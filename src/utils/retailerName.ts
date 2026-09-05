/**
 * The one rule for what a retailer is CALLED, shared by every form that can
 * create or edit one.
 *
 * A retailer is added from three places — the Customers tab's Add modal, the
 * inline form on Select Retailer, and the edit sheet on a retailer's own screen
 * — and the rule has to be identical in all three. Three copies of a naming
 * rule is how the same retailer ends up displayed one way on a bill and another
 * way in a list.
 *
 * The form requires an OWNER name and leaves the shop name optional, but
 * `customer.name` is what bills, lists, search, sorting, the dues views and the
 * print templates all read, and it must never be empty. So it is derived rather
 * than typed: the shop when the shop has a name, the person otherwise.
 *
 * Preferring the shop is deliberate. A bill made out to "Krishna Jewellers"
 * is the document the retailer expects; falling back to "Ramesh Patel" only
 * when there is no shop name to use means a bill always carries the most
 * specific name on file.
 */
export const retailerDisplayName = (
  shopName: string | undefined,
  ownerName: string | undefined,
): string => (shopName?.trim() || ownerName?.trim() || '');

/**
 * The line to show UNDER the display name, or `undefined` when there is
 * nothing worth adding.
 *
 * Only the owner, and only when the title is the shop — repeating "Ramesh
 * Patel" directly beneath "Ramesh Patel" tells the reader nothing, which is
 * exactly what happens for a retailer with no shop name if this is not checked.
 */
export const retailerSubtitle = (customer: {
  name?: string;
  ownerName?: string;
}): string | undefined => {
  const owner = customer?.ownerName?.trim();
  if (!owner) return undefined;
  return owner === customer?.name?.trim() ? undefined : owner;
};
