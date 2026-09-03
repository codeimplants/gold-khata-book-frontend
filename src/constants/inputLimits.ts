/**
 * Central length caps for every free-text field a shopkeeper can type into.
 *
 * These exist because the fields used to be unbounded. Shopkeepers paste whole
 * paragraphs into single-line fields — most commonly name *and* full address
 * into "Shop Name" — which then overflows the printed bill header, the PDF and
 * every admin list that renders the value on one line.
 *
 * Each value must stay <= the matching cap in the backend
 * (`gold-khata-book-backend/src/common/constants/inputLimits.ts`). The client cap is
 * UX; the server cap is the guarantee.
 */
export const INPUT_LIMITS = {
  // Shop / business identity
  shopName: 60,
  ownerName: 50,
  shopDescription: 250,
  addressLine: 120,
  city: 50,
  state: 50,
  zipcode: 6,
  website: 100,
  email: 100,
  gstin: 15,

  // People
  customerName: 50,
  customerAddress: 200,
  phone: 10,
  otp: 6,

  // Catalogue / line items
  itemName: 60,
  itemDescription: 200,
  hsnCode: 8,
  metalName: 40,
  purity: 20,

  // Documents
  invoiceNumber: 20,
  supplierName: 60,
  notes: 300,
  termsAndConditions: 500,
  paymentNote: 200,

  // Old-gold declaration / affidavit
  declarationItemDescription: 120,
  idProofNumber: 30,
  idProofOtherLabel: 40,
  witnessName: 50,
  familyMemberName: 60,
  purchaseReceiptDetails: 200,
  noReceiptReason: 250,
  bankName: 60,
  bankAccountName: 60,
  bankAccountNumber: 20,
  ifsc: 11,
  upiId: 60,
  payoutReference: 40,

  // Free-text search boxes — a pasted paragraph here just wedges the filter
  searchQuery: 60,

  // Numeric fields, expressed as max digits the keypad will accept
  amount: 12,
  weight: 10,
  rate: 12,
  percentage: 5,
  quantity: 6,
} as const;

export type InputLimitKey = keyof typeof INPUT_LIMITS;

/**
 * A counter under every field is noise. Only reveal it once the user is close
 * enough to the cap that being cut off would otherwise be a surprise.
 */
export const COUNTER_THRESHOLD = 0.8;

export function shouldShowCounter(length: number, limit: number): boolean {
  return length >= Math.floor(limit * COUNTER_THRESHOLD);
}

/* ─── Standard user-facing messages ───
   Kept here so the same field reads identically wherever it is validated. */

export function requiredMessage(label: string): string {
  return `${label} is required`;
}

export function tooLongMessage(label: string, limit: number): string {
  return `${label} must be ${limit} characters or less`;
}

export function tooShortMessage(label: string, min: number): string {
  return `${label} must be at least ${min} characters`;
}

export function limitReachedMessage(label: string, limit: number): string {
  return `${label} is limited to ${limit} characters`;
}

/**
 * Trims and hard-truncates a value to its cap.
 *
 * `maxLength` on the input already blocks typing and paste, but values can also
 * arrive from a contact picker, a deep link or restored form state — this is
 * the belt-and-braces pass before anything is sent to the API.
 */
export function clampToLimit(value: string | undefined | null, limit: number): string {
  if (!value) return '';
  return value.trim().slice(0, limit);
}

/**
 * Returns a user-facing error string, or undefined when the value is fine.
 */
export function validateText(
  value: string | undefined | null,
  opts: { label: string; limit: number; required?: boolean; min?: number },
): string | undefined {
  const v = (value ?? '').trim();
  if (!v) return opts.required ? requiredMessage(opts.label) : undefined;
  if (opts.min && v.length < opts.min) return tooShortMessage(opts.label, opts.min);
  if (v.length > opts.limit) return tooLongMessage(opts.label, opts.limit);
  return undefined;
}
