import { JewelleryFormValues, PrintContext } from '../../types';
import { MobileLang } from './shared';
import { buildTaxInvoiceHTML } from './taxInvoiceBase';

/**
 * Formal tax invoice, colour-led, with the shop's header from app data.
 *
 * The colour is confined to the header band and the table head. It never
 * carries information on its own: every figure, rule and label is legible in
 * pure black even when the browser drops background graphics — which it does by
 * default on web unless the shopkeeper ticks the box. A template that only reads
 * correctly in colour is a template that prints wrong for most people.
 */
export const buildTaxInvoiceColorHTML = (
  values: JewelleryFormValues,
  ctx: PrintContext,
  lang: MobileLang,
): string =>
  buildTaxInvoiceHTML(values, ctx, lang, {
    showShopHeader: true,
    accent: '#1e3a5f',
    headFill: '#eef2f7',
    rule: '#1e3a5f',
  });
