// Web-only shim for @react-native-firebase/app and @react-native-firebase/analytics
// (aliased in webpack.config.js) — RNFB is native-bridge-only and cannot run in
// a browser at all. This used to be a true no-op ({ initializeApp: () => {},
// analytics: () => ({ logEvent: () => {} }) }), which meant the web build
// silently collected ZERO Firebase data despite @codeimplants/analytics's
// GA4Adapter running "successfully" (its errors are always swallowed, by
// design, so a broken shim here never surfaced as a crash — see
// node_modules/@codeimplants/analytics/dist/index.js).
//
// Real implementation now, backed by the Firebase JS SDK. GA4Adapter (from
// the published, unmodified @codeimplants/analytics package) imports this
// module's default export and calls it AS A FUNCTION —
// `import analytics from '@react-native-firebase/analytics'; analytics()` —
// matching RNFB's own "namespaced" API shape (see
// node_modules/@react-native-firebase/analytics/lib/namespaced.ts). This shim
// mimics that exact calling convention so GA4Adapter needs no changes.
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
    getAnalytics,
    isSupported,
    logEvent as fbLogEvent,
    setUserId as fbSetUserId,
    setUserProperties,
    setAnalyticsCollectionEnabled as fbSetAnalyticsCollectionEnabled,
} from 'firebase/analytics';
import { FIREBASE_WEB_CONFIG } from '../config/firebaseWeb';

function ensureApp() {
    return getApps().length ? getApp() : initializeApp(FIREBASE_WEB_CONFIG);
}

let analyticsPromise = null;

/** GA4 requires an async support check in the browser (e.g. cookies/IndexedDB blocked). */
function ensureAnalytics() {
    if (!analyticsPromise) {
        analyticsPromise = isSupported()
            .then((supported) => (supported ? getAnalytics(ensureApp()) : null))
            .catch(() => null);
    }
    return analyticsPromise;
}

function analytics() {
    return {
        setAnalyticsCollectionEnabled: async (enabled) => {
            const instance = await ensureAnalytics();
            if (instance) fbSetAnalyticsCollectionEnabled(instance, Boolean(enabled));
        },
        setUserProperty: async (name, value) => {
            const instance = await ensureAnalytics();
            if (instance) setUserProperties(instance, { [name]: value });
        },
        logEvent: async (name, params) => {
            const instance = await ensureAnalytics();
            if (instance) fbLogEvent(instance, name, params);
        },
        logScreenView: async (params) => {
            const instance = await ensureAnalytics();
            if (instance) fbLogEvent(instance, 'screen_view', params);
        },
        setUserId: async (id) => {
            const instance = await ensureAnalytics();
            if (instance) fbSetUserId(instance, id ?? null);
        },
    };
}

// @react-native-firebase/app's default export also needs an initializeApp
// method, in case anything imports it directly (GA4Adapter doesn't, but keep
// this alias usable for that package too, per webpack.config.js).
analytics.initializeApp = () => ensureApp();

export default analytics;
