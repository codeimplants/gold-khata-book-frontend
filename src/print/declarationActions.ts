import { toast } from '../components/common/Toast';
import { printDeclaration, shareDeclaration, downloadDeclaration } from './declarationService';
import type { PurchaseOldGold } from '../types';
import type { MobileLang } from './templates/shared';

/**
 * Print / Share / Download for a saved declaration, with the failure handling
 * attached.
 *
 * Six screens offer these same three buttons — the invoice flow, the advance
 * order success screen, the old-gold form, both declaration blocks on the order
 * detail screen, and the Sold to Us detail screen. Each had its own copy of the
 * same try/catch, and they had drifted exactly as copies do: one of the six
 * called `t('declaration.printFailed')` and the other five had the English
 * string typed in, so a shop running the app in Marathi got an English error
 * from five of the six buttons and a Marathi one from the sixth.
 *
 * The language argument is the one thing callers genuinely differ on, and it is
 * always the same rule — the language the customer signed under, falling back to
 * the reader's setting for records saved before that was recorded. `resolveLang`
 * applies it so no caller has to remember.
 */

type Translate = (key: string) => string;

/**
 * The language a declaration prints in.
 *
 * The document's own, not the reader's: a shopkeeper running the app in English
 * routinely buys gold from a customer who only reads Marathi, and a reprint
 * months later — possibly after the shop switched app language — has to come out
 * in the language on the signed page. Records saved before the field was
 * recorded fall back to the reader's setting, which is what they did before.
 */
export const resolveLang = (
  declaration: Pick<PurchaseOldGold, 'language'>,
  fallback: string,
): MobileLang => (declaration.language ?? fallback) as MobileLang;

/**
 * A blocked browser pop-up, which is the web build's most common print failure
 * and the only one the user can fix themselves.
 *
 * Matched by name rather than `instanceof`: importing the class from
 * printService would pull the whole native print stack into every screen that
 * only wants to show a message.
 */
const isPopupBlocked = (error: unknown): boolean =>
  (error as any)?.name === 'PrintPopupBlockedError';

/** The message to show for a failed declaration action. */
const failureMessage = (error: unknown, t: Translate, fallbackKey: string): string => {
  if (isPopupBlocked(error)) {
    return t('printerChoice.popupBlockedBody') || 'Your browser blocked the print window.';
  }
  return t(fallbackKey) || 'Could not print the declaration';
};

export const printDeclarationAction = async (
  declaration: PurchaseOldGold,
  shopDetails: any,
  fallbackLang: string,
  t: Translate,
): Promise<void> => {
  try {
    await printDeclaration(declaration, shopDetails, resolveLang(declaration, fallbackLang));
  } catch (err) {
    // The reason reaches the log even though the toast stays plain — without
    // this a report of "print error" carries nothing to act on.
    console.warn('[declaration] print failed:', err);
    toast.error(failureMessage(err, t, 'declaration.printFailed'));
  }
};

export const shareDeclarationAction = async (
  declaration: PurchaseOldGold,
  shopDetails: any,
  fallbackLang: string,
  t: Translate,
): Promise<void> => {
  try {
    const ok = await shareDeclaration(
      declaration,
      shopDetails,
      resolveLang(declaration, fallbackLang),
    );
    // `false` means the PDF was never produced — distinct from the user simply
    // dismissing the share sheet, which resolves true.
    if (!ok) toast.error(t('declaration.printFailed') || 'Could not generate the declaration');
  } catch (err) {
    console.warn('[declaration] share failed:', err);
    toast.error(failureMessage(err, t, 'declaration.printFailed'));
  }
};

export const downloadDeclarationAction = async (
  declaration: PurchaseOldGold,
  shopDetails: any,
  fallbackLang: string,
  t: Translate,
): Promise<void> => {
  try {
    const ok = await downloadDeclaration(
      declaration,
      shopDetails,
      resolveLang(declaration, fallbackLang),
    );
    if (!ok) toast.error(t('orders.details.pdfGenerateFailed') || 'Failed to generate PDF');
  } catch (err) {
    console.warn('[declaration] download failed:', err);
    toast.error(
      t('orders.details.pdfGenerateError') || 'An error occurred while generating the PDF',
    );
  }
};
