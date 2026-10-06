// Updates the legal texts (privacy, account deletion, terms) where they
// describe SoneBill's UI or positioning. Exact substring replacements per
// language, so nothing else in a legal text can change by accident.
//
//   node scripts/rebrand/legal-copy.js          dry run: reports what matches
//   node scripts/rebrand/legal-copy.js --write
//
// Why each change:
//  - The deletion steps named the "Settings" tab and a "grey Logout button".
//    The tab is More now, and Logout is an outlined button. Deletion
//    instructions have to match the app: App Store guideline 5.1.1(v), and
//    Play's account-deletion page is generated from en.ts
//    (scripts/legal-pages.js).
//  - "invoices and bills ... advance orders" described SoneBill's records.
//    This app keeps sales and receipts.
//  - The Terms called the app a "Jewellery Billing Application".
//  - The Gujarati Terms paragraph 2 was corrupted in the SoneBill original:
//    it contained stray zero-width characters, "the" and Korean "있다".
//    It is rewritten whole.
// After running, redeploy the web build so the public legal pages match.
const fs = require('fs');
const path = require('path');

const PAIRS = {
  en: [
    ['Go to the Settings tab in the bottom navigation bar', 'Go to the More tab in the bottom navigation bar'],
    ['all invoices and bills you have created, all advance orders and their payment history', 'all sales you have recorded and the receipts against them'],
    ['such as invoices required for tax records', 'such as sale slips or statements required for tax records'],
    ["title: 'Step 2 — Open Settings'", "title: 'Step 2 — Open More'"],
    ['Tap the Settings tab, the last icon in the navigation bar at the bottom of the screen.', 'Tap More, the last icon in the navigation bar at the bottom of the screen.'],
    ['Scroll to the very bottom of the Settings screen. Below the grey Logout button', 'Scroll to the very bottom of the More screen. Below the Logout button'],
    ['every invoice and bill you have created; every advance order and its payment history;', 'every sale you have recorded and the receipts against it;'],
    ['invoices for your tax records, for example', 'sale slips and statements for your tax records, for example'],
    ['By using this Jewellery Billing Application ("App")', 'By using Gold Khata Book ("App")'],
    ['to support jewellery businesses with billing and operational management', 'to support gold wholesalers in keeping their accounts with retailers'],
  ],
  hi: [
    ['नीचे के नेविगेशन बार में सेटिंग्स टैब पर जाएं', 'नीचे के नेविगेशन बार में "और" टैब पर जाएं'],
    ['आपके द्वारा बनाए गए सभी चालान और बिल, सभी अग्रिम ऑर्डर और उनका भुगतान इतिहास', 'आपकी दर्ज की गई सभी बिक्री और उन पर मिली जमा'],
    ['जैसे कर रिकॉर्ड के लिए चालान', 'जैसे कर रिकॉर्ड के लिए बिक्री पर्चियाँ और स्टेटमेंट'],
    ['चरण 2 — सेटिंग्स खोलें', 'चरण 2 — "और" खोलें'],
    ['स्क्रीन के नीचे नेविगेशन बार में अंतिम आइकन, सेटिंग्स टैब पर टैप करें।', 'स्क्रीन के नीचे नेविगेशन बार में अंतिम आइकन, "और" टैब पर टैप करें।'],
    ['सेटिंग्स स्क्रीन के बिल्कुल नीचे तक स्क्रॉल करें। ग्रे लॉगआउट बटन के नीचे', '"और" स्क्रीन के बिल्कुल नीचे तक स्क्रॉल करें। लॉगआउट बटन के नीचे'],
    ['आपके बनाए हुए सभी चालान और बिल; सभी अग्रिम ऑर्डर और उनका भुगतान इतिहास;', 'आपकी दर्ज की गई सभी बिक्री और उन पर मिली जमा;'],
    ['इस ज्वेलरी बिलिंग एप्लिकेशन ("ऐप") का उपयोग करके', 'Gold Khata Book ("ऐप") का उपयोग करके'],
    ['ज्वेलरी व्यवसायों को बिलिंग और परिचालन प्रबंधन में सहायता के लिए', 'सोने के थोक व्यापारियों को रिटेलरों के साथ हिसाब रखने में सहायता के लिए'],
  ],
  mr: [
    ['खालच्या नेव्हिगेशन बारमधील सेटिंग्ज टॅबवर जा', 'खालच्या नेव्हिगेशन बारमधील "अधिक" टॅबवर जा'],
    ['तुम्ही तयार केलेली सर्व बिले आणि पावत्या, सर्व ॲडव्हान्स ऑर्डर आणि त्यांचा पेमेंट इतिहास', 'तुम्ही नोंदवलेली सर्व विक्री आणि त्यावरील जमा'],
    ['उदाहरणार्थ कर नोंदींसाठी लागणारी बिले', 'उदाहरणार्थ कर नोंदींसाठी लागणाऱ्या विक्री पावत्या आणि स्टेटमेंट'],
    ['पायरी २ — सेटिंग्ज उघडा', 'पायरी २ — "अधिक" उघडा'],
    ['स्क्रीनच्या तळाशी असलेल्या नेव्हिगेशन बारमधील शेवटचा आयकॉन, सेटिंग्ज टॅब दाबा.', 'स्क्रीनच्या तळाशी असलेल्या नेव्हिगेशन बारमधील शेवटचा आयकॉन, "अधिक" टॅब दाबा.'],
    ['सेटिंग्ज स्क्रीनच्या अगदी तळापर्यंत स्क्रोल करा. करड्या रंगाच्या लॉगआउट बटणाच्या खाली', '"अधिक" स्क्रीनच्या अगदी तळापर्यंत स्क्रोल करा. लॉगआउट बटणाच्या खाली'],
    ['तुम्ही तयार केलेली प्रत्येक बिल आणि पावती; प्रत्येक ॲडव्हान्स ऑर्डर आणि तिचा पेमेंट इतिहास;', 'तुम्ही नोंदवलेली प्रत्येक विक्री आणि त्यावरील जमा;'],
    ['या ज्वेलरी बिलिंग अॅप्लिकेशन ("अॅप") चा वापर करून', 'Gold Khata Book ("अॅप") चा वापर करून'],
    ['ज्वेलरी व्यवसायांना बिलिंग आणि परिचालन व्यवस्थापनात मदत करण्यासाठी', 'सोन्याच्या घाऊक व्यापाऱ्यांना रिटेलरसोबतचा हिशोब ठेवण्यात मदत करण्यासाठी'],
  ],
  gu: [
    ['નીચેના નેવિગેશન બારમાં સેટિંગ્સ ટૅબ પર જાઓ', 'નીચેના નેવિગેશન બારમાં "વધુ" ટૅબ પર જાઓ'],
    ['તમે બનાવેલા બધા બિલ અને ઇન્વોઇસ, બધા એડવાન્સ ઓર્ડર અને તેમનો ચુકવણી ઇતિહાસ', 'તમે નોંધેલાં બધાં વેચાણ અને તેના પર મળેલી જમા'],
    ['જેમ કે કર રેકોર્ડ માટેના બિલ', 'જેમ કે કર રેકોર્ડ માટેની વેચાણ ચિઠ્ઠીઓ અને સ્ટેટમેન્ટ'],
    ['પગલું 2 — સેટિંગ્સ ખોલો', 'પગલું 2 — "વધુ" ખોલો'],
    ['સ્ક્રીનના તળિયે આવેલા નેવિગેશન બારમાં છેલ્લું આઇકન, સેટિંગ્સ ટૅબ દબાવો.', 'સ્ક્રીનના તળિયે આવેલા નેવિગેશન બારમાં છેલ્લું આઇકન, "વધુ" ટૅબ દબાવો.'],
    ['સેટિંગ્સ સ્ક્રીનના છેક તળિયે સ્ક્રોલ કરો. ગ્રે લૉગઆઉટ બટનની નીચે', '"વધુ" સ્ક્રીનના છેક તળિયે સ્ક્રોલ કરો. લૉગઆઉટ બટનની નીચે'],
    ['તમે બનાવેલું દરેક બિલ અને ઇન્વોઇસ; દરેક એડવાન્સ ઓર્ડર અને તેનો ચુકવણી ઇતિહાસ;', 'તમે નોંધેલું દરેક વેચાણ અને તેના પર મળેલી જમા;'],
    ['આ જ્વેલરી બિલિંગ ઍપ્લિકેશન ("ઍપ") નો ઉપયોગ કરીને', 'Gold Khata Book ("ઍપ") નો ઉપયોગ કરીને'],
    [/આ ઍપ હાલ જ્વેલરી વ્યવસાયોને[^']*?સુરક્ષિત રાખીએ છીએ\./,
      'આ ઍપ હાલ સોનાના જથ્થાબંધ વેપારીઓને રિટેલરો સાથેનો હિસાબ રાખવામાં મદદ કરવા માટે મફત ઉપલબ્ધ છે. મફત ઉપયોગ અમારી ઇન્ફ્રાસ્ટ્રક્ચર, સર્વર અને ડેટાબેઝ ક્ષમતાની મર્યાદાઓને આધીન છે. વપરાશકર્તાઓ અને ડેટા વધે ત્યારે, અમે પેઇડ પ્લાન, ન્યૂનતમ ફી અથવા ફ્રી વપરાશકર્તાઓ માટે ચોક્કસ ફીચર્સ મર્યાદિત કરવાનો અધિકાર અમારી પાસે સુરક્ષિત રાખીએ છીએ.'],
  ],
};

const write = process.argv.includes('--write');
let problems = 0;
for (const [lang, pairs] of Object.entries(PAIRS)) {
  const file = path.join(__dirname, '../../src/localization', `${lang}.ts`);
  let src = fs.readFileSync(file, 'utf8');
  const report = [];
  for (const [from, to] of pairs) {
    const isRe = from instanceof RegExp;
    const count = isRe ? (src.match(new RegExp(from.source, 'g')) || []).length : src.split(from).length - 1;
    if (count === 0) {
      // Already applied is fine; anything else is a mismatch to look at.
      const applied = src.includes(to);
      report.push(`${applied ? 'already' : 'MISSING'}: ${String(from).slice(0, 50)}`);
      if (!applied) problems++;
      continue;
    }
    src = isRe ? src.replace(new RegExp(from.source, 'g'), to) : src.split(from).join(to);
    report.push(`x${count}: ${String(from).slice(0, 50)}`);
  }
  if (write) fs.writeFileSync(file, src);
  console.log(`== ${lang}\n  ${report.join('\n  ')}`);
}
if (problems) { console.error(`${problems} replacement(s) found nothing`); process.exitCode = 1; }
