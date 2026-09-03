import { useTranslation } from '../../hooks/useTranslation';
import type { LegalSection } from './LegalDocumentView';

export type LegalDocId = 'privacy' | 'terms' | 'accountDeletion';

const FALLBACK_TITLES: Record<LegalDocId, string> = {
  privacy: 'Privacy Policy',
  terms: 'Terms & Conditions',
  accountDeletion: 'Account & Data Deletion',
};

const FALLBACK_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/**
 * The month stamped on every legal document.
 *
 * Left null, the stamp tracks the current month, so it never goes stale. Note
 * that this means it advances on its own: a reader comparing two visits sees
 * the date move even though the wording did not. If you would rather it name
 * the month the text was actually last revised — which is what the field is
 * conventionally taken to mean — pin it here, e.g.
 *
 *   export const LEGAL_LAST_UPDATED = { month: 6, year: 2026 }; // July 2026
 *
 * `month` is 0-based, matching Date.getMonth().
 */
export const LEGAL_LAST_UPDATED: { month: number; year: number } | null = null;

/**
 * Reads one legal document out of the active locale.
 *
 * `t()` falls back to English and then returns undefined (see LanguageProvider),
 * so a miss is caught with `??` rather than by comparing the result against the
 * key it was asked for. The array reads stay defended with `Array.isArray`
 * because a locale could define the key as the wrong shape, which no fallback
 * would catch. These documents are the app's public face on the store listings,
 * so a half-translated locale must degrade to English, never to a blank page.
 */
export const useLegalDocument = (id: LegalDocId) => {
  const { t } = useTranslation();

  const rawSections = t<LegalSection[] | string>(`${id}.sections`);
  const sections = Array.isArray(rawSections) ? rawSections : [];

  const title = t<string>(`${id}.title`);

  // Reuses the month names the date picker already maintains in every locale,
  // rather than adding a second list that could drift out of sync.
  const rawMonths = t<string[] | string>('invoice.calendar.months');
  const months = Array.isArray(rawMonths) ? rawMonths : FALLBACK_MONTHS;

  const now = new Date();
  const stamp = LEGAL_LAST_UPDATED ?? {
    month: now.getMonth(),
    year: now.getFullYear(),
  };

  const label = t<string>(`${id}.lastUpdated`);
  const month = months[stamp.month] ?? FALLBACK_MONTHS[stamp.month];
  const lastUpdated = label ? `${label}: ${month} ${stamp.year}` : undefined;

  return {
    title: title ?? FALLBACK_TITLES[id],
    sections,
    lastUpdated,
  };
};
