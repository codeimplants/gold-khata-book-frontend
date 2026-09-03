import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, Platform } from 'react-native';
import * as Contacts from 'expo-contacts';

export interface PickedContact {
  name: string;
  /** Digits only, last 10 — the shape customer phone numbers are stored in. */
  phone: string;
}

/** One phone-book row, flattened to the four fields the list actually draws. */
export interface ContactRow extends PickedContact {
  id: string;
  /** The number as the phone book formats it, for display under the name. */
  display: string;
  /** Lowercased name plus digits, precomputed so filtering is one includes(). */
  search: string;
}

export type ContactsStatus =
  /** Reading the current permission — the first frame, and very brief. */
  | 'checking'
  /** Not granted yet. Explain why we want it before raising the OS dialog. */
  | 'primer'
  | 'loading'
  | 'ready'
  | 'denied'
  | 'error';

/** Digits only, last 10 — matches how customers are stored and compared. */
export const normalizePhone = (raw: string): string => raw.replace(/\D/g, '').slice(-10);

/**
 * The device phone book, as a flat list ready to render.
 *
 * Two things made the previous version unusable, and neither was the size of
 * the phone book.
 *
 * The first was `react-native-contacts`, which on iOS answered `checkPermission`
 * with a status it had never actually obtained and then never settled
 * `requestPermission` at all — so a fresh install sat on a spinner forever and
 * the OS dialog was never raised. Confirmed on a real iPhone, not just the
 * simulator: Settings showed no Contacts row for the app, which only happens
 * when the request never reaches iOS. 8.0.10 was already the newest release,
 * so there was nothing to upgrade to. `expo-contacts` asks properly.
 *
 * The second was cost per contact. We now ask for only the two fields the list
 * draws — asking for everything pulls thumbnail image data for every entry —
 * and immediately flatten each record into a small plain object, so React holds
 * 2000 tiny objects rather than 2000 native ones. The lowercased search key is
 * built once here instead of on every keystroke.
 */
export const usePhoneContacts = () => {
  const [status, setStatus] = useState<ContactsStatus>('checking');
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  /**
   * iOS 18 lets the user grant a hand-picked subset instead of the whole book.
   * The list then legitimately shows only a few people, which looks like a bug
   * unless we say so — and offer the OS sheet to widen it.
   */
  const [limited, setLimited] = useState(false);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const { data } = await Contacts.getContactsAsync({
        // Only what the row draws. Omitting this pulls every field, including
        // image data for every contact, which is what made 2000 entries crawl.
        fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers],
        sort: Contacts.SortTypes.FirstName,
      });

      const rows: ContactRow[] = [];
      for (const c of data) {
        const numbers = c.phoneNumbers ?? [];
        if (numbers.length === 0) continue;

        // A contact can carry several numbers; prefer the one the phone book
        // marks primary and fall back to the first, same as before.
        const chosen = numbers.find(n => n.isPrimary) ?? numbers[0];
        const raw = chosen?.number ?? '';
        const phone = normalizePhone(raw);
        if (!phone) continue;

        const name = (c.name ?? '').trim();
        rows.push({
          id: c.id ?? `${name}-${phone}`,
          name,
          phone,
          display: raw,
          search: `${name.toLowerCase()} ${phone}`,
        });
      }

      setContacts(rows);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, []);

  /** Raise the OS permission dialog, then load if it was granted. */
  const request = useCallback(async () => {
    try {
      const { granted, canAskAgain, accessPrivileges } = await Contacts.requestPermissionsAsync();
      if (granted) {
        setLimited(accessPrivileges === 'limited');
        await load();
        return;
      }
      // canAskAgain is false once the OS will no longer show the dialog, which
      // is the only case where Settings is genuinely the only way back.
      setStatus(canAskAgain && Platform.OS === 'android' ? 'primer' : 'denied');
    } catch {
      setStatus('error');
    }
  }, [load]);

  // Resolve the starting state once the step mounts.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { granted, accessPrivileges } = await Contacts.getPermissionsAsync();
        if (cancelled) return;
        if (granted) {
          setLimited(accessPrivileges === 'limited');
          await load();
        } else {
          setStatus('primer');
        }
      } catch {
        if (!cancelled) setStatus('primer');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  // If the user leaves for Settings to flip the permission on, pick it up when
  // they come back so they land in the list rather than on the denied screen.
  const statusRef = useRef(status);
  statusRef.current = status;
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state !== 'active' || statusRef.current !== 'denied') return;
      Contacts.getPermissionsAsync()
        .then(({ granted }) => {
          if (granted) void load();
        })
        .catch(() => {});
    });
    return () => sub.remove();
  }, [load]);

  /**
   * The OS's own picker, used only as the way out of a hard denial on iOS.
   * It runs out of process and returns a single contact, so it needs no
   * permission at all — the one route to contacts left once ours is refused.
   */
  const pickViaSystem = useCallback(async (): Promise<PickedContact | null> => {
    try {
      const contact = await Contacts.presentContactPickerAsync();
      if (!contact) return null;
      const numbers = contact.phoneNumbers ?? [];
      const chosen = numbers.find(n => n.isPrimary) ?? numbers[0];
      return {
        name: (contact.name ?? '').trim(),
        phone: normalizePhone(chosen?.number ?? ''),
      };
    } catch {
      return null;
    }
  }, []);

  /** iOS 18 only: reopen the OS sheet so more contacts can be shared with us. */
  const expandAccess = useCallback(async () => {
    try {
      await Contacts.presentAccessPickerAsync();
      const { accessPrivileges } = await Contacts.getPermissionsAsync();
      setLimited(accessPrivileges === 'limited');
      await load();
    } catch {
      // Rejects outright below iOS 18; nothing to widen there.
    }
  }, [load]);

  const openSettings = useCallback(() => {
    void Linking.openSettings();
  }, []);

  return { status, contacts, limited, request, retry: load, expandAccess, openSettings, pickViaSystem };
};
