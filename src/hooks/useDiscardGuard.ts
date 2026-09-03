import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigation } from '@react-navigation/native';

/**
 * Asks before a half-filled creation form is thrown away.
 *
 * Hooks `beforeRemove` rather than the header's back button alone: the same
 * confirmation then also covers the Android hardware back button and the iOS
 * swipe-back gesture, which would otherwise drop a filled-in invoice silently.
 *
 * Only for screens that *create* something. A read-only order/bill screen has
 * nothing to lose and must not prompt.
 *
 * ```ts
 * const guard = useDiscardGuard(items.length > 0);
 * // …on a successful save, leave without asking:
 * guard.allowNextNavigation();
 * navigation.replace('Success');
 * ```
 */
export const useDiscardGuard = (isDirty: boolean) => {
    const navigation = useNavigation<any>();
    const [promptVisible, setPromptVisible] = useState(false);

    /**
     * Lets a navigation we triggered ourselves (a completed save) straight
     * through. A ref rather than state because the guard reads it in the same
     * tick the navigation is dispatched, before a re-render could deliver a
     * new value.
     */
    const bypass = useRef(false);
    const pendingAction = useRef<any>(null);

    useEffect(() => {
        const unsubscribe = navigation.addListener('beforeRemove', (e: any) => {
            if (!isDirty || bypass.current) return;
            e.preventDefault();
            pendingAction.current = e.data?.action;
            setPromptVisible(true);
        });
        return unsubscribe;
    }, [navigation, isDirty]);

    /** Stops the guard firing on the next navigation — call before saving-and-leaving. */
    const allowNextNavigation = useCallback(() => {
        bypass.current = true;
    }, []);

    /**
     * Completes whatever navigation the prompt interrupted. Replays the
     * original action when there was one — a hardware back or a swipe may have
     * been heading somewhere other than the previous screen, and goBack() would
     * send the shopkeeper to the wrong place.
     */
    const confirmDiscard = useCallback(() => {
        setPromptVisible(false);
        bypass.current = true;
        const action = pendingAction.current;
        pendingAction.current = null;
        if (action) {
            navigation.dispatch(action);
        } else {
            navigation.goBack();
        }
    }, [navigation]);

    const cancelDiscard = useCallback(() => {
        pendingAction.current = null;
        setPromptVisible(false);
    }, []);

    return { promptVisible, confirmDiscard, cancelDiscard, allowNextNavigation };
};

export default useDiscardGuard;
