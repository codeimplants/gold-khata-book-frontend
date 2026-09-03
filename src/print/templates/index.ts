import { JewelleryFormValues, PrintContext, InvoiceTemplate } from '../../types';
import { MobileLang } from './shared';
import { buildTraditionalHTML } from './traditional';
import { buildModernHTML } from './modern';
import { buildClassicHTML } from './classic';
import { buildMinimalHTML } from './minimal';
import { buildShopHeaderHTML } from './shopHeader';
import { buildLetterheadHTML } from './letterhead';
import { buildTaxInvoiceColorHTML } from './taxInvoiceColor';
import { buildTaxInvoiceBoldHTML } from './taxInvoiceBold';
import { buildTaxInvoiceLetterheadHTML } from './taxInvoiceLetterhead';

export {
  buildTraditionalHTML,
  buildModernHTML,
  buildClassicHTML,
  buildMinimalHTML,
  buildShopHeaderHTML,
  buildLetterheadHTML,
  buildTaxInvoiceColorHTML,
  buildTaxInvoiceBoldHTML,
  buildTaxInvoiceLetterheadHTML,
};

export const buildBillHTML = (
  values: JewelleryFormValues,
  ctx: PrintContext,
  lang: MobileLang = 'en',
  template: InvoiceTemplate = 'minimal',
): string => {
  switch (template) {
    case 'traditional': return buildTraditionalHTML(values, ctx, lang);
    case 'modern': return buildModernHTML(values, ctx, lang);
    case 'classic': return buildClassicHTML(values, ctx, lang);
    case 'shopHeader':
      return ctx.shopDetails?.shopHeader
        ? buildShopHeaderHTML(values, ctx, lang)
        : buildMinimalHTML(values, ctx, lang);
    // No shopHeader-style fallback here: this template renders no shop details
    // by design, because they are pre-printed on the paper. Falling back to
    // `minimal` would print the shop's name on top of its own letterhead.
    case 'letterhead': return buildLetterheadHTML(values, ctx, lang);
    case 'taxInvoiceColor': return buildTaxInvoiceColorHTML(values, ctx, lang);
    case 'taxInvoiceBold': return buildTaxInvoiceBoldHTML(values, ctx, lang);
    // Same "no fallback" rule as `letterhead`: this one also renders no shop
    // details because the paper already carries them.
    case 'taxInvoiceLetterhead': return buildTaxInvoiceLetterheadHTML(values, ctx, lang);
    case 'minimal':
    default: return buildMinimalHTML(values, ctx, lang);
  }
};
