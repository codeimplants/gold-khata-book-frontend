import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Bottom padding for a sheet anchored to the bottom of the screen.
 *
 * `android/gradle.properties` sets `edgeToEdgeEnabled=true` (required for Android
 * 15+), so the app draws *behind* the system navigation bar. A sheet with a fixed
 * bottom padding therefore renders its last row underneath the three-button nav
 * bar on the phones that have one — the control is visible but unreachable, which
 * is how "Choose Photo" and a Cancel button ended up half-hidden on a real device.
 *
 * The inset is the fix rather than a per-platform constant, because it is the only
 * thing that answers all three cases with one number:
 *   - three-button navigation: ~48dp, and the sheet lifts clear of it
 *   - gesture navigation: ~0-24dp, so the sheet keeps the padding it had
 *   - iOS home indicator: 34dp, the value that used to be hardcoded
 *
 * Safe to call inside a React Native `Modal`: the provider is above these screens
 * in the React tree, and context crosses the Modal boundary even though the native
 * view hierarchy does not. `DeclarationDetailsModal` has relied on this for a while.
 *
 * @param min Padding to keep when there is no inset to clear, e.g. gesture nav.
 */
export const useSheetBottomInset = (min = 20): number => {
  const insets = useSafeAreaInsets();
  return Math.max(insets.bottom, min);
};
