// Web stub — see react-native-ble-plx.js. Only the thermal (native) print path
// captures a receipt to an image; the web build prints HTML directly.
export const captureRef = () =>
  Promise.reject(new Error('View capture is not available on web'));

export default { captureRef };
