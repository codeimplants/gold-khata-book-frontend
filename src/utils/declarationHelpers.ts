import {
  addPurchaseOldGold,
  updatePurchaseOldGold,
  uploadPurchaseOldGoldPhotos,
  uploadDeclarationItemPhotos,
  uploadIdProofPhotos,
  uploadWitnessPhotos,
  syncCustomerForDeclaration,
} from '../store/data/dataSlice';
import type { Customer } from '../store/data/dataSlice';
import type { AppDispatch } from '../store';
import type {
  DeclarationFormValues,
  DeclarationItem,
  IdProofEntry,
  PurchaseOldGold,
  WitnessFormValue,
} from '../types';
import { makeEmptyWitness } from './witness';

/**
 * Uploads each witness's ID proof against a declaration that already exists.
 *
 * Sequential, not parallel: every response carries the whole updated
 * declaration, so concurrent uploads would each overwrite the other's
 * witnesses. At two witnesses of two photos this costs nothing.
 *
 * A fulfilled action with a null payload is guest mode — there is no backend
 * to upload to and the local uris are already on the record, so that is a
 * success, not a failure.
 */
export const uploadPendingWitnessPhotos = async (
  dispatch: AppDispatch,
  declaration: PurchaseOldGold,
  witnesses: WitnessFormValue[],
): Promise<{ declaration: PurchaseOldGold; failed: boolean }> => {
  let current = declaration;
  let failed = false;

  for (const witness of witnesses) {
    const photos = witness.pendingPhotos || [];
    if (!witness.id || photos.length === 0) continue;

    const action = await dispatch(
      uploadWitnessPhotos({
        declarationId: current.id,
        witnessId: witness.id,
        photos,
      }),
    );
    if (uploadWitnessPhotos.fulfilled.match(action)) {
      if (action.payload) current = action.payload as PurchaseOldGold;
    } else {
      failed = true;
    }
  }

  return { declaration: current, failed };
};

/**
 * Uploads each ornament's photos against a declaration that already exists.
 *
 * Same contract as the witness upload above, for the same reasons: sequential
 * because every response carries the whole updated declaration, addressed by
 * the ornament's own id rather than its index, and a fulfilled action with a
 * null payload is guest mode rather than a failure.
 */
export const uploadPendingItemPhotos = async (
  dispatch: AppDispatch,
  declaration: PurchaseOldGold,
  items: DeclarationItem[],
): Promise<{ declaration: PurchaseOldGold; failed: boolean }> => {
  let current = declaration;
  let failed = false;

  for (const item of items) {
    const photos = item.pendingPhotos || [];
    if (!item.id || photos.length === 0) continue;

    const action = await dispatch(
      uploadDeclarationItemPhotos({
        declarationId: current.id,
        itemId: item.id,
        photos,
      }),
    );
    if (uploadDeclarationItemPhotos.fulfilled.match(action)) {
      if (action.payload) current = action.payload as PurchaseOldGold;
    } else {
      failed = true;
    }
  }

  return { declaration: current, failed };
};

/**
 * Uploads the scans of each ID document against a declaration that already
 * exists.
 *
 * Same contract as the witness and ornament uploads above, for the same
 * reasons: sequential because every response carries the whole updated
 * declaration, addressed by the entry's own id rather than its index, and a
 * fulfilled action with a null payload is guest mode rather than a failure.
 */
export const uploadPendingIdProofPhotos = async (
  dispatch: AppDispatch,
  declaration: PurchaseOldGold,
  idProofs: IdProofEntry[],
): Promise<{ declaration: PurchaseOldGold; failed: boolean }> => {
  let current = declaration;
  let failed = false;

  for (const entry of idProofs) {
    const photos = entry.pendingPhotos || [];
    // A blank row never reaches the server, so it has no entry to hang scans
    // on — skip it rather than uploading against an id that does not exist.
    if (!entry.id || !entry.number?.trim() || photos.length === 0) continue;

    const action = await dispatch(
      uploadIdProofPhotos({
        declarationId: current.id,
        idProofId: entry.id,
        photos,
      }),
    );
    if (uploadIdProofPhotos.fulfilled.match(action)) {
      if (action.payload) current = action.payload as PurchaseOldGold;
    } else {
      failed = true;
    }
  }

  return { declaration: current, failed };
};

