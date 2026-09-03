// Minimal base64 encoder for BLE writes (react-native-ble-plx's characteristic write
// methods take a base64-encoded string, not raw bytes). Hermes has no built-in btoa
// that's guaranteed binary-safe across RN versions, and this repo has no existing
// base64/Buffer dependency — a ~15-line encoder avoids pulling one in for this alone.

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function bytesToBase64(bytes: number[] | Uint8Array): string {
  let out = '';
  const len = bytes.length;
  for (let i = 0; i < len; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < len ? bytes[i + 1] : undefined;
    const b2 = i + 2 < len ? bytes[i + 2] : undefined;

    out += CHARS[b0 >> 2];
    out += CHARS[((b0 & 0x03) << 4) | (b1 === undefined ? 0 : b1 >> 4)];
    out += b1 === undefined ? '=' : CHARS[((b1 & 0x0f) << 2) | (b2 === undefined ? 0 : b2 >> 6)];
    out += b2 === undefined ? '=' : CHARS[b2 & 0x3f];
  }
  return out;
}
