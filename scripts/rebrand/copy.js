// The copy pass: new values for existing string keys, in four languages.
// Applied by `node scripts/rebrand/set-strings.js set`. Once applied,
// src/localization/ is the source of truth again; this file is the record of
// what was renamed and why.
//
// Vocabulary, from SoneBill's retail billing to the wholesaler's khata:
//   order / invoice / bill  ->  sale         (hi बिक्री, mr विक्री, gu વેચાણ)
//   payment                 ->  receipt      (जमा / जमा / જમા)
//   printed bill            ->  sale slip    (बिक्री पर्ची / विक्री पावती / વેચાણ ચિઠ્ઠી)
//   customer purchase       ->  sale to a retailer
// Printed GST documents keep "Tax Invoice" (bill.*, taxInvoice.*). That is
// their legal name, whatever the screen calls a sale.
module.exports = {
  // The item catalogue that fills a sale line, not a retail inventory.
  'items.title': { en: 'Item catalogue', hi: 'आइटम सूची', mr: 'वस्तू यादी', gu: 'આઇટમ યાદી' },
  'items.titleShort': { en: 'Catalogue', hi: 'सूची', mr: 'यादी', gu: 'યાદી' },
  // No "*" in the label text. The shop screen adds a red asterisk to the
  // fields it actually requires (name, address line 1, phone), so these read
  // "Shop Name * *". City and State are not required at all, so their "*" was
  // wrong. The labels also feed the length-validation messages.
  'shop.add.shopName': { en: 'Shop Name', hi: 'दुकान का नाम', mr: 'दुकानाचे नाव', gu: 'દુકાનનું નામ' },
  'shop.add.addr1': { en: 'Address Line 1', hi: 'पता पंक्ति 1', mr: 'पत्ता ओळ 1', gu: 'સરનામું લાઇન 1' },
  'shop.add.phone': { en: 'Phone Number', hi: 'फोन नंबर', mr: 'फोन नंबर', gu: 'ફોન નંબર' },
  'shop.add.city': { en: 'City', hi: 'शहर', mr: 'शहर', gu: 'શહેર' },
  'shop.add.state': { en: 'State', hi: 'राज्य', mr: 'राज्य', gu: 'રાજ્ય' },

  'shop.add.headerSubtitle': {
    en: 'This appears on your sale slips and statements',
    hi: 'यह जानकारी आपकी बिक्री पर्चियों और स्टेटमेंट पर दिखेगी',
    mr: 'ही माहिती तुमच्या विक्री पावत्या आणि स्टेटमेंटवर दिसेल',
    gu: 'આ માહિતી તમારી વેચાણ ચિઠ્ઠીઓ અને સ્ટેટમેન્ટ પર દેખાશે',
  },
  'items.emptySubtitle': {
    en: 'Add the ornaments you sell often to fill a sale line in one tap',
    hi: 'अक्सर बिकने वाले गहने जोड़ें, ताकि बिक्री की लाइन एक टैप में भर जाए',
    mr: 'नेहमी विकले जाणारे दागिने जोडा, म्हणजे विक्रीची ओळ एका टॅपमध्ये भरेल',
    gu: 'વારંવાર વેચાતા દાગીના ઉમેરો, જેથી વેચાણની લાઇન એક ટૅપમાં ભરાઈ જાય',
  },
  'print.configSubtitle': {
    en: 'Paper size for sale slips and statements',
    hi: 'बिक्री पर्ची और स्टेटमेंट का पेपर साइज़',
    mr: 'विक्री पावती आणि स्टेटमेंटचा कागद आकार',
    gu: 'વેચાણ ચિઠ્ઠી અને સ્ટેટમેન્ટનું પેપર સાઇઝ',
  },
  'print.printerTypeSubtitle': {
    en: 'Choose how sale slips are printed',
    hi: 'चुनें कि बिक्री पर्चियाँ कैसे प्रिंट हों',
    mr: 'विक्री पावत्या कशा छापायच्या ते निवडा',
    gu: 'વેચાણ ચિઠ્ઠીઓ કેવી રીતે છાપવી તે પસંદ કરો',
  },
  'thermalPrinter.connectedBody': {
    en: 'This printer will now be used for your sale slips.',
    hi: 'अब आपकी बिक्री पर्चियाँ इसी प्रिंटर पर प्रिंट होंगी।',
    mr: 'आता तुमच्या विक्री पावत्या याच प्रिंटरवर छापल्या जातील.',
    gu: 'હવે તમારી વેચાણ ચિઠ્ઠીઓ આ જ પ્રિન્ટર પર છપાશે.',
  },
  'printerChoice.title': {
    en: 'How do you print sale slips?',
    hi: 'आप बिक्री पर्ची कैसे प्रिंट करते हैं?',
    mr: 'तुम्ही विक्री पावती कशी छापता?',
    gu: 'તમે વેચાણ ચિઠ્ઠી કેવી રીતે છાપો છો?',
  },
  'printerChoice.standardSubtitle': {
    en: 'Standard printer, or save the slip as a PDF',
    hi: 'सामान्य प्रिंटर, या पर्ची को PDF के रूप में सहेजें',
    mr: 'सामान्य प्रिंटर, किंवा पावती PDF म्हणून जतन करा',
    gu: 'સામાન્ય પ્રિન્ટર, અથવા ચિઠ્ઠી PDF તરીકે સાચવો',
  },
  'settings.menu.meltSub': {
    en: "Take old ornaments in and credit them to a retailer's account",
    hi: 'पुराने गहने लें और रिटेलर के खाते में जमा करें',
    mr: 'जुने दागिने घ्या आणि रिटेलरच्या खात्यात जमा करा',
    gu: 'જૂના દાગીના લો અને રિટેલરના ખાતામાં જમા કરો',
  },
  'settings.deleteAccountConfirm': {
    en: 'This permanently deletes your account along with your shop details, sales, retailers and uploaded images. This cannot be undone.',
    hi: 'यह आपके खाते को आपकी दुकान विवरण, बिक्री, रिटेलर और अपलोड की गई छवियों सहित स्थायी रूप से हटा देता है। इसे पूर्ववत नहीं किया जा सकता।',
    mr: 'हे तुमचे खाते तुमच्या दुकानाचा तपशील, विक्री, रिटेलर आणि अपलोड केलेल्या प्रतिमांसह कायमचे हटवते. हे पूर्ववत करता येणार नाही.',
    gu: 'આ તમારા ખાતાને તમારી દુકાનની વિગતો, વેચાણ, રિટેલરો અને અપલોડ કરેલી છબીઓ સાથે કાયમ માટે કાઢી નાખે છે. આ પૂર્વવત્ કરી શકાતું નથી.',
  },
  'customers.emptySubHead': {
    en: 'Add the jewellery shops you supply',
    hi: 'जिन ज्वेलरी दुकानों को आप माल देते हैं, उन्हें जोड़ें',
    mr: 'तुम्ही माल पुरवता ती ज्वेलरी दुकाने जोडा',
    gu: 'તમે માલ પૂરો પાડો છો તે જ્વેલરી દુકાનો ઉમેરો',
  },
  'customers.stats.orders': { en: 'Sales', hi: 'बिक्री', mr: 'विक्री', gu: 'વેચાણ' },
  'customers.filters.noOrders': { en: 'No sales', hi: 'कोई बिक्री नहीं', mr: 'विक्री नाही', gu: 'વેચાણ નથી' },
  'customers.sort.ordersHigh': { en: 'Most sales', hi: 'सबसे ज़्यादा बिक्री', mr: 'सर्वाधिक विक्री', gu: 'સૌથી વધુ વેચાણ' },
  'customers.sort.saleHigh': {
    en: 'Sales value: high to low', hi: 'बिक्री मूल्य: ज़्यादा से कम', mr: 'विक्री मूल्य: जास्त ते कमी', gu: 'વેચાણ મૂલ્ય: વધુથી ઓછું',
  },
  'customers.sort.saleLow': {
    en: 'Sales value: low to high', hi: 'बिक्री मूल्य: कम से ज़्यादा', mr: 'विक्री मूल्य: कमी ते जास्त', gu: 'વેચાણ મૂલ્ય: ઓછાથી વધુ',
  },
  'customers.sort.recent': { en: 'Most recent sale', hi: 'हाल की बिक्री', mr: 'अलीकडील विक्री', gu: 'તાજેતરનું વેચાણ' },
  'customers.delete.plain': {
    en: 'This retailer has no sales. Deleting them cannot be undone.',
    hi: 'इस रिटेलर की कोई बिक्री नहीं है। हटाने के बाद वापस नहीं लाया जा सकता।',
    mr: 'या रिटेलरची कोणतीही विक्री नाही. हटवल्यानंतर परत आणता येणार नाही.',
    gu: 'આ રિટેલરનું કોઈ વેચાણ નથી. કાઢી નાખ્યા પછી પાછું મળશે નહીં.',
  },
  'customers.delete.records.orders': { en: 'sale(s)', hi: 'बिक्री', mr: 'विक्री', gu: 'વેચાણ' },
  'customers.delete.records.pending': {
    en: 'sale(s) with a balance', hi: 'बकाया वाली बिक्री', mr: 'बाकी असलेली विक्री', gu: 'બાકીવાળાં વેચાણ',
  },
  'customers.addAndCreateOrder': {
    en: 'Add retailer & record a sale', hi: 'रिटेलर जोड़ें और बिक्री दर्ज करें', mr: 'रिटेलर जोडा आणि विक्री नोंदवा', gu: 'રિટેલર ઉમેરો અને વેચાણ નોંધો',
  },
  'customers.detailsScreen.searchInvoicePlaceholder': {
    en: 'Search sale number...', hi: 'बिक्री नंबर खोजें...', mr: 'विक्री क्रमांक शोधा...', gu: 'વેચાણ નંબર શોધો...',
  },

  'orders.title': { en: 'Sales', hi: 'बिक्री', mr: 'विक्री', gu: 'વેચાણ' },
  'orders.total': { en: 'sales', hi: 'बिक्री', mr: 'विक्री', gu: 'વેચાણ' },
  'orders.newOrder': { en: 'New sale', hi: 'नई बिक्री', mr: 'नवीन विक्री', gu: 'નવું વેચાણ' },
  'orders.search': { en: 'Search sales...', hi: 'बिक्री खोजें...', mr: 'विक्री शोधा...', gu: 'વેચાણ શોધો...' },
  'orders.noOrdersHead': { en: 'No sales yet', hi: 'अभी कोई बिक्री नहीं', mr: 'अजून विक्री नाही', gu: 'હજી કોઈ વેચાણ નથી' },
  'orders.noOrdersSubHead': {
    en: 'Record a sale to get started', hi: 'शुरू करने के लिए बिक्री दर्ज करें', mr: 'सुरुवात करण्यासाठी विक्री नोंदवा', gu: 'શરૂ કરવા વેચાણ નોંધો',
  },
  'orders.noItems': {
    en: 'No items on this sale', hi: 'इस बिक्री में कोई आइटम नहीं', mr: 'या विक्रीत कोणतेही आयटम नाहीत', gu: 'આ વેચાણમાં કોઈ આઇટમ નથી',
  },
  'orders.detailsTitle': { en: 'Sale', hi: 'बिक्री', mr: 'विक्री', gu: 'વેચાણ' },
  'orders.notFound': { en: 'Sale not found', hi: 'बिक्री नहीं मिली', mr: 'विक्री सापडली नाही', gu: 'વેચાણ મળ્યું નહીં' },
  'orders.orderDate': { en: 'Sale date', hi: 'बिक्री की तारीख', mr: 'विक्री दिनांक', gu: 'વેચાણ તારીખ' },
  'orders.addAnotherHint': {
    en: 'Add another item to this sale.', hi: 'इस बिक्री में एक और आइटम जोड़ें।', mr: 'या विक्रीत आणखी एक आयटम जोडा.', gu: 'આ વેચાણમાં બીજી આઇટમ ઉમેરો.',
  },
  'orders.createOrder': { en: 'Save sale', hi: 'बिक्री सेव करें', mr: 'विक्री सेव्ह करा', gu: 'વેચાણ સેવ કરો' },
  'orders.created': { en: 'Sale saved', hi: 'बिक्री सेव हो गई', mr: 'विक्री सेव्ह झाली', gu: 'વેચાણ સેવ થયું' },
  'orders.savedPaymentFailed': {
    en: 'Sale saved, but a receipt did not go on it',
    hi: 'बिक्री सेव हो गई, लेकिन एक जमा उस पर नहीं चढ़ी',
    mr: 'विक्री सेव्ह झाली, पण एक जमा त्यावर चढली नाही',
    gu: 'વેચાણ સેવ થયું, પણ એક જમા તેના પર ચઢી નહીં',
  },
  'orders.share.invoiceFromPrefix': { en: 'Sale slip from', hi: 'बिक्री पर्ची:', mr: 'विक्री पावती:', gu: 'વેચાણ ચિઠ્ઠી:' },
  'orders.share.invoiceNumberLabel': { en: 'Sale No', hi: 'बिक्री नंबर', mr: 'विक्री क्रमांक', gu: 'વેચાણ નં.' },

  'orders.details.walkInCustomer': { en: 'Retailer', hi: 'रिटेलर', mr: 'रिटेलर', gu: 'રિટેલર' },
  'orders.details.totalOrderCost': { en: 'Sale value', hi: 'बिक्री मूल्य', mr: 'विक्री मूल्य', gu: 'વેચાણ મૂલ્ય' },
  'orders.details.advanceOrder': { en: 'Sale on account', hi: 'उधार बिक्री', mr: 'उधारी विक्री', gu: 'ઉધાર વેચાણ' },
  'orders.details.timelineSubtitle': {
    en: 'Every sale and receipt for this retailer',
    hi: 'इस रिटेलर की हर बिक्री और जमा',
    mr: 'या रिटेलरची प्रत्येक विक्री आणि जमा',
    gu: 'આ રિટેલરનું દરેક વેચાણ અને જમા',
  },
  'orders.details.viewFullTimeline': {
    en: 'Retailer statement', hi: 'रिटेलर स्टेटमेंट', mr: 'रिटेलर स्टेटमेंट', gu: 'રિટેલર સ્ટેટમેન્ટ',
  },
  'orders.details.downloadInvoice': { en: 'Download slip', hi: 'पर्ची डाउनलोड करें', mr: 'पावती डाउनलोड करा', gu: 'ચિઠ્ઠી ડાઉનલોડ કરો' },
  'orders.details.orderDetailsTitle': { en: 'Sale', hi: 'बिक्री', mr: 'विक्री', gu: 'વેચાણ' },
  'orders.details.shareTitle': { en: 'Share sale', hi: 'बिक्री शेयर करें', mr: 'विक्री शेअर करा', gu: 'વેચાણ શૅર કરો' },
  'orders.details.orderDateLabel': { en: 'Sale date', gu: 'વેચાણ તારીખ' },
  'orders.details.paymentProgress': { en: 'Settlement', hi: 'हिसाब', mr: 'हिशोब', gu: 'હિસાબ' },
  'orders.details.paymentHistory': { en: 'Receipts', hi: 'जमा', mr: 'जमा', gu: 'જમા' },
  'orders.details.noPaymentHistory': {
    en: 'Nothing received against this sale yet',
    hi: 'इस बिक्री पर अभी कुछ जमा नहीं',
    mr: 'या विक्रीवर अजून काही जमा नाही',
    gu: 'આ વેચાણ પર હજી કંઈ જમા નથી',
  },
  'orders.details.addPayment': { en: 'Add receipt', hi: 'जमा जोड़ें', mr: 'जमा जोडा', gu: 'જમા ઉમેરો' },
  // estimatedBalance is "what would close this today" (AGENTS.md), never a due.
  'orders.details.outstandingBalance': {
    en: 'To close today (estimate)',
    hi: 'आज चुकाने के लिए (अनुमान)',
    mr: 'आज पूर्ण करण्यासाठी (अंदाजे)',
    gu: 'આજે ચૂકતે કરવા (અંદાજ)',
  },
  'orders.details.advancePaid': { en: 'Received so far', hi: 'अब तक जमा', mr: 'आतापर्यंत जमा', gu: 'અત્યાર સુધી જમા' },

  'invoicePreview.billTo': { en: 'Sold to', hi: 'खरीदार', mr: 'खरेदीदार', gu: 'ખરીદનાર' },
  'invoicePreview.grandTotal': { en: 'Total value', hi: 'कुल मूल्य', mr: 'एकूण मूल्य', gu: 'કુલ મૂલ્ય' },

  'auth.tagline': {
    en: 'Wholesale gold khata', hi: 'थोक सोने का खाता', mr: 'घाऊक सोन्याचे खाते', gu: 'જથ્થાબંધ સોનાનું ખાતું',
  },
  'auth.register.skipDescription': {
    en: 'You can start using the app right away. Your sale slips and statements will show "Gold Khata Book" instead of your shop name until you add these details — you can fill them in any time from More.',
    hi: 'आप अभी से ऐप इस्तेमाल कर सकते हैं। यह जानकारी भरने तक आपकी बिक्री पर्चियों और स्टेटमेंट पर दुकान के नाम की जगह "Gold Khata Book" दिखेगा — इसे आप "और" टैब से कभी भी भर सकते हैं।',
    mr: 'तुम्ही आत्ताच अ‍ॅप वापरायला सुरुवात करू शकता. ही माहिती भरेपर्यंत तुमच्या विक्री पावत्या आणि स्टेटमेंटवर दुकानाच्या नावाऐवजी "Gold Khata Book" दिसेल — "अधिक" टॅबमधून तुम्ही ती कधीही भरू शकता.',
    gu: 'તમે અત્યારથી જ ઍપ વાપરવાનું શરૂ કરી શકો છો. આ વિગતો ભરો ત્યાં સુધી તમારી વેચાણ ચિઠ્ઠીઓ અને સ્ટેટમેન્ટ પર દુકાનના નામની જગ્યાએ "Gold Khata Book" દેખાશે — "વધુ" ટૅબમાંથી તમે એ ગમે ત્યારે ભરી શકો છો.',
  },

  'about.aboutDescription': {
    en: "Gold Khata Book is a ledger for gold wholesalers. It keeps every retailer's account in fine gold and cash, with sales, receipts, melt lots and statements in one place.",
    hi: 'Gold Khata Book सोने के थोक व्यापारियों का खाता है। यह हर रिटेलर का हिसाब शुद्ध सोने और नकद में रखता है, और बिक्री, जमा, गलाई लॉट और स्टेटमेंट एक ही जगह।',
    mr: 'Gold Khata Book हे सोन्याच्या घाऊक व्यापाऱ्यांचे खाते आहे. ते प्रत्येक रिटेलरचा हिशोब शुद्ध सोने आणि रोख यांत ठेवते, आणि विक्री, जमा, वितळवणी लॉट व स्टेटमेंट एकाच ठिकाणी.',
    gu: 'Gold Khata Book સોનાના જથ્થાબંધ વેપારીઓનું ખાતું છે. તે દરેક રિટેલરનો હિસાબ શુદ્ધ સોના અને રોકડમાં રાખે છે, અને વેચાણ, જમા, ગાળણ લોટ અને સ્ટેટમેન્ટ એક જ જગ્યાએ.',
  },

  'statement.orderCol': { en: 'Sale', hi: 'बिक्री', mr: 'विक्री', gu: 'વેચાણ' },
  'credit.willApply': { en: 'Apply to this sale', hi: 'इस बिक्री पर लगाएं', mr: 'या विक्रीवर लावा', gu: 'આ વેચાણ પર લગાવો' },
  'credit.applied': {
    en: 'Credit applied to this sale', hi: 'क्रेडिट इस बिक्री पर लग गया', mr: 'क्रेडिट या विक्रीवर लागले', gu: 'ક્રેડિટ આ વેચાણ પર લાગ્યું',
  },
  'rate.hint': {
    en: 'Used for every sale raised today', hi: 'आज की हर बिक्री पर लागू', mr: 'आजच्या प्रत्येक विक्रीला लागू', gu: 'આજના દરેક વેચાણને લાગુ',
  },
};
