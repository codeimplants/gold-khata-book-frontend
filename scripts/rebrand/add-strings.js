// Adds the string namespaces the 4.3(a) rework introduced to all four
// languages. Each namespace is inserted directly after the `newEntry` block if
// that language does not have it yet.
//
// This is a one-way tool. Once a namespace is in the files, src/localization/
// is the source of truth: edit the strings there, not here. Re-running skips
// any namespace a language already has, so it is safe after a merge.
//
//   node scripts/rebrand/add-strings.js
const fs = require('fs');
const path = require('path');

const NAMESPACES = {
  // Khata home (DashboardScreen).
  khata: {
    en: {
      owedToYou: 'Owed to you',
      fineGold: 'Fine gold (99.50)',
      cash: 'Cash',
      retailersOwing: 'retailers with a balance',
      balances: 'Retailer balances',
      colRetailer: 'Retailer',
      colGold: 'Gold',
      colCash: 'Cash',
      recent: 'Recent entries',
      openDayBook: 'Open day book',
      sale: 'Sale',
      receipt: 'Received',
      noEntries: 'No entries yet. Tap + to record a sale.',
      allSettled: 'Every retailer is settled.',
      rateLabel: "Today's rate · 99.50",
      rateLive: 'Live',
      rateYours: 'Your rate',
    },
    hi: {
      owedToYou: 'आपको मिलना है',
      fineGold: 'शुद्ध सोना (99.50)',
      cash: 'नकद',
      retailersOwing: 'रिटेलरों पर बकाया',
      balances: 'रिटेलर बकाया',
      colRetailer: 'रिटेलर',
      colGold: 'सोना',
      colCash: 'नकद',
      recent: 'हाल की एंट्री',
      openDayBook: 'रोज़नामचा खोलें',
      sale: 'बिक्री',
      receipt: 'जमा',
      noEntries: 'अभी कोई एंट्री नहीं। बिक्री दर्ज करने के लिए + दबाएँ।',
      allSettled: 'सभी रिटेलरों का हिसाब बराबर है।',
      rateLabel: 'आज का भाव · 99.50',
      rateLive: 'लाइव',
      rateYours: 'आपका भाव',
    },
    mr: {
      owedToYou: 'तुम्हाला येणे',
      fineGold: 'शुद्ध सोने (99.50)',
      cash: 'रोख',
      retailersOwing: 'रिटेलरकडे बाकी',
      balances: 'रिटेलर बाकी',
      colRetailer: 'रिटेलर',
      colGold: 'सोने',
      colCash: 'रोख',
      recent: 'अलीकडील नोंदी',
      openDayBook: 'रोजकीर्द उघडा',
      sale: 'विक्री',
      receipt: 'जमा',
      noEntries: 'अजून नोंदी नाहीत. विक्री नोंदवण्यासाठी + दाबा.',
      allSettled: 'सर्व रिटेलरचा हिशोब पूर्ण आहे.',
      rateLabel: 'आजचा भाव · 99.50',
      rateLive: 'लाइव्ह',
      rateYours: 'तुमचा भाव',
    },
    gu: {
      owedToYou: 'તમારે લેવાના',
      fineGold: 'શુદ્ધ સોનું (99.50)',
      cash: 'રોકડ',
      retailersOwing: 'રિટેલરો પાસે બાકી',
      balances: 'રિટેલર બાકી',
      colRetailer: 'રિટેલર',
      colGold: 'સોનું',
      colCash: 'રોકડ',
      recent: 'તાજેતરની એન્ટ્રી',
      openDayBook: 'રોજમેળ ખોલો',
      sale: 'વેચાણ',
      receipt: 'જમા',
      noEntries: 'હજી કોઈ એન્ટ્રી નથી. વેચાણ નોંધવા + દબાવો.',
      allSettled: 'બધા રિટેલરનો હિસાબ ચૂકતે છે.',
      rateLabel: 'આજનો ભાવ · 99.50',
      rateLive: 'લાઇવ',
      rateYours: 'તમારો ભાવ',
    },
  },

  // Retailer statement (CustomerDetailsScreen).
  retailer: {
    en: {
      receiveHint: 'Tap a sale to record what was received against it.',
      entries: 'Entries',
      noSales: 'No sales to this retailer yet.',
      settled: 'Settled',
      remind: 'Remind',
    },
    hi: {
      receiveHint: 'किसी बिक्री पर टैप करके उसके बदले मिली रकम दर्ज करें।',
      entries: 'एंट्री',
      noSales: 'इस रिटेलर को अभी कोई बिक्री नहीं।',
      settled: 'चुकता',
      remind: 'याद दिलाएँ',
    },
    mr: {
      receiveHint: 'विक्रीवर टॅप करून त्यापोटी मिळालेली रक्कम नोंदवा.',
      entries: 'नोंदी',
      noSales: 'या रिटेलरला अजून विक्री नाही.',
      settled: 'पूर्ण',
      remind: 'आठवण द्या',
    },
    gu: {
      receiveHint: 'વેચાણ પર ટૅપ કરીને તેની સામે મળેલું નોંધો.',
      entries: 'એન્ટ્રી',
      noSales: 'આ રિટેલરને હજી વેચાણ નથી.',
      settled: 'ચૂકતે',
      remind: 'યાદ અપાવો',
    },
  },

  // Sale screen (OrderDetailsScreen).
  sale: {
    en: { owedOnSale: 'Owed on this sale', settled: 'This sale is settled' },
    hi: { owedOnSale: 'इस बिक्री पर बकाया', settled: 'यह बिक्री चुकता है' },
    mr: { owedOnSale: 'या विक्रीवर बाकी', settled: 'ही विक्री पूर्ण झाली आहे' },
    gu: { owedOnSale: 'આ વેચાણ પર બાકી', settled: 'આ વેચાણ ચૂકતે છે' },
  },

  // Sign-in screens (LoginScreen, OtpScreen on AuthLayout).
  welcome: {
    en: {
      tagline: 'Wholesale gold khata',
      point1: 'Fine gold and cash dues for every retailer',
      point2: 'A day book of sales and receipts',
      point3: 'Statements and reminders on WhatsApp',
      signIn: 'Sign in with your mobile number',
      signInHint: 'We will text you a 6-digit code',
      getOtp: 'Get OTP',
      agree: 'By continuing you agree to our',
      enterCode: 'Enter the code',
      change: 'Change',
      verify: 'Verify & continue',
    },
    hi: {
      tagline: 'थोक सोने का खाता',
      point1: 'हर रिटेलर का शुद्ध सोना और नकद बकाया',
      point2: 'बिक्री और जमा का रोज़नामचा',
      point3: 'व्हाट्सऐप पर स्टेटमेंट और रिमाइंडर',
      signIn: 'अपने मोबाइल नंबर से साइन इन करें',
      signInHint: 'हम आपको 6 अंकों का कोड भेजेंगे',
      getOtp: 'OTP पाएं',
      agree: 'जारी रखकर आप सहमत हैं:',
      enterCode: 'कोड दर्ज करें',
      change: 'बदलें',
      verify: 'सत्यापित करें और आगे बढ़ें',
    },
    mr: {
      tagline: 'घाऊक सोन्याचे खाते',
      point1: 'प्रत्येक रिटेलरचे शुद्ध सोने व रोख बाकी',
      point2: 'विक्री व जमा यांची रोजकीर्द',
      point3: 'व्हॉट्सॲपवर स्टेटमेंट व आठवण',
      signIn: 'तुमच्या मोबाइल नंबरने साइन इन करा',
      signInHint: 'आम्ही तुम्हाला 6 अंकी कोड पाठवू',
      getOtp: 'OTP मिळवा',
      agree: 'पुढे जाऊन तुम्ही सहमत आहात:',
      enterCode: 'कोड टाका',
      change: 'बदला',
      verify: 'पडताळा आणि पुढे जा',
    },
    gu: {
      tagline: 'જથ્થાબંધ સોનાનું ખાતું',
      point1: 'દરેક રિટેલરનું શુદ્ધ સોનું અને રોકડ બાકી',
      point2: 'વેચાણ અને જમાનો રોજમેળ',
      point3: 'વૉટ્સઍપ પર સ્ટેટમેન્ટ અને રિમાઇન્ડર',
      signIn: 'તમારા મોબાઇલ નંબરથી સાઇન ઇન કરો',
      signInHint: 'અમે તમને 6 અંકનો કોડ મોકલીશું',
      getOtp: 'OTP મેળવો',
      agree: 'આગળ વધીને તમે સંમત થાઓ છો:',
      enterCode: 'કોડ દાખલ કરો',
      change: 'બદલો',
      verify: 'ચકાસો અને આગળ વધો',
    },
  },

  // Day Book tab (DayBookScreen) and the pushed Sales list (OrdersScreen).
  dayBook: {
    en: {
      entries: 'entries',
      sales: 'Sales',
      receipts: 'Receipts',
      salesList: 'Sales',
      salesTitle: 'Sales',
      today: 'Today',
      yesterday: 'Yesterday',
      goldOut: 'Gold out',
      goldIn: 'Gold in',
      cashIn: 'Cash in',
      empty: 'Nothing in the book yet. Tap + to record your first sale.',
    },
    hi: {
      entries: 'एंट्री',
      sales: 'बिक्री',
      receipts: 'जमा',
      salesList: 'बिक्री',
      salesTitle: 'बिक्री',
      today: 'आज',
      yesterday: 'कल',
      goldOut: 'सोना दिया',
      goldIn: 'सोना आया',
      cashIn: 'नकद आया',
      empty: 'खाते में अभी कुछ नहीं। पहली बिक्री दर्ज करने के लिए + दबाएँ।',
    },
    mr: {
      entries: 'नोंदी',
      sales: 'विक्री',
      receipts: 'जमा',
      salesList: 'विक्री',
      salesTitle: 'विक्री',
      today: 'आज',
      yesterday: 'काल',
      goldOut: 'सोने दिले',
      goldIn: 'सोने आले',
      cashIn: 'रोख आली',
      empty: 'खात्यात अजून काही नाही. पहिली विक्री नोंदवण्यासाठी + दाबा.',
    },
    gu: {
      entries: 'એન્ટ્રી',
      sales: 'વેચાણ',
      receipts: 'જમા',
      salesList: 'વેચાણ',
      salesTitle: 'વેચાણ',
      today: 'આજે',
      yesterday: 'ગઈકાલે',
      goldOut: 'સોનું આપ્યું',
      goldIn: 'સોનું આવ્યું',
      cashIn: 'રોકડ આવી',
      empty: 'ખાતામાં હજી કંઈ નથી. પહેલું વેચાણ નોંધવા + દબાવો.',
    },
  },

  // More tab (SettingsScreen).
  more: {
    en: {
      sectionKhata: 'KHATA',
      sectionShop: 'SHOP',
      sectionHelp: 'HELP & ABOUT',
      meltLots: 'Melt lots',
      meltLotsSub: 'Old gold in the pot, and lots already credited',
      shopSub: 'Name, address and GSTIN on your statements',
      print: 'Printing',
      printSub: 'Statement paper size and thermal printer',
      helpSub: 'Call or WhatsApp us',
      catalog: 'Item catalogue',
      catalogSub: 'Ornaments you sell often, to fill a sale quickly',
    },
    hi: {
      sectionKhata: 'खाता',
      sectionShop: 'दुकान',
      sectionHelp: 'सहायता और जानकारी',
      meltLots: 'गलाई लॉट',
      meltLotsSub: 'भट्टी में पुराना सोना और जमा हो चुके लॉट',
      shopSub: 'आपके स्टेटमेंट पर नाम, पता और GSTIN',
      print: 'छपाई',
      printSub: 'स्टेटमेंट का पेपर साइज़ और थर्मल प्रिंटर',
      helpSub: 'हमें कॉल या व्हाट्सऐप करें',
      catalog: 'आइटम सूची',
      catalogSub: 'अक्सर बिकने वाले गहने, बिक्री जल्दी भरने के लिए',
    },
    mr: {
      sectionKhata: 'खाते',
      sectionShop: 'दुकान',
      sectionHelp: 'मदत आणि माहिती',
      meltLots: 'वितळवणी लॉट',
      meltLotsSub: 'भट्टीतील जुने सोने आणि जमा झालेले लॉट',
      shopSub: 'तुमच्या स्टेटमेंटवरील नाव, पत्ता आणि GSTIN',
      print: 'छपाई',
      printSub: 'स्टेटमेंटचा कागद आकार आणि थर्मल प्रिंटर',
      helpSub: 'आम्हाला कॉल किंवा व्हॉट्सॲप करा',
      catalog: 'वस्तू यादी',
      catalogSub: 'नेहमी विकले जाणारे दागिने, विक्री पटकन भरण्यासाठी',
    },
    gu: {
      sectionKhata: 'ખાતું',
      sectionShop: 'દુકાન',
      sectionHelp: 'મદદ અને માહિતી',
      meltLots: 'ગાળણ લોટ',
      meltLotsSub: 'ભઠ્ઠીમાં જૂનું સોનું અને જમા થયેલા લોટ',
      shopSub: 'તમારા સ્ટેટમેન્ટ પર નામ, સરનામું અને GSTIN',
      print: 'છાપકામ',
      printSub: 'સ્ટેટમેન્ટનું પેપર સાઇઝ અને થર્મલ પ્રિન્ટર',
      helpSub: 'અમને કૉલ અથવા વૉટ્સઍપ કરો',
      catalog: 'આઇટમ યાદી',
      catalogSub: 'વારંવાર વેચાતા દાગીના, વેચાણ ઝડપથી ભરવા',
    },
  },
};

