# Gold Khata Book — App

Read this before changing anything. It is the short version of what this app is
for and which parts will bite you.

## What this is

A React Native app (Android, iOS, and web via react-native-web) for **gold
wholesalers**. A wholesaler sells ornaments to **retailers** — jewellery shops —
and carries their running account until it is settled.

It is a fork of `sonebill-mobile`, which was a **retail** billing app for
jewellery shops selling to walk-in consumers. Most of the code is still that
code.

**The domain rules live at
<https://claude.ai/code/artifact/3a6e7d0d-5bef-49d4-a523-869ac65bb4ef>.**
Read that before touching anything that shows a weight or a balance.

> `CLAUDE.md` in this repo is inherited from SoneBill and describes the retail
> product. Its build, release and store-guard sections are still accurate. Its
> domain sections are not — this file wins where they disagree.

## Customer means retailer

The UI says **Retailer** everywhere. The code still says `Customer` —
`Customer`, `customerId`, `CustomerDetailsScreen`, the `Customers` route, the
`/api/customer` endpoints.

That is deliberate. The rename covered **user-facing copy only**; the
identifiers are the wire format shared with the backend, and renaming them
means a matching backend change plus a migration. Don't half-rename: either
leave an identifier alone, or do the whole path including the server.

The one exception is the localisation **values**, which are all "Retailer" in
four languages. The **keys** are still `customers.*` — those are code.

## The unit

**Everything is grams of fine gold at 99.50.** Not the ornament's own weight,
not rupees. Cash settles that position at the day's 24K 99.50 rate; it is not a
second unit of account.

## Dues: `src/utils/dues.ts`

The single definition of what a retailer owes. The dashboard, the retailer list
and the retailer detail all read through it, so they cannot drift apart. Two
independent accounts:

- **metal**, from `order.remainingWeight` (grams)
- **cash**, from `order.outstandingCash` (rupees)

**Never use `estimatedBalance` for dues.** It is both accounts priced as one
rupee figure, so pairing it with the weight shows the same debt twice — a
retailer owing 5 g reads as "5.000 gm" *and* "₹75,000", which is that 5 g again
in rupees. It exists for printing and for "what would close this today". This
shipped as a real bug once.

Only **pending advance** orders carry an outstanding. A full-payment order is
settled when raised; a cancelled one was never owed.

## Money and weight arithmetic

The server is authoritative. `src/utils/calculations.ts` and friends mirror it
so the create-order screen can show a live total, and the two are expected to
agree exactly — the backend's `goldPricing.ts` is the reference. If you change
one, change both, and check the backend's `npm run verify:pricing` still passes.

Weights display to 3 decimals with `t('common.gramShort')` ("gm"), never a bare
"g". Currency uses `formatCurrencyValue` for Indian grouping (₹2,76,581).

## What was removed

Old-gold **declarations** (affidavits, ID proof, witnesses, signature capture),
the standalone Old Gold Purchase flow, the "Sold to us" views, the blank-forms
feature that existed only to print a blank declaration, and **ornament
exchange** everywhere. All of it was consumer-protection machinery for buying
gold off the public, which does not apply between a wholesaler and a retailer.

`components/photos/PhotoViewer.tsx` survived that removal — it was filed under
`oldGold/` but is a plain lightbox, and item photos still use it.

Melting old metal is coming back as its own record **with photos for audit**,
behind a feature flag (`src/featureFlags/registry.ts`) — many wholesalers do
not melt at all. It is a melt lot producing a credit, never a declaration.

## Running it

```
npm run dev        # webpack dev server, web build, first free port from 8081
npx tsc --noEmit
npx jest __tests__/thermalReceipt.test.ts __tests__/itemPlausibility.test.ts
```

`../start.cmd` brings up MongoDB, the backend and the web app together.

`API_BASE_URL` is overridable at build time so the web build can point at a
backend on this machine; unset, `src/config/environments/*.ts` keeps its hosted
default. Native is unaffected — nothing defines it for Metro.

`src/config/secrets.ts` is gitignored and required to compile. Firebase config
is a **placeholder**, and `ANALYTICS_ENABLED` is false in every environment
until a real project exists — SoneBill's was deliberately not inherited.

## Conventions worth keeping

- Comments explain **why**, usually citing the incident that produced the rule.
  When you change such code, restate the reasoning — do not delete it.
- All user-facing strings go through `t()` with an English fallback, in four
  languages: `en`, `hi`, `mr`, `gu`. The fallback is what a user sees when a key
  is missing, so it is real copy, not a placeholder.
- Tile and card labels reserve two lines. Translated labels are longer than the
  English and wrap where English does not; without the reserved height a row's
  figures sit at different baselines.
- The only tests are the money and weight maths. That is on purpose — those are
  where a mistake costs real rupees.
