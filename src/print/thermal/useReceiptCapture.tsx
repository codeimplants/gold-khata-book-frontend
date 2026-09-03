import React, { useCallback, useRef, useState } from 'react';
import { View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import ReceiptImageView, { ReceiptStripView, CAPTURE_WIDTH } from './ReceiptImageView';
import { ReceiptLine } from './receiptModel';

/**
 * Renders a receipt off-screen and screenshots it, so non-Latin text can be printed
 * as a bitmap.
 *
 * The view must genuinely be in the view hierarchy and laid out for the capture to
 * contain anything, so it is positioned far off-screen rather than hidden with
 * `display: none` or zero opacity (both of which yield a blank or transparent
 * capture). `collapsable={false}` stops Android's view flattening from optimising the
 * container away, which would make captureRef fail outright.
 *
 * Capture is awaited on the real onLayout rather than a guessed timeout — a fixed
 * delay would be both slower than necessary and unreliable on a loaded device.
 */
type CaptureJob = { lines: ReceiptLine[]; mode: 'full' | 'strip' };

/** A broken or slow logo must not hang a print; past this we capture regardless and
 * the receipt simply comes out without it. */
const IMAGE_LOAD_TIMEOUT_MS = 3000;

export function useReceiptCapture() {
  const [job, setJob] = useState<CaptureJob | null>(null);
  const viewRef = useRef<View>(null);
  const layoutResolver = useRef<(() => void) | null>(null);
  const imagesResolver = useRef<((ok: boolean) => void) | null>(null);

  const onLayout = useCallback(() => {
    layoutResolver.current?.();
    layoutResolver.current = null;
  }, []);

  /**
   * Mounts the receipt, waits for layout, and returns a base64 PNG.
   *
   * `mode: 'strip'` renders only the given lines at a fixed height each, for the
   * hybrid path where just the non-ASCII lines become images.
   */
  const capture = useCallback(async (
    model: ReceiptLine[],
    mode: 'full' | 'strip' = 'full',
    /** Diagnostics: reports how each embedded image resolved, so a blank logo can be
     * told apart from a failed decode or a load that timed out. */
    onImageStatus?: (status: { loaded: number; failed: number; timedOut: boolean }) => void
  ): Promise<string> => {
    const laidOut = new Promise<void>(resolve => {
      layoutResolver.current = resolve;
    });

    // Logos must finish decoding before the screenshot or they capture blank. Counted
    // rather than assumed, and bounded by a timeout so a broken image URL degrades to
    // a logo-less receipt instead of hanging the print.
    const expectedImages = model.filter(l => l.kind === 'logo').length;
    let loaded = 0;
    let failed = 0;
    let timedOut = false;
    const imagesReady =
      expectedImages === 0
        ? Promise.resolve()
        : new Promise<void>(resolve => {
            imagesResolver.current = (ok: boolean) => {
              if (ok) loaded++;
              else failed++;
              if (loaded + failed >= expectedImages) resolve();
            };
            setTimeout(() => {
              timedOut = loaded + failed < expectedImages;
              resolve();
            }, IMAGE_LOAD_TIMEOUT_MS);
          });

    setJob({ lines: model, mode });
    try {
      await laidOut;
      await imagesReady;
      // Frames, not just layout: onLoad fires when the bitmap is decoded, but it still
      // has to be composited into the surface captureRef reads. Text needs one frame;
      // an image needs a little more, and capturing early yields a blank logo band.
      await new Promise(requestAnimationFrame);
      if (expectedImages > 0) {
        await new Promise(requestAnimationFrame);
        await new Promise(resolve => setTimeout(resolve, 60));
        onImageStatus?.({ loaded, failed, timedOut });
      }

      return await captureRef(viewRef, {
        format: 'png',
        quality: 1,
        result: 'base64',
        // Capture at the print head's exact dot width, so the raster step does no
        // meaningful scaling and stays cheap regardless of screen density.
        width: CAPTURE_WIDTH,
      });
    } finally {
      layoutResolver.current = null;
      imagesResolver.current = null;
      setJob(null);
    }
  }, []);

  const host = job ? (
    <View
      // Off-screen but only just: at extreme offsets Android can skip drawing the
      // subtree entirely, which shows up as an image that never composites even
      // though its onLoad fired.
      style={{ position: 'absolute', top: -2000, left: 0, width: CAPTURE_WIDTH }}
      pointerEvents="none"
      collapsable={false}
    >
      <View ref={viewRef} collapsable={false} onLayout={onLayout}>
        {job.mode === 'strip' ? (
          <ReceiptStripView
            lines={job.lines}
            onImageSettled={ok => imagesResolver.current?.(ok)}
          />
        ) : (
          <ReceiptImageView lines={job.lines} />
        )}
      </View>
    </View>
  ) : null;

  return { capture, host };
}
