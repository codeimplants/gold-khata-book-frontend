import { esc, buildPageCss, NUM_FONT } from './templates/shared';
import { formatCurrencyValue } from '../utils/formatter';
import { formatGrams, CASH_SETTLED_EPSILON, WEIGHT_SETTLED_EPSILON_GM } from '../utils/dues';
import type { RetailerStatement } from '../utils/retailerStatement';

/**
 * The retailer's account, as a one-page document.
 *
 * The formal copy of what the WhatsApp text says — same figures, same order,
 * same rule that metal and cash are never added together. It exists because a
 * retailer settling several bills at once asks for something they can put in a
 * file, and a chat message is not that.
 *
 * Deliberately NOT one of the bill templates. A bill is a document about one
 * transaction and carries GST columns, item rows and a signature line; a
 * statement is a list of balances and would have to leave most of that blank.
 */
export const buildStatementHTML = (
  statement: RetailerStatement,
  ctx: {
    retailerName: string;
    retailerPhone?: string;
    shopName?: string;
    shopAddress?: string;
    shopPhone?: string;
    gramShort: string;
    labels: {
      title: string;
      asOn: string;
      orderCol: string;
      dateCol: string;
      dueCol: string;
      settled: string;
      totalDue: string;
      credit: string;
      meltCredit: string;
      nothingDue: string;
    };
  },
): string => {
  const L = ctx.labels;
  const today = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const rows = statement.lines
    .map(line => {
      const due = line.settled
        ? `<span class="ok">${esc(L.settled)}</span>`
        : [
          line.gold > 0 ? esc(formatGrams(line.gold, ctx.gramShort)) : '',
          line.cash > 0 ? esc(formatCurrencyValue(line.cash)) : '',
        ].filter(Boolean).join(' + ');
      return `<tr>
        <td>${esc(line.orderNumber)}</td>
        <td>${esc(line.date)}</td>
        <td class="num">${due}</td>
      </tr>`;
    })
    .join('');

  const totalParts = [
    statement.totalGold > 0 ? esc(formatGrams(statement.totalGold, ctx.gramShort)) : '',
    statement.totalCash > 0 ? esc(formatCurrencyValue(statement.totalCash)) : '',
  ].filter(Boolean);

  // Credit is its own row below the total, never subtracted from it — the two
  // are different accounts, and netting them hides that the wholesaler is
  // holding the retailer's money.
  const creditRows = [
    statement.heldCash >= CASH_SETTLED_EPSILON
      ? `<tr><td colspan="2">${esc(L.credit)}</td><td class="num credit">${esc(formatCurrencyValue(statement.heldCash))}</td></tr>`
      : '',
    statement.meltCredit >= WEIGHT_SETTLED_EPSILON_GM
      ? `<tr><td colspan="2">${esc(L.meltCredit)}</td><td class="num credit">${esc(formatGrams(statement.meltCredit, ctx.gramShort))}</td></tr>`
      : '',
  ].filter(Boolean).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8" />
<style>
${buildPageCss()}
body { font-family: Georgia, 'Times New Roman', serif; color: #111827; margin: 0; }
.shop { text-align: center; margin-bottom: 18px; }
.shop h1 { font-size: 20px; margin: 0 0 2px; letter-spacing: .5px; }
.shop .sub { font-size: 11px; color: #6B7280; }
h2 { font-size: 14px; margin: 0 0 2px; }
.meta { font-size: 11px; color: #6B7280; margin-bottom: 14px; }
table { width: 100%; border-collapse: collapse; font-size: 12px; }
th { text-align: left; font-size: 10px; letter-spacing: .6px; text-transform: uppercase;
     color: #6B7280; border-bottom: 1px solid #D1D5DB; padding: 6px 4px; }
td { padding: 7px 4px; border-bottom: 1px solid #F3F4F6; }
.num { text-align: right; ${NUM_FONT} }
.ok { color: #15803D; }
.credit { color: #B45309; }
tfoot td { border-top: 2px solid #111827; border-bottom: none; font-weight: bold; padding-top: 9px; }
</style></head><body>
  <div class="shop">
    <h1>${esc(ctx.shopName || '')}</h1>
    <div class="sub">${[ctx.shopAddress, ctx.shopPhone].filter(Boolean).map(esc).join(' · ')}</div>
  </div>

  <h2>${esc(L.title)}</h2>
  <div class="meta">
    ${esc(ctx.retailerName)}${ctx.retailerPhone ? ' · ' + esc(ctx.retailerPhone) : ''}
    &nbsp;|&nbsp; ${esc(L.asOn)} ${esc(today)}
  </div>

  <table>
    <thead>
      <tr><th>${esc(L.orderCol)}</th><th>${esc(L.dateCol)}</th><th style="text-align:right">${esc(L.dueCol)}</th></tr>
    </thead>
    <tbody>${rows}</tbody>
    <tfoot>
      <tr>
        <td colspan="2">${esc(L.totalDue)}</td>
        <td class="num">${totalParts.length ? totalParts.join(' + ') : esc(L.nothingDue)}</td>
      </tr>
      ${creditRows}
    </tfoot>
  </table>
</body></html>`;
};
