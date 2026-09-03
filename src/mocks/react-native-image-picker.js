// Web stub for the native image picker.
//
// `launchImageLibrary` opens an <input type="file">. `launchCamera` splits by
// device: on a phone browser the same input with `capture="environment"` opens
// the native camera app, which beats anything this file could build. Desktop
// browsers ignore `capture` entirely, so there it opens a getUserMedia overlay
// instead — see webCamera.js for why that split exists.
import { canUseWebCamera, openWebCamera } from './webCamera';
const pickFiles = (options, callback, capture) => {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = options?.mediaType === 'video' ? 'video/*' : 'image/*';

    if (capture) {
      input.capture = capture;
    }

    // selectionLimit: 0 means "no limit" in react-native-image-picker; 1 (or
    // undefined) means single-select, which is what the shop logo/signature
    // pickers rely on.
    const limit = options?.selectionLimit;
    const allowMultiple = limit === 0 || (typeof limit === 'number' && limit > 1);
    if (allowMultiple) {
      input.multiple = true;
    }

    const finish = (result) => {
      if (callback) callback(result);
      resolve(result);
    };

    input.onchange = (e) => {
      const files = Array.from(e.target.files || []);
      if (files.length === 0) {
        finish({ didCancel: true, assets: [] });
        return;
      }

      const capped = limit > 0 ? files.slice(0, limit) : files;
      const assets = capped.map((file) => ({
        uri: URL.createObjectURL(file),
        fileName: file.name,
        fileSize: file.size,
        type: file.type,
        width: undefined,
        height: undefined,
      }));

      finish({ didCancel: false, assets });
    };

    input.oncancel = () => finish({ didCancel: true, assets: [] });

    input.click();
  });
};

export const launchImageLibrary = (options, callback) =>
  pickFiles(options, callback);

export const launchCamera = async (options, callback) => {
  if (canUseWebCamera()) {
    try {
      const assets = await openWebCamera({
        maxWidth: options?.maxWidth,
        maxHeight: options?.maxHeight,
        quality: options?.quality,
        limit: options?.selectionLimit,
        labels: options?.cameraLabels,
      });
      const result =
        assets.length > 0
          ? { didCancel: false, assets }
          : { didCancel: true, assets: [] };
      if (callback) callback(result);
      return result;
    } catch (err) {
      // No camera, permission denied, or a non-secure origin. Falling through
      // to the file chooser keeps the button useful instead of turning a
      // hardware problem into a dead end.
      console.warn('[imagePicker] web camera unavailable, using file input:', err);
    }
  }

  return pickFiles(options, callback, 'environment');
};

export default { launchImageLibrary, launchCamera };
