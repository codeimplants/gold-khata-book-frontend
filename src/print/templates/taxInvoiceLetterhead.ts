import { JewelleryFormValues, PrintContext } from '../../types';
import { MobileLang } from './shared';
import { buildTaxInvoiceHTML } from './taxInvoiceBase';

/**
 * Formal tax invoice for the shop's own pre-printed stationery.
 *
 * Same document as the other two, with the shop header omitted because the press
 * already printed it. The blank strip it needs at the top of every page comes
 * from Header Space in Print Settings, via @page margins — see buildPageCss.
 *
 * Like `letterhead`, this must not fall back to rendering the shop's details
 * when they are missing: printing them would land on top of the letterhead.
 */
export const buildTaxInvoiceLetterheadHTML = (
  values: JewelleryFormValues,
  ctx: PrintContext,
  lang: MobileLang,
): string =>
  buildTaxInvoiceHTML(values, ctx, lang, {
    showShopHeader: false,
    accent: '',
    headFill: '',
    rule: '#000000',
  });
