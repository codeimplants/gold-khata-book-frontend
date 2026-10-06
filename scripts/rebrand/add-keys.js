// Adds string KEYS to the four language files: new keys inside namespaces that
// already exist, and whole namespaces that do not (inserted after `newEntry`,
// as add-strings.js does). Also resets a few existing VALUES (VALUES below).
//
// Written for the retailer-account work of 2026-10-06: cash held with the rate
// fixed later, cash and gold advances, Fix rate, and the Day Book lines for
// them. Plus two keys the app already called but no language had
// (common.close, auth.enterOtp), which logged "missing key" on every render.
//
// One-way, like add-strings.js: once a key is in the files, src/localization/
// is the source of truth. Re-running skips every key a language already has.
//
//   node scripts/rebrand/add-keys.js
const fs = require('fs');
const path = require('path');

const LANGS = ['en', 'hi', 'mr', 'gu'];
const file = lang => path.join(__dirname, '../../src/localization', `${lang}.ts`);
const quote = s => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

const KEYS = {
  common: {
    en: { close: 'Close' },
    hi: { close: 'बंद करें' },
    mr: { close: 'बंद करा' },
    gu: { close: 'બંધ કરો' },
  },
  auth: {
    en: { enterOtp: 'Enter 6-digit OTP' },
    hi: { enterOtp: '6 अंकों का OTP डालें' },
    mr: { enterOtp: '6 अंकी OTP टाका' },
    gu: { enterOtp: '6 અંકનો OTP દાખલ કરો' },
  },
  khata: {
    en: {
      cashHeld: 'Cash held · rate not fixed',
      cashHeldShort: 'Cash held',
      goldAdvance: 'Gold advance',
      meltCredit: 'Melt credit',
      rateFixedAt: 'Rate fixed at {rate}',
      rateFixed: 'Rate fixed',
      goldUsed: 'Gold held used',
      overpaid: 'Overpaid, kept as cash held',
      cashBack: 'Cash returned',
      goldBack: 'Gold returned',
      heldForRetailers: 'Held for retailers',
      holds: 'Holds',
    },
    hi: {
      cashHeld: 'नकद जमा · भाव तय नहीं',
      cashHeldShort: 'नकद जमा',
      goldAdvance: 'सोना एडवांस',
      meltCredit: 'मेल्ट क्रेडिट',
      rateFixedAt: '{rate} पर भाव तय',
      rateFixed: 'भाव तय',
      goldUsed: 'जमा सोना लगाया',
      overpaid: 'ज़्यादा भुगतान, नकद जमा में रखा',
      cashBack: 'नकद लौटाया',
      goldBack: 'सोना लौटाया',
      heldForRetailers: 'रिटेलरों का जमा',
      holds: 'जमा',
    },
    mr: {
      cashHeld: 'रोख जमा · भाव ठरलेला नाही',
      cashHeldShort: 'रोख जमा',
      goldAdvance: 'सोने ॲडव्हान्स',
      meltCredit: 'मेल्ट क्रेडिट',
      rateFixedAt: '{rate} भावाने ठरले',
      rateFixed: 'भाव ठरला',
      goldUsed: 'जमा सोने वापरले',
      overpaid: 'जास्त भरले, रोख जमा म्हणून ठेवले',
      cashBack: 'रोख परत दिली',
      goldBack: 'सोने परत दिले',
      heldForRetailers: 'रिटेलरांचे जमा',
      holds: 'जमा',
    },
    gu: {
      cashHeld: 'રોકડ જમા · ભાવ નક્કી નથી',
      cashHeldShort: 'રોકડ જમા',
      goldAdvance: 'સોનું એડવાન્સ',
      meltCredit: 'મેલ્ટ ક્રેડિટ',
      rateFixedAt: '{rate} ભાવે નક્કી',
      rateFixed: 'ભાવ નક્કી',
      goldUsed: 'જમા સોનું વાપર્યું',
      overpaid: 'વધુ ચૂકવ્યું, રોકડ જમામાં રાખ્યું',
      cashBack: 'રોકડ પરત આપી',
      goldBack: 'સોનું પરત આપ્યું',
      heldForRetailers: 'રિટેલરોનું જમા',
      holds: 'જમા',
    },
  },
  orders: {
    en: {
      itemsHeading: 'Items',
      goldHeld: 'From gold held',
      goldHeldOverdrawn: 'That is more gold than is held for this retailer',
      cashHeld: 'From cash held',
      cashHeldOverdrawn: 'That is more cash than is held for this retailer',
      cashHeldHint: '{amount} held · converts at {rate}/gm',
    },
    hi: {
      itemsHeading: 'आइटम',
      goldHeld: 'जमा सोने से',
      goldHeldOverdrawn: 'इस रिटेलर का इतना सोना जमा नहीं है',
      cashHeld: 'जमा नकद से',
      cashHeldOverdrawn: 'इस रिटेलर की इतनी नकद जमा नहीं है',
      cashHeldHint: '{amount} जमा · {rate}/ग्राम पर बदलेगा',
    },
    mr: {
      itemsHeading: 'आयटम',
      goldHeld: 'जमा सोन्यातून',
      goldHeldOverdrawn: 'या रिटेलरचे इतके सोने जमा नाही',
      cashHeld: 'जमा रोखीतून',
      cashHeldOverdrawn: 'या रिटेलरची इतकी रोख जमा नाही',
      cashHeldHint: '{amount} जमा · {rate}/gm भावाने',
    },
    gu: {
      itemsHeading: 'આઇટમ',
      goldHeld: 'જમા સોનામાંથી',
      goldHeldOverdrawn: 'આ રિટેલરનું આટલું સોનું જમા નથી',
      cashHeld: 'જમા રોકડમાંથી',
      cashHeldOverdrawn: 'આ રિટેલરની આટલી રોકડ જમા નથી',
      cashHeldHint: '{amount} જમા · {rate}/ગ્રામ ભાવે',
    },
  },
  account: {
    en: {
      receive: 'Receive',
      receiveTitle: 'Receive on account',
      receiveSubtitle: 'Not against a sale. Held for {name} until it is used.',
      tabCash: 'Cash · fix rate later',
      tabGold: 'Gold advance',
      amount: 'Amount',
      weight: 'Weight',
      purity: 'Purity',
      note: 'Note (optional)',
      notePlaceholderCash: 'e.g. Will fix at 14,500',
      notePlaceholderGold: 'e.g. Bar, for Diwali orders',
      noteRateLater: 'Rate to be fixed later',
      noteAdvance: 'Advance',
      noteGoldAdvance: 'Gold advance',
      cashHintDue: 'Their gold due stays as it is until the rate is fixed. Fix it from their account when they ask, at the rate they choose.',
      cashHintAdvance: 'An advance. When they buy, fix the rate on the sale and it comes off what they owe.',
      goldHint: 'Used on their sales gram for gram, oldest due first, or on the next sale they make.',
      creditPreview: 'Credited as {grams} of 99.50',
      holdAmount: 'Hold {amount}',
      holdCash: 'Hold cash',
      keepGold: 'Keep gold on account',
      saveFailed: 'Could not record it',
      cashHeldFor: 'Cash held for {name}',
      goldHeldFor: 'Gold held for {name}',
      cashHeldRateLater: 'Cash held · rate not fixed',
      cashAdvance: 'Cash advance · for their next sale',
      goldHeld: 'Gold held · fine 99.50',
      goldAdvanceHint: 'Gold advance · for their next sale',
      fixRate: 'Fix rate',
      useGold: 'Use',
      useGrams: 'Use {grams}',
      fixRateTitle: 'Fix rate',
      fixRateSubtitle: '{cash} held for {name} · {gold} gold due',
      fixRateSubtitleSale: '{cash} held · {gold} still due on this sale',
      rateLabel: 'Rate, per gm of 99.50',
      convertLabel: 'Cash to convert',
      onlyHeld: 'Only {amount} is held.',
      buysGrams: 'Buys {grams} at this rate, against {due} due.',
      staysHeld: '{amount} stays held.',
      fixRateHint: 'Oldest sale first. Their gold due comes down by the grams this buys.',
      fixRateHintSale: 'Their gold due on this sale comes down by the grams this buys.',
      fixRateConfirm: 'Fix rate and apply',
      nothingToFix: 'No sale owes gold to put this against.',
      fixRateFailed: 'Could not fix the rate',
      rateFixedToast: 'Rate fixed. {grams} off their gold due.',
      useGoldTitle: 'Use gold held?',
      useGoldConfirm: 'Use gold held',
      useGoldBody: '{gold} held for {name} goes against their oldest gold dues, gram for gram.',
      useGoldFailed: 'Could not use the gold held',
      goldUsedToast: 'Gold held put against their dues',
      full: 'Full',
      half: 'Half',
      goldToUse: 'Gold to use, fine 99.50',
      onlyGoldHeld: 'Only {grams} is held.',
      moreThanDue: 'That is more than the {due} owed.',
      clearsDue: 'Clears the gold due.',
      leavesDue: '{grams} of gold stays owed.',
      goldStaysHeld: '{grams} stays held.',
      useGoldSubtitle: '{held} held for {name} · {due} gold due',
      useGoldSubtitleSale: '{held} held · {due} still due on this sale',
      useGoldHint: 'Gram for gram, oldest sale first.',
    },
    hi: {
      receive: 'जमा लें',
      receiveTitle: 'खाते में जमा',
      receiveSubtitle: 'किसी बिक्री के सामने नहीं। उपयोग होने तक {name} के लिए जमा रहेगा।',
      tabCash: 'नकद · भाव बाद में',
      tabGold: 'सोना एडवांस',
      amount: 'रकम',
      weight: 'वज़न',
      purity: 'शुद्धता',
      note: 'नोट (वैकल्पिक)',
      notePlaceholderCash: 'जैसे 14,500 पर तय करेंगे',
      notePlaceholderGold: 'जैसे बिस्किट, दिवाली ऑर्डर के लिए',
      noteRateLater: 'भाव बाद में तय होगा',
      noteAdvance: 'एडवांस',
      noteGoldAdvance: 'सोना एडवांस',
      cashHintDue: 'भाव तय होने तक उनका सोने का बकाया जैसा है वैसा रहेगा। जब वे कहें, उनके चुने भाव पर उनके खाते से तय करें।',
      cashHintAdvance: 'एडवांस। जब वे खरीदें, बिक्री पर भाव तय करें और यह उनके बकाया से घट जाएगा।',
      goldHint: 'उनकी बिक्री पर ग्राम के बदले ग्राम लगेगा, पहले सबसे पुराना बकाया, या उनकी अगली बिक्री पर।',
      creditPreview: '99.50 में {grams} जमा होगा',
      holdAmount: '{amount} जमा रखें',
      holdCash: 'नकद जमा रखें',
      keepGold: 'सोना खाते में रखें',
      saveFailed: 'दर्ज नहीं हो सका',
      cashHeldFor: '{name} के लिए नकद जमा',
      goldHeldFor: '{name} के लिए सोना जमा',
      cashHeldRateLater: 'नकद जमा · भाव तय नहीं',
      cashAdvance: 'नकद एडवांस · अगली बिक्री के लिए',
      goldHeld: 'जमा सोना · शुद्ध 99.50',
      goldAdvanceHint: 'सोना एडवांस · अगली बिक्री के लिए',
      fixRate: 'भाव तय करें',
      useGold: 'लगाएं',
      useGrams: '{grams} लगाएं',
      fixRateTitle: 'भाव तय करें',
      fixRateSubtitle: '{name} के लिए {cash} जमा · {gold} सोना बकाया',
      fixRateSubtitleSale: '{cash} जमा · इस बिक्री पर {gold} बकाया',
      rateLabel: 'भाव, प्रति ग्राम 99.50',
      convertLabel: 'बदलने वाली नकद',
      onlyHeld: 'केवल {amount} जमा है।',
      buysGrams: 'इस भाव पर {grams} मिलेगा, {due} बकाया के सामने।',
      staysHeld: '{amount} जमा रहेगा।',
      fixRateHint: 'पहले सबसे पुरानी बिक्री। उनका सोने का बकाया इतने ग्राम घटेगा।',
      fixRateHintSale: 'इस बिक्री पर उनका सोने का बकाया इतने ग्राम घटेगा।',
      fixRateConfirm: 'भाव तय करें और लगाएं',
      nothingToFix: 'किसी बिक्री पर सोना बकाया नहीं है।',
      fixRateFailed: 'भाव तय नहीं हो सका',
      rateFixedToast: 'भाव तय हुआ। सोने के बकाया से {grams} घटा।',
      useGoldTitle: 'जमा सोना लगाएं?',
      useGoldConfirm: 'जमा सोना लगाएं',
      useGoldBody: '{name} का {gold} जमा सोना उनके सबसे पुराने सोने के बकाया पर ग्राम के बदले ग्राम लगेगा।',
      useGoldFailed: 'जमा सोना नहीं लग सका',
      goldUsedToast: 'जमा सोना बकाया पर लगाया गया',
      full: 'पूरा',
      half: 'आधा',
      goldToUse: 'लगाने वाला सोना, शुद्ध 99.50',
      onlyGoldHeld: 'केवल {grams} जमा है।',
      moreThanDue: 'यह {due} बकाया से ज़्यादा है।',
      clearsDue: 'सोने का बकाया पूरा हो जाएगा।',
      leavesDue: '{grams} सोना बकाया रहेगा।',
      goldStaysHeld: '{grams} जमा रहेगा।',
      useGoldSubtitle: '{name} के लिए {held} जमा · {due} सोना बकाया',
      useGoldSubtitleSale: '{held} जमा · इस बिक्री पर {due} बकाया',
      useGoldHint: 'ग्राम के बदले ग्राम, पहले सबसे पुरानी बिक्री।',
    },
    mr: {
      receive: 'जमा घ्या',
      receiveTitle: 'खात्यावर जमा',
      receiveSubtitle: 'कोणत्याही विक्रीसमोर नाही. वापर होईपर्यंत {name} साठी जमा राहील.',
      tabCash: 'रोख · भाव नंतर',
      tabGold: 'सोने ॲडव्हान्स',
      amount: 'रक्कम',
      weight: 'वजन',
      purity: 'शुद्धता',
      note: 'नोंद (ऐच्छिक)',
      notePlaceholderCash: 'उदा. 14,500 ला ठरवणार',
      notePlaceholderGold: 'उदा. बिस्किट, दिवाळी ऑर्डरसाठी',
      noteRateLater: 'भाव नंतर ठरेल',
      noteAdvance: 'ॲडव्हान्स',
      noteGoldAdvance: 'सोने ॲडव्हान्स',
      cashHintDue: 'भाव ठरेपर्यंत त्यांची सोन्याची बाकी तशीच राहील. ते सांगतील तेव्हा, त्यांनी निवडलेल्या भावाने त्यांच्या खात्यातून ठरवा.',
      cashHintAdvance: 'ॲडव्हान्स. ते खरेदी करतील तेव्हा विक्रीवर भाव ठरवा, ते त्यांच्या बाकीतून वजा होईल.',
      goldHint: 'त्यांच्या विक्रीवर ग्रॅमला ग्रॅम वापरले जाईल, आधी सर्वात जुनी बाकी, किंवा पुढच्या विक्रीवर.',
      creditPreview: '99.50 मध्ये {grams} जमा होईल',
      holdAmount: '{amount} जमा ठेवा',
      holdCash: 'रोख जमा ठेवा',
      keepGold: 'सोने खात्यावर ठेवा',
      saveFailed: 'नोंद होऊ शकली नाही',
      cashHeldFor: '{name} साठी रोख जमा',
      goldHeldFor: '{name} साठी सोने जमा',
      cashHeldRateLater: 'रोख जमा · भाव ठरलेला नाही',
      cashAdvance: 'रोख ॲडव्हान्स · पुढच्या विक्रीसाठी',
      goldHeld: 'जमा सोने · शुद्ध 99.50',
      goldAdvanceHint: 'सोने ॲडव्हान्स · पुढच्या विक्रीसाठी',
      fixRate: 'भाव ठरवा',
      useGold: 'वापरा',
      useGrams: '{grams} वापरा',
      fixRateTitle: 'भाव ठरवा',
      fixRateSubtitle: '{name} साठी {cash} जमा · {gold} सोने बाकी',
      fixRateSubtitleSale: '{cash} जमा · या विक्रीवर {gold} बाकी',
      rateLabel: 'भाव, प्रति ग्रॅम 99.50',
      convertLabel: 'बदलायची रोख',
      onlyHeld: 'फक्त {amount} जमा आहे.',
      buysGrams: 'या भावाने {grams} मिळेल, {due} बाकीसमोर.',
      staysHeld: '{amount} जमा राहील.',
      fixRateHint: 'आधी सर्वात जुनी विक्री. त्यांची सोन्याची बाकी तितक्या ग्रॅमने कमी होईल.',
      fixRateHintSale: 'या विक्रीवरची त्यांची सोन्याची बाकी तितक्या ग्रॅमने कमी होईल.',
      fixRateConfirm: 'भाव ठरवा आणि लावा',
      nothingToFix: 'कोणत्याही विक्रीवर सोने बाकी नाही.',
      fixRateFailed: 'भाव ठरवता आला नाही',
      rateFixedToast: 'भाव ठरला. सोन्याच्या बाकीतून {grams} कमी झाले.',
      useGoldTitle: 'जमा सोने वापरायचे?',
      useGoldConfirm: 'जमा सोने वापरा',
      useGoldBody: '{name} चे {gold} जमा सोने त्यांच्या सर्वात जुन्या सोन्याच्या बाकीवर ग्रॅमला ग्रॅम वापरले जाईल.',
      useGoldFailed: 'जमा सोने वापरता आले नाही',
      goldUsedToast: 'जमा सोने बाकीवर वापरले',
      full: 'पूर्ण',
      half: 'अर्धे',
      goldToUse: 'वापरायचे सोने, शुद्ध 99.50',
      onlyGoldHeld: 'फक्त {grams} जमा आहे.',
      moreThanDue: 'हे {due} बाकीपेक्षा जास्त आहे.',
      clearsDue: 'सोन्याची बाकी पूर्ण फिटेल.',
      leavesDue: '{grams} सोने बाकी राहील.',
      goldStaysHeld: '{grams} जमा राहील.',
      useGoldSubtitle: '{name} साठी {held} जमा · {due} सोने बाकी',
      useGoldSubtitleSale: '{held} जमा · या विक्रीवर {due} बाकी',
      useGoldHint: 'ग्रॅमला ग्रॅम, आधी सर्वात जुनी विक्री.',
    },
    gu: {
      receive: 'જમા લો',
      receiveTitle: 'ખાતામાં જમા',
      receiveSubtitle: 'કોઈ વેચાણ સામે નહીં. વપરાય ત્યાં સુધી {name} માટે જમા રહેશે.',
      tabCash: 'રોકડ · ભાવ પછી',
      tabGold: 'સોનું એડવાન્સ',
      amount: 'રકમ',
      weight: 'વજન',
      purity: 'શુદ્ધતા',
      note: 'નોંધ (વૈકલ્પિક)',
      notePlaceholderCash: 'દા.ત. 14,500 પર નક્કી કરશે',
      notePlaceholderGold: 'દા.ત. બિસ્કિટ, દિવાળી ઓર્ડર માટે',
      noteRateLater: 'ભાવ પછી નક્કી થશે',
      noteAdvance: 'એડવાન્સ',
      noteGoldAdvance: 'સોનું એડવાન્સ',
      cashHintDue: 'ભાવ નક્કી થાય ત્યાં સુધી તેમનું સોનાનું બાકી એમ જ રહેશે. તેઓ કહે ત્યારે, તેમણે પસંદ કરેલા ભાવે તેમના ખાતામાંથી નક્કી કરો.',
      cashHintAdvance: 'એડવાન્સ. તેઓ ખરીદે ત્યારે વેચાણ પર ભાવ નક્કી કરો, તે તેમના બાકીમાંથી ઓછું થશે.',
      goldHint: 'તેમના વેચાણ પર ગ્રામના બદલે ગ્રામ વપરાશે, પહેલા સૌથી જૂનું બાકી, અથવા આગળના વેચાણ પર.',
      creditPreview: '99.50 માં {grams} જમા થશે',
      holdAmount: '{amount} જમા રાખો',
      holdCash: 'રોકડ જમા રાખો',
      keepGold: 'સોનું ખાતામાં રાખો',
      saveFailed: 'નોંધ થઈ શકી નહીં',
      cashHeldFor: '{name} માટે રોકડ જમા',
      goldHeldFor: '{name} માટે સોનું જમા',
      cashHeldRateLater: 'રોકડ જમા · ભાવ નક્કી નથી',
      cashAdvance: 'રોકડ એડવાન્સ · આગળના વેચાણ માટે',
      goldHeld: 'જમા સોનું · શુદ્ધ 99.50',
      goldAdvanceHint: 'સોનું એડવાન્સ · આગળના વેચાણ માટે',
      fixRate: 'ભાવ નક્કી કરો',
      useGold: 'વાપરો',
      useGrams: '{grams} વાપરો',
      fixRateTitle: 'ભાવ નક્કી કરો',
      fixRateSubtitle: '{name} માટે {cash} જમા · {gold} સોનું બાકી',
      fixRateSubtitleSale: '{cash} જમા · આ વેચાણ પર {gold} બાકી',
      rateLabel: 'ભાવ, પ્રતિ ગ્રામ 99.50',
      convertLabel: 'બદલવાની રોકડ',
      onlyHeld: 'ફક્ત {amount} જમા છે.',
      buysGrams: 'આ ભાવે {grams} મળશે, {due} બાકી સામે.',
      staysHeld: '{amount} જમા રહેશે.',
      fixRateHint: 'પહેલા સૌથી જૂનું વેચાણ. તેમનું સોનાનું બાકી એટલા ગ્રામ ઘટશે.',
      fixRateHintSale: 'આ વેચાણ પર તેમનું સોનાનું બાકી એટલા ગ્રામ ઘટશે.',
      fixRateConfirm: 'ભાવ નક્કી કરો અને લગાવો',
      nothingToFix: 'કોઈ વેચાણ પર સોનું બાકી નથી.',
      fixRateFailed: 'ભાવ નક્કી થઈ શક્યો નહીં',
      rateFixedToast: 'ભાવ નક્કી થયો. સોનાના બાકીમાંથી {grams} ઘટ્યું.',
      useGoldTitle: 'જમા સોનું વાપરવું છે?',
      useGoldConfirm: 'જમા સોનું વાપરો',
      useGoldBody: '{name} નું {gold} જમા સોનું તેમના સૌથી જૂના સોનાના બાકી પર ગ્રામના બદલે ગ્રામ વપરાશે.',
      useGoldFailed: 'જમા સોનું વાપરી શકાયું નહીં',
      goldUsedToast: 'જમા સોનું બાકી પર વાપર્યું',
      full: 'પૂરું',
      half: 'અડધું',
      goldToUse: 'વાપરવાનું સોનું, શુદ્ધ 99.50',
      onlyGoldHeld: 'ફક્ત {grams} જમા છે.',
      moreThanDue: 'આ {due} બાકી કરતાં વધુ છે.',
      clearsDue: 'સોનાનું બાકી પૂરું થશે.',
      leavesDue: '{grams} સોનું બાકી રહેશે.',
      goldStaysHeld: '{grams} જમા રહેશે.',
      useGoldSubtitle: '{name} માટે {held} જમા · {due} સોનું બાકી',
      useGoldSubtitleSale: '{held} જમા · આ વેચાણ પર {due} બાકી',
      useGoldHint: 'ગ્રામના બદલે ગ્રામ, પહેલા સૌથી જૂનું વેચાણ.',
    },
  },
  // The item-name picker on New sale (components/catalog/ItemPicker.tsx).
  // SoneBill's picker logic over the shared jewellery-catalog package; the
  // words are this app's own.
  itemPicker: {
    en: {
      title: 'Item name',
      fieldHint: 'Search or type',
      search: 'Search your catalogue or the ornament list',
      all: 'All',
      catalogue: 'Your catalogue',
      inCatalogue: 'Catalogue',
      yours: 'Yours',
      useTyped: 'Use “{name}”',
      useTypedSub: 'This sale only',
      saveOwn: '+ Add “{name}” to the list',
      saveOwnSub: 'Not in the list. It is saved as your own ornament.',
      whichCategory: 'Which group is “{name}” in?',
      newCategory: '+ A new group of your own',
      newCategorySub: 'For ornaments that fit none of these',
      newCategoryPlaceholder: 'Group name, e.g. Antique',
      createCategory: 'Create “{name}” and add this ornament to it',
      back: 'Back',
      close: 'Close',
      clear: 'Clear',
    },
    hi: {
      title: 'आइटम का नाम',
      fieldHint: 'खोजें या लिखें',
      search: 'अपने कैटलॉग या गहनों की सूची में खोजें',
      all: 'सभी',
      catalogue: 'आपका कैटलॉग',
      inCatalogue: 'कैटलॉग',
      yours: 'आपका',
      useTyped: '“{name}” इस्तेमाल करें',
      useTypedSub: 'केवल इस बिक्री में',
      saveOwn: '+ “{name}” सूची में जोड़ें',
      saveOwnSub: 'सूची में नहीं है। यह आपके अपने गहने के रूप में सेव होगा।',
      whichCategory: '“{name}” किस समूह में है?',
      newCategory: '+ अपना नया समूह',
      newCategorySub: 'जो गहने इनमें से किसी में नहीं आते',
      newCategoryPlaceholder: 'समूह का नाम, जैसे एंटीक',
      createCategory: '“{name}” बनाएं और यह गहना उसमें जोड़ें',
      back: 'वापस',
      close: 'बंद करें',
      clear: 'साफ़ करें',
    },
    mr: {
      title: 'आयटमचे नाव',
      fieldHint: 'शोधा किंवा लिहा',
      search: 'तुमच्या कॅटलॉगमध्ये किंवा दागिन्यांच्या यादीत शोधा',
      all: 'सर्व',
      catalogue: 'तुमचा कॅटलॉग',
      inCatalogue: 'कॅटलॉग',
      yours: 'तुमचे',
      useTyped: '“{name}” वापरा',
      useTypedSub: 'फक्त या विक्रीसाठी',
      saveOwn: '+ “{name}” यादीत जोडा',
      saveOwnSub: 'यादीत नाही. तुमचा स्वतःचा दागिना म्हणून सेव्ह होईल.',
      whichCategory: '“{name}” कोणत्या गटात आहे?',
      newCategory: '+ तुमचा नवीन गट',
      newCategorySub: 'यापैकी कशातही न बसणाऱ्या दागिन्यांसाठी',
      newCategoryPlaceholder: 'गटाचे नाव, उदा. अँटिक',
      createCategory: '“{name}” तयार करा आणि हा दागिना त्यात जोडा',
      back: 'मागे',
      close: 'बंद करा',
      clear: 'पुसा',
    },
    gu: {
      title: 'આઇટમનું નામ',
      fieldHint: 'શોધો અથવા લખો',
      search: 'તમારા કેટલોગ અથવા ઘરેણાંની યાદીમાં શોધો',
      all: 'બધા',
      catalogue: 'તમારો કેટલોગ',
      inCatalogue: 'કેટલોગ',
      yours: 'તમારું',
      useTyped: '“{name}” વાપરો',
      useTypedSub: 'ફક્ત આ વેચાણ માટે',
      saveOwn: '+ “{name}” યાદીમાં ઉમેરો',
      saveOwnSub: 'યાદીમાં નથી. તમારા પોતાના ઘરેણાં તરીકે સેવ થશે.',
      whichCategory: '“{name}” કયા જૂથમાં છે?',
      newCategory: '+ તમારું નવું જૂથ',
      newCategorySub: 'આમાંના કોઈમાં ન બેસતા ઘરેણાં માટે',
      newCategoryPlaceholder: 'જૂથનું નામ, દા.ત. એન્ટીક',
      createCategory: '“{name}” બનાવો અને આ ઘરેણું તેમાં ઉમેરો',
      back: 'પાછા',
      close: 'બંધ કરો',
      clear: 'સાફ કરો',
    },
  },
};

