import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import type { PendingDeclarationPhoto } from '../types';

/**
 * Client-side compression before upload, matching sonetaran-mobile's src/lib/photo.ts.
 *
 * A modern phone camera produces 3–12 MB per shot, so six unresized photos can
 * exceed nginx's 25 MB `client_max_body_size` and fail with a 413 — after the
 * shopkeeper has waited through the whole upload. Resizing the longest edge to
 * 1600px at quality 0.6 puts each photo in the low hundreds of KB.
 *
 * Deliberately not WebP: react-native-image-picker emits JPEG, and the backend's
 * sharp pass converts to WebP at 1024px for storage anyway. One compression pass
 * here, one conversion there — no double-compression.
 */
const MAX_DIM = 1600;
const COMPRESS = 0.6;

export type PickOutcome =
  | { status: 'picked'; photos: PendingDeclarationPhoto[] }
  | { status: 'cancelled' }
  /** The picker module is missing — the web build without the image-picker mock. */
  | { status: 'unavailable' }
  | { status: 'error'; message?: string };

/**
 * Opens the camera or the gallery and returns what was picked, compressed.
 *
 * Returns an outcome rather than toasting, so each caller words its own
 * message — "add ornament photos" and "add witness ID" fail for the same
 * reasons but should not say the same thing.
 *
 * Both entry points work on web too. The library one maps onto a file input;
 * the camera one opens the native camera app on a phone browser (via
 * `capture="environment"`) and a getUserMedia overlay on desktop, where that
 * attribute is ignored. See src/mocks/react-native-image-picker.js.
 */
export const pickPhotos = async (
  mode: 'camera' | 'library',
  limit: number,
  /**
   * Button text for the desktop-web camera overlay. Passed down rather than
   * read here because this is a util with no access to the translation hook,
   * and an overlay stuck in English in a Marathi shop is the same defect as an
   * untranslated screen. Ignored by the native picker, which draws its own UI.
   */
  cameraLabels?: { capture: string; done: string; cancel: string },
  options?: {
    /**
     * Return the file exactly as it sits in the camera roll — no resize, no
     * re-encode.
     *
     * Only for the shop's branding images. An ornament photo is looked at in a
     * 104px box, where the 1600px/0.6 pass below is invisible; the shop header
     * is stretched across a whole printed page, where the same pass turns
     * Devanagari shop names into mush. Everything else stays compressed.
     */
    fullResolution?: boolean;
  },
): Promise<PickOutcome> => {
  const picker = mode === 'camera' ? launchCamera : launchImageLibrary;
  if (!picker) return { status: 'unavailable' };

  try {
    const result: any = await picker({
      mediaType: 'photo',
      // Resize + compress before the bytes ever leave the device. maxWidth /
      // maxHeight scale proportionally, so this caps the longest edge.
      //
      // Omitted entirely for a full-resolution pick rather than set to some
      // large number: react-native-image-picker only re-encodes the file when
      // these are present, so leaving them out is what returns the original
      // bytes. (The web file input ignores them either way.)
      ...(options?.fullResolution
        ? {}
        : { maxWidth: MAX_DIM, maxHeight: MAX_DIM, quality: COMPRESS }),
      // Inert on native, where launchCamera returns one shot per launch no
      // matter what is asked for. It matters on desktop web: the getUserMedia
      // overlay reads this as how many shots to allow before closing, so six
      // ornaments cost one trip through the picker rather than six.
      selectionLimit: limit,
      // Cast because this key exists only in the web mock — the real library's
      // types reject it, and the native picker ignores unknown options.
      cameraLabels,
    } as any);

    if (result?.didCancel) return { status: 'cancelled' };
    if (result?.errorMessage) {
      return { status: 'error', message: result.errorMessage };
    }

    const photos: PendingDeclarationPhoto[] = (result?.assets || [])
      .filter((a: any) => a?.uri)
      .map((a: any) => ({
        uri: a.uri,
        fileName: a.fileName,
        type: a.type,
        // Post-resize dimensions, which is what a caller judging the image's
        // shape wants. Undefined on web, so callers must treat them as optional.
        width: a.width,
        height: a.height,
        fileSize: a.fileSize,
      }));

    return { status: 'picked', photos };
  } catch (err: any) {
    console.warn('[photoPicker] pick failed:', err);
    return { status: 'error' };
  }
};
