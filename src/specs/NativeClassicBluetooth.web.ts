// Web build resolves this in place of NativeClassicBluetooth.ts (webpack prefers
// `.web.ts`). The real spec calls TurboModuleRegistry.get(), and react-native-web has
// no TurboModuleRegistry — importing it would crash the bundle on load.
//
// It cannot simply be guarded in the shared file: RN's codegen parser matches on the
// literal `TurboModuleRegistry.get<Spec>('Name')` call and fails the Android build with
// "Unused NativeModule spec" if it is written any other way.
//
// Null is the same value the module has on iOS, and every caller already null-checks,
// so the print path degrades to its non-native behaviour rather than breaking.
export default null;