/**
 * Existing values to reset. The statement's two "held" lines read "Credit with
 * us" and "Melt credit"; gold held is now advances as well as melt, and cash
 * held is usually waiting for a rate, which is what the retailer needs to see.
 */
const VALUES = {
  'statement.credit': {
    en: 'Cash held (rate not fixed)',
    hi: 'नकद जमा (भाव तय नहीं)',
    mr: 'रोख जमा (भाव ठरलेला नाही)',
    gu: 'રોકડ જમા (ભાવ નક્કી નથી)',
  },
  'statement.meltCredit': {
    en: 'Gold held',
    hi: 'जमा सोना',
    mr: 'जमा सोने',
    gu: 'જમા સોનું',
  },
  // "Coming soon" reads as an unfinished app to App Review (2.1), and the store
  // guard fails it. The screen is not reachable while the tutorials flag is off,
  // but the words should not be there either way.
  'tutorials.emptyTitle': {
    en: 'No help videos here',
    hi: 'यहाँ कोई सहायता वीडियो नहीं है',
    mr: 'येथे मदतीचे व्हिडिओ नाहीत',
    gu: 'અહીં કોઈ મદદ વિડિઓ નથી',
  },
};

/** [start, end) line range of a top-level namespace block, or null. */
const block = (lines, ns) => {
  const start = lines.findIndex(l => new RegExp(`^  ${ns}: \\{\\s*$`).test(l));
  if (start < 0) return null;
  let end = start + 1;
  while (end < lines.length && !/^  \},?\s*$/.test(lines[end])) end++;
  return [start, end];
};

