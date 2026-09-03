/**
 * Web-only invoice PDF helpers. RN Web has no native PDF generator
 * (react-native-html-to-pdf is stubbed for the web build — see webpack.config.js
 * aliases), so we rasterize the same bill HTML the app prints with (html2canvas)
 * and wrap it in a portrait-A4 jsPDF document. Matches the native fixed-A4 output:
 * full-width content, bottom whitespace on short invoices, paginated for long ones.
 */

import { BILL_PAGE } from '../constants/bill';

// A4 at 96dpi (210mm) — every invoice template is authored/sized for an A4 page,
// so laying the iframe out at this width makes the captured PDF match print.
const A4_WIDTH_PX = 794;
// A4 point dimensions used by jsPDF's built-in 'a4' format (portrait).
const A4_WIDTH_PT = 595.28;
const A4_HEIGHT_PT = 841.89;

/**
 * Safe printable border, mirroring the templates' @page margin.
 *
 * This path has to apply it by hand: html2canvas rasterises the DOM and ignores
 * paged-media rules entirely, so without this the Print button would gain a
 * margin while Download/Share stayed full-bleed — and those PDFs get printed
 * later from whatever machine the shopkeeper opens them on.
 */
const MARGIN_PX = (BILL_PAGE.MARGIN_MM * 96) / 25.4;
const MARGIN_PT = (BILL_PAGE.MARGIN_MM * 72) / 25.4;

/** Width/height available to content once both margins are taken off. */
const CONTENT_WIDTH_PX = A4_WIDTH_PX - MARGIN_PX * 2;
const CONTENT_WIDTH_PT = A4_WIDTH_PT - MARGIN_PT * 2;
const CONTENT_HEIGHT_PT = A4_HEIGHT_PT - MARGIN_PT * 2;

/**
 * Rasterisation scale. 3× the 794px A4 width ≈ 288 DPI, near print standard.
 * The previous 2× worked out at ~192 DPI, which reads visibly soft for a
 * text-dense page like the declaration.
 *
 * Rasterising at all is deliberate, not a shortcut: these documents render in
 * Devanagari and Gujarati, and jsPDF has no complex-text-layout engine, so
 * drawing them as real PDF text would break conjuncts and matras even with an
 * embedded font. The browser shapes the script correctly and we capture that.
 */
const TARGET_SCALE = 3;

/**
 * Safari caps total canvas area (~16.7M px) and hands back a blank canvas past
 * it rather than erroring. Long documents therefore step the scale down instead
 * of silently producing an empty PDF — which the fixed 2× could already do on a
 * sufficiently long bill.
 */
const MAX_CANVAS_AREA_PX = 16_000_000;

/**
 * JPEG rather than PNG. For antialiased text PNG stores every grey edge pixel
 * losslessly and runs several times larger; at this quality JPEG artefacts are
 * not visible at 288 DPI. Size matters because these get shared over WhatsApp.
 */
const PAGE_IMAGE_QUALITY = 0.95;

/**
 * Renders a full HTML document string into a hidden off-screen iframe and
 * rasterizes its body to a canvas. Captures the full content width/height so
 * nothing (rate/amount columns, long invoices) is clipped.
 */
const renderHtmlToCanvas = async (html: string): Promise<HTMLCanvasElement> => {
  const html2canvas = (await import('html2canvas-pro')).default;

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.left = '-9999px';
  iframe.style.top = '0';
  iframe.style.width = `${CONTENT_WIDTH_PX}px`;
  iframe.style.height = '1200px';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  try {
    await new Promise<void>((resolve, reject) => {
      iframe.onload = () => resolve();
      iframe.onerror = () => reject(new Error('Failed to render bill HTML'));
      iframe.srcdoc = html;
    });
    // Give inlined images (shop logo/header/signature) a moment to paint.
    await new Promise((r) => setTimeout(r, 300));

    const body = iframe.contentDocument?.body;
    if (!body) throw new Error('Bill iframe has no document body');

    const contentWidth = Math.max(body.scrollWidth, CONTENT_WIDTH_PX);
    if (contentWidth !== CONTENT_WIDTH_PX) {
      iframe.style.width = `${contentWidth}px`;
      await new Promise((r) => requestAnimationFrame(() => r(null)));
    }
    const contentHeight = body.scrollHeight;
    if (contentHeight > 0) {
      iframe.style.height = `${contentHeight}px`;
      await new Promise((r) => requestAnimationFrame(() => r(null)));
    }

    // Step the scale down only as far as the canvas ceiling forces, so short
    // documents stay at full crispness and long ones degrade instead of failing.
    const area = Math.max(contentWidth * Math.max(contentHeight, 1), 1);
    const scale = Math.max(1, Math.min(TARGET_SCALE, Math.sqrt(MAX_CANVAS_AREA_PX / area)));

    return await html2canvas(body, {
      useCORS: true,
      // Explicit: JPEG has no alpha channel, so a transparent backdrop would
      // come out black rather than white.
      backgroundColor: '#ffffff',
      scale,
      width: contentWidth,
      windowWidth: contentWidth,
      height: contentHeight > 0 ? contentHeight : undefined,
      windowHeight: contentHeight > 0 ? contentHeight : undefined,
    });
  } finally {
    document.body.removeChild(iframe);
  }
};

