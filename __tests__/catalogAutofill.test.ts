/**
 * The rule for merging a saved catalogue item into a half-typed bill row.
 *
 * Written after a support report from shop 9231531962: "gross weight 8.075 was
 * not working when creating a full payment bill; deleting the account and
 * recreating it fixed the problem." It was real. Picking a saved item cleared
 * the gross weight he had just typed, because every numeric field on a
 * catalogue product is stored `default: 0` and the old helper treated a stored
 * 0 as a real value. The bill then failed its own "Gross Weight is required"
 * check on a field that had been filled in, and deleting the account "worked"
 * only because it deleted the catalogue with it.
 *
 * Pure string/number logic, no rendering and no native modules, which is the
 * one place this project writes tests.
 */
import {
  mergeCatalogNumber,
  mergeCatalogText,
  overwrittenLabels,
} from '../src/utils/catalogAutofill';

describe('mergeCatalogNumber', () => {
  it('keeps a typed value when the saved item has nothing for that field', () => {
    // The reported bug: catalogue stores 0 for "blank", 8.075 was typed.
    expect(mergeCatalogNumber(0, '8.075')).toEqual({ value: '8.075', overwritten: false });
    expect(mergeCatalogNumber(null, '8.075')).toEqual({ value: '8.075', overwritten: false });
    expect(mergeCatalogNumber(undefined, '8.075')).toEqual({ value: '8.075', overwritten: false });
    expect(mergeCatalogNumber('', '8.075')).toEqual({ value: '8.075', overwritten: false });
  });

  it('fills an empty field without warning — the ordinary use', () => {
    expect(mergeCatalogNumber(5, '')).toEqual({ value: '5', overwritten: false });
    expect(mergeCatalogNumber(8.075, undefined)).toEqual({ value: '8.075', overwritten: false });
  });

  it('replaces a typed value and reports it', () => {
    expect(mergeCatalogNumber(5, '8.075')).toEqual({ value: '5', overwritten: true });
  });

  it('does not report a replacement that changes nothing', () => {
    expect(mergeCatalogNumber(5, '5')).toEqual({ value: '5', overwritten: false });
    // Same number, written differently.
    expect(mergeCatalogNumber(5, '5.00')).toEqual({ value: '5', overwritten: false });
  });

  it('leaves both empty when neither side has a value', () => {
    expect(mergeCatalogNumber(0, '')).toEqual({ value: '', overwritten: false });
  });

  it('carries three decimals through untouched', () => {
    expect(mergeCatalogNumber(8.075, '').value).toBe('8.075');
    expect(mergeCatalogNumber(0, '8.075').value).toBe('8.075');
  });
});

describe('mergeCatalogText', () => {
  it('keeps typed text when the saved item has none', () => {
    expect(mergeCatalogText('', 'ABC123')).toEqual({ value: 'ABC123', overwritten: false });
    expect(mergeCatalogText(null, 'ABC123')).toEqual({ value: 'ABC123', overwritten: false });
  });

  it('replaces typed text and reports it', () => {
    expect(mergeCatalogText('XYZ789', 'ABC123')).toEqual({ value: 'XYZ789', overwritten: true });
  });

  it('does not report identical text', () => {
    expect(mergeCatalogText('ABC123', 'ABC123')).toEqual({ value: 'ABC123', overwritten: false });
  });
});

describe('overwrittenLabels', () => {
  it('lists only the fields that lost a hand-entered value, in form order', () => {
    expect(
      overwrittenLabels([
        { label: 'Item Name', merged: mergeCatalogText('Ring', 'Bangle') },
        { label: 'Gross Wt', merged: mergeCatalogNumber(0, '8.075') },
        { label: 'Discount', merged: mergeCatalogNumber(100, '50') },
      ]),
    ).toEqual(['Item Name', 'Discount']);
  });

  it('is empty when nothing was lost, which is what suppresses the dialog', () => {
    expect(
      overwrittenLabels([
        { label: 'Gross Wt', merged: mergeCatalogNumber(0, '8.075') },
        { label: 'Discount', merged: mergeCatalogNumber(100, '') },
      ]),
    ).toEqual([]);
  });
});
