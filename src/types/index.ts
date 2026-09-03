import type { PaperPrefs } from '../constants/bill';

export interface BillItem {
  id: string;
  itemName: string;
  /** Id of the catalog product this line was auto-filled from, for stock deduction. */
  sourceItemId?: string;
  huid?: string;
  metalType: string;
  purity: string;

  pcs: string;

  grossWt: string;
  lessWt: string;
  netWt: string;

  ratePerGm: string;
  useCustomRate?: boolean;
  rateSourcePurity?: string;

  makingChargeType: 'Per Gram' | 'Fixed' | 'Percentage' | '%';
  makingCharges: string;

  /**
   * The making charge as the shopkeeper actually entered it — `'Percentage'`
   * and `'10'`. Display only. Never feed these to a calculation.
   *
   * The two fields above are the *arithmetic* pair, and for a saved order the
   * print mappings deliberately collapse them: `makingCharges` becomes the
   * resolved rupee amount and `makingChargeType` becomes `'Fixed'`, so nothing
   * downstream multiplies by weight a second time (see OrderDetailsScreen —
   * getting this wrong once made a printed making charge ~18x the real one).
   *
   * Correct for the maths, but it throws away the basis the customer agreed to,
   * which is what a bill has to show. A 10% making charge was printing as
   * "₹28,336 Fixed". These carry the original through for the column header.
   */
  makingBasisType?: string;
  makingBasisValue?: string;

  otherChargesDescription: string;
  otherChargesAmount: string;

  discountType: 'Percentage' | 'Fixed' | '%';
  discount: string;

  itemTotal: string;

  /** HSN code for GST reporting; defaults to 7113 (jewellery) server-side. */
  hsnCode?: string;

  /**
   * Optional photos of the piece being sold, so the shopkeeper can look up
   * months later which item went to which customer.
   *
   * Two fields because the two halves have different lifetimes: `pendingPhotos`
   * are local picker assets that exist only until the bill is saved and they
   * are uploaded (the bill has no id before that, and the upload route is keyed
   * on it), while `photos` are what came back from the server. A saved item
   * being edited can carry both at once.
   */
  pendingPhotos?: PendingDeclarationPhoto[];
  photos?: DeclarationPhoto[];
}

export interface ExchangeItem {
  id: string;
  type: 'Gold' | 'Silver';
  itemName?: string;
  grossWt?: string;
  lessWt?: string;
  netWt?: string;
  purity?: string;
  /** Client-only: swaps the purity dropdown for a free-text field, for old gold
   *  whose purity doesn't match a preset ("916 hallmark", "mixed", "kacha").
   *  Never sent to the API — mapOrnamentExchangesForApi whitelists fields. */
  useCustomPurity?: boolean;
  ratePerGm?: string;
  /** Total value credited for this exchanged item — the only mandatory field. */
  amount: string;
  /** Legacy field: only set on rows reconstructed from invoices saved before
   * the per-item exchange extension (aggregate gold/silver shape had a
   * single weight, no gross/less/net split). */
  weight?: string;
  /** Picked on this screen, uploaded against this row once the bill or order
   *  has an id. Never sent in the save payload - the upload route writes
   *  them, exactly as it does for item photos. */
  pendingPhotos?: PendingDeclarationPhoto[];
  /** Already uploaded against this row. Empty while creating. */
  photos?: DeclarationPhoto[];
}

/* ─── Old-gold declaration / affidavit ───
   Entirely optional. A shopkeeper who only wants to note an old ornament's name
   and the amount knocked off the bill keeps using `ExchangeItem` above and never
   touches any of this. */

export type IdProofType =
  | 'aadhaar'
  | 'pan'
  | 'voter'
  | 'driving_licence'
  | 'passport'
  | 'other';

/**
 * `standalone` — old gold bought outright for cash; the declaration is the
 * transaction record.
 * `exchange`  — old gold taken against a new ornament; the invoice is the
 * transaction record and this links to it via `orderId`.
 */
export type DeclarationMode = 'standalone' | 'exchange';

/** `none` covers an exchange where the customer owes the shop, not vice versa. */
export type PayoutMethod = 'cash' | 'online' | 'none';

