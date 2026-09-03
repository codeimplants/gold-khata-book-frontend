// Web stub — see react-native-ble-plx.js. Browsers cannot open raw TCP sockets, so a
// WiFi printer is unreachable from the web build by definition.
export default {
  createConnection() {
    throw new Error('TCP sockets are not available on web');
  },
};