/**
 * Converts bill HTML into a portrait-A4 PDF File: renders it to a canvas, then
 * lays the image across one or more A4 pages inside the safe printable border
 * (top-aligned, bottom whitespace on short invoices; sliced across pages for
 * long ones).
 */
export const buildInvoiceA4PdfFile = async (
  html: string,
  fileName: string,
): Promise<File> => {
  const canvas = await renderHtmlToCanvas(html);
  const { jsPDF } = await import('jspdf');

  const pdf = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });

  // Scale the capture to the content width; height follows aspect.
  const imgHeightPt = (canvas.height * CONTENT_WIDTH_PT) / canvas.width;

  if (imgHeightPt <= CONTENT_HEIGHT_PT) {
    // Fits on one page — place at the top of the content box; the rest is
    // bottom whitespace.
    pdf.addImage(
      canvas.toDataURL('image/jpeg', PAGE_IMAGE_QUALITY),
      'JPEG',
      MARGIN_PT,
      MARGIN_PT,
      CONTENT_WIDTH_PT,
      imgHeightPt,
    );
  } else {
    // Cut the capture into page-height strips and embed only the strip each
    // page actually shows.
    //
    // The previous version added the *whole* image to every page, shifted up by
    // one page each time. A three-page declaration therefore carried three full
    // copies of a full-length bitmap, which is most of why the file came out at
    // several MB.
    const sliceHeightPx = Math.floor((CONTENT_HEIGHT_PT * canvas.width) / CONTENT_WIDTH_PT);
    const pageCanvas = document.createElement('canvas');
    const ctx = pageCanvas.getContext('2d');
    if (!ctx) throw new Error('Could not allocate a canvas for PDF pagination');

    for (let y = 0; y < canvas.height; y += sliceHeightPx) {
      const sliceHeight = Math.min(sliceHeightPx, canvas.height - y);
      pageCanvas.width = canvas.width;
      pageCanvas.height = sliceHeight;

      // Resizing a canvas clears it, so the white fill has to follow the resize.
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, sliceHeight);
      ctx.drawImage(
        canvas,
        0, y, canvas.width, sliceHeight,
        0, 0, canvas.width, sliceHeight,
      );

      if (y > 0) pdf.addPage();
      pdf.addImage(
        pageCanvas.toDataURL('image/jpeg', PAGE_IMAGE_QUALITY),
        'JPEG',
        MARGIN_PT,
        MARGIN_PT,
        CONTENT_WIDTH_PT,
        (sliceHeight * CONTENT_WIDTH_PT) / canvas.width,
      );
    }
  }

  const blob = pdf.output('blob');
  return new File([blob], `${fileName}.pdf`, { type: 'application/pdf' });
};

/**
 * Triggers a browser download of an already-built PDF File (anchor + object
 * URL). Kept separate so callers that already have the File (e.g. the share
 * fallback) don't rebuild/re-rasterize it.
 */
export const triggerFileDownload = (file: File, fileName: string): void => {
  const url = URL.createObjectURL(file);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
};

/**
 * Builds the A4 PDF and triggers a browser download of it.
 */
export const downloadInvoiceA4Pdf = async (
  html: string,
  fileName: string,
): Promise<void> => {
  const file = await buildInvoiceA4PdfFile(html, fileName);
  triggerFileDownload(file, fileName);
};