export type OnlinePayoutType = 'upi' | 'bank_transfer' | 'cheque' | 'card' | 'other';

/**
 * One ID document recorded on a declaration.
 *
 * A seller may need to produce more than one (an Aadhaar plus a PAN, say), so
 * the declaration holds a list. The *customer* record still keeps a single ID
 * on file — that one only seeds the first entry here.
 */
export interface IdProofEntry {
  id: string;
  type: IdProofType;
  number: string;
  /** Only meaningful when `type` is 'other'. */
  otherLabel?: string;
  /**
   * Scans of this document. Two fields for the same reason as DeclarationItem:
   * `pendingPhotos` are local picker assets that exist only until the
   * declaration is saved and they are uploaded against this entry's `id`, while
   * `photos` are what came back from the server. An ID being edited can carry
   * both at once.
   *
   * Kept as the shop's own record and shown in the app; deliberately never
   * rendered into the printed declaration, same as the witness ID proof.
   */
  pendingPhotos?: PendingDeclarationPhoto[];
  photos?: DeclarationPhoto[];
}

export interface DeclarationItem {
  id: string;
  /** Only `description` and `grams` are required. */
  description: string;
  /** Net weight — what the declaration and its totals are based on. */
  grams: string;
  /** Gross/less split, mirroring the invoice exchange row. Optional: a
   *  shopkeeper who only knows the net weight leaves them blank and `grams`
   *  stays whatever they typed. */
  grossWt?: string;
  lessWt?: string;
  metalType?: string;
  purity?: string;
  /** Client-only: swaps the purity dropdown for free text, for old gold with
   *  no standard grade. Never sent to the API. */
  useCustomPurity?: boolean;
  ratePerGm?: string;
  amount?: string;
  /**
   * Photos of this ornament. Two fields for the same reason as InvoiceItem:
   * `pendingPhotos` are local picker assets that exist only until the
   * declaration is saved and they are uploaded against this ornament's `id`,
   * while `photos` are what came back from the server. An ornament being
   * edited can carry both at once.
   */
  pendingPhotos?: PendingDeclarationPhoto[];
  photos?: DeclarationPhoto[];
}

/** How the shop paid the customer. Every bank/UPI field is optional. */
export interface DeclarationPayout {
  method: PayoutMethod;
  onlineType?: OnlinePayoutType;
  reference?: string;
  paidAt?: string;
  bankName?: string;
  bankAccountName?: string;
  bankAccountNumber?: string;
  bankIfsc?: string;
  upiId?: string;
}

export interface DeclarationPhoto {
  url: string;
  fileId: string;
}

/** A photo picked but not yet uploaded — carries the local picker asset. */
export interface PendingDeclarationPhoto {
  uri: string;
  fileName?: string;
  type?: string;
  /**
   * Carried through for callers that need to judge the image rather than just
   * upload it — the shop header warns when the aspect ratio is far from its
   * 2480×700 banner shape. Absent on web, where the file input reports neither.
   */
  width?: number;
  height?: number;
  fileSize?: number;
}

export interface Witness {
  /** Stable per-declaration key. Witness photos are addressed by this rather
   *  than by array position — see the backend Witness type for why. Generated
   *  client-side so photos can be uploaded straight after the save. */
  id?: string;
  name: string;
  phone?: string;
  /** ID proof for this witness. Kept as the shop's own record and shown in the
   *  app; deliberately never rendered into the printed declaration, which gets
   *  shared with the customer. */
  photos?: DeclarationPhoto[];
}

/** A witness while the form is open — carries local picks not yet uploaded. */
export interface WitnessFormValue extends Witness {
  pendingPhotos?: PendingDeclarationPhoto[];
}

/**
 * The language a declaration is printed and signed in.
 *
 * Recorded on the document rather than read from settings at print time: a
 * shopkeeper running the app in English routinely buys gold from a customer who
 * only reads Marathi, and a reprint months later — possibly after the shop
 * switched app language — has to come out in the language the customer actually
 * signed under. Mirrors the four languages the app ships.
 */
export type DeclarationLanguage = 'en' | 'hi' | 'mr' | 'gu';

export interface DeclarationFormValues {
  declarationDate: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;

