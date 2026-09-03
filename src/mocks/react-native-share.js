/**
 * Web stand-in for react-native-share (aliased in webpack.config.js).
 *
 * The real module is native-only; importing it into the web bundle is what
 * blanks the page at runtime. Callers are expected to branch on
 * Platform.OS === 'web' before reaching any of this, so these are no-ops that
 * exist to keep the module resolvable — but they cover the whole surface the
 * app calls rather than just `open`, so a missed platform guard degrades to
 * "nothing happened" instead of "undefined is not a function" taking the
 * screen down.
 */
const noop = () => Promise.resolve();

export default {
  open: noop,
  shareSingle: noop,
  Social: {
    WHATSAPP: 'whatsapp',
    WHATSAPPBUSINESS: 'whatsappbusiness',
    EMAIL: 'email',
    TELEGRAM: 'telegram',
  },
};
