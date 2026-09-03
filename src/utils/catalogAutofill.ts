/**
 * Merging a saved catalogue item into a bill row the shopkeeper may already
 * have started typing into.
 *
 * The rule, in full:
 *
 *   - the catalogue has nothing for this field  → keep what was typed
 *   - the catalogue has a value, the field is empty → fill it, silently
 *   - the catalogue has a value AND the field was filled in by hand → the
 *     catalogue wins, but the shopkeeper is told which fields changed
 *
 * The middle case is the ordinary one and must stay silent; warning on a fill
 * into an empty row would fire on every single use and train people to dismiss
 * the dialog without reading it — at which point the third case, the one that
 * actually loses work, is invisible too.
 *
 * Why "the catalogue has nothing" is not simply a null check: every numeric
 * field on a catalogue product is `default: 0` server-side, so an item saved
 * without a weight stores `grossWt: 0`, not `null`. Treating that 0 as a real
 * value is what silently erased a typed gross weight and made bills fail their
 * own "Gross Weight is required" check on a field that had been filled in —
 * the only workaround anyone found was deleting and recreating the account,
 * which "works" because it deletes the catalogue along with it.
 */

export interface MergedField {
  /** The value to put in the form. */
  value: string;
  /** A hand-entered value was replaced by a different one from the catalogue. */
  overwritten: boolean;
}

const asText = (v: unknown): string =>
  v === null || v === undefined ? '' : String(v).trim();

/**
 * A numeric catalogue field: blank is stored as 0, so 0 counts as "not set".
 * `current` is what is in the form right now.
 */
export const mergeCatalogNumber = (saved: unknown, current: unknown): MergedField => {
  const currentText = asText(current);

  if (saved === null || saved === undefined || saved === '' || Number(saved) === 0) {
    return { value: currentText, overwritten: false };
  }

  const value = String(saved);
  // Same number typed a different way ("8.075" vs "8.0750") is not a loss.
  const same = currentText !== '' && Number(currentText) === Number(value);
  return { value, overwritten: currentText !== '' && !same };
};

/** A free-text catalogue field (item name, HUID, charge description). */
export const mergeCatalogText = (saved: unknown, current: unknown): MergedField => {
  const currentText = asText(current);
  const savedText = asText(saved);

  if (savedText === '') return { value: currentText, overwritten: false };

  return {
    value: savedText,
    overwritten: currentText !== '' && currentText !== savedText,
  };
};

/**
 * Collects the labels of the fields that lost a hand-entered value, in the
 * order they appear on the form, for the "these were overwritten" dialog.
 * Returns an empty array when nothing was lost, which is the signal not to
 * show the dialog at all.
 */
export const overwrittenLabels = (
  fields: { label: string; merged: MergedField }[],
): string[] => fields.filter(f => f.merged.overwritten).map(f => f.label);
