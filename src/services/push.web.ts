/**
 * Web build stub for push notifications.
 *
 * react-native-onesignal is native-only: its entry module calls
 * TurboModuleRegistry.getEnforcing('OneSignal') at import time, which throws
 * synchronously outside a native RN runtime. That crashed the whole web
 * bundle before React could mount (blank page, no login screen) — the crash
 * happens on `import`, so no Platform.OS check inside push.ts can prevent it.
 *
 * React Native's bundler prefers a `.web.ts` file over the base `.ts` file
 * when building for web, so this file is used instead there and the native
 * package is never imported on web at all. Push notifications are a
 * mobile-only feature; these are safe no-ops.
 */

export const initPush = (): void => {};

export const requestPermission = async (): Promise<boolean> => false;

export const hasPermission = (): boolean => false;

export const setPushUser = (_userId: string): void => {};

export const clearPushUser = (): void => {};
