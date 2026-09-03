/**
 * Native stub. The real implementation lives in `invoicePdfWeb.web.ts` and is
 * resolved by the webpack web build (see webpack.config.js `.web.ts` extension
 * priority). These functions are only ever called behind `Platform.OS === 'web'`
 * guards, so on native they must exist but never run.
 */

export const buildInvoiceA4PdfFile = async (
  _html: string,
  _fileName: string,
): Promise<File> => {
  throw new Error('buildInvoiceA4PdfFile is web-only');
};

export const downloadInvoiceA4Pdf = async (
  _html: string,
  _fileName: string,
): Promise<void> => {
  throw new Error('downloadInvoiceA4Pdf is web-only');
};

export const triggerFileDownload = (_file: File, _fileName: string): void => {
  throw new Error('triggerFileDownload is web-only');
};
