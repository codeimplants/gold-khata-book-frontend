import { JewelleryFormValues, PrintContext } from '../../types';
import { MobileLang } from './shared';
import { buildTaxInvoiceHTML } from './taxInvoiceBase';

/**
 * Formal tax invoice, pure ink, with the shop's header from app data.
 *
 * No fills and no colour anywhere — black rules on white. This is the variant to
 * reach for when legibility is the whole requirement: a shopkeeper on a laser
 * with a tired cartridge, or a customer who could not read the old bill at all.
 * Nothing here depends on a background printing, so what appears on screen is
 * exactly what reaches the paper.
 */
export const buildTaxInvoiceBoldHTML = (
  values: JewelleryFormValues,
  ctx: PrintContext,
  lang: MobileLang,
): string =>
  buildTaxInvoiceHTML(values, ctx, lang, {
    showShopHeader: true,
    accent: '',
    headFill: '',
    rule: '#000000',
  });