let added = 0;
let set = 0;
for (const lang of LANGS) {
  const raw = fs.readFileSync(file(lang), 'utf8');
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  const lines = raw.split(/\r?\n/);

  for (const [ns, byLang] of Object.entries(KEYS)) {
    const keys = byLang[lang];
    const range = block(lines, ns);
    if (range) {
      const [start, end] = range;
      const body = lines.slice(start + 1, end);
      const fresh = Object.entries(keys).filter(
        ([k]) => !body.some(l => new RegExp(`^    '?${k}'?:`).test(l)),
      );
      if (!fresh.length) continue;
      lines.splice(end, 0, ...fresh.map(([k, v]) => `    ${k}: ${quote(v)},`));
      added += fresh.length;
    } else {
      const anchor = block(lines, 'newEntry');
      if (!anchor) throw new Error(`${lang}: no newEntry block to insert ${ns} after`);
      lines.splice(anchor[1] + 1, 0,
        `  ${ns}: {`,
        ...Object.entries(keys).map(([k, v]) => `    ${k}: ${quote(v)},`),
        '  },');
      added += Object.keys(keys).length;
    }
  }

  for (const [dotted, byLang] of Object.entries(VALUES)) {
    const [ns, key] = dotted.split('.');
    const range = block(lines, ns);
    if (!range) throw new Error(`${lang}: no ${ns} block`);
    for (let i = range[0] + 1; i < range[1]; i++) {
      const m = lines[i].match(new RegExp(`^(    '?${key}'?: ).*,\\s*$`));
      if (m) {
        const next = `${m[1]}${quote(byLang[lang])},`;
        if (lines[i] !== next) { lines[i] = next; set++; }
        break;
      }
    }
  }

  fs.writeFileSync(file(lang), lines.join(eol));
}
console.log(`added ${added} key(s), reset ${set} value(s) across ${LANGS.length} languages`);
