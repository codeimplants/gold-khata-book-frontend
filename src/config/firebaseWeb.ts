/**
 * Firebase Web app config for project `goldkhatabook` — used ONLY by the
 * react-native-web build (src/mocks/firebase.js), since @react-native-firebase
 * is native-bridge-only and cannot run in a browser. Native builds get their
 * config from android/app/google-services.json and ios/GoldKhataBook/GoogleService-
 * Info.plist instead; this file has no effect on them.
 *
 * These values are Gold Khata Book's own. They are deliberately NOT SoneBill's:
 * reusing those would file this app's analytics into SoneBill's GA4 property and
 * mix two products' data.
 *
 * Not secret — a Firebase web config is meant to ship inside the public JS
 * bundle (the same way any web app's Firebase config does); access control is
 * enforced server-side by Firebase Security Rules / GA4's own data model, not
 * by hiding this object.
 *
 * Registered in the Firebase console as the 'Gold Khata Book Web' app under
 * project `goldkhatabook` (project number 954294037063).
 *
 * measurementId is the GA4 property this app reports to. It only exists because
 * a Google Analytics property was linked to the project — creating a Firebase
 * project via the CLI does not link one, and until it was, this key was absent
 * and web analytics silently collected nothing. If you ever see it missing
 * again, that is what it means; do not invent a value.
 */
export const FIREBASE_WEB_CONFIG = {
  apiKey: 'AIzaSyBqKaIZ4MSPzA7ru0UiczNCn9xOzm92A_Y',
  authDomain: 'goldkhatabook.firebaseapp.com',
  projectId: 'goldkhatabook',
  storageBucket: 'goldkhatabook.firebasestorage.app',
  messagingSenderId: '954294037063',
  appId: '1:954294037063:web:81be88409f38a2e01fdf62',
  measurementId: 'G-XVMP6B2NJX',
};
