# Gold Khata Book: store listing, review notes and reply to App Review

Copy to paste into App Store Connect and the Play Console for the resubmission
after the guideline 4.3(a) rejection of 2026-09-25. The plan behind it is in
`APP_STORE_4.3_REWORK.md` at the repo root.

Nothing here should repeat SoneBill's wording. SoneBill sells itself as
billing for jewellers who serve walk-in customers. Gold Khata Book is a ledger
for gold wholesalers who supply retailers on account. The copy says so, and
the screenshots in `../screenshots/` show it.

Character counts were checked with a script. Recount after any edit.

---

## App Store Connect

| Field | Limit | Text |
| --- | --- | --- |
| Name | 30 | Gold Khata Book |
| Subtitle | 30 | Wholesale gold ledger *(21)* |
| Promotional text | 170 | Know exactly how much fine gold and cash every retailer owes you. Record sales on account, take in gold or cash, and send statements on WhatsApp. *(145)* |
| Keywords | 100 | `wholesale,bullion,fine gold,retailer,ledger,udhar,hisab,rojmel,melt,karigar,statement,dues,jama,999` *(99)* |
| Primary category | | **Finance**, or Business if SoneBill is already in Finance. It should differ from SoneBill (owner decision, 2026-10-06) |
| Privacy Policy URL | | https://goldkhatabook.codeimplants.com/privacy-policy/ |
| Support URL | | https://goldkhatabook.codeimplants.com/privacy-policy/ (its footer carries the company name and codeimplants@gmail.com). Never SoneBill's pages, and never goldkhatabook.web.app: the API refuses that origin, so its sign-in fails |

The words of the name (Gold, Khata, Book) are left out of the keywords on
purpose: Apple already indexes the name, so repeating them wastes characters.

### Description

Gold Khata Book is the account book for gold wholesalers: the trade that
supplies ornaments to jewellery shops on account and settles in fine gold or
cash.

Every figure is kept the way the trade keeps it: in grams of fine gold at
99.50, with cash as its own separate balance. A retailer can clear the metal
and still owe the GST, or pay the charges and still owe the gold. Gold Khata
Book keeps both, so a balance is never a guess at today's rate.

YOUR KHATA AT A GLANCE
• What every retailer owes you, in fine gold and in cash, on one screen
• Today's 99.50 rate, from the live feed or set by you
• Your latest sales and receipts, with a reminder button for each retailer

SALES ON ACCOUNT
• Record a sale line by line: weight, purity and wastage
• Name each item from a ready list of 127 ornaments, in four languages, or add your own
• Fine weight at 99.50 is worked out for you, with the purity uplift shown
• Add 3% GST when the sale carries it

RECEIPTS IN GOLD OR CASH
• Take in old or fine gold, cash, or both against a sale
• Cash now, gold rate later: hold a retailer's cash until they fix the rate
• Advances in gold or cash, used on the retailer's next sale
• What you hold for a retailer is shown beside their dues, never netted off
• A sale closes on its own when both its gold and its cash are cleared

DAY BOOK
• Every sale and receipt in date order, like your rojmel
• Daily totals for gold out, gold in and cash in

RETAILER STATEMENTS
• A statement for each retailer: balance as of today, every sale and receipt
• Send it on WhatsApp as a message, or share it as a PDF

MADE FOR THE COUNTER
• English, Hindi, Marathi and Gujarati
• Face ID or fingerprint lock
• Print sale slips on a thermal printer or as A4 PDFs

Your data belongs to you. Delete your account and everything in it at any
time from More, Delete Account.

---

## App Review information

**Sign-in:** phone `1234567890`, OTP `123456`. No SMS is sent to this number.
The app has no guest mode, so reviewers must use this account.

**Before submitting,** load the sample wholesale book into this account, or
the reviewer sees an empty app. It is one command, in the plan, section 9,
item 5. Then sign in once on a phone and check the Khata tab shows the sample
retailers (twelve in all).

**Notes for the reviewer** (paste into App Review Information, Notes):

> Gold Khata Book is a ledger for gold wholesalers: businesses that supply
> ornaments to jewellery shops (retailers) on account and are paid back in fine
> gold or cash. Balances are kept in grams of fine gold at 99.50 purity, with
> cash as a separate balance.
>
> To try it, sign in with 1234567890 and OTP 123456. The demo account holds a
> sample book of twelve retailers.
> - Khata (first tab): what each retailer owes, in gold and cash.
> - The + button: record a new sale on account, or receive gold or cash.
> - Day Book: every sale and receipt by date, with daily totals.
> - Retailers, then any retailer: their statement, which can be shared on WhatsApp or as a PDF.
> - Raj Gold House: a retailer who owes gold and has paid cash to be converted
>   at a rate they choose later. Fix rate converts it. Shubh Laxmi Jewellers and
>   Siddhivinayak Gold have left advances in gold and in cash.
> - More, Delete Account: permanent account deletion.

---

## Reply to App Review (Resolution Center)

Send with the new build, in reply to the 4.3(a) message of 2026-09-25.
Written for the App Review team.

*Owner's note (2026-10-06): SoneBill's own code now has a Day Book and a
supplier khata, so this reply must not claim that SoneBill has no day book or
khata. It says what is true: SoneBill is the retail shop's software, this app
is the wholesaler's. Check it against SoneBill's latest live version before
sending.*

> Hello,
>
> Thank you for the review. We have reworked Gold Khata Book into its own
> product, and we would like to explain how it differs from our other app,
> SoneBill, which we believe prompted the 4.3(a) concern.
>
> They are used by different businesses, on opposite sides of the gold trade:
>
> - SoneBill is shop software for retail jewellers. It bills walk-in customers
>   at the counter, in rupees, and runs the shop: stock, orders, repairs, the
>   shop's own day book and its account with the suppliers it buys from.
> - Gold Khata Book is for the gold wholesaler who supplies those shops. It
>   keeps every retailer's running account in grams of fine gold at 99.50, with
>   cash as a separate account. It records sales to retailers on account and
>   receipts in gold or cash, holds a retailer's cash until they choose the
>   rate to convert it at, takes advances in gold or cash, and sends each
>   retailer a statement. It has no consumer billing, no stock and no retail
>   tax invoices.
>
> A wholesaler cannot run their business on SoneBill, and a retail shop cannot
> bill its customers with Gold Khata Book.
>
> In this build:
>
> - **New design and structure.** The app has its own visual design (emerald
>   and pearl, with gold jewellery motifs) and its own navigation (Khata, Retailers, Day Book, More, and a central New Entry
>   button). Every main screen is new: the ledger home, the day book, the
>   retailer statement and the sign-in screens.
> - **Retail features removed.** We removed everything that belonged to retail
>   billing: tax invoices for consumers, advance orders, old-gold purchase
>   declarations, sales and GST reports, purchase records and invoice
>   templates.
> - **New listing.** The metadata and screenshots are new and show only this
>   app.
>
> A demo account with a sample wholesale book is in the review notes (phone
> 1234567890, OTP 123456).
>
> Thank you for taking another look.

---

## Google Play

| Field | Limit | Text |
| --- | --- | --- |
| App name | 30 | Gold Khata Book |
| Short description | 80 | Wholesale gold khata: fine gold and cash dues for every retailer *(64)* |
| Full description | 4000 | The App Store description above |
| Feature graphic | 1024 × 500 | `../graphics/play-feature-graphic.jpg` |
| Screenshots | | `../screenshots/android/phone`, `tablet-7`, `tablet-10` |
