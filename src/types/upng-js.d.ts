// upng-js ships no types. Only the two functions the raster path uses are declared,
// rather than pulling in a broad `any` shim that would hide real mistakes.
declare module 'upng-js' {
  export interface UPNGImage {
    width: number;
    height: number;
    depth: number;
    ctype: number;
    frames: unknown[];
    tabs: Record<string, unknown>;
    data: Uint8Array;
  }

  /** Parses PNG bytes into UPNG's intermediate representation. */
  export function decode(buffer: ArrayBuffer | Uint8Array): UPNGImage;

  /** Converts a decoded image to one RGBA buffer per frame. */
  export function toRGBA8(img: UPNGImage): ArrayBuffer[];

  const UPNG: {
    decode: typeof decode;
    toRGBA8: typeof toRGBA8;
  };
  export default UPNG;
}
