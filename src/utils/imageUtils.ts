import { Platform } from 'react-native';
import RNFS from 'react-native-fs';
import { API_BASE_URL } from '../config';

/**
 * Ensures an image path is a full, valid URI for React Native Image components.
 * Handles:
 * 1. Objects with .uri (from react-native-image-picker)
 * 2. Absolute URLs (http://, file://, etc.)
 * 3. Relative backend paths (/uploads/...)
 * 
 * @param path The image path or object
 * @returns A string URI or null
 */
export const getFullImageUrl = (path: any): string | null => {
  if (!path) return null;

  // Handle image-picker object
  if (typeof path === 'object' && path.uri) {
    return path.uri;
  }

  // Handle strings
  if (typeof path === 'string') {
    const trimmedPath = path.trim();
    if (!trimmedPath) return null;

    // Legacy bad data: a JS object once cast to a String column produced the
    // literal "[object Object]". Treat it as no image instead of mistaking it
    // for a relative path (which would trigger a broken fetch against the API).
    if (trimmedPath === '[object Object]') return null;

    // Hand-drawn signatures are stored as raw <svg> XML, not a URL — wrap
    // them as a data URI so <img> tags can render them.
    if (trimmedPath.startsWith('<svg')) {
      return `data:image/svg+xml;utf8,${encodeURIComponent(trimmedPath)}`;
    }

    // Already absolute
    if (
      trimmedPath.startsWith('http://') ||
      trimmedPath.startsWith('https://') ||
      trimmedPath.startsWith('file://') ||
      trimmedPath.startsWith('content://') ||
      trimmedPath.startsWith('data:image/')
    ) {
      return trimmedPath;
    }

    // Relative path - prepend API base URL
    // API_BASE_URL is usually something like "http://192.168.1.5:5000/api"
    // We want the host root "http://192.168.1.5:5000"
    const baseUrl = (API_BASE_URL || '').replace(/\/api\/?$/, '').replace(/\/$/, '');
    
    const separator = trimmedPath.startsWith('/') ? '' : '/';
    return `${baseUrl}${separator}${trimmedPath}`;
  }

  return null;
};

/**
 * Guesses a MIME type from a URL's file extension. Defaults to webp because
 * the backend (ImageKit) serves optimized shop images as .webp.
 */
const mimeFromUrl = (url: string): string => {
  const clean = url.split('?')[0].toLowerCase();
  if (clean.endsWith('.png')) return 'image/png';
  if (clean.endsWith('.jpg') || clean.endsWith('.jpeg')) return 'image/jpeg';
  if (clean.endsWith('.gif')) return 'image/gif';
  if (clean.endsWith('.svg')) return 'image/svg+xml';
  return 'image/webp';
};

/**
 * Resolves an image reference to a base64 `data:` URI so it can be embedded
 * directly in HTML. This is required for react-native-html-to-pdf, which
 * snapshots the page before remote images finish downloading — inlining the
 * bytes guarantees the image is present in the generated PDF.
 *
 * Returns null on any failure so callers can fall back to a placeholder.
 */
export const imageUrlToDataUri = async (src: any): Promise<string | null> => {
  const url = getFullImageUrl(src);
  if (!url) return null;

  // Already inline (data URI or SVG XML string) — nothing to fetch.
  if (url.startsWith('data:')) return url;

  try {
    // Web has no RNFS (it's aliased to a stub in webpack.config.js), so read
    // the bytes with fetch instead. This matters beyond convenience: the web
    // PDF path rasterizes the HTML through html2canvas, which silently drops
    // any remote image the canvas considers cross-origin. Inlining first means
    // the image is same-origin data by the time the canvas sees it.
    if (Platform.OS === 'web') {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Failed to read image blob'));
        reader.readAsDataURL(blob);
      });
    }

    // Local file already on device — read straight off disk.
    if (url.startsWith('file://') || url.startsWith('/')) {
      const path = url.replace('file://', '');
      const base64 = await RNFS.readFile(path, 'base64');
      return `data:${mimeFromUrl(url)};base64,${base64}`;
    }

    // Remote URL — download to cache, then read as base64.
    const tempPath = `${RNFS.CachesDirectoryPath}/print_img_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2)}`;
    const { promise } = RNFS.downloadFile({ fromUrl: url, toFile: tempPath });
    const result = await promise;
    if (result.statusCode && result.statusCode >= 400) {
      throw new Error(`Download failed with status ${result.statusCode}`);
    }
    const base64 = await RNFS.readFile(tempPath, 'base64');
    RNFS.unlink(tempPath).catch(() => {});
    return `data:${mimeFromUrl(url)};base64,${base64}`;
  } catch (err) {
    console.warn('[imageUrlToDataUri] failed to inline image:', err);
    return null;
  }
};

/**
 * Returns a shallow copy of shopDetails with logo / shopHeader / signature
 * replaced by inline base64 data URIs, ready to embed in a printable bill.
 * SVG-string signatures (drawn in-app) are left untouched, as are fields that
 * fail to resolve. Use this before building bill HTML for print/PDF/share.
 */
export const prepareShopForPrint = async (shopDetails: any): Promise<any> => {
  if (!shopDetails) return shopDetails;

  const inline = async (value: any): Promise<any> => {
    // Preserve in-app drawn signatures (raw SVG XML strings).
    if (typeof value === 'string' && value.trim().startsWith('<svg')) return value;
    if (!value) return value;
    const dataUri = await imageUrlToDataUri(value);
    return dataUri ?? value;
  };

  const [logo, shopHeader, signature] = await Promise.all([
    inline(shopDetails.logo),
    inline(shopDetails.shopHeader),
    inline(shopDetails.signature),
  ]);

  return { ...shopDetails, logo, shopHeader, signature };
};

