/**
 * Title-cases free text: upper-cases the first letter of every
 * whitespace-separated word while preserving the rest of each word and the
 * user's original spacing (so mid-typing edits aren't clobbered).
 *
 * Intended for name/description style inputs (shop name, customer name, item
 * name, address, etc). Do NOT use on structured fields such as email, phone,
 * GST number, HUID, website/URL or OTP — those have their own casing rules.
 *
 * Examples:
 *   capitalizeWords('gold ring')     -> 'Gold Ring'
 *   capitalizeWords('ramesh  kumar') -> 'Ramesh  Kumar'
 */
export const capitalizeWords = (text: string): string => {
  if (!text) return text;
  return text.replace(/(^|\s)(\S)/g, (_m, sep, ch) => sep + ch.toUpperCase());
};