  mode: DeclarationMode;
  orderId?: string;

  /** What the printed declaration will be written in — see DeclarationLanguage.
   *  Seeded from the shop's declaration-language setting, overridable per
   *  declaration for the customer in front of you. */
  language: DeclarationLanguage;

  ownerIsSelf: boolean;
  familyMemberName?: string;

  /** One or more ID documents. The API payload also carries the first entry in
   *  the legacy singular fields so older records and clients keep working. */
  idProofs: IdProofEntry[];

  /** Whether the customer has the original purchase receipt. `undefined` means
   *  unanswered — only one of the two fields below is ever relevant, so the
   *  answer decides which is collected and which is printed. */
  hasPurchaseReceipt?: boolean;
  purchaseReceiptDetails?: string;
  noReceiptReason?: string;

  items: DeclarationItem[];
  payout: DeclarationPayout;
  witnesses: WitnessFormValue[];

  /** The customer's signature as an SVG string, captured on the device and
   *  drawn onto the printed declaration above the signature line.
   *
   *  Optional throughout: taking a digital signature is the shopkeeper's
   *  choice, and a declaration is still valid signed on paper after printing —
   *  which is how every declaration worked before this existed. */
  customerSignature?: string;
  /** When the signature was taken, kept alongside it because a signature on a
   *  legal declaration is only meaningful with a time attached. */
  customerSignedAt?: string;

  /**
   * Print the ornament photographs on the declaration. Defaults to TRUE,
   * unlike the bill's includeItemPhotosOnBill: a bill is the customer's copy
   * where photos are a nicety, while a declaration is the shop's record of
   * what it took in and the photograph is the evidence it exists to hold.
   */
  includePhotosOnDeclaration?: boolean;

  /** Local picks, uploaded after the declaration itself is saved. */
  pendingPhotos: PendingDeclarationPhoto[];

  /**
   * A portrait picked for the customer while filling the declaration in.
   *
   * Saved to the customer's *profile* before the declaration is created, not
   * onto the declaration itself: the server snapshots `customerSnapshot` from
   * the customer record at create time, so a photo that has not landed on the
   * profile by then never reaches the document. Absent when the customer
   * already has a profile photo, or when the shopkeeper takes none.
   */
  customerPhoto?: PendingDeclarationPhoto;
}

/** A declaration as returned by the API. */
export interface PurchaseOldGold {
  id: string;
  declarationNumber: string;
  declarationDate: string;
  customerId: string;
  mode: DeclarationMode;
  orderId?: string;
  /** Absent on declarations saved before this was recorded — those fall back to
   *  the reader's own setting, which is what they did before. */
  language?: DeclarationLanguage;
  /** `photoUrl` is snapshotted like the name beside it — the document keeps the
   *  face that was on it when signed, not whatever the profile holds today. */
  customerSnapshot: { name: string; phone: string; address?: string; photoUrl?: string };
  ownerIsSelf: boolean;
  familyMemberName?: string;
  /** Legacy singular fields, still populated from the first ID so declarations
   *  saved before multi-ID keep rendering. Read `idProofs` when present. */
  idProofType: IdProofType;
  idProofNumber: string;
  idProofOtherLabel?: string;
  idProofs?: Array<{
    /** Absent on records saved before ID-proof scans existed; those entries
     *  cannot be addressed by the photo routes until the declaration is saved
     *  again and the server backfills one. */
    id?: string;
    type: IdProofType;
    number: string;
    otherLabel?: string;
    photos?: DeclarationPhoto[];
  }>;
  hasPurchaseReceipt?: boolean;
  purchaseReceiptDetails?: string;
  noReceiptReason?: string;
  items: Array<{
    description: string;
    grams: number;
    metalType?: string;
    purity?: string;
    ratePerGm?: number;
    amount?: number;
  }>;
  totalGrams: number;
  totalAmount: number;
  payout: DeclarationPayout;
  photos: DeclarationPhoto[];
  witnesses: Witness[];
  /** Print the ornament photographs. Absent means true - older records
   *  predate the field and should keep printing them. */
  includePhotosOnDeclaration?: boolean;
  /** SVG string; absent on declarations signed on paper or saved before
   *  on-device signing existed. */
  customerSignature?: string;
  customerSignedAt?: string;
  createdAt?: string;
}

