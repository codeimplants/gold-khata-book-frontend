const { getDefaultConfig } = require('expo/metro-config');
// mergeConfig only: expo/metro-config does not export it, and destructuring it
// from there left it undefined, so Metro died on startup with "mergeConfig is
// not a function" and the app booted to a blank screen.
const { mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://docs.expo.dev/guides/customizing-metro/
 *
 * This app's native entry point is ExpoReactHostFactory (see
 * MainApplication.kt), which loads the JS bundle from Expo's virtual
 * entry module `.expo/.virtual-metro-entry`. That module is registered
 * by expo/metro-config, so the default config must come from Expo
 * rather than @react-native/metro-config -- otherwise the dev server
 * 404s on the entry bundle.
 *
 * @type {import('expo/metro-config').MetroConfig}
 */
const config = {};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
