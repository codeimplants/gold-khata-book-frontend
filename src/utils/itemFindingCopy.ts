import { formatCurrencyValue, formatNumber } from './formatter';
import type { ItemFinding } from './itemPlausibility';

export interface ItemFindingCopy {
  title: string;
  description: string;
  /** Always present, so the primary button is never a bare "Confirm". */
  confirmLabel: string;
  /** Dismisses. Deliberately plain — see the note on emphasis below. */
  cancelLabel: string;
  /**
   * True when confirming applies the suggested numbers. False when we have no
   * confident correction, in which case confirming should just send the
   * shopkeeper back to the field — still the primary action, because "go look
   * at it" beats "keep it" whenever we cannot say what the right value is.
   */
  canApply: boolean;
}

/**
 * Whole sentences with named slots, never concatenated fragments.
 *
 * The tempting shortcut — `t('reads') + weight + t('at') + rate` — bakes English
 * word order into every language. The shop this was written for bills in
 * Marathi, where the verb lands at the end and "at ₹15,123/gm" is a postposition
 * on the rate, so a fragment chain reads as broken Marathi no matter how each
 * fragment is translated. Each language owns its full sentence instead.
 */
const fill = (template: string, vars: Record<string, string>): string =>
  template.replace(/\{(\w+)\}/g, (whole, key) => vars[key] ?? whole);

/**
 * Wording for a plausibility finding, shared by the invoice form and the
 * advance-order form so the two cannot drift into saying different things about
 * the same mistake.
 *
 * Two rules the production case earned:
 *
 *  - **Argue in bill money, not in rate.** The old copy said "you entered
 *    Rs.1,34,550/g, today's rate is Rs.14,104/g". A shopkeeper dismissed exactly
 *    that and shipped a 10x overcharge. "This line will total Rs.7,77,699. At
 *    today's rate it would be Rs.77,770" is the same fact in the units they are
 *    accountable for.
 *
 *  - **Name the field and carry the corrected number.** Never "something looks
 *    wrong" — the item card already showed a Rs.1.37-crore total seven times and
 *    that was not enough to locate the weight box.
 *
 * Nothing here blocks. The confirm label is the safe path and gets the primary
 * button; dismissing stays one tap away.
 */
export const describeItemFinding = (
  finding: ItemFinding,
  t: (key: string) => string,
): ItemFindingCopy => {
  const unit = t('common.gramShort');
  const gm = (n: number) => `${formatNumber(n, 3)} ${unit}`;
  const perGm = (n: number) => `${formatCurrencyValue(n)}/${unit}`;
  const cancelLabel = t('invoice.plausibility.keep');

  switch (finding.kind) {
    case 'scaled-pair':
      return {
        title: t('invoice.plausibility.pairTitle'),
        description: fill(t('invoice.plausibility.pairDescription'), {
          weight: gm(finding.weight),
          rate: perGm(finding.rate),
          suggestedWeight: gm(finding.suggestedWeight!),
          suggestedRate: perGm(finding.suggestedRate!),
          // The reason this survived to production: correcting it costs nothing,
          // and saying so is what makes the correction feel safe to accept.
          total: formatCurrencyValue(finding.enteredTotal),
        }),
        confirmLabel: fill(t('invoice.plausibility.pairConfirm'), {
          weight: gm(finding.suggestedWeight!),
          rate: perGm(finding.suggestedRate!),
        }),
        cancelLabel,
        canApply: true,
      };

    case 'weight-too-high': {
      const canApply = finding.suggestedWeight !== undefined;
      return {
        title: t('invoice.plausibility.weightTitle'),
        description:
          fill(t('invoice.plausibility.weightDescription'), {
            weight: gm(finding.weight),
            total: formatCurrencyValue(finding.enteredTotal),
          }) +
          (canApply
            ? ' ' + fill(t('invoice.plausibility.weightSuggestion'), {
              weight: gm(finding.suggestedWeight!),
              total: formatCurrencyValue(finding.suggestedTotal!),
            })
            : ''),
        confirmLabel: canApply
          ? fill(t('invoice.plausibility.weightConfirm'), { weight: gm(finding.suggestedWeight!) })
          : t('invoice.plausibility.edit'),
        cancelLabel,
        canApply,
      };
    }

    case 'rate-too-high':
    case 'rate-too-low': {
      const canApply = finding.suggestedRate !== undefined;
      const hint =
        finding.kind === 'rate-too-high'
          ? t('invoice.plausibility.per10Hint')
          : t('invoice.plausibility.perGramHint');
      return {
        title: t('invoice.plausibility.rateTitle'),
        description:
          fill(t('invoice.plausibility.rateDescription'), {
            total: formatCurrencyValue(finding.enteredTotal),
            rate: perGm(finding.rate),
          }) +
          (canApply
            ? ' ' + fill(t('invoice.plausibility.rateSuggestion'), {
              rate: perGm(finding.suggestedRate!),
              total: formatCurrencyValue(finding.suggestedTotal!),
            })
            : '') +
          ' ' + hint,
        confirmLabel: canApply
          ? fill(t('invoice.plausibility.rateConfirm'), { rate: perGm(finding.suggestedRate!) })
          : t('invoice.plausibility.edit'),
        cancelLabel,
        canApply,
      };
    }
  }
};