const quote = s => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

for (const lang of ['en', 'hi', 'mr', 'gu']) {
  const file = path.join(__dirname, '../../src/localization', `${lang}.ts`);
  let src = fs.readFileSync(file, 'utf8');
  // The translation files are CRLF. Match either ending, and write in the
  // file's own, so one file never ends up with both.
  const eol = src.includes('\r\n') ? '\r\n' : '\n';
  const added = [];
  for (const [ns, byLang] of Object.entries(NAMESPACES)) {
    const strings = byLang[lang];
    if (!strings) throw new Error(`${ns}: no ${lang} strings`);
    const existing = src.match(new RegExp(`^  ${ns}: \\{\\r?\\n(?:    .*\\r?\\n)*?  \\},\\r?\\n`, 'm'));
    if (existing) {
      // The namespace is there: add only the keys it lacks, before its close.
      const missing = Object.entries(strings).filter(([k]) => !new RegExp(`^    ${k}:`, 'm').test(existing[0]));
      if (!missing.length) continue;
      const closeAt = existing[0].lastIndexOf('  },');
      const lines = missing.map(([k, v]) => `    ${k}: ${quote(v)},${eol}`).join('');
      const block = existing[0].slice(0, closeAt) + lines + existing[0].slice(closeAt);
      src = src.replace(existing[0], block);
      added.push(`${ns}.{${missing.map(([k]) => k).join(',')}}`);
      continue;
    }
    const anchor = src.match(/^  newEntry: \{\r?\n(?:    .*\r?\n)*?  \},\r?\n/m);
    if (!anchor) throw new Error(`${lang}: newEntry block not found`);
    const block = ['', `  ${ns}: {`, ...Object.entries(strings).map(([k, v]) => `    ${k}: ${quote(v)},`), '  },', ''].join(eol);
    src = src.replace(anchor[0], anchor[0] + block);
    added.push(ns);
  }
  if (added.length) fs.writeFileSync(file, src);
  console.log(`${lang}: ${added.length ? 'added ' + added.join(', ') : 'nothing to add'}`);
}
