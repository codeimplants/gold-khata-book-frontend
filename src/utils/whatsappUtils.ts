import { Linking, Platform } from 'react-native';

/**
 * Extra context that lets the web variant of this module (whatsappUtils.web.ts)
 * attempt a best-effort file attach via the Web Share API. Ignored on native,
 * which already attaches the real invoice PDF through a separate path
 * (Share.shareSingle in CreateInvoiceScreen.tsx).
 */
export interface WhatsAppShareOptions {
  html?: string;
  fileName?: string;
}

/**
 * Normalizes a phone number for wa.me / whatsapp:// links: strips
 * non-digits and prepends the India country code (91) to bare 10-digit
 * numbers. Numbers that already include a country code (or are otherwise
 * not 10 digits) are passed through as-is.
 */
export const formatWhatsAppPhone = (phone?: string | null): string => {
  const digits = (phone || '').replace(/\D/g, '');
  return digits.length === 10 ? `91${digits}` : digits;
};

/**
 * Builds a universal https://wa.me link. This works everywhere (native
 * browsers, desktop browsers, RN Web) and is what Windows/macOS resolve to
 * the WhatsApp desktop app when one is installed and registered as the
 * handler for wa.me links. Omitting the phone opens WhatsApp's contact
 * picker with the message prefilled instead of a specific chat.
 */
export const buildWhatsAppUrl = (phone: string | undefined | null, message: string): string => {
  const formatted = formatWhatsAppPhone(phone);
  const encoded = encodeURIComponent(message);
  return formatted ? `https://wa.me/${formatted}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
};

/**
 * Opens WhatsApp with a prefilled message.
 *
 * On native (Android/iOS) this tries the `whatsapp://` app scheme first,
 * which opens the app directly, falling back to the wa.me link.
 *
 * On web (react-native-web) `Linking.canOpenURL` always resolves `true`
 * regardless of the URL, so the app-scheme check is meaningless there —
 * always use the universal wa.me link instead, letting the OS/browser
 * hand off to the WhatsApp desktop app if one is registered for it.
 */
export const openWhatsApp = async (
  phone: string | undefined | null,
  message: string,
  _options?: WhatsAppShareOptions,
): Promise<void> => {
  const waUrl = buildWhatsAppUrl(phone, message);

  if (Platform.OS === 'web') {
    await Linking.openURL(waUrl);
    return;
  }

  const formatted = formatWhatsAppPhone(phone);
  const encoded = encodeURIComponent(message);
  const appUrl = formatted
    ? `whatsapp://send?phone=${formatted}&text=${encoded}`
    : `whatsapp://send?text=${encoded}`;

  try {
    const supported = await Linking.canOpenURL(appUrl);
    if (supported) {
      await Linking.openURL(appUrl);
      return;
    }
  } catch {
    // fall through to the wa.me link below
  }

  await Linking.openURL(waUrl);
};
