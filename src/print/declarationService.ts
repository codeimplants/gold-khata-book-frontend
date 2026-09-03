import { Platform } from 'react-native';
import type { PurchaseOldGold } from '../types';
import type { MobileLang } from './templates/shared';
import { buildDeclarationHTML } from './templates/declaration';
import { printHTML } from './printService';
import {
  prepareShopForPrint,
  prepareDeclarationPhotosForPrint,
  prepareCustomerPhotoForPrint,
} from '../utils/imageUtils';
import {
  buildPdfFileName,
  generateInvoicePDF,
  downloadPDFToDevice,
} from '../utils/pdfService';
// Resolves to invoicePdfWeb.web.ts on the web build; the native sibling is a
// no-op stub, so this import is safe on both targets.
import { downloadInvoiceA4Pdf } from '../utils/invoicePdfWeb';
// Resolves to declarationShare.web.ts on the web build.
import { shareDeclarationPdf } from './declarationShare';

/**
 * Print / share for the old-gold declaration.
 *
 * Kept out of printService.printBill on purpose: that function's first act is to
 * check the saved thermal-printer preference, and a legal declaration with
 * signature and witness blocks cannot be rendered on an 80mm receipt. This
 * always goes down the A4 path.
 */

/**
 * File name for a saved/shared declaration.
 *
 * Prefixed so it can't be mistaken for a bill in a downloads folder or a
 * WhatsApp thread — `POG-5_Bhavani.pdf` sat in exactly the same shape as an
 * invoice's `INV-12_Bhavani.pdf`. Stays ASCII: sanitizeForFileName strips
 * non-alphanumerics, so a translated prefix would be dropped entirely.
 */
const buildDeclarationFileName = (declaration: PurchaseOldGold): string =>
  `Declaration_${buildPdfFileName(
    declaration.declarationNumber,
    declaration.customerSnapshot?.name,
  )}`;

/** Builds the document HTML with shop images and ornament photos inlined. */
export const buildPrintableDeclaration = async (
  declaration: PurchaseOldGold,
  shopDetails: any,
  lang: MobileLang,
): Promise<string> => {
  /**
   * Every photograph on the record, ornament by ornament plus the
   * declaration-wide set.
   *
   * This used to read `declaration.photos` alone. Ornament photos moved onto
   * the ornaments when each one started carrying its own, and the exchange
   * references attached at creation land there too - so the print asked for a
   * set that is empty on anything recent and correctly rendered nothing,
   * while the screen beside it showed the pictures. The same mistake the
   * detail screen had, in the path nobody looked at.
   *
   * Ornaments first and in order, so the document reads down the list the way
   * the ornament table above it does. The declaration-wide set follows: on an
   * older record it is all there is, and on a newer one it is whatever was
   * added to the record as a whole rather than to a piece.
   */
  const photosForPrint = declaration.includePhotosOnDeclaration === false
    ? []
    : [
        ...(declaration.items || []).flatMap((item: any) => item?.photos || []),
        ...(declaration.photos || []),
      ];

  const [printableShop, inlinePhotos, customerPhoto] = await Promise.all([
    prepareShopForPrint(shopDetails),
    prepareDeclarationPhotosForPrint(photosForPrint),
    prepareCustomerPhotoForPrint(declaration.customerSnapshot?.photoUrl),
  ]);

  return buildDeclarationHTML(
    declaration,
    { shopDetails: printableShop, mode: 'print', customerPhoto },
    lang,
    inlinePhotos,
  );
};

/**
 * Builds an empty declaration to print, hand-fill, or pass to a shopkeeper who
 * does not use the app — also the fallback when the app cannot produce a bill.
 *
 * `includeShopDetails: false` omits the letterhead, because a form carrying this
 * shop's name is wrong in someone else's hands.
 */
export const buildBlankDeclaration = async (
  shopDetails: any,
  lang: MobileLang,
  includeShopDetails: boolean,
): Promise<string> => {
  const printableShop = includeShopDetails
    ? await prepareShopForPrint(shopDetails)
    : undefined;

  // A blank form has no record behind it, so the template is handed an empty
  // shell and told to render rules instead of values.
  const empty = {
    declarationNumber: '',
    declarationDate: '',
    customerSnapshot: { name: '', phone: '', address: '' },
    ownerIsSelf: false,
    idProofType: 'aadhaar',
    idProofNumber: '',
    items: [],
    totalGrams: 0,
    totalAmount: 0,
    payout: { method: 'none' },
    photos: [],
    witnesses: [],
    mode: 'standalone',
  } as unknown as PurchaseOldGold;

  return buildDeclarationHTML(
    empty,
    { shopDetails: printableShop, mode: 'print', blank: true },
    lang,
    [],
  );
};

export const printBlankDeclaration = async (
  shopDetails: any,
  lang: MobileLang,
  includeShopDetails: boolean,
): Promise<void> => {
  const html = await buildBlankDeclaration(shopDetails, lang, includeShopDetails);
  await printHTML(html);
};

export const shareBlankDeclaration = async (
  shopDetails: any,
  lang: MobileLang,
  includeShopDetails: boolean,
): Promise<boolean> => {
  const html = await buildBlankDeclaration(shopDetails, lang, includeShopDetails);
  return shareDeclarationPdf(html, `Declaration_Form_${lang}`);
};

export const printDeclaration = async (
  declaration: PurchaseOldGold,
  shopDetails: any,
  lang: MobileLang,
): Promise<void> => {
  const html = await buildPrintableDeclaration(declaration, shopDetails, lang);
  // printHTML already branches for web (window.print) vs native (PDF + RNPrint).
  await printHTML(html);
};

export const shareDeclaration = async (
  declaration: PurchaseOldGold,
  shopDetails: any,
  lang: MobileLang,
): Promise<boolean> => {
  const html = await buildPrintableDeclaration(declaration, shopDetails, lang);
  return shareDeclarationPdf(html, buildDeclarationFileName(declaration));
};

/**
 * Saves the declaration PDF to the device instead of opening a share sheet.
 *
 * Distinct from shareDeclaration on purpose: a button labelled "Download"
 * must not open the share dialog. Mirrors OrderDetailsScreen's invoice
 * download exactly — direct A4 PDF download on web, generate-then-save to the
 * device's Downloads on native.
 */
export const downloadDeclaration = async (
  declaration: PurchaseOldGold,
  shopDetails: any,
  lang: MobileLang,
): Promise<boolean> => {
  const html = await buildPrintableDeclaration(declaration, shopDetails, lang);
  const fileName = buildDeclarationFileName(declaration);

  if (Platform.OS === 'web') {
    await downloadInvoiceA4Pdf(html, fileName);
    return true;
  }

  const filePath = await generateInvoicePDF(html, fileName);
  if (!filePath) return false;
  await downloadPDFToDevice(filePath, fileName);
  return true;
};
