// Desktop-web camera capture, built on getUserMedia.
//
// Exists because `<input type="file" capture="environment">` — what the image
// picker mock uses everywhere else — is honoured only by mobile browsers.
// Desktop Chrome/Edge/Firefox/Safari ignore the attribute and show a plain file
// chooser, so "Take Photo" on a shop's PC was a button that could not take a
// photo, with or without a webcam attached.
//
// Deliberately plain DOM rather than a React component: the image picker is
// consumed as a module (`launchCamera(...)` returning a promise), not rendered,
// so there is no tree to mount into and no state to plumb through six call
// sites. It returns the same asset shape the native picker does, with a `blob:`
// uri that `appendPickedImage` in dataSlice already knows how to turn into
// multipart.

/** Matches the native picker's compression contract — see utils/photoPicker.ts. */
const DEFAULT_MAX_DIM = 1600;
const DEFAULT_QUALITY = 0.6;

/**
 * True when a live camera is both usable and the better option.
 *
 * Touch devices are excluded on purpose, not by oversight: on a phone browser
 * the file input opens the *native camera app*, which beats a <video> element on
 * autofocus, resolution, orientation handling and familiarity. This overlay is
 * strictly the desktop fallback.
 */
export const canUseWebCamera = () =>
  typeof navigator !== 'undefined' &&
  !!navigator.mediaDevices?.getUserMedia &&
  typeof window !== 'undefined' &&
  window.isSecureContext === true &&
  navigator.maxTouchPoints === 0;

const el = (tag, style, text) => {
  const node = document.createElement(tag);
  Object.assign(node.style, style);
  if (text) node.textContent = text;
  return node;
};

const button = (label, variant) => {
  const base = {
    border: 'none',
    borderRadius: '10px',
    padding: '10px 18px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: 'inherit',
  };
  const tones = {
    primary: { background: '#6D5EF7', color: '#fff' },
    ghost: { background: 'rgba(255,255,255,0.15)', color: '#fff' },
  };
  return el('button', { ...base, ...(tones[variant] || tones.ghost) }, label);
};

/**
 * Opens a full-screen camera overlay and resolves with what was captured.
 *
 * Resolves with `[]` when cancelled, and REJECTS when the camera cannot be
 * opened at all (no device, permission denied, insecure origin) so the caller
 * can fall back to the file input rather than leaving a dead button.
 */
export const openWebCamera = ({
  maxWidth = DEFAULT_MAX_DIM,
  maxHeight = DEFAULT_MAX_DIM,
  quality = DEFAULT_QUALITY,
  limit = 1,
  labels = {},
} = {}) =>
  new Promise((resolve, reject) => {
    const maxShots = Math.max(1, limit || 1);
    const captured = [];
    let stream = null;
    let settled = false;

    const overlay = el('div', {
      position: 'fixed',
      inset: '0',
      zIndex: '99999',
      background: '#000',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '12px',
      padding: '16px',
      boxSizing: 'border-box',
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    });

    const video = el('video', {
      maxWidth: '100%',
      maxHeight: '65vh',
      borderRadius: '12px',
      background: '#111',
      objectFit: 'contain',
    });
    video.autoplay = true;
    video.playsInline = true;
    video.muted = true;

    const strip = el('div', {
      display: 'flex',
      gap: '8px',
      minHeight: '0',
      flexWrap: 'wrap',
      justifyContent: 'center',
    });

    const counter = el(
      'div',
      { color: 'rgba(255,255,255,0.7)', fontSize: '13px' },
      '',
    );
    const updateCounter = () => {
      counter.textContent =
        maxShots > 1 ? `${captured.length} / ${maxShots}` : '';
    };
    updateCounter();

    const controls = el('div', {
      display: 'flex',
      gap: '10px',
      alignItems: 'center',
    });
    const shutterBtn = button(labels.capture || 'Capture', 'primary');
    const doneBtn = button(labels.done || 'Done', 'ghost');
    const cancelBtn = button(labels.cancel || 'Cancel', 'ghost');
    doneBtn.style.display = 'none';
    controls.append(shutterBtn, doneBtn, cancelBtn);

    overlay.append(video, strip, counter, controls);

    /**
     * Stops the camera and tears the overlay down.
     *
     * Every exit runs through here — capture-done, cancel, Escape and error
     * alike. A track left running keeps the webcam LED lit after the modal is
     * gone, which reads to a shopkeeper as the app watching them.
     */
    const teardown = () => {
      if (stream) stream.getTracks().forEach(track => track.stop());
      stream = null;
      document.removeEventListener('keydown', onKey);
      overlay.remove();
    };

    const finish = result => {
      if (settled) return;
      settled = true;
      teardown();
      resolve(result);
    };

    /**
     * Cancel and Escape throw the shots away rather than returning them.
     *
     * Resolving with what was captured so far would make Cancel mean "keep
     * some", which is not what the word promises — and the blob URLs would leak
     * either way, so they are revoked here.
     */
    const discard = () => {
      if (settled) return;
      captured.forEach(photo => URL.revokeObjectURL(photo.uri));
      captured.length = 0;
      finish([]);
    };

    const fail = err => {
      if (settled) return;
      settled = true;
      teardown();
      reject(err);
    };

    function onKey(event) {
      if (event.key === 'Escape') discard();
    }

    const capture = () => {
      const width = video.videoWidth;
      const height = video.videoHeight;
      if (!width || !height) return;

      // Scale the longest edge down to the cap, preserving aspect ratio — the
      // same shape of resize the native picker's maxWidth/maxHeight performs.
      const scale = Math.min(1, maxWidth / width, maxHeight / height);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);

      // Drawn unmirrored even when the preview is mirrored below: a flipped
      // capture makes the text on an ID card read backwards.
      canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(
        blob => {
          if (!blob) return;
          const uri = URL.createObjectURL(blob);
          captured.push({
            uri,
            fileName: `camera_${Date.now()}_${captured.length + 1}.jpg`,
            fileSize: blob.size,
            type: 'image/jpeg',
            width: canvas.width,
            height: canvas.height,
          });

          const thumb = el('img', {
            width: '48px',
            height: '48px',
            objectFit: 'cover',
            borderRadius: '6px',
            border: '1px solid rgba(255,255,255,0.3)',
          });
          thumb.src = uri;
          strip.append(thumb);
          updateCounter();

          if (captured.length >= maxShots) {
            finish(captured);
            return;
          }
          doneBtn.style.display = '';
        },
        'image/jpeg',
        quality,
      );
    };

    shutterBtn.addEventListener('click', capture);
    doneBtn.addEventListener('click', () => finish(captured));
    cancelBtn.addEventListener('click', discard);
    document.addEventListener('keydown', onKey);

    document.body.append(overlay);

    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 } },
      })
      .then(mediaStream => {
        if (settled) {
          mediaStream.getTracks().forEach(track => track.stop());
          return;
        }
        stream = mediaStream;
        video.srcObject = mediaStream;

        // A laptop's only camera is user-facing, and an unmirrored preview makes
        // aiming feel inverted. Mirror what is shown, never what is saved.
        const facing = mediaStream.getVideoTracks()[0]?.getSettings?.().facingMode;
        if (facing !== 'environment') video.style.transform = 'scaleX(-1)';
      })
      .catch(fail);
  });

export default openWebCamera;
