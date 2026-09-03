// BLE transport for ESC/POS thermal receipt printers. Deliberately printer-agnostic:
// rather than hardcoding a guessed service/characteristic UUID for one model, it
// auto-discovers the first writable characteristic on connect and persists that
// alongside the device id, so any BLE ESC/POS printer (not just the Seznik Veer this
// was validated against) can work without per-model configuration.
import { Platform, PermissionsAndroid } from 'react-native';
import {
  BleManager,
  BleErrorCode,
  ConnectionPriority,
  Device,
  Characteristic,
} from 'react-native-ble-plx';
import { bytesToBase64 } from './base64';
import { PrinterTransport, SavedPrinter, ThermalPrintError, TransportTimer } from './transport';

export type ScanResultDevice = {
  id: string;
  name: string;
  rssi: number | null;
};

/** Why a scan failed, as a stable semantic value the UI can localize. Raw BleError
 * messages ("BluetoothLE is powered off") are library-internal English and must not
 * reach the user. */
export type ScanFailureReason = 'bluetooth-off' | 'permission' | 'unknown';

function toScanFailureReason(errorCode: number | undefined): ScanFailureReason {
  switch (errorCode) {
    case BleErrorCode.BluetoothPoweredOff:
    case BleErrorCode.BluetoothUnsupported:
    case BleErrorCode.BluetoothResetting:
      return 'bluetooth-off';
    case BleErrorCode.BluetoothUnauthorized:
      return 'permission';
    default:
      return 'unknown';
  }
}

/** The BLE arm of SavedPrinter, narrowed for the functions in this file. */
export type BlePrinter = Extract<SavedPrinter, { transport: 'ble' }>;

let manager: BleManager | null = null;

function getManager(): BleManager {
  if (!manager) {
    manager = new BleManager();
  }
  return manager;
}

/** Android 12+ needs runtime BLUETOOTH_SCAN/CONNECT; older Android needs location. Call this
 * right before starting a scan (not at app launch, not just on toggling thermal mode on). */
export async function requestBlePermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true; // iOS prompts automatically on first scan/connect

  if (Platform.Version >= 31) {
    const results = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    ]);
    return (
      results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] === PermissionsAndroid.RESULTS.GRANTED &&
      results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === PermissionsAndroid.RESULTS.GRANTED
    );
  }

  const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
  return granted === PermissionsAndroid.RESULTS.GRANTED;
}

/** Starts scanning for nearby BLE devices. Returns a stop function — always call it
 * (screen blur/unmount) since scanning drains battery and BLE stacks misbehave if left running. */
export function startScan(
  onDevice: (device: ScanResultDevice) => void,
  onError: (reason: ScanFailureReason) => void
): () => void {
  const seen = new Set<string>();
  getManager().startDeviceScan(null, { allowDuplicates: false }, (error, device) => {
    if (error) {
      onError(toScanFailureReason(error.errorCode));
      return;
    }
    if (!device || !device.name || seen.has(device.id)) return;
    seen.add(device.id);
    onDevice({ id: device.id, name: device.name, rssi: device.rssi });
  });

  return () => {
    getManager().stopDeviceScan();
  };
}

async function findWritableCharacteristic(device: Device): Promise<{ serviceUUID: string; characteristicUUID: string; writeWithResponse: boolean }> {
  const services = await device.services();
  for (const service of services) {
    const characteristics: Characteristic[] = await service.characteristics();
    for (const c of characteristics) {
      if (c.isWritableWithResponse) {
        return { serviceUUID: service.uuid, characteristicUUID: c.uuid, writeWithResponse: true };
      }
      if (c.isWritableWithoutResponse) {
        return { serviceUUID: service.uuid, characteristicUUID: c.uuid, writeWithResponse: false };
      }
    }
  }
  throw new Error('No writable characteristic found on this device — it may not be a supported printer.');
}

/** Connects, discovers services, and locates a writable characteristic to print to.
 * The returned info should be persisted so future prints can reconnect directly. */