/** What the declaration print template needs to render a page. */
export interface DeclarationPrintContext {
  /** Omit to print a neutral form with blank header rules — for handing to a
   *  shopkeeper who does not use the app, where this shop's name would be wrong. */
  shopDetails?: any;
  mode: 'preview' | 'print';
  /** Render an empty form to fill in by hand: no computed totals, blank serial
   *  number and date, and a longer ornament table. */
  blank?: boolean;
  /** The customer's photo pre-inlined as a data URI. Remote URLs do not survive
   *  the PDF renderers — same reason the ornament photos are inlined. */
  customerPhoto?: string;
}

export interface JewelleryFormValues {
  invoiceDate: string;
  customerId?: string;
  customerName: string;
  address: string;
  phone: string;

  includeGst: boolean;
  customerGstin?: string;

  paymentMethod?: 'cash' | 'online';
  onlinePaymentType?: 'upi' | 'bank_transfer' | 'cheque' | 'card' | 'other';

  items: BillItem[];

  exchanges: ExchangeItem[];
  enableExchange: boolean;
  /** Optional photos of the old ornaments, captured while they are on the
   *  counter. Carried into a declaration if one is generated; kept as a plain
   *  visual record if not. Never required. */
  ornamentPhotos?: PendingDeclarationPhoto[];
  /** Off by default. When true, DeclarationDetailsModal opens right after the
   *  bill saves so the shopkeeper can finish generating the declaration this
   *  exchange already has everything else for — no separate screen. */
  generateDeclaration?: boolean;

  /**
   * Whether item photos are printed on the customer's bill. Default false: the
   * photos are the shop's own record of what was sold, and putting them on the
   * document the customer walks out with is a separate, deliberate choice.
   */
  includeItemPhotosOnBill?: boolean;

  subtotal: string;
  gst: string;
  gstPercentage?: number;
  grandTotal: string;
  orderType?: string;
  orderNumber?: string;
  orderStatus?: string;
  paymentSummary?: PaymentSummary;

  advanceAmount?: string;
  bookingPurity?: string;
  useCustomBookingRate?: boolean;
  bookingRate?: string;
}

export interface PaymentDetail {
  id: string;
  amount: string;
  date: string;
  goldRate?: string;
  weightCovered?: string;
  purity?: string;
  notes?: string;
}

export interface PaymentSummary {
  amountPaid: string;
  bookingRate: string;
  weightCovered: string;
  remainingWeight: string;
  totalWeight: string;
  estimatedBalance: string;
  payments: PaymentDetail[];
}

export type InvoiceTemplate =
  | 'traditional'
  | 'modern'
  | 'classic'
  | 'minimal'
  | 'shopHeader'
  /** For stationery that already carries the shop's details, printed by a press
   * rather than by us. Renders no shop header at all — see templates/letterhead. */
  | 'letterhead'
  /** Formal GST tax-invoice layout: ruled grid, HSN/SAC, tax summary, amount in
   * words, declaration. The first two print the shop header from app data; the
   * third omits it for pre-printed paper. See templates/taxInvoiceBase. */
  | 'taxInvoiceColor'
  | 'taxInvoiceBold'
  | 'taxInvoiceLetterhead';

export interface PrintSettings {
  invoiceLanguage: string;
  invoiceTemplate: InvoiceTemplate;
}

export interface PrintContext {
  billNo: string;
  billDate: string;
  mode: 'preview' | 'print';
  shopDetails?: any;
  // When true, itemized advance-payment rows are collapsed into a single
  // anonymized "Advance Paid" line (used for gift bills). Defaults to
  // itemized (false) when omitted.
  combinePayments?: boolean;
  /**
   * The sheet this bill is being printed on. Omitted means plain A4, which is
   * what every caller predating custom paper support wants — so templates read
   * it through `resolvePaper()` rather than requiring it. `printBill` fills it
   * in from the store; preview screens pass it too, so what the shopkeeper sees
   * matches what comes out of the printer.
   */
  paper?: PaperPrefs;
}
