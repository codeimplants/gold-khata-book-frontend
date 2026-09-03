import { generatePDF, type PDFOptions } from 'react-native-html-to-pdf';
import { Platform, Alert } from 'react-native';
import Share from 'react-native-share';
import RNFS from 'react-native-fs';
import { BILL_PAGE } from '../constants/bill';

const MM_TO_PT = 72 / 25.4;

const sanitizeForFileName = (value?: string, allowHyphen = false) => {
  if (!value) return '';
  const trimmed = value.trim();
  const collapsed = trimmed.replace(/\s+/g, '');
  const pattern = allowHyphen ? /[^a-zA-Z0-9-]/g : /[^a-zA-Z0-9]/g;
  return collapsed.replace(pattern, '');
};

export const buildPdfFileName = (identifier?: string, customerName?: string) => {
  const idPart = sanitizeForFileName(identifier, true) || 'document';
  const customerPart = sanitizeForFileName(customerName);
  return customerPart ? `${idPart}_${customerPart}` : idPart;
};

/**
 * Kept so a caller can report WHY the PDF failed after the fact.
 *
 * generateInvoicePDF resolves `null` rather than throwing, deliberately —
 * every caller has a fallback and none of them should be forced into a
 * try/catch. But "null" alone left the print path unable to say anything more
 * useful than "it did not work".
 */
let lastError: unknown = null;

/** react-native-html-to-pdf's Android singleton refusing a concurrent job. */
const isConverterBusy = (error: unknown): boolean =>
  String((error as any)?.code || (error as any)?.message || '').includes('CONVERSION_IN_PROGRESS');

/**
 * Generates a PDF from an HTML string.
 * Android: written to <externalFilesDir>/invoices/ - app-private external
 * storage, no WRITE_EXTERNAL_STORAGE permission needed on any Android
 * version, fully covered by the app's own FileProvider (external-files-path
 * root in file_provider_paths.xml).
 * NOTE: `directory` must be a plain relative subfolder name, not an absolute
 * path - react-native-html-to-pdf's Android module does
 * File(getExternalFilesDir(null), directory), so an absolute-looking string
 * gets mis-appended as a bogus nested path instead of acting as an override.
 */
export const generateInvoicePDF = async (
  html: string,
  fileName: string,
  /** Set by the retry below — clears a latched Android converter first. */
  isRetry = false,
): Promise<string | null> => {
  try {
    lastError = null;
    const directory = Platform.OS === 'android' ? 'invoices' : 'Documents';

    const options = {
      html,
      fileName,
      directory,
      base64: false,
      // iOS 16.4+: WKWebView print formatter drops CSS backgrounds by default.
      // Android + older iOS rely on the print-color-adjust rule in the HTML.
      shouldPrintBackgrounds: true,
      // Fixed A4 page (matches the template's PAGE_CSS @page size). The
      // full-bleed templates fill the sheet edge-to-edge, so there's no
      // left/right/top whitespace; short invoices leave blank space at the
      // bottom, long ones paginate across A4 pages. One deterministic size
      // means Share, Download and Print all use the exact same PDF.
      width: Math.round(BILL_PAGE.WIDTH_MM * MM_TO_PT),
      height: Math.round(BILL_PAGE.HEIGHT_MM * MM_TO_PT),
      // Android only, and only on the retry — see the catch below.
      ...(isRetry ? { forceReset: true } : {}),
    } as PDFOptions;

    const file = await generatePDF(options);

    if (file?.filePath) {
      return file.filePath;
    }
    return null;
  } catch (error) {
    lastError = error;
    console.error('PDF Generation Error:', error);

    // The Android converter is a process-wide singleton behind an
    // `mIsCurrentlyConverting` latch, and it releases that latch only when the
    // WebView it drives reaches onPageFinished — or when its own 30s timeout
    // fires. A conversion whose page never settles therefore blocks every
    // later one with CONVERSION_IN_PROGRESS, including the very next tap of
    // Print. The library exposes `forceReset` for exactly this, and nothing
    // was passing it, so the shopkeeper had to wait the timeout out without
    // being told that is what was happening.
    //
    // Once only: a second CONVERSION_IN_PROGRESS after a reset means a
    // conversion really is running, and retrying in a loop would fight it.
    if (!isRetry && isConverterBusy(error)) {
      console.warn('[pdf] converter latched — resetting and retrying once');
      return generateInvoicePDF(html, fileName, true);
    }
    return null;
  }
};

/**
 * The reason a PDF failed, in a form worth showing someone.
 *
 * The failures come back as `{ code, message }` from the native module —
 * PDF_WRITE_FAILED, CONVERSION_IN_PROGRESS, File not found. Callers used to
 * discard all of it and show one fixed sentence, so a report of "print error"
 * carried nothing to act on and could not be told apart from a cancelled
 * print dialog.
 */
export const describePdfError = (error: unknown): string => {
  if (!error) return '';
  const anyError = error as any;
  const code = typeof anyError.code === 'string' ? anyError.code : '';
  const message = typeof anyError.message === 'string' ? anyError.message : String(error);
  return code && !message.includes(code) ? `${code}: ${message}` : message;
};

/** The last failure from generateInvoicePDF, for callers that report why. */
export const lastPdfError = (): unknown => lastError;

/**
 * Downloads the PDF directly to the device's Downloads folder.
 * Falls back to the share sheet if direct saving is restricted.
 */
export const downloadPDFToDevice = async (
  filePath: string,
  fileName: string,
) => {
  try {
    const fileUri = filePath.startsWith('file://') ? filePath : `file://${filePath}`;
    
    if (Platform.OS === 'android') {
      try {
        // Try direct copy to public Downloads folder
        const destPath = `${RNFS.ExternalStorageDirectoryPath}/Download/${fileName}.pdf`;
        
        // Remove existing file if it exists to prevent copy error
        const exists = await RNFS.exists(destPath);
        if (exists) {
          await RNFS.unlink(destPath);
        }

        await RNFS.copyFile(filePath, destPath);
        
        Alert.alert(
          'Downloaded! ✅',
          `Invoice saved to your Downloads folder as "${fileName}.pdf"`,
        );
      } catch (copyError) {
        console.log('Direct download failed, falling back to system picker:', copyError);
        // Fallback for Android 11+ (Scoped Storage): Use the share sheet but 
        // specifically for saving files if available, otherwise general share.
        await Share.open({
          title: 'Save Invoice',
          url: fileUri,
          type: 'application/pdf',
          failOnCancel: false,
        });
      }
    } else {
      // iOS: Open the "Save to Files" picker
      await Share.open({
        title: 'Save Invoice',
        url: fileUri,
        saveToFiles: true,
      });
    }
  } catch (error) {
    console.error('Download Error:', error);
    Alert.alert('Error', 'Could not save the PDF. Please try again or use the Share option.');
  }
};

/**
 * Opens the system share sheet for a PDF file.
 * Use this only for the Share action, not Download.
 */
export const sharePDF = async (filePath: string, title: string) => {
  try {
    const fileUri = filePath.startsWith('file://')
      ? filePath
      : `file://${filePath}`;

    await Share.open({
      title,
      urls: [fileUri],
      type: 'application/pdf',
      failOnCancel: false,
    });
  } catch (error: any) {
    if (error?.message === 'User did not share' || error?.dismissedAction) {
      return;
    }
    console.error('Share Error:', error);
  }
};
