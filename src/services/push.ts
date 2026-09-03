/**
 * Push notifications — not implemented yet.
 *
 * react-native-onesignal was added, then removed before it ever did anything.
 * It was inert the whole time (ONESIGNAL_APP_ID has never been set, because the
 * OneSignal app and App ID do not exist yet), and it was not free:
 *
 *   - Apple returned ITMS-90683 on 1.0.11 build 4. The SDK pulls in
 *     OneSignalXCFramework/OneSignalLocation, so the binary references
 *     CoreLocation and Apple then requires NSLocationWhenInUseUsageDescription
 *     — a purpose string for a permission this app never requests. Adding one
 *     would be the same defect that got Sone Taran rejected under Guideline
 *     5.1.1(ii): a purpose string that does not describe real functionality.
 *   - It added roughly 2MB to the .ipa.
 *
 * These no-ops keep the call sites in App.tsx intact so re-adding the SDK is a
 * single npm install plus restoring the bodies here. The identity design that
 * belongs in setPushUser/clearPushUser is worth preserving, so it is recorded
 * rather than deleted:
 *
 *   Identity should use OneSignal's External ID, not stored device tokens —
 *   OneSignal.login(<JWT sub>), the same opaque id analytics uses. OneSignal
 *   owns the device mapping, so multiple devices per shopkeeper work with no
 *   token lifecycle and no backend schema change.
 *
 *   Two rules that are about data leaking between accounts, not tidiness:
 *   never bind while impersonating (the admin's device would receive that
 *   shop's outstanding balances, and keep receiving them afterwards), and
 *   always clear on logout (on a shared phone the next user inherits the
 *   previous shop's reminders).
 *
 *   Permission must not be requested at startup: iOS shows that prompt once per
 *   install and a decline is permanent short of the Settings app.
 *
 * When re-adding, exclude the OneSignalLocation subspec or the ITMS-90683
 * warning returns.
 *
 * Mirrors push.web.ts, which stubs the same surface for web builds.
 */

export const initPush = (): void => {};

export const requestPermission = async (): Promise<boolean> => false;

export const hasPermission = (): boolean => false;

export const setPushUser = (_userId: string): void => {};

export const clearPushUser = (): void => {};
