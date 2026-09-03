import { Linking } from 'react-native';
import { buildInvoiceA4PdfFile, triggerFileDownload } from './invoicePdfWeb';

/**
 * Extra context that lets this web variant attempt a best-effort file
 * attach via the Web Share API before falling back to a text-only wa.me
 * link.
 */
export interface WhatsAppShareOptions {
  html?: string;
  fileName?: string;
}

/**
 * Normalizes a phone number for wa.me links: strips non-digits and
 * prepends the India country code (91) to bare 10-digit numbers. Numbers
 * that already include a country code (or are otherwise not 10 digits)
 * are passed through as-is.
 */
export const formatWhatsAppPhone = (phone?: string | null): string => {
  const digits = (phone || '').replace(/\D/g, '');
  return digits.length === 10 ? `91${digits}` : digits;
};

/**
 * Builds a universal https://wa.me link. Windows/macOS resolve this to the
 * WhatsApp desktop app when one is installed and registered as its handler.
 * Omitting the phone opens WhatsApp's contact picker with the message
 * prefilled instead of a specific chat.
 */
export const buildWhatsAppUrl = (phone: string | undefined | null, message: string): string => {
  const formatted = formatWhatsAppPhone(phone);
  const encoded = encodeURIComponent(message);
  return formatted ? `https://wa.me/${formatted}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
};

/**
 * Attempts to share a file via the Web Share API. Returns true if the
 * share sheet was successfully invoked (regardless of what the user does
 * once it's open), false if file sharing isn't supported here at all.
 * A user-cancel (AbortError) is treated as "handled" — callers must not
 * fall back to another share method in that case.
 */
const tryShareFile = async (file: File, text: string, title: string): Promise<boolean> => {
  const nav = navigator as Navigator & {
    canShare?: (data?: ShareData) => boolean;
    share?: (data?: ShareData) => Promise<void>;
  };

  if (!nav.share || !nav.canShare || !nav.canShare({ files: [file] })) {
    return false;
  }

  try {
    await nav.share({ files: [file], text, title });
    return true;
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      // User dismissed the share sheet — handled, don't also open wa.me.
      return true;
    }
    // Unexpected failure generating/sharing the file — let the caller fall
    // back to the text-only wa.me link.
    return false;
  }
};

/**
 * Opens WhatsApp with a prefilled message and, when bill HTML is provided,
 * best-effort delivers the invoice PDF:
 *  - Phones / browsers that support the Web Share API with files hand the
 *    portrait-A4 PDF straight to the native share sheet (which can include
 *    WhatsApp) — done.
 *  - Desktop browsers can't attach files to WhatsApp, so we save the PDF to
 *    the user's Downloads and then open WhatsApp with the prefilled text for
 *    them to drag the file into.
 *  - No HTML (e.g. advance-order text share) → just open the wa.me text link.
 */
export const openWhatsApp = async (
  phone: string | undefined | null,
  message: string,
  options?: WhatsAppShareOptions,
): Promise<void> => {
  if (options?.html) {
    const fileName = options.fileName || 'invoice';
    try {
      const file = await buildInvoiceA4PdfFile(options.html, fileName);
      const shared = await tryShareFile(file, message, 'Invoice');
      if (shared) return;
      // Desktop / no file-share support: save the built PDF, then fall through
      // to open WhatsApp with the text. (Reuses the already-built File so we
      // don't rasterize the invoice twice.)
      triggerFileDownload(file, fileName);
    } catch (err) {
      console.warn('[openWhatsApp] file share/download failed, falling back to text-only:', err);
    }
  }

  await Linking.openURL(buildWhatsAppUrl(phone, message));
};