/**
 * Saves a declaration and uploads whatever photos came with it, in one call.
 *
 * Shared by every place a declaration can now be generated without a separate
 * screen: right after an invoice or advance order saves (when "Generate
 * Declaration" was ticked), and later from Order Details' "Generate
 * Declaration" button if it was skipped the first time. One implementation so
 * the three call sites can't drift on how saving + photo upload is sequenced.
 *
 * Photo upload failure does not fail the whole operation — the declaration
 * itself is the thing that must exist; a photo problem surfaces as a toast
 * from the caller, not a lost declaration.
 *
 * The customer's phone and portrait are written to their *profile* first, and
 * that step can fail the whole operation: the server snapshots the customer
 * record at create time and refuses a declaration for a customer with no phone,
 * so there is no declaration to save until that write lands. See
 * syncCustomerForDeclaration.
 */
export const generateDeclaration = async (
  dispatch: AppDispatch,
  values: DeclarationFormValues,
): Promise<{
  declaration: PurchaseOldGold;
  photosFailed: boolean;
  /**
   * A scan of somebody's ID — the seller's own documents or a witness's —
   * did not upload. Separate from photosFailed because the ornament-photo
   * retry cannot re-send these, and the two are reported as one because they
   * are the same kind of miss and one toast is enough.
   */
  idPhotosFailed: boolean;
  /** The portrait did not reach the profile, so the document has no face on
   *  it. Non-fatal, and separate again: nothing here can re-send it. */
  customerPhotoFailed: boolean;
}> => {
  const syncAction = await dispatch(
    syncCustomerForDeclaration({
      customerId: values.customerId,
      phone: values.customerPhone,
      photo: values.customerPhoto,
    }),
  );
  if (!syncCustomerForDeclaration.fulfilled.match(syncAction)) {
    throw new Error(
      String((syncAction as any).payload || 'Failed to save the customer details'),
    );
  }
  const customerPhotoFailed = !!syncAction.payload?.photoFailed;

  const action = await dispatch(addPurchaseOldGold(values));
  if (!addPurchaseOldGold.fulfilled.match(action)) {
    throw new Error(String((action as any).payload || 'Failed to save declaration'));
  }
  let declaration = action.payload as PurchaseOldGold;
  let photosFailed = false;

  if (values.pendingPhotos.length > 0) {
    const photoAction = await dispatch(
      uploadPurchaseOldGoldPhotos({
        declarationId: declaration.id,
        photos: values.pendingPhotos,
      }),
    );
    if (uploadPurchaseOldGoldPhotos.fulfilled.match(photoAction) && photoAction.payload) {
      declaration = photoAction.payload as PurchaseOldGold;
    } else {
      photosFailed = true;
    }
  }

  // Ornament photos are per item now, so they upload alongside the witness ID
  // proof rather than as one declaration-wide set. A failure here is folded
  // into the same non-blocking `photosFailed` the caller already surfaces.
  const itemResult = await uploadPendingItemPhotos(
    dispatch,
    declaration,
    values.items,
  );
  declaration = itemResult.declaration;
  if (itemResult.failed) photosFailed = true;

  const idProofResult = await uploadPendingIdProofPhotos(
    dispatch,
    declaration,
    values.idProofs,
  );
  declaration = idProofResult.declaration;

  const witnessResult = await uploadPendingWitnessPhotos(
    dispatch,
    declaration,
    values.witnesses,
  );
  declaration = witnessResult.declaration;

  return {
    declaration,
    photosFailed,
    idPhotosFailed: witnessResult.failed || idProofResult.failed,
    customerPhotoFailed,
  };
};

/**
 * Reads a saved declaration back into the shape its form edits.
 *
 * The inverse of `buildPurchaseOldGoldPayload`. Two asymmetries are deliberate:
 *
 * - `pendingPhotos` and each witness's `pendingPhotos` start empty. Those are
 *   *new* local picks awaiting upload; the photos already on the record stay on
 *   it untouched, because the update payload deliberately sends no `photos` at
 *   all. Editing therefore adds photos and never silently drops the existing
 *   ones.
 * - `language` falls back to the reader's setting only when the record predates
 *   the field. Anything saved since carries its own, and editing is the one
 *   place that value is meant to be changeable.
 */
