import { generateInvoicePDF, sharePDF } from '../utils/pdfService';

/**
 * Native declaration share: build the A4 PDF, then hand it to the share sheet.
 *
 * The web build resolves declarationShare.web.ts instead (Metro/webpack pick the
 * platform sibling automatically). Keeping the two apart matters — the web
 * implementation pulls in jspdf and html2canvas, which have no business in the
 * native bundle.
 */
export const shareDeclarationPdf = async (
  html: string,
  fileName: string,
): Promise<boolean> => {
  const filePath = await generateInvoicePDF(html, fileName);
  if (!filePath) return false;

  await sharePDF(filePath, 'Share Declaration');
  return true;
};
