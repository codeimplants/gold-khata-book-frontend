import {
  buildInvoiceA4PdfFile,
  triggerFileDownload,
} from '../utils/invoicePdfWeb.web';

/**
 * Web declaration share.
 *
 * react-native-html-to-pdf and react-native-share are both stubbed for the web
 * build, so this goes through the same html2canvas + jsPDF pipeline the invoice
 * uses (invoicePdfWeb.web.ts takes any HTML string, not just bills). Falls back
 * to a plain download wherever the Web Share API can't take a file — which is
 * every desktop browser today.
 */
export const shareDeclarationPdf = async (
  html: string,
  fileName: string,
): Promise<boolean> => {
  const file = await buildInvoiceA4PdfFile(html, fileName);

  const nav: any = typeof navigator !== 'undefined' ? navigator : undefined;
  if (nav?.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: fileName });
      return true;
    } catch {
      // Dismissed, or the browser refused — fall through to a download so the
      // shopkeeper still ends up holding the document.
    }
  }

  triggerFileDownload(file, fileName);
  return true;
};