export async function connectAndDiscoverPrinter(deviceId: string): Promise<BlePrinter> {
  let device = await getManager().connectToDevice(deviceId, { autoConnect: false });
  // Reassigned, not discarded — see write() below for why that matters.
  device = await device.discoverAllServicesAndCharacteristics();

  const { serviceUUID, characteristicUUID, writeWithResponse } = await findWritableCharacteristic(device);
  return {
    transport: 'ble',
    id: device.id,
    name: device.name ?? deviceId,
    serviceUUID,
    characteristicUUID,
    writeWithResponse,
  };
}

/** MTU minus 3 bytes of ATT protocol overhead is the usable payload per write. */
function maxChunkSize(device: Device): number {
  const mtu = device.mtu ?? 23;
  return Math.max(20, mtu - 3);
}

/** Whether the printer's write characteristic accepts unacknowledged writes, which
 * avoid a round trip per chunk. Read live rather than from the saved device so an
 * already-paired printer benefits without re-pairing. */
async function supportsWriteWithoutResponse(
  device: Device,
  printer: BlePrinter
): Promise<boolean> {
  try {
    const characteristics = await device.characteristicsForService(printer.serviceUUID);
    const target = characteristics.find(c => c.uuid === printer.characteristicUUID);
    return Boolean(target?.isWritableWithoutResponse);
  } catch {
    return false;
  }
}

async function write(
  printer: SavedPrinter,
  data: number[],
  timer?: TransportTimer
): Promise<void> {
  if (printer.transport !== 'ble') throw new ThermalPrintError('unreachable');

  let device: Device;
  try {
    device = await getManager().connectToDevice(printer.id, { autoConnect: false });

    // These calls RETURN an updated Device rather than mutating in place. Discarding
    // the result leaves `device.mtu` at the 23-byte default no matter what was
    // negotiated — which is how an 8KB receipt became 408 twenty-byte writes.
    device = await device.discoverAllServicesAndCharacteristics();

    if (Platform.OS === 'android') {
      // Android needs MTU asked for explicitly. iOS has no equivalent API: CoreBluetooth
      // negotiates it during connection and reports it on the device, so the value read
      // below is already the real one there.
      try {
        device = await device.requestMTU(517);
      } catch {
        // Some printers refuse renegotiation; the default still works, just slowly.
      }
      try {
        // Shortens the connection interval, which is what actually paces acknowledged
        // writes — at the default interval each round trip measured ~130ms.
        // Android-only; iOS does not expose connection-priority control.
        device = await device.requestConnectionPriority(ConnectionPriority.High);
      } catch {
        // Not supported everywhere; not fatal.
      }
    }
  } catch {
    throw new ThermalPrintError('unreachable');
  }
  timer?.mark('ble connect');

  try {
    // Re-read the characteristic's capabilities from the live connection rather than
    // trusting what was stored at pairing: a printer that accepts unacknowledged
    // writes can be driven far faster, and this avoids migrating saved devices.
    const noAck = await supportsWriteWithoutResponse(device, printer);
    const chunkSize = maxChunkSize(device);
    timer?.note(`ble mtu      ${device.mtu ?? 23}`);
    timer?.note(`ble chunk    ${chunkSize} B x ${Math.ceil(data.length / chunkSize)} writes`);
    timer?.note(`ble ack      ${noAck ? 'noResponse' : 'withResponse'}`);

    for (let offset = 0; offset < data.length; offset += chunkSize) {
      const base64Chunk = bytesToBase64(data.slice(offset, offset + chunkSize));
      if (noAck) {
        await device.writeCharacteristicWithoutResponseForService(printer.serviceUUID, printer.characteristicUUID, base64Chunk);
      } else {
        await device.writeCharacteristicWithResponseForService(printer.serviceUUID, printer.characteristicUUID, base64Chunk);
      }
    }
    timer?.mark('ble write');
  } catch {
    throw new ThermalPrintError('unreachable');
  } finally {
    // Always release the link, even on a partial write, or the next print finds the
    // printer still held by a stale connection.
    await device.cancelConnection().catch(() => {});
    timer?.mark('ble disconnect');
  }
}

export const bleTransport: PrinterTransport = {
  write,
  isSupported: () => Platform.OS === 'android' || Platform.OS === 'ios',
};

/** Kept as a named export for the setup screen's test-print button. */
export { write as writeBytes };
