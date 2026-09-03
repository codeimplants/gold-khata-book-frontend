// Web stub. Thermal printing is a native-only feature, but the print path is shared
// with the web build, so this module gets imported there and must not blow up on load.
// Nothing here is ever reached: bleTransport.isSupported() is false on web.
export class BleManager {
  startDeviceScan() {}
  stopDeviceScan() {}
  connectToDevice() {
    return Promise.reject(new Error('Bluetooth is not available on web'));
  }
}

export const BleErrorCode = {
  BluetoothPoweredOff: 102,
  BluetoothUnsupported: 100,
  BluetoothResetting: 103,
  BluetoothUnauthorized: 101,
};

export const ConnectionPriority = { Balanced: 0, High: 1, LowPower: 2 };

export default { BleManager, BleErrorCode, ConnectionPriority };