export const mapDeclarationToFormValues = (
  declaration: PurchaseOldGold,
  fallbackLanguage: DeclarationFormValues['language'],
): DeclarationFormValues => ({
  declarationDate: (declaration.declarationDate || '').split('T')[0],
  customerId: declaration.customerId,
  customerName: declaration.customerSnapshot?.name || '',
  customerPhone: declaration.customerSnapshot?.phone || '',
  customerAddress: declaration.customerSnapshot?.address || '',
  mode: declaration.mode,
  orderId: declaration.orderId,
  language: declaration.language ?? fallbackLanguage,
  ownerIsSelf: declaration.ownerIsSelf ?? true,
  familyMemberName: declaration.familyMemberName || '',
  // Records written before multi-ID carry only the singular fields.
  idProofs:
    declaration.idProofs?.length
      ? declaration.idProofs.map((e, idx) => ({
          // The stored id, never a fresh one — same reasoning as the ornaments
          // below: scans are addressed by it, so regenerating it would make the
          // update look like a different document and orphan its photos.
          // Only entries written before ids existed need a stand-in.
          id: e.id || `idp_edit_${idx}`,
          type: e.type,
          number: e.number,
          otherLabel: e.otherLabel || '',
          // Deliberately empty, and no `photos` copied alongside it: these are
          // new local picks, and the scans already on the record are read from
          // the record itself — same asymmetry as the witness entries below.
          pendingPhotos: [],
        }))
      : [
          {
            id: 'idp_edit_0',
            type: declaration.idProofType,
            number: declaration.idProofNumber || '',
            otherLabel: declaration.idProofOtherLabel || '',
            pendingPhotos: [],
          },
        ],
  hasPurchaseReceipt: declaration.hasPurchaseReceipt,
  purchaseReceiptDetails: declaration.purchaseReceiptDetails || '',
  noReceiptReason: declaration.noReceiptReason || '',
  items: (declaration.items || []).map((i: any, idx: number) => ({
    // The stored id, never a fresh one. Ornament photos are addressed by it, so
    // regenerating it here would make the update look like a different ornament:
    // reconcileItems would mint a new id, and the photos of the old one would be
    // treated as orphaned and deleted. Only pre-id records need a stand-in.
    id: i.id || `orn_edit_${idx}`,
    description: i.description || '',
    grams: String(i.grams ?? ''),
    grossWt: String(i.grossWt ?? ''),
    lessWt: String(i.lessWt ?? ''),
    metalType: (i.metalType || 'Gold') as 'Gold' | 'Silver',
    purity: i.purity || '',
    ratePerGm: i.ratePerGm ? String(i.ratePerGm) : '',
    amount: i.amount ? String(i.amount) : '',
    // Already uploaded against this ornament. pendingPhotos deliberately starts
    // empty — those are new local picks, same asymmetry as the witness ones.
    photos: i.photos || [],
    pendingPhotos: [],
  })),
  payout: declaration.payout || { method: 'cash' },
  // Carried back so an edit shows the signature already on the record,
  // and so rotating it on a saved declaration actually has something to
  // act on. buildPurchaseOldGoldPayload only sends the field when it is
  // set, and the API preserves an absent one - so dropping it here meant
  // the signature survived the edit but was invisible while making it.
  includePhotosOnDeclaration: declaration.includePhotosOnDeclaration !== false,
  customerSignature: declaration.customerSignature,
  witnesses: (declaration.witnesses || []).map((w: any) => ({
    id: w.id,
    name: w.name || '',
    phone: w.phone || '',
    pendingPhotos: [],
  })),
  pendingPhotos: [],
});

/**
 * Saves an edit to an existing declaration, mirroring `generateDeclaration`.
 *
 * Same contract on photos: the declaration itself is what must persist, and a
 * failed upload of newly added photos surfaces as a toast rather than losing
 * the edit.
 */
