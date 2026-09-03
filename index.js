/**
 * @format
 */

import 'react-native-reanimated';
import { AppRegistry } from 'react-native';
import { enableScreens } from 'react-native-screens';

// Global override to strip trailing zeroes from toFixed as requested across the app
const originalToFixed = Number.prototype.toFixed;
Number.prototype.toFixed = function(fractionDigits) {
  const formatted = originalToFixed.call(this, fractionDigits);
  return formatted.replace(/(\.\d*?[1-9])0+$|\.0+$/, '$1');
};

import App from './App';
import { name as appName } from './app.json';

enableScreens();
AppRegistry.registerComponent(appName, () => App);
