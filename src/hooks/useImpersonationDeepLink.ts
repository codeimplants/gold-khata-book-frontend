import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { useAppDispatch, useAppSelector } from '../store/hooks';
import { startImpersonation } from '../store/auth/authSlice';
import { clearUserData } from '../store/data/dataSlice';
import { adminService } from '../services/authService';
import { toast } from '../components/common/Toast';

export const IMPERSONATE_PARAM = 'impersonate';

/**
 * Opens a shop straight from Nexus: `?impersonate=<dukandarId>` on the web build.
 *
 * Nexus can show every number about a shop but it cannot show the shop what it
 * sees — that needs the actual app, which is what this hands over to. The link
 * carries only an id: no token, ever. The admin session is whatever the browser
 * already has, so a stale link in someone's history is worth nothing on its own,
 * and the year-long admin JWT never touches a URL, a referrer header or a
 * server log.
 *
 * Waits for a logged-in admin rather than acting immediately, so following the
 * link while signed out lands on the OTP screen and resumes by itself once
 * that completes — the param stays in the URL until it is either used or
 * refused.
 */
export function useImpersonationDeepLink() {
    const dispatch = useAppDispatch();
    const { hydrated, isLoggedIn, userType, impersonateUserId } = useAppSelector(s => s.auth);
    // One attempt per load. Without this the effect re-runs on every auth change
    // and could fire a second lookup while the first is still in flight.
    const handled = useRef(false);

    useEffect(() => {
        if (Platform.OS !== 'web' || handled.current) return;
        if (!hydrated) return;

        const params = new URLSearchParams(window.location.search);
        const targetId = params.get(IMPERSONATE_PARAM);
        if (!targetId) return;

        // Already inside a session — most likely a refresh after the param was
        // consumed but before the URL was cleaned. Leave it alone.
        if (impersonateUserId) {
            handled.current = true;
            stripParam();
            return;
        }

        // Not signed in yet: keep the param and wait. The effect re-runs when
        // auth state changes, so finishing the OTP flow resumes this.
        if (!isLoggedIn) return;

        handled.current = true;

        if (userType !== 'admin') {
            // A shopkeeper following an admin link. Say nothing about what the
            // link was for; just drop it.
            stripParam();
            return;
        }

        void (async () => {
            try {
                // The shop list is the lookup AND the check: an id that is not in
                // it is either deleted or not a shop, and either way must not
                // start a session. It also carries the phone, which the
                // impersonation banner shows.
                const res = await adminService.listUsersWithStats();
                const match = (res.data ?? []).find(u => String(u._id) === targetId);

                if (!match) {
                    toast.error('That shop no longer exists.');
                    return;
                }

                dispatch(clearUserData());
                dispatch(startImpersonation({
                    userId: String(match._id),
                    phone: String(match.phone),
                }));
            } catch {
                toast.error('Could not open that shop. Try again from Nexus.');
            } finally {
                // Cleared either way: a failed link should not retry forever on
                // every reload, and a successful one must not restart the session
                // if the admin later refreshes the page.
                stripParam();
            }
        })();
    }, [hydrated, isLoggedIn, userType, impersonateUserId, dispatch]);
}

/** Drops the param without a navigation, so no history entry is added. */
function stripParam() {
    if (Platform.OS !== 'web') return;
    const url = new URL(window.location.href);
    url.searchParams.delete(IMPERSONATE_PARAM);
    window.history.replaceState({}, '', url.toString());
}