export const saveDeclarationEdit = async (
  dispatch: AppDispatch,
  id: string,
  values: DeclarationFormValues,
): Promise<{
  declaration: PurchaseOldGold;
  photosFailed: boolean;
  /** Same contract as generateDeclaration's — see there. */
  idPhotosFailed: boolean;
}> => {
  const action = await dispatch(updatePurchaseOldGold({ id, form: values }));
  if (!updatePurchaseOldGold.fulfilled.match(action)) {
    throw new Error(String((action as any).payload || 'Failed to update declaration'));
  }
  let declaration = action.payload as PurchaseOldGold;
  let photosFailed = false;

  if (values.pendingPhotos.length > 0) {
    const photoAction = await dispatch(
      uploadPurchaseOldGoldPhotos({
        declarationId: declaration.id,
        photos: values.pendingPhotos,
      }),
    );
    if (uploadPurchaseOldGoldPhotos.fulfilled.match(photoAction) && photoAction.payload) {
      declaration = photoAction.payload as PurchaseOldGold;
    } else {
      photosFailed = true;
    }
  }

  // Ornament photos are per item now, so they upload alongside the witness ID
  // proof rather than as one declaration-wide set. A failure here is folded
  // into the same non-blocking `photosFailed` the caller already surfaces.
  const itemResult = await uploadPendingItemPhotos(
    dispatch,
    declaration,
    values.items,
  );
  declaration = itemResult.declaration;
  if (itemResult.failed) photosFailed = true;

  const idProofResult = await uploadPendingIdProofPhotos(
    dispatch,
    declaration,
    values.idProofs,
  );
  declaration = idProofResult.declaration;

  const witnessResult = await uploadPendingWitnessPhotos(
    dispatch,
    declaration,
    values.witnesses,
  );
  declaration = witnessResult.declaration;

  return {
    declaration,
    photosFailed,
    idPhotosFailed: witnessResult.failed || idProofResult.failed,
  };
};

/**
 * Builds the declaration form values for an exchange, prefilling everything
 * the exchange itself already supplies (customer, ornaments, date, orderId,
 * payout direction, any photos already captured) plus the customer's ID
 * proof when one is on file. `DeclarationDetailsModal` only has to collect
 * what this cannot know: ownership, and ID proof when the customer has none
 * saved yet.
 */
export const buildExchangeDeclarationPrefill = (args: {
  orderId: string;
  customer?: Customer;
  customerId: string;
  invoiceDate?: string;
  exchanges: Array<{
    id?: string;
    itemName?: string;
    type?: string;
    netWt?: string;
    weight?: string;
    purity?: string;
    ratePerGm?: string;
    amount?: string;
  }>;
  /** grandTotal > 0 means the customer paid something, so the shop owes
   *  nothing back for the exchange; grandTotal <= 0 means the exchange
   *  credit covered the bill and the shop may owe the difference. */
  grandTotal: number;
  pendingPhotos?: DeclarationFormValues['pendingPhotos'];
  /** The shop's declaration language, from `useTranslation()`. Passed in rather
   *  than read here because this is a plain function, not a hook. */
  language: DeclarationFormValues['language'];
}): DeclarationFormValues => ({
  declarationDate: args.invoiceDate || new Date().toISOString().split('T')[0],
  customerId: args.customerId,
  customerName: args.customer?.name || '',
  customerPhone: args.customer?.phone || '',
  customerAddress: (args.customer as any)?.address || '',
  mode: 'exchange',
  orderId: args.orderId,
  language: args.language,
  ownerIsSelf: true,
  familyMemberName: '',
  // Prefill, not lock: the customer's saved ID seeds the first row, but the
  // actual seller may be a family member with different documents.
  idProofs: [
    {
      id: `idp_prefill_${args.orderId}`,
      type: args.customer?.idProofType || 'aadhaar',
      number: args.customer?.idProofNumber || '',
      otherLabel: '',
      pendingPhotos: [],
    },
  ],
  purchaseReceiptDetails: '',
  noReceiptReason: '',
  items: args.exchanges.map((ex, idx) => ({
    id: ex.id || `ex_${idx}`,
    description: ex.itemName || `${ex.type || 'Gold'} ornament`,
    grams: String(ex.netWt || ex.weight || ''),
    metalType: ex.type || 'Gold',
    purity: ex.purity || '',
    ratePerGm: ex.ratePerGm || '',
    amount: ex.amount || '',
  })),
  payout: { method: args.grandTotal > 0 ? 'none' : 'cash' },
  witnesses: [makeEmptyWitness(), makeEmptyWitness()],
  // Matches makeInitialDeclaration - see the note there.
  includePhotosOnDeclaration: true,
  pendingPhotos: args.pendingPhotos || [],
});