/**
 * Inlines ornament photos as base64 data URIs for the declaration document.
 *
 * Same reasoning as prepareShopForPrint: react-native-html-to-pdf snapshots
 * before remote images load, and html2canvas (the web path) drops cross-origin
 * images. Photos that fail to resolve keep their original URL — they will still
 * render on screen, just possibly not in the PDF, which beats dropping them.
 */
/**
 * Width, in pixels, to request for an ornament photo destined for the printed
 * declaration.
 *
 * The template renders each photo in a 104px box (see print/templates/
 * declaration.ts). ImageKit stores them at 1024px because they are evidence and
 * the fullscreen viewer needs that detail — but shipping 1024px to fill 104px
 * put roughly six times the necessary pixels into the PDF, then inflated them a
 * further ~33% through base64. 400px still exceeds what a 104px box resolves to
 * at 300 DPI, so nothing visible is lost.
 */
const PRINT_PHOTO_WIDTH = 400;

/**
 * Adds an ImageKit resize transform to a stored image URL.
 *
 * Returns the URL untouched when it is not an ImageKit-style remote URL (a
 * local file:// path during an offline retry, or a data URI), so callers can
 * apply it unconditionally.
 */
const withImageKitWidth = (url: string, width: number): string => {
  if (!/^https?:\/\//i.test(url)) return url;
  // ImageKit reads chained transforms from the `tr` query parameter; leave an
  // existing one alone rather than producing two conflicting directives.
  if (/[?&]tr=/.test(url)) return url;
  return `${url}${url.includes('?') ? '&' : '?'}tr=w-${width}`;
};

/**
 * Inlines the customer's profile photo for the printed declaration.
 *
 * Same reasoning as the ornament photos: a remote URL renders on screen and is
 * dropped by both PDF paths, which would show the photo in preview and lose it
 * in the document that actually matters. Returns undefined when there is no
 * photo, or when it could not be fetched — the template then falls back to the
 * remote URL rather than dropping the block entirely.
 */
export const prepareCustomerPhotoForPrint = async (
  url: string | undefined,
): Promise<string | undefined> => {
  if (!url) return undefined;
  const printUrl = withImageKitWidth(getFullImageUrl(url) || url, PRINT_PHOTO_WIDTH);
  return (await imageUrlToDataUri(printUrl)) ?? undefined;
};

/**
 * Width requested for an item photo on a printed BILL.
 *
 * The strip renders each one in a 34px box, 20px on a short sheet, so 120px is
 * already generous at 300 DPI. Much smaller than the declaration's 400px
 * because a bill can carry three photos per item across many items, and each
 * one is inlined as base64 into a PDF that gets shared over WhatsApp.
 */
const BILL_PHOTO_WIDTH = 120;

/** The item photo strip prints at most three per item — see itemPhotoStrip. */
const BILL_PHOTOS_PER_ITEM = 3;

/**
 * Inlines a bill's item photos as data URIs, the way `prepareShopForPrint` does
 * for the logo and signature.
 *
 * Without this the item photos were the ONE image on a printed bill still going
 * out as a remote URL, and they failed on every path for the reasons
 * `imageUrlToDataUri` already documents: react-native-html-to-pdf snapshots the
 * page before a remote image finishes downloading, html2canvas drops anything it
 * considers cross-origin, and the web print window calls `window.print()` on a
 * timer that a slow image loses. Worse, it failed invisibly — the `<img>` still
 * carries an explicit width and height, so the strip reserved its ~10mm of a
 * pre-printed slip and printed nothing into it.
 *
 * Reported from production on INV-11: "include item photos" was ticked, the
 * photo was stored, and the paper came out with a blank gap where it should be.
 *
 * Photos that cannot be fetched keep their original URL, so the on-screen
 * preview is unaffected by a failed inline.
 */
export const prepareItemPhotosForPrint = async (items: any[]): Promise<any[]> =>
  Promise.all(
    items.map(async item => {
      if (!item?.photos?.length) return item;
      const photos = await Promise.all(
        item.photos.map(async (photo: { url: string }, index: number) => {
          // Only the ones that will actually print get downloaded.
          if (index >= BILL_PHOTOS_PER_ITEM) return photo;
          const printUrl = withImageKitWidth(
            getFullImageUrl(photo.url) || photo.url,
            BILL_PHOTO_WIDTH,
          );
          const inlined = await imageUrlToDataUri(printUrl);
          return inlined ? { ...photo, url: inlined } : photo;
        }),
      );
      return { ...item, photos };
    }),
  );

/**
 * The bill, ready to print: item photos inlined when the shopkeeper asked for
 * them on this bill, and untouched when they did not.
 *
 * Call it beside `prepareShopForPrint` at every print / download / share site.
 * Returns the values unchanged when there is nothing to do, so it is safe to
 * call unconditionally.
 */
export const prepareBillForPrint = async <
  T extends { includeItemPhotosOnBill?: boolean; items?: any[] },
>(
  values: T,
): Promise<T> => {
  if (!values?.includeItemPhotosOnBill || !values.items?.length) return values;
  return { ...values, items: await prepareItemPhotosForPrint(values.items) };
};

export const prepareDeclarationPhotosForPrint = async (
  photos: Array<{ url: string }> | undefined,
): Promise<string[]> => {
  if (!photos?.length) return [];
  return Promise.all(
    photos.map(async p => {
      // Fetch a print-sized rendition rather than the full-resolution original.
      // Only the printed document is affected — the fullscreen photo viewer
      // still loads the stored image, where the detail is the point.
      const printUrl = withImageKitWidth(getFullImageUrl(p.url) || p.url, PRINT_PHOTO_WIDTH);
      return (await imageUrlToDataUri(printUrl)) ?? p.url;
    }),
  );
};
