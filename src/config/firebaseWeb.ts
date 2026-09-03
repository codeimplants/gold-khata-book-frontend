/**
 * TODO(gold-khata-book): every value below is a PLACEHOLDER.
 *
 * Forked from SoneBill. The real values were SoneBill's Firebase project and
 * were removed rather than inherited — reusing them would file this app's
 * analytics into SoneBill's GA4 property and mix two products' data. Create a
 * Gold Khata Book Firebase project, register an Android app
 * (com.goldkhatabook.app), an iOS app (com.goldkhatabook.app) and a Web app,
 * then replace this object, android/app/google-services.json and
 * ios/GoldKhataBook/GoogleService-Info.plist with the generated configs — and
 * flip ANALYTICS_ENABLED back to true in src/config/environments/*.ts.
 *
 * Firebase Web app config for project PLACEHOLDER-firebase-project — used ONLY by the
 * react-native-web build (src/mocks/firebase.js), since @react-native-firebase
 * is native-bridge-only and cannot run in a browser. Native builds get their
 * config from android/app/google-services.json and ios/GoldKhataBook/GoogleService-
 * Info.plist instead; this file has no effect on them.
 *
 * Not secret — a Firebase web config is meant to ship inside the public JS
 * bundle (the same way any web app's Firebase config does); access control is
 * enforced server-side by Firebase Security Rules / GA4's own data model, not
 * by hiding this object.
 *
 * Registered in Firebase Console as the "Gold Khata Book Web" app under
 * PLACEHOLDER-firebase-project.
 */
export const FIREBASE_WEB_CONFIG = {
  apiKey: 'REPLACE_WITH_GOLD_KHATA_BOOK_WEB_API_KEY',
  authDomain: 'PLACEHOLDER-firebase-project.firebaseapp.com',
  projectId: 'PLACEHOLDER-firebase-project',
  storageBucket: 'PLACEHOLDER-firebase-project.firebasestorage.app',
  messagingSenderId: '000000000000',
  appId: '1:000000000000:web:0000000000000000000000',
  measurementId: 'G-XXXXXXXXXX',
};
