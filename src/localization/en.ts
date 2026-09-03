export default {
  shop: {
    add: {
      headerTitle: 'Add Shop Details',
      headerTitleEdit: 'Edit Shop Details',
      headerSubtitle: 'This info will appear on your invoices',

      infoTitle: 'Shop Information',
      infoSubtitle: 'Enter your shop details',

      shopName: 'Shop Name *',
      shopDesc: 'Shop Description',
      addr1: 'Address Line 1 *',
      addr2: 'Address Line 2',
      city: 'City *',
      state: 'State *',
      zipcode: 'Zipcode',
      phone: 'Phone Number *',
      email: 'Email (Optional)',
      website: 'Website (Optional)',
      gst: 'GST Number (Optional)',

      brandingTitle: 'Branding',
      shopLogo: 'Shop Logo',
      chooseLogo: 'Choose Shop Logo',
      shopHeader: 'Shop Header (recommended 2480×700px)',
      chooseHeader: 'Choose Shop Header',
      signature: 'Signature',
      signatureRotate: 'Rotate signature',
      addSignature: 'Add Signature',

      saveBtn: 'Save Shop Details',
      saveBtnEdit: 'Update Shop Details',
      saving: 'Saving...',
      brandingHint: 'Tap to upload · Tap eye icon to preview',

      preview: {
        shopLogoTitle: 'Shop Logo',
        shopHeaderTitle: 'Shop Header',
        signatureTitle: 'Signature',
        noImage: 'No image selected',
        replaceImage: 'Replace Image',
      },

      alerts: {
        errorTitle: 'Error',
        validationTitle: 'Validation Error',
        successTitle: 'Success',
        imageLibraryUnavailable: 'Image library not available',
        imageLibraryFailed: 'Failed to open image library',
        imageTooLarge: 'Image size should be less than 10MB',
        shopNameRequired: 'Shop name is required',
        phoneRequired: 'Phone number is required',
        addressRequired: 'At least one address line is required',
        phoneInvalid: 'Please enter a valid 10-digit phone number',
        emailInvalid: 'Please enter a valid email address',
        gstInvalid: 'Please enter a valid 15-digit GST number',
        saveSuccess: 'Shop details saved successfully!',
        saveFailed: 'Failed to save shop details. Please check your connection.',
      },

      placeholders: {
        shopName: 'e.g., Shree Jewellers',
        shopDesc: 'Brief description of your business',
        addr1: 'Street address, building number',
        addr2: 'Apartment, suite, unit, etc.',
        city: 'e.g., Mumbai',
        state: 'e.g., Maharashtra',
        zipcode: 'e.g., 400001',
        phone: 'e.g., 9876543210',
        email: 'e.g., shop@email.com',
        website: 'e.g., www.shreejewellers.com',
        gst: 'e.g., 22AAAAA0000A1Z5',
      },
    },
  },

  items: {
    title: 'Inventory / Products',
    titleShort: 'Inventory',
    count: 'items',

    selectSaved: 'Select Saved Items',
    chooseFromCatalog: 'Choose from catalog...',

    addItem: 'Add Item',
    searchPlaceholder: 'Search items...',

    emptyTitle: 'No items yet',
    emptySubtitle: 'Add items to quickly select them when creating invoices',
    noItemsYetTitle: 'No items added yet',
    noItemsYetSubtitle: 'Click "Add Item" to add items',
    unnamedItem: 'Unnamed Item',

    modal: {
      addTitle: 'Add New Item',
      editTitle: 'Edit Item',
      inputPlaceholder: 'Enter item name (e.g., Gold Ring, Necklace)',
      saveBtn: 'Save Item',
      addBtn: 'Add Item',
      cancelBtn: 'Cancel',
    },

    typeLabel: 'Item Type',

    form: {
      selectPlaceholder: 'Select...',
      fields: {
        itemName: 'Item Name',
        type: 'Type',
        purity: 'Purity',
        makingChargeType: 'Making Charge Type',
        makingCharges: 'Making Charges',
        discountType: 'Discount Type',
        discount: 'Discount',
        grossWeight: 'Gross Weight',
        lessWeight: 'Less Weight',
        huid: 'HUID',
        pieces: 'Pieces',
        stockQty: 'Stock Qty (pieces)',
        otherChargeDesc: 'Other Charge Desc',
        otherChargeAmount: 'Charge Amount',
      },
      placeholders: {
        itemName: 'e.g. Gold Ring, Necklace',
        makingCharges: 'Enter Charges',
        discount: 'Enter discount',
        grossWeight: 'Enter weight',
        lessWeight: 'Enter weight',
        huid: 'Enter HUID',
        pieces: 'Enter pieces',
        stockQty: 'Blank = not tracked',
        otherChargeDesc: 'Enter description',
        otherChargeAmount: 'Enter amount',
      },
    },

    alerts: {
      validationTitle: 'Validation',
      nameRequired: 'Item name is required.',
      nameDuplicate: 'Item name already exists.',
      deleteTitle: 'Delete Item?',
      deleteMessage: 'This will remove \"{name}\" from your saved items. This action cannot be undone.',
      deleteConfirm: 'Delete',
    },
  },

  gst: {
    headerTitle: 'GST Settings',
    headerSubtitle: 'Configure tax rates',

    label: 'GST Rate (%)',

    alerts: {
      errorTitle: 'Error',
      successTitle: 'Success',
      shopNotFound: 'Shop details not found. Please add shop details first.',
      updateSuccess: 'GST settings updated successfully.',
      updateFailed: 'Failed to update GST settings.',
    },

    noteTitle: 'Note',
    noteDescription:
      'These GST rates will be applied when calculating invoice totals. Make sure to keep these rates updated according to current government regulations.',

    saveBtn: 'Save Settings',
  },

  metalRates: {
    title: 'Metal Rates',
    subtitle: "Today's prices",
    pricePerGram: 'Price per gram',
    gold: {
      title: 'Gold Rates',
      guaranteedWeight: 'Guaranteed Weight',
      ornament: 'Ornament Gold',
      jewelry: 'Jewelry Gold',
      lowPurity: 'Low Purity Gold',
    },
    silver: {
      title: 'Silver Rate',
    },
    liveRatesNote: 'Live rates · updated just now',
  },

  language: {
    title: 'Language',
    subtitle: 'Choose your preferred language',
    declaration: {
      title: 'Declaration Language',
      hint: 'New declarations are written in this language. You can change it on any individual declaration.',
      hintFollowingApp:
        'Currently following your app language. Pick one to always print declarations in the language your retailers read.',
    },
  },

  about: {
    headerTitle: 'About Us',
    appName: 'Gold Khata Book',
    version: 'Version',
    aboutTitle: 'About Gold Khata Book',
    aboutDescription: 'Gold Khata Book is a specialized jewellery billing and management solution designed to simplify your business operations.',
    featuresTitle: 'Key Features',
    features: [
      'Easy Invoice Generation',
      'Inventory Management',
      'Retailer Record Maintenance',
      'Sales Reports & Analysis',
      'Multi-language Support',
      'GST Ready Billing'
    ],
    footerLine1: 'Crafted with ❤️ for Jewelers',
    footerLine2: 'Gold Khata Book. All rights reserved.',
    contactTitle: 'Contact Us',
    call: 'Call',
    whatsapp: 'WhatsApp',
  },

  privacy: {
    title: 'Privacy Policy',
    lastUpdated: 'Last Updated',
    sections: [
      {
        title: '1. Data Ownership',
        content: 'All business data entered into the App — including retailer details, billing information, product details, inventory records, transaction history, and business reports — remains the property of the respective business/user. We do not claim ownership of your business data.',
      },
      {
        title: '2. Data Access and Usage',
        content: 'To operate, maintain, support, secure, and improve the App, authorized administrators or technical personnel may have limited access to data stored within the system. This access is strictly limited to technical support, troubleshooting, data backup and recovery, security monitoring, and performance improvements. We do not access or use your business data for commercial resale or unauthorized purposes.',
      },
      {
        title: '3. Data Privacy and Confidentiality',
        content: 'We understand that your business data is highly confidential. We are committed to protecting your data and will not sell, rent, distribute, or share your business information with any third party for marketing or commercial purposes. Your data will remain confidential and protected using reasonable security practices.',
      },
      {
        title: '4. Government and Legal Requests',
        content: 'We will not voluntarily share your business data with Income Tax authorities, GST authorities, government departments, regulatory agencies, or third parties unless required to do so under applicable law. Data may only be disclosed upon receipt of a valid court order, a legally binding government notice, or a lawful order from a competent legal authority.',
      },
      {
        title: '5. Data Security',
        content: 'We implement reasonable administrative, technical, and security measures to protect your data from unauthorized access, misuse, or disclosure. However, no digital system can guarantee 100% security. By using the App, you acknowledge and accept this risk.',
      },
      {
        title: '6. Device Permissions',
        content: 'With your permission, the App can read your phone contacts so you can quickly fill in a new retailer\'s name and phone number instead of typing it manually. Your contact list is only read on your device and is never uploaded, stored on our servers, or shared with any third party — only the single retailer record you choose to save is stored, the same as if you had typed it in yourself. You can decline this permission at any time and still add retailers manually; you can also revoke it later from your device settings.',
      },
      {
        title: '7. Approximate Location',
        content: 'When you sign in or open the App, we record the approximate city and state your internet connection appears to be in. This is worked out from your IP address using a database held on our own server — your IP address is never sent to any third party, and the address itself is not stored. We do not ask for location permission and we cannot see your GPS position. The result is never more precise than a city, and on a mobile network it is usually the city of your network operator\'s gateway rather than your own. We use it only to understand which parts of the country Gold Khata Book is used in. It is removed along with everything else when you delete your account.',
      },
      {
        title: '8. Deleting Your Account and Your Data',
        content: 'You can permanently delete your account and all data associated with it from inside the App, at any time, without contacting us. Open the App and sign in with your registered mobile number and the OTP sent to it. Go to the Settings tab in the bottom navigation bar, scroll to the very bottom of the screen, and tap the red "Delete Account" button. A confirmation dialog will appear — tap "Delete Permanently" to confirm. Deletion is immediate and cannot be undone.',
      },
      {
        title: '9. What Deletion Removes',
        content: 'Deleting your account permanently removes your account and mobile number, your shop details, GST settings and shop logo and signature, all invoices and bills you have created, all advance orders and their payment history, your retailer list, your inventory and product records, and any images you have uploaded. Nothing is retained in a recoverable form, so please export or print anything you need — such as invoices required for tax records — before you delete. We may retain minimal anonymised records where the law requires it, and de-identified analytics that cannot be linked back to you or your shop. If you cannot sign in to complete the deletion yourself, email us from your registered mobile number\'s associated address at codeimplants@gmail.com and we will action the request.',
      },
    ]
  },

  accountDeletion: {
    title: 'Account & Data Deletion',
    lastUpdated: 'Last Updated',
    sections: [
      {
        title: 'Deleting your Gold Khata Book account',
        content: 'Gold Khata Book lets you delete your account and all of its data yourself, directly in the app. You do not need to email us or wait for approval, and there is no charge. Deletion is immediate and permanent.',
      },
      {
        title: 'Step 1 — Sign in',
        content: 'Open the Gold Khata Book app on your phone, or go to https://goldkhatabook.codeimplants.com in a browser. Enter the mobile number your account is registered with, tap Send OTP, and enter the 6-digit code you receive by SMS. If you are browsing as a guest you have no account to delete — guest use does not create one.',
      },
      {
        title: 'Step 2 — Open Settings',
        content: 'Tap the Settings tab, the last icon in the navigation bar at the bottom of the screen.',
      },
      {
        title: 'Step 3 — Tap Delete Account',
        content: 'Scroll to the very bottom of the Settings screen. Below the grey Logout button you will find a red "Delete Account" button. Tap it.',
      },
      {
        title: 'Step 4 — Confirm',
        content: 'A confirmation dialog explains what will be removed. Tap "Delete Permanently" to go ahead, or Cancel to stop. Once you confirm, your account is deleted straight away and you are signed out. This cannot be undone.',
      },
      {
        title: 'What gets deleted',
        content: 'Your account and registered mobile number; your shop details, GST settings, shop logo and signature; every invoice and bill you have created; every advance order and its payment history; your full retailer list; your inventory and product records; and all images you have uploaded. Export or print anything you still need — invoices for your tax records, for example — before you delete, because none of it can be recovered afterwards.',
      },
      {
        title: 'What we may keep',
        content: 'Only minimal anonymised records that we are required by law to retain, and de-identified usage analytics that cannot be linked back to you, your shop or your retailers. We keep no copy of your business data after deletion.',
      },
      {
        title: 'If you cannot sign in',
        content: 'If you have lost access to your registered mobile number and cannot complete the steps above, email codeimplants@gmail.com from your usual address with your shop name and registered mobile number. We will verify your identity and delete the account for you within 30 days.',
      },
    ],
  },

  contact: {
    headerTitle: 'Help / Support',
    introTitle: 'Get in Touch',
    introSubtitle: 'Have questions or need support? We are here to help you!',
    email: 'Support Email',
    phone: 'Phone Support',
    whatsapp: 'WhatsApp Support',
    address: 'Our Office',
    businessHoursTitle: 'Business Hours',
    hours: {
      weekday: 'Mon - Sat: 10:00 AM - 07:00 PM',
      sunday: 'Sunday: Closed',
    }
  },

  terms: {
    title: 'Terms & Conditions',
    lastUpdated: 'Last Updated',
    sections: [
      {
        title: '1. Acceptance of Terms',
        content: 'By using this Jewellery Billing Application ("App"), you agree to comply with and be bound by these Terms & Conditions. If you do not agree, please discontinue use of the App.',
      },
      {
        title: '2. Free Usage Policy',
        content: 'This App is currently provided free of cost to support jewellery businesses with billing and operational management. However, free usage is subject to our infrastructure, server, and database capacity limits. As the number of users and stored data increases, we reserve the right to introduce paid subscription plans, charge a minimal maintenance fee, restrict certain features for free users, or request users to export and delete their data if they choose not to continue under updated pricing plans. We will make reasonable efforts to inform users in advance before any pricing changes take effect.',
      },
      {
        title: '3. Data Ownership',
        content: 'All business data entered into the App — including retailer details, billing information, product details, inventory records, transaction history, and business reports — remains the property of the respective business/user. We do not claim ownership of your business data.',
      },
      {
        title: '4. Data Access and Usage',
        content: 'To operate, maintain, support, secure, and improve the App, authorized administrators or technical personnel may have limited access to data stored within the system. This access is strictly limited to technical support, troubleshooting, data backup and recovery, security monitoring, and performance improvements. We do not access or use your business data for commercial resale or unauthorized purposes.',
      },
      {
        title: '5. Data Privacy and Confidentiality',
        content: 'We understand that your business data is highly confidential. We are committed to protecting your data and will not sell, rent, distribute, or share your business information with any third party for marketing or commercial purposes. Your data will remain confidential and protected using reasonable security practices.',
      },
      {
        title: '6. Government and Legal Requests',
        content: 'We will not voluntarily share your business data with Income Tax authorities, GST authorities, government departments, regulatory agencies, or third parties unless required to do so under applicable law. Data may only be disclosed upon receipt of a valid court order, a legally binding government notice, or a lawful order from a competent legal authority.',
      },
      {
        title: '7. Data Security',
        content: 'We implement reasonable administrative, technical, and security measures to protect your data from unauthorized access, misuse, or disclosure. However, no digital system can guarantee 100% security. By using the App, you acknowledge and accept this risk.',
      },
      {
        title: '8. Service Availability',
        content: 'We aim to provide uninterrupted service but do not guarantee that the App will always be available without downtime, maintenance, technical issues, or interruptions. We reserve the right to suspend or modify the service when necessary.',
      },
      {
        title: '9. Changes to Terms',
        content: 'We reserve the right to update or modify these Terms & Conditions at any time. Users will be notified of major changes through the App or other communication channels. Continued use of the App after updates constitutes acceptance of the revised terms.',
      },
      {
        title: '10. Contact',
        content: 'For questions regarding these Terms & Conditions or data privacy, please contact the App administrator or support team.',
      },
    ],
  },

  print: {
    headerTitle: 'Print Settings',
    headerSubtitle: 'Configure print page size',

    configTitle: 'Print Configuration',
    configSubtitle: 'Customize invoice print size',

    useCustomTitle: 'Use Custom Print Size',
    customEnabled: 'Custom page dimensions enabled',
    defaultInfo: 'Default A4 size (210mm x 297mm)',

    defaultRecommendedTitle: 'Default Print (Recommended)',
    defaultRecommendedDesc:
      'Uses standard A4 size (210mm x 297mm) which is compatible with most printers.',

    customDimensionsTitle: 'Custom Page Dimensions',
    widthLabel: 'Page Width (mm)',
    heightLabel: 'Page Height (mm)',

    sizeHint:
      'Standard sizes: A4 (210x297mm), A5 (148x210mm), Letter (216x279mm)',

    saveBtn: 'Save Print Settings',

    headerReserveLabel: 'Header Space (mm)',
    headerReserveHint:
      'Blank space kept at the top of every sheet, for stationery that already has your shop details printed on it. Leave 0 if your paper is blank.',

    positionTitle: 'Where the paper sits',
    positionHint:
      'A printer prints in the same place whatever size sheet you load, so we need to know where your tray holds it. Most desktop printers grip the sheet in the centre. Printers that feed from an upright tray usually push it against one side.',
    posLeft: 'Left side',
    posCenter: 'Centre',
    posRight: 'Right side',

    testPrintBtn: 'Print Test Page',
    testPrintHint:
      'Prints an outline of your paper size. If the whole box lands on the sheet, your settings are right. If one side is cut off, change where the paper sits.',

    driverTipTitle: 'For best results',
    driverTipDesc:
      'Add your paper size to your printer settings on the computer as a Custom size. The printer then knows the real size and places everything correctly on its own.',

    errWidth: 'Width must be between 1 and 216 mm',
    errHeight: 'Height must be between 1 and 297 mm',
    errReserve: 'Header space must be less than the page height',

    printerTypeTitle: 'Printer Type',
    printerTypeSubtitle: 'Choose how your bills are printed',
    standardOption: 'Standard (A4)',
    thermalOption: 'Thermal (58mm)',
    thermalWebUnavailable:
      'Thermal printing needs Bluetooth, which browsers cannot use. Open Gold Khata Book on your Android or iOS device to print to a thermal printer. On the web, bills always print to a regular A4 printer.',
    noPrinterSelected: 'No printer selected',
    changePairPrinter: 'Tap to change / pair printer',
  },

  /* Invoice template picker. Grouped by WHO prints the shop's header: us in one
     of our styles, the press onto the shop's own paper, or us from a banner the
     shop uploaded. The style names stay in English as labels; everything that
     explains a choice is translated, because choosing wrong means every printed
     bill is wrong. */
  invoiceTemplates: {
    groupStandardTitle: 'Print everything on blank paper',
    groupStandardDesc:
      'We print your shop name, address and GST number at the top, then the bill below it. Use plain blank paper. Your details come from Shop Details.',

    groupPrePrintedTitle: 'Print on your own letterhead',
    groupPrePrintedDesc:
      'For paper that already has your shop details printed on it. We leave the top of every page blank for your printed header and print only the bill below it.',
    prePrintedLabel: 'Pre-Printed Bill (Shop Header)',
    prePrintedDesc: 'Your paper already has your header',
    prePrintedLocked: 'Set Header Space in Print Settings first',
    prePrintedHint:
      'Set Header Space in Print Settings to tell us where your printed header ends. Set the page size there too if your paper is not A4.',

    groupBannerTitle: 'Print your header image on blank paper',
    groupBannerDesc:
      'Choose this if you have a digital copy of your header. We print your header image at the top of blank paper, then the bill below it.',
    bannerDescHas: 'Your uploaded banner replaces the invoice header',
    bannerDescMissing: 'Upload a shop header in Shop Details first',

    loginRequired: 'Log in to use this template',
    screenTitle: 'Invoice / Bill Settings',
    screenSubtitle: 'Template and shop header banner',
    bannerLabel: 'Shop Header Banner',
    saveBtn: 'Save Invoice / Bill Settings',
    saving: 'Saving…',
    previewFrameTitle: 'Invoice Preview',
    discardTitle: 'Discard changes?',
    discardBody: 'Your invoice template change has not been saved yet.',
    discardConfirm: 'Discard',
    discardCancel: 'Keep editing',
    discardSave: 'Save and leave',
    useThisTemplate: 'Use This Template',
    close: 'Close',
    openShopDetails: 'Open Shop Details →',
    openPrintSettings: 'Open Print Settings →',
    descTaxColor: 'Formal GST layout, colour header',
    descTaxBold: 'Formal GST layout, black & bold',
    prePrintedTaxLabel: 'Pre-Printed Bill (Professional)',
    prePrintedTaxDesc: 'Formal GST layout on your paper',
    descMinimal: 'Clean black & white',
    descTraditional: 'Classic saffron style',
    descModern: 'Gold accent, clean layout',
    descClassic: 'Navy professional',

    preview: 'Preview',
    notAvailable: 'Not available',
  },

  /* Formal GST tax-invoice templates. The amount in words is intentionally NOT
     translated — Indian tax invoices state it in English rupees regardless of
     the language the rest of the bill is printed in. */
  taxInvoice: {
    title: 'TAX INVOICE',
    slNo: 'Sl No.',
    description: 'Description of Goods',
    hsnSac: 'HSN/SAC',
    quantity: 'Quantity',
    rate: 'Rate',
    per: 'per',
    perGms: 'Gms.',
    amount: 'Amount',
    total: 'Total',
    amountChargeable: 'Amount Chargeable (in words)',
    declaration: 'Declaration',
    declarationText:
      'We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.',
    for: 'for',
    jurisdictionLine: 'SUBJECT TO {city} JURISDICTION',
    computerGenerated: 'This is a Computer Generated Invoice',
  },

  thermalPrinter: {
    headerTitle: 'Thermal Printer',
    headerSubtitle: 'Pair a Bluetooth receipt printer',

    nearbyDevices: 'Nearby printers',
    scanning: 'Scanning for nearby Bluetooth printers…',
    connect: 'Connect',
    currentlySelected: 'Currently selected printer',
    sendTestPrint: 'Send test print',

    connectedTitle: 'Printer connected',
    connectedBody: 'This printer will now be used for your bills.',
    connectFailedTitle: "Couldn't connect",
    connectFailedBody:
      'Make sure the printer is switched on and nearby, then try again.',
    testPrintFailedTitle: 'Test print failed',
    testPrintFailedBody:
      "Couldn't reach the printer. Check that it is switched on and in range.",

    bluetoothOff: 'Bluetooth is switched off. Turn it on to find your printer.',
    permissionDenied:
      'Bluetooth permission was denied. Allow it in system settings to pair a printer.',
    noPrinterError:
      'No thermal printer is connected. Pair one in Print Settings first.',
    printFailedTitle: 'Print failed',
    refresh: 'Refresh',
    unsupportedPlatform: 'This printer type is not supported on iPhone. Use a Bluetooth 4.0 or WiFi printer instead.',
    iosBluetoothNote: 'iPhone can use Bluetooth 4.0+ printers and WiFi printers. Older Bluetooth-only printers work on Android phones only — this is an Apple restriction.',
    pairInSettingsHint: "Older Bluetooth printers must first be paired in your phone's Bluetooth settings (PIN is usually 0000).",
    wifiTitle: 'WiFi printer',
    wifiSubtitle: "Enter the printer's IP address, shown on its self-test page.",
    wifiIpLabel: 'IP address',
    wifiPortLabel: 'Port',
    wifiConnect: 'Connect WiFi printer',
    wifiUnreachable: 'No printer answered at that address. Check the IP and that the printer is on the same WiFi network.',
  },

  printerChoice: {
    title: 'How do you print bills?',
    changeTitle: 'Change printer',
    subtitle: 'You can change this later in Print Settings.',
    standardTitle: 'Regular printer (A4)',
    standardSubtitle: 'Standard printer, or save the bill as a PDF',
    thermalTitle: 'Thermal receipt printer',
    thermalSubtitle: 'Small 58mm till-roll printer (Bluetooth or WiFi)',
    changeLaterHint: 'You can change your printer any time from Settings.',
    change: 'Change',
    printingTo: 'Printing to: {name}',
    printingToStandard: 'Printing to: Regular printer (A4)',
    changeConfirm: {
      title: 'Open Print Settings?',
      description: 'This will take you to Print Settings and leave this screen.',
      confirm: 'Open Settings',
    },
    noPrinterYet: 'No thermal printer connected yet',
    tryAgain: 'Try again',
    useRegularPrinter: 'Use regular printer',
    setUpPrinter: 'Set up printer',
    // Shown when the A4/PDF print fails. Kept separate from the thermal wording:
    // a regular printer is set up in the phone's own settings, not in this app,
    // so there is nothing here to switch on or bring "in range".
    popupBlockedTitle: 'Allow pop-ups to print',
    popupBlockedBody:
      'Your browser blocked the print window. Allow pop-ups for this site in the address bar, then try again.',

    standardFailedTitle: 'Print failed',
    standardFailedBody:
      "The bill could not be sent to the printer. Check that a printer is set up on this device, then try again.",
  },

  settings: {
    title: 'Settings',
    subtitle: 'Manage your business',
    loggedIn: 'Logged in',
    guest: 'Guest',
    login: 'Login',

    business: 'BUSINESS',
    loggedInAs: 'Logged in as',
    // An account exists from OTP verification onward, before the shop name is
    // ever collected — so this is a real state, not an error.
    noShopName: 'Shop name not set',
    security: 'SECURITY',
    information: 'INFORMATION',

    logout: 'Logout',

    menu: {
      shop: 'Add Shop Details',
      shopSub: 'Setup your shop',
      shopEdit: 'Edit Shop Details',
      shopEditSub: 'Update your shop info',

      items: 'Inventory / Products',
      itemsSub: 'Manage products & stock',

      history: 'Bill History',
      historySub: 'View past invoices',

      customers: 'Retailers',
      customersSub: 'Manage retailer list',

      salesReport: 'Sales Report',
      salesReportSub: 'View sales report',

      gstReport: 'GST Report',
      gstReportSub: 'CA-ready GST summary (CSV & PDF)',

      purchases: 'Purchases (GST)',
      purchasesSub: 'Record stock purchases & GST paid',

      gst: 'GST Settings',
      gstSub: 'Configure GST rates',

      invoiceBill: 'Invoice / Bill Settings',
      invoiceBillSub: 'Template, language & shop header',
      print: 'Print Settings',
      printSub: 'Page size & thermal printer',

      downloadForms: 'Download Forms',
      downloadFormsSub: 'Blank forms to print, fill by hand or share',

      language: 'Language',
      languageSub: 'Change app language',

      tutorials: 'Video Tutorials',
      tutorialsSub: 'Short videos on how to use the app',

      biometricLock: 'Biometric Lock',
      biometricLockSub: 'Lock app when switching away',
      biometricLockEnabledSub: 'Tap to disable',

      about: 'About Us',
      aboutSub: 'Learn more about Gold Khata Book',

      rate: 'Rate this app',
      rateSub: 'Tell others what you think',

      privacy: 'Privacy Policy',
      privacySub: 'How we handle your data',

      contact: 'Help / Support',
      contactSub: 'Get help using the app',
      ratesSub: "Today's prices",

      terms: 'Terms & Conditions',
      termsSub: 'Read our terms of use',
    },

    terms: 'Terms & Conditions',
    termsSub: 'Read our terms',

    logoutConfirm: 'Logout Confirmation',
    logoutMessage: 'Are you sure you want to logout?',
    logoutGuestTitle: 'Data Loss Warning!',
    logoutGuestMessage:
      'You are in guest mode. Logging out will PERMANENTLY DELETE all your shop, retailer, and order data from this device. Are you sure?',

    deleteAccount: 'Delete Account',
    deleteAccountConfirm: 'This permanently deletes your account along with your shop details, invoices, retailers and uploaded images. This cannot be undone.',
    deleteAccountConfirmLabel: 'Delete Permanently',
    deleteAccountError: 'Failed to delete account. Please try again.',
  },

  customers: {
    title: 'Retailers',
    count: 'retailers',
    empty: 'No retailers yet',
    emptySubHead: 'Add retailers manually or they\'re created when making invoices',

    photo: {
      title: 'Retailer Photo',
      camera: 'Take a photo',
      gallery: 'Choose from gallery',
      remove: 'Remove photo',
      unavailable: 'Photos are not available here',
      failed: 'Could not add the photo',
    },
    stats: {
      orders: 'Orders',
      pending: 'Pending',
      completed: 'Complete',
      soldToUs: 'Sold to us',
      totalPurchase: 'Total purchase',
    },
    filters: {
      all: 'All',
      pending: 'Pending',
      completed: 'Complete',
      sellers: 'Sold to us',
      noOrders: 'No orders',
    },
    sort: {
      title: 'Sort By',
      nameAsc: 'Name: A to Z',
      nameDesc: 'Name: Z to A',
      saleHigh: 'Purchase: High to Low',
      saleLow: 'Purchase: Low to High',
      ordersHigh: 'Most Orders',
      recent: 'Recent Purchase',
    },
    delete: {
      title: 'Delete this retailer?',
      confirm: 'Delete',
      plain: 'This retailer has no bills, orders or declarations. Deleting them cannot be undone.',
      hasRecords: 'Deleting this retailer will also permanently delete:',
      recordsNote:
        'These bills, orders and declarations will be removed from your books, and any GST already reported on them will change. This cannot be undone.',
      records: {
        orders: 'bill(s) / order(s)',
        pending: 'pending order(s)',
        sold: 'old-gold declaration(s)',
      },
    },

    // Optional, collapsed by default — only useful once, if this customer
    // ever brings in old gold: a declaration reuses it instead of asking again.
    idProof: {
      title: 'ID Proof (optional)',
      type: 'ID Proof Type',
      selectType: 'Select...',
      number: 'ID Proof Number',
      numberPlaceholder: 'e.g. ABCDE1234F',
    },

    add: 'Add',
    addNew: 'Add New Retailer',
    addCustomer: 'Add Retailer',
    addAndCreateOrder: 'Add Retailer & Create Order',
    cancel: 'Cancel',
    deleteTitle: 'Delete Retailer',
    deleteConfirm: 'Are you sure you want to delete this retailer? This action cannot be undone.',

    search: 'Search by name or phone...',
    searchWithCode: 'Search by name, phone or code...',
    noResults: 'No retailers match your search',

    pickFromContacts: 'Pick from contacts',
    contactPickFailed: 'Could not open your contacts',
    contactsPermissionPrimer: "Gold Khata Book will ask for access to your contacts so you can quickly fill in a retailer's name and phone number. Contacts are only read on this device and are never uploaded or shared — only the one contact you pick is saved, as a retailer.",
    contactsPermissionDenied: 'Contacts permission was denied. Enable it from your device settings to pick a contact.',
    openSettings: 'Open Settings',
    continueWithoutContacts: 'Enter details manually instead',
    loadingContacts: 'Loading your contacts…',
    noContactsFound: 'No contacts found',
    alreadyACustomer: 'Already a retailer',
    moreDetails: "More details (optional)",
    contactsPermissionShort: "Fill a retailer in from your phone book. Contacts stay on this device.",
    allowContacts: "Allow contacts access",
    limitedContacts: "You shared only some contacts with Gold Khata Book.",
    shareMore: "Share more",
    continueLabel: 'Continue',

    name: 'Name *',
    phone: 'Phone *',
    phoneOptional: 'Phone (optional)',
    noPhone: 'No phone number',
    email: 'Email',
    address: 'Address',

    placeholders: {
      name: 'Retailer name',
      phone: '10-digit mobile number (optional)',
      email: 'Email address (optional)',
      address: 'Address (optional)',
    },

    // Details & list texts
    noCustomers: 'No retailers found',
    detailsTitle: 'Retailer Details',
    notFound: 'Retailer not found',
    orders: 'Orders',
    pending: 'Pending',
    completed: 'Complete',
    total: 'Total',
    orderHistory: 'Order History',
    noOrders: 'No orders for this retailer',

    detailsScreen: {
      tabs: {
        invoices: 'Invoices',
        advanceOrders: 'Advance Orders',
        boughtFromUs: 'Bought from us',
        soldToUs: 'Sold to us',
      },
      searchDeclarationPlaceholder: 'Search declaration...',
      badges: {
        exchange: 'Exchange',
        cashPurchase: 'Cash',
      },
      searchInvoicePlaceholder: 'Search invoice number...',
      searchOrderPlaceholder: 'Search order number...',
      noMatchingResults: 'No matching results found',
      noInvoicesFound: 'No invoices found',
      noAdvanceOrdersFound: 'No advance orders found',
      dueLabel: 'Due',
      editTitle: 'Edit Retailer',
      saveChanges: 'Save Changes',
      validationErrorTitle: 'Validation Error',
      phoneValidationMessage: 'Please enter a 10-digit phone number',
      errorTitle: 'Error',
      updateErrorMessage: 'Failed to update retailer',
    },
    validation: {
      nameRequired: 'Name is required',
      phoneRequired: 'Phone is required',
      phoneLengthError: 'Please enter a valid 10-digit phone number',
      shopPhoneError: "You cannot use your shop's phone number",
      ownPhoneError: 'You cannot use your own registered number',
      phoneExists: 'A retailer with this phone number already exists',
      duplicateNameTitle: 'Retailer with this name exists',
      duplicateNameMessage:
        'You already have a retailer named {name}. Without a phone number there is no way to tell them apart later. Add anyway?',
      duplicateNameConfirm: 'Add anyway',
      addFailed: 'Failed to add retailer',
    },
  },

  orders: {
    title: 'Orders',
    total: 'total orders',
    newOrder: 'New Order',
    search: 'Search orders...',
    invoice: 'Invoice',
    items: 'item(s)',
    pieces: 'piece',

    filters: {
      all: 'All',
      pending: 'Pending',
      complete: 'Complete',
      gst: 'GST',
      nonGst: 'Non-GST',
    },
    sort: {
      title: 'Sort By',
      newest: 'Newest First',
      oldest: 'Oldest First',
      amountLow: 'Amount: Low to High',
      amountHigh: 'Amount: High to Low',
    },

    noOrdersHead: 'No orders found',
    noOrdersSubHead: 'Create your order to get started',
    noItems: 'No items found for this order',
    selectCustomer: 'Select retailer',

    historyTitle: 'Bill History',
    historyEmpty: 'No invoices yet',
    pendingTitle: 'Pending Orders',
    pendingSubtitle: 'orders pending',

    detailsTitle: 'Order Details',
    notFound: 'Order not found',
    amount: 'Amount',
    type: 'Type',
    viewCustomer: 'View Retailer',

    chooseType: 'Choose Order Type',

    fullPayment: {
      title: 'Full Payment',
      desc: 'Complete payment at once. Generate invoice immediately.',
    },

    advancePayment: {
      title: 'Advance Payment',
      desc: 'Pay in installments. Lock gold rates with each payment.',
    },

    status: {
      pending: 'Pending',
      completed: 'Completed',
    },

    itemsFallback: 'Item',

    share: {
      invoiceFromPrefix: 'Invoice from',
      invoiceNumberLabel: 'Invoice No',
      dateLabel: 'Date',
      customerLabel: 'Retailer',
      customerFallback: 'Retailer',
      subTotalLabel: 'Sub Total',
      gstLabel: 'GST',
      estimatedAmountLabel: 'Estimated Amount',
      grandTotalLabel: 'Grand Total',
      thankYou: 'Thank you for your purchase! 🙏',
    },

    details: {
      billTo: 'Bill To',
      walkInCustomer: 'Walk-in Retailer',
      dateLabel: 'Date',
      itemDetails: 'Item Details',
      weightLabel: 'Weight (gm)',
      rateLabel: 'Rate',
      amountLabel: 'Amount',
      piecesShort: 'Qty',
      totalAmount: 'Total Amount',
      makingCharges: 'Making Charges',
      otherCharges: 'Other Charges',
      totalDiscount: 'Total Discount',
      subTotal: 'Sub Total',
      gstLabel: 'GST',
      estimatedAmount: 'Estimated Amount',
      grandTotal: 'Grand Total',
      advanceSummary: 'Advance Summary',
      finalAmount: 'Final Amount',
      paymentProgress: 'Payment Progress',
      weightPaid: 'Weight Paid',
      weightRemainingShort: 'Weight Rem.',
      totalAmountPaid: 'Total Paid',
      outstandingBalance: 'Outstanding Balance (Estimated)',
      remainingWeight: 'Remaining Weight',
      goldCost: 'Gold Cost',
      totalOrderCost: 'Total Order Cost',
      advancePaid: 'Advance Paid',
      advanceOrder: 'Advance Order',
      sendOnWhatsApp: 'Send on WhatsApp',
      billAttached: 'Full bill attached.',
      oldOrnamentsAdjusted: 'Old Ornaments Adjusted',
      estimatedTotalBalance: 'Estimated Balance (at current rate)',
      gstFinalSettlementNote: '* GST will be applied at final settlement',
      paymentHistory: 'Payment History',
      oldOrnamentSettled: 'Old ornament',
      payableToCustomer: 'Payable to retailer',
      addPayment: 'Add Payment',
      paymentDetails: 'Payment Details',
      rateAt: '@',
      noPaymentHistory: 'No payment history yet',
      markAsCompleted: 'Mark as Completed',
      fullTimeline: 'Full Timeline',
      viewFullTimeline: 'View Retailer History',
      timelineSubtitle: 'See all orders and payments for this retailer',
      historySuffix: "'s History",
      useBookingRate: 'Apply Booking Rate',
      addInstallment: 'Add Installment',
      editInstallment: 'Edit Installment',
      paymentDetailsLabel: 'Payment Details',
      recordingPaymentFor: 'Recording payment for',
      paymentNotes: 'Payment Notes',
      deletePayment: 'Delete Payment?',
      deleteConfirmShort: 'Are you sure you want to delete this payment?',
      print: 'Print',
      share: 'Share',
      endOfReceipt: 'End of Receipt Summary',
      paymentDate: 'Payment Date',
      amountReceived: 'Amount Received (₹) *',
      amountPlaceholder: 'Enter amount eg. 10000',
      goldRate: 'Gold Rate',
      customRate: 'Custom rate',
      perGram: 'per gram',
      weightCovered: 'Weight covered by this payment:',
      paymentNotesPlaceholder: 'e.g. UPI, Cash, Cheque',
      processing: 'Processing...',
      confirmPayment: 'Confirm Payment',
      selectPurity: 'Select Purity',
      errorTitle: 'Error',
      pdfGenerateFailed: 'Failed to generate PDF',
      pdfGenerateError: 'An error occurred while generating the PDF',
      downloadInvoice: 'Download Invoice',
      orderDetailsTitle: 'Order Details',
      download: 'Download',
      shareTitle: 'Share Order Details',
      combinePaymentsTitle: 'Combine payments as single (gift bill)',
      combinePaymentsDesc: 'Hides individual installments on this copy only — your records stay itemized',
      deleteInvoice: 'Delete Invoice',
      completeOrderNote: 'Complete when ready to generate final bill with all charges',
      customerLabel: 'Retailer',
      itemLabel: 'Item',
      purityLabel: 'Purity',
      orderDateLabel: 'Order Date',
      totalWeightLabel: 'Total Weight',
    },
  },

  completeAdvance: {
    title: 'Complete Order',
    completionDate: 'Completion Date:',
    goldRate: 'Gold Rate',
    customRate: 'Custom rate',
    perGram: 'per gram',
    finalPayment: 'Final Payment Amount (₹)',
    amountLessThanBalance: 'Amount is less than balance due',
    processing: 'Processing...',
    completeAndGenerate: 'Complete Order & Generate Bill',

    summary: {
      title: 'Order Summary',
      item: 'Item',
      itemFallback: 'Jewelry Item',
      purity: 'Purity',
      totalWeight: 'Total Weight',
      customer: 'Retailer',
    },

    payments: {
      receivedTitle: 'Advance Payments Received',
      totalPayments: 'Total Payments',
      weightCovered: 'Weight Covered',
    },

    finalBill: {
      title: 'Final Bill Calculation',
      goldValue: 'Gold Value',
      makingCharges: 'Making Charges',
      subtotal: 'Subtotal',
      gst: 'GST',
      grandTotal: 'Grand Total',
      advancePaid: 'Advance Paid',
      balanceDue: 'Balance Due',
    },

    alerts: {
      validationTitle: 'Validation Error',
      balanceAtLeast: 'Balance payment must be at least',
      errorTitle: 'Error',
      createInvoiceFailed: 'Failed to create invoice.',
      completeFailed: 'Failed to complete order',
    },
  },

  advanceOrder: {
    title: 'Create Advance Order',
    subtitle: 'Select or create retailer',

    addCustomer: 'Add New Retailer',

    saveContinue: 'Save & Continue',
    createTitle: 'Create Advance Order',
    editTitle: 'Edit Order Items',

    noCustomerSelected: 'No Retailer Selected',
    orderDate: 'Order Date',
    itemsTitle: 'Items',
    chooseFromCatalog: 'Choose from catalog...',

    fields: {
      name: 'Retailer Name *',
      phone: 'Phone *',
      email: 'Email (optional)',
      address: 'Address (optional)',
      itemName: 'Item Name *',
      huid: 'HUID',
      pieces: 'Pieces',
      itemType: 'Item Type',
      purity: 'Purity',
      grossWt: 'Gross Wt (gm) *',
      grossWeight: 'Gross Wt',
      Qty: 'Qty',
      lessWt: 'Less Wt (gm)',
      netWt: 'Net Wt',
      makingChargeType: 'Making Charge Type',
      charges: 'Making Charges',
      otherChargeDesc: 'Other Charge Desc',
      chargeAmount: 'Other Charges Amount',
      discountType: 'Discount Type',
      discount: 'Discount',
      amount: 'Advance Amount',
      itemRate: 'Rate (per gm)',
    },

    placeholders: {
      name: 'Retailer name',
      phone: 'Phone number',
      email: 'Email address',
      address: 'Address',
      itemName: 'e.g. Gold Chain',
      amount: 'Amount',
      huid: 'ABC123',
      // A worked example, not an instruction: the decimal point is the whole
      // point. "Enter gross weight" was silent about it, and 2.030 gm was
      // repeatedly typed as 2030.
      grossWt: 'e.g. 2.030',
      lessWt: 'Enter less weight',
      otherChargeDesc: 'Enter charge description',
      charges: 'Enter charges',
      chargeAmount: 'Enter charge amount',
      discount: 'Enter discount',
      advanceAmount: 'e.g. 50000',
      itemRate: 'e.g. 6500',
    },

    messages: {
      rateOverridden: 'Booking rate will override item rates',
    },

    makingCharge: {
      perGram: 'Per Gram',
      fixed: 'Fixed',
    },

    discountType: {
      fixed: 'Fixed',
    },

    payment: {
      title: 'Advance Payment',
      bookingRatePurity: 'Booking Rate Purity',
      rateTracker: 'Rate Tracker',
      effectiveRate: 'Effective Rate (weighted avg.)',
      customRate: 'Custom rate',
      perGram: 'per gram',
      advanceAmountPaid: 'Advance Amount Paid (₹) *',
    },

    summary: {
      title: 'Order Summary',
      totalEstimatedAmount: 'Total Estimated Amount',
      totalAmountPaid: 'Total Amount Paid',
      totalWeightCovered: 'Total Weight Covered',
      of: 'Of',
      totalWeight: 'total weight',
      totalWeightCount: 'Total Weight',
      totalOrderCost: 'Total Order Cost',
      itemCost: 'Item cost',
      itemCostShort: 'Item',
      makingShort: 'Making',
      weightCoveredPurity: 'Weight Covered',
      /* Old gold and cash both settle weight at the same effective rate, so
         the covered total alone cannot say how much the customer paid. */
      coveredByExchange: 'From old ornaments',
      coveredByAdvance: 'From advance paid',
      gstAmount: 'GST Amount (At Current Rate)',
      balanceIncludesGstNote: '* Includes estimated GST at current rate; recalculated at final settlement.',
      finalAmountNote:
        '* Final amount will be calculated at the time of delivery based on actual weight and making charges.',
      finalSettlementNote: '* Final settlement depends on actual weight and rates at delivery.',
    },

    buttons: {
      creating: 'Creating Order...',
      create: 'Create Advance Order',
      saving: 'Saving...',
      saveChanges: 'Save Changes',
    },

    alerts: {
      validationTitle: 'Validation',
      validationMessage: 'Please fill in item names and structural weights.',
      errorTitle: 'Error',
      createFailed: 'Failed to create advance order. Please try again.',
      unexpectedError: 'An unexpected error occurred.',
      noItemsMessage: 'Please add at least one item before creating the order.'
    },
  },

  appName: 'Gold Khata Book',

  metals: {
    gold: 'Gold',
    silver: 'Silver',
    others: 'Others',
    purity: {
      gold24k995gw: '24K - 99.5%',
      gold23k: '23K - 95.8%',
      gold22k: '22K - 91.6%',
      gold21k: '21K - 87.5%',
      gold20k: '20K - 83.3%',
      gold18k: '18K - 75%',
      gold17k: '17K - 70.8%',
      gold14k: '14K - 58.5%',
      gold9k: '9K - 37.5%',
      silver: 'Silver',
      silverCoin: 'Silver Coin',
    },
  },

  rateApp: {
    title: 'Enjoying Gold Khata Book?',
    body: 'A rating helps other jewellers find the app.',
    action: 'Rate now',
  },

  dashboard: {
    appName: 'Gold Khata Book',

    todayRates: "Today's Rates",
    edit: 'Edit',
    viewAll: 'View All',

    gold22: 'Gold (22K)',
    gold24: 'Gold (24K)',
    silver: 'Silver',
    per1gm: 'per gram',
    perKg: 'per kg',

    silverRate: 'Silver Rate',

    pendingOrders: 'Pending Orders',
    completed: 'Completed',
    completedOrders: 'Completed Orders',
    soldToUs: 'Sold to Us',

    total: 'total',
    paid: 'paid',
    pending: 'pending',
    thisMonth: 'this month',

    stats: {
      today: 'Today',
      todaySales: 'Today Sales',
      month: 'This Month',
      totalBills: 'Total Bills',
    },

    dues: {
      totalCash: 'Total Cash Dues',
      totalGold: 'Total Gold Dues',
      listTitle: 'Retailer Dues List',
      all: 'All',
      cash: 'Cash',
      gold: 'Gold',
      empty: 'No outstanding dues found.',
    },

    fab: {
      newOrder: 'New Order',
      newRetailer: 'New Retailer',
    },

    ratesModal: {
      title: "Update Today's Rates",
      goldTitle: 'Gold Rates (per gram)',
      silverTitle: 'Silver Rate (per kg)',
      save: 'Save Rates',
    },
  },

  gstReport: {
    title: 'GST Report',
    headerSubtitle: 'CA-ready summary for filing',
    periodTitle: 'Filing Period',
    selectPeriod: 'Select period',
    presets: {
      thisMonth: 'This Month',
      lastMonth: 'Last Month',
      thisQuarter: 'This Quarter',
      lastQuarter: 'Last Quarter',
      thisFY: 'This FY (Apr–Mar)',
      lastFY: 'Last FY',
      custom: 'Custom Range',
    },
    from: 'From',
    to: 'To',
    invalidRange: '"From" date must be before "To" date',
    netPayable: 'Net GST Payable',
    netFormula: 'Output {output} − ITC {itc}',
    shareCsv: 'Share CSV',
    sharePdf: 'Share PDF',
    exportErrorTitle: 'Export failed',
    outwardTitle: 'Part A — Sales (Outward)',
    outwardMeta: '{bills} bills • {b2b} B2B • {b2c} B2C',
    taxableValue: 'Taxable Value',
    totalTax: 'Total Tax',
    invoiceTotal: 'Invoice Total',
    noSales: 'No GST bills in this period',
    inwardTitle: 'Part B — Purchases (ITC)',
    inwardMeta: '{count} purchases • {reg} registered • {unreg} unregistered',
    purchaseTaxable: 'Purchase Value',
    eligibleItc: 'Eligible ITC',
    noPurchases: 'No purchases recorded in this period',
    recordPurchases: 'Record purchases →',
    legacyNote: '* GST split derived from invoice total (created before the CGST/SGST breakdown).',
    unregisteredNote: 'Unregistered purchases: ITC eligibility to be confirmed by your CA.',
  },

  purchases: {
    title: 'Purchases (GST)',
    count: 'purchases',
    addShort: 'Add',
    addTitle: 'Add Purchase',
    editTitle: 'Edit Purchase',
    addBtn: 'Add Purchase',
    saveBtn: 'Save Changes',
    searchPlaceholder: 'Search supplier or bill no.',
    emptyTitle: 'No purchases yet',
    emptySubtitle: 'Record stock purchases with GST paid to claim Input Tax Credit in your GST report.',
    registered: 'GST',
    unregistered: 'Unregistered',
    gstinHint: 'Needed to claim Input Tax Credit (registered supplier)',
    fields: {
      supplierName: 'Supplier Name *',
      supplierGstin: 'Supplier GSTIN (optional)',
      billNo: 'Purchase Invoice No *',
      date: 'Purchase Date *',
      taxableValue: 'Taxable Value (₹) *',
      gstRate: 'GST Rate %',
      gstAmount: 'GST Paid (₹)',
      category: 'Category (optional)',
      description: 'Description (optional)',
    },
    placeholders: {
      supplierName: 'e.g., Ratanlal Bullion',
      supplierGstin: 'e.g., 27AAAAA0000A1Z5',
      billNo: 'Supplier bill no.',
      description: 'e.g., 24K bullion 100g',
    },
    alerts: {
      supplierRequired: 'Supplier name is required',
      billNoRequired: 'Purchase invoice number is required',
      taxableRequired: 'Taxable value must be greater than 0',
      gstinInvalid: 'Enter a valid 15-character GSTIN or leave it blank',
      deleteTitle: 'Delete Purchase',
      deleteMessage: 'Delete purchase "{name}"? This cannot be undone.',
    },
  },

  salesReport: {
    title: 'Sales Report',
    headerSubtitle: 'Track your business performance',
    analyticsTitle: 'Analytics',
    analyticsSubtitle: 'Overview & insights',
    range: {
      today: 'Today',
      week: '7 Days',
      month: '30 Days',
      year: '1 Year',
      lifetime: 'Lifetime',
      selectPeriod: 'Select Period',
    },
    summary: {
      totalSalesVolume: 'Total Sales Volume',
      generatedAcross: 'Generated across {count} specific invoices.',
    },
    stats: {
      itemsSold: 'Items Sold',
      itemsSoldSub: '{gold} Gold, {silver} Silver',
      customers: 'Retailers',
      customersSub: 'Unique buyers tracked',
      avgOrderValue: 'Avg Order Value',
      avgOrderValueSub: 'Median checkout per cart',
      period: 'Period',
      periodSub: 'Current timeframe',
      periodValueWeek: 'Last 7 Days',
      periodValueMonth: 'Last 30 Days',
      periodValueYear: 'Last Year',
    },
    empty: {
      title: 'No orders discovered',
      subtitle: 'Your selected range \"{range}\" does not\\ncontain any processed sales data.',
    },
  },

  tabs: {
    dashboard: 'Dashboard',
    orders: 'Orders',
    customers: 'Retailers',
    settings: 'Settings',
  },

  invoice: {
    title: 'Create Invoice',
    editTitle: 'Edit Invoice',
    invoiceDate: 'Invoice Date',
    ratePurity: 'Rate Purity',
    // Shown on the create-invoice screen when the shop name was never set —
    // the bill header is the one place that omission is actually visible.
    shopNameMissing: 'Add your shop name so it appears on this bill',

    item: 'Item',
    addAnotherItem: 'Add Another Item',
    editRateManually: 'Edit',

    // Shown when an entered weight/rate pair cannot be real. Never blocks.
    plausibility: {
      keep: 'Keep as entered',
      edit: 'Let me check it',
      pairTitle: 'Check the weight and rate',
      pairDescription: 'This line reads {weight} at {rate}. It looks like {suggestedWeight} at {suggestedRate} — the total stays {total} either way.',
      pairConfirm: 'Use {weight} at {rate}',
      weightTitle: 'Check this weight',
      weightDescription: '{weight} is very large for a single item, and this line totals {total}. Weights are entered in grams.',
      weightSuggestion: 'Did you mean {weight}? That totals {total}.',
      weightConfirm: 'Use {weight}',
      rateTitle: 'Check this rate',
      rateDescription: 'This line will total {total} at {rate}.',
      rateSuggestion: 'At {rate} it would be {total}.',
      rateConfirm: 'Use {rate}',
      per10Hint: 'This usually happens when the rate is entered per 10 grams.',
      perGramHint: 'Rates are entered per gram.',
    },

    fields: {
      itemName: 'Item Name *',
      huid: 'HUID',
      pieces: 'Pieces',
      itemType: 'Item Type *',
      purity: 'Purity',
      grossWt: 'Gross Wt (gm) *',
      lessWt: 'Less Wt (gm)',
      netWt: 'Net Wt (gm)',
      rate: 'Rate (per gram) *',
      makingChargeType: 'Making Charge Type',
      makingCharges: 'Making Charges',
      discountType: 'Discount Type',
      discount: 'Discount',
      otherChargesDescription: 'Other Charges\nDescription',
      otherChargesAmount: 'Other Charges\nAmount',
    },
    placeholders: {
      itemName: 'e.g., Gold Ring, Necklace, Bangles',
      huid: 'e.g., ABC123',
      otherCharges: 'e.g., Hallmark, Pol',
      no_name: 'No name',
      // A worked example, not an instruction: the decimal point is the whole
      // point. "Enter gross weight" was silent about it, and 2.030 gm was
      // repeatedly typed as 2030.
      grossWt: 'e.g. 2.030',
      lessWt: 'Enter less weight',
      charges: 'Enter charges',
      chargeAmount: 'Enter charge amount',
      discount: 'Enter discount',
    },
    items_count: 'items',

    dropdown: {
      gold: 'Gold',
      silver: 'Silver',
      others: 'Others',
      perGram: 'Per Gram',
      fixed: 'Fixed',
      percentage: 'Percentage (%)',
    },

    exchange: {
      title: 'Old Ornament Exchange',
      addGold: 'Add Gold',
      addSilver: 'Add Silver',
      weight: 'Weight (gm)',
      amount: 'Total Amount (₹)',
      exchange_short: 'Exchange',
      subtitle: 'Add old ornaments for exchange',
      itemName: 'Item Name',
      itemNamePlaceholder: 'e.g. Old Gold Ring',
      grossWt: 'Gross Wt (gm)',
      lessWt: 'Less Wt (gm)',
      netWt: 'Net Wt (gm)',
      purity: 'Purity',
      ratePerGm: 'Rate/gm (₹)',
      amountRequired: 'Total Amount is required',
      fillAmountFirst: 'Please enter the Total Amount for the previous exchange item before adding another.',
      generateDeclaration: 'Generate Declaration / Affidavit for this exchange',
      generateDeclarationSubtitle: 'Affidavit for this exchange',
      customPurity: 'Custom',
      customPurityPlaceholder: 'e.g. 916 hallmark',
    },

    customer: {
      title: 'Retailer Information',
      name: 'Name *',
      phone: 'Phone *',
      address: 'Address (Optional)',
    },

    includeGst: 'Include GST in the bill',

    gstApplied: 'GST APPLIED',

    customerGstin: 'Retailer GSTIN (for B2B)',
    customerGstinPlaceholder: 'e.g., 27AAAAA0000A1Z5 (optional)',
    customerGstinInvalid: 'Enter a valid 15-character GSTIN',

    paymentMethod: {
      title: 'Payment Mode',
      cash: 'Cash',
      online: 'Online',
      selectType: 'Select payment type',
      upi: 'UPI',
      bank_transfer: 'Bank Transfer',
      cheque: 'Cheque',
      card: 'Card',
      other: 'Other',
      required: 'Please select a payment mode',
      onlineTypeRequired: 'Please select an online payment type',
    },

    labels: {
      metalType: 'Metal Type',
      purity: 'Purity',
    },

    validation: {
      missingFields:
        'Please fill all required fields (Item Name, Weight, and Rate) for all items.',
    },

    buttons: {
      calculatePreview: 'Calculate & Preview',
    },
    calendar: {
      months: [
        'January',
        'February',
        'March',
        'April',
        'May',
        'June',
        'July',
        'August',
        'September',
        'October',
        'November',
        'December',
      ],
      days: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
    },
  },

  common: {
    yes: 'Yes',
    no: 'No',
    cancel: 'Cancel',
    back: 'Back',
    loading: 'Loading…',
    add: 'Add',
    remove: 'Remove',
    done: 'Done',
    today: 'Today',
    phone: 'Phone',
    gramShort: 'gm',
    change: 'Change',
    edit: 'Edit',
    delete: 'Delete',
    none: 'None',
    // Shown when backing out of a half-filled creation form.
    discard: {
      title: 'Discard this bill?',
      invoiceTitle: 'Discard this invoice?',
      editTitle: 'Discard these changes?',
      orderTitle: 'Discard this order?',
      declarationTitle: 'Discard this declaration?',
      completionTitle: 'Discard this completion?',
      description:
        'The details you have entered have not been saved and will be lost.',
      confirm: 'Discard',
      cancel: 'Keep editing',
    },
  },

  validationModal: {
    title: 'Please Fix the Following',
    subtitle: 'Correct the issues below before continuing:',
    closeBtn: 'OK, Got it',
  },

  // Shown after "Select Saved Item" replaces something the shopkeeper typed.
  // Only fields that held a hand-entered value are listed; filling an empty row
  // from the catalogue is the normal case and stays silent.
  catalogOverwrite: {
    title: 'Some values were replaced',
    subtitle: 'You chose a saved item, so these fields now use the saved item’s values instead of what you had entered:',
    hint: 'You can edit any of them again before saving the bill.',
    okBtn: 'OK',
  },

  // Login required modal (guest tries to upload logo/header/signature)
  loginRequiredTitle: 'Login Required',
  loginRequiredDescription:
    'Uploading a logo, header, or signature image requires an account so it can be saved securely to your shop.',
  loginRequiredConfirm: 'Login',

  // Guest mode modal
  guestModeNotice: 'Using Gold Khata Book in Guest Mode',
  guestModeNoticeDescription:
    'In guest mode, your shop, retailer and order data is stored only on this device and is not backed up to any server.',
  guestModeDataStorage: 'How guest mode stores your data',
  guestModeDataLocalOnly: 'All data is stored locally on this device only.',
  guestModeDataTemporary:
    'If the app is uninstalled or device data is cleared, your records will be lost.',
  guestModeDataDeleted:
    'To keep your data long term, create an account and login later.',
  okayLetMeContinue: 'Continue as Guest',

  // Exit app confirmation modal
  exitAppTitle: 'Exit App',
  exitAppMessage: 'Are you sure you want to exit the app?',
  exitAppConfirm: 'Exit',

  // Biometrics enable prompt (post-auth, one-time)
  biometricsPrompt: {
    title: 'Enable Biometric Lock?',
    description:
      'Protect your shop data with Face ID or fingerprint so only you can open Gold Khata Book.',
    enable: 'Enable',
    skip: 'Skip for now',
  },

  invoicePreview: {
    title: 'Invoice Preview',
    subtitle: 'Review before saving',

    invoiceNo: 'Invoice No',
    date: 'Date',

    billTo: 'Bill To',
    itemsTotal: 'Items Total',

    table: {
      item: 'Item',
      weight: 'Weight (gm)',
      rate: 'Rate',
      amount: 'Amount',
    },

    subtotal: 'Subtotal',
    gst: 'GST',
    grandTotal: 'Grand Total',
    totalAmount: 'Total Amount',
    makingCharges: 'Making Charges',
    otherCharges: 'Other Charges',
    totalDiscount: 'Total Discount',
    goldExchange: 'Gold Exchange',
    silverExchange: 'Silver Exchange',
    // Screen-only note on a saved line whose weight/rate cannot be real. Never
    // printed — the customer's copy must not carry our doubt about data entry.
    lineNeedsCheck: 'Check this line — likely {weight} at {rate}',
    lineNeedsCheckPlain: 'Check the weight and rate on this line',

    buttons: {
      cancel: 'Cancel',
      confirmSave: 'Confirm & Save',
    },
  },

  invoiceSuccess: {
    title: 'Invoice Saved!',
    print: 'Print Invoice',
    download: 'Download Invoice',
    share: 'Share via WhatsApp',
  },

  advanceOrderSuccess: {
    title: 'Order Created!',
    subtitle: 'Your advance order has been successfully processed',
    receiptNo: 'Order Number',
    item: 'Item',
    totalWeight: 'Total Weight',
    advancePaid: 'Advance Paid',
    weightCovered: 'Weight Covered',
    remainingWeight: 'Remaining Weight',
    totalOrderCost: 'Total Order Cost',
    goldBalance: 'Gold Balance',
    makingCharges: 'Making Charges',
    estTotalBalance: 'Est. Total Balance',
    settlementNote: '* GST will be applied at final settlement',
    shareWhatsApp: 'Share on WhatsApp',
    otherShare: 'Other Share',
    print: 'Print',
    backToOrders: 'Back to Orders',
    backToPendingOrders: 'View Pending Orders',
    noOrderData: 'No order data found',
    backToDashboard: 'Back to Dashboard',
  },

  auth: {
    tagline: 'Jewellery Billing Made Simple',
    enterPhone: 'Enter Phone Number',
    otpInfo: 'We will send you an OTP',
    phonePlaceholder: 'Enter phone number',
    sendOtp: 'Send OTP',
    sending: 'Sending...',
    verifyOtp: 'Verify OTP',
    sentTo: 'Sent to',
    verifyLogin: 'Verify & Login',
    verifying: 'Verifying...',
    changePhone: 'Change Phone Number',
    resend: 'Resend OTP',
    resendIn: 'Resend OTP in',
    skip: 'Skip login & continue as guest',
    terms: 'By continuing, you agree to our Terms & Privacy Policy',

    register: {
      headerTitle: 'Complete Registration',
      headerSubtitle: 'Set up your shop to get started',
      infoTitle: 'Shop Information',
      infoSubtitle: 'Tell us about your shop',
      phone: 'Phone Number',
      ownerName: 'Shop Owner Full Name',
      shopName: 'Shop Name',
      address: 'Shop Address',
      note: 'You can add more shop details like shop logo and others inside App Settings.',
      submit: 'Complete Registration',
      submitting: 'Completing...',
      cancelTitle: 'Cancel registration?',
      cancelDescription: "You haven't finished registering yet. Going back will take you to the login screen — you'll need to verify your phone number again to continue.",
      cancelStay: 'Stay here',
      cancelConfirm: 'Go back to login',
      // The escape hatch from the registration form. Quiet by design — finishing
      // now is still the encouraged path.
      skip: 'Skip for now, I\'ll do this later',
      skipTitle: 'Set this up later?',
      skipDescription: 'You can start using the app right away. Your bills will show "Gold Khata Book" instead of your shop name until you add these details — you can fill them in any time from Settings.',
      skipStay: 'Fill it in now',
      skipConfirm: 'Skip for now',
      placeholders: {
        ownerName: 'e.g., Ramesh Shah',
        shopName: 'e.g., Shree Jewellers',
        address: 'Street address, area, city',
      },
      alerts: {
        ownerNameRequired: 'Shop owner full name is required',
        shopNameRequired: 'Shop name is required',
        addressRequired: 'Shop address is required',
      },
    },
  },

  bill: {
    invoice: 'Invoice',
    cashMemo: 'Cash Memo',
    billTo: 'Bill To',
    items: 'Items',
    pcs: 'Pcs',
    netWt: 'Net Wt',
    grossWt: 'Gross Wt',
    ratePerGm: 'Rate/gm',
    making: 'Making',
    /** Suffix on a flat making charge in the item table: "₹500 Fixed", telling
     *  the customer the amount is not per gram and not a percentage. */
    makingFixed: 'Fixed',
    totalAmount: 'Total Amount',
    otherCharges: 'Other Charges',
    discount: 'Discount',
    amount: 'Amount',
    subtotal: 'Subtotal',
    gstDetails: 'GST Details',
    gstRate: 'GST Rate',
    total: 'Total',
    thankYou: 'Thank you for your business',
    allPricesInclMC: 'All prices incl. making charges',
    advanceSummary: 'Advance Summary',
    amountPaid: 'Amount Paid',
    bookingRate: 'Booking Rate',
    totalWeight: 'Total Weight',
    exchange: 'Exchange',
    advancePayment: 'Advance Paid',
    balanceDue: 'Balance Due',
    authorisedSignatory: 'Authorised Signatory',
    invoiceLanguage: 'Invoice Language',
    invoiceLanguageDesc: 'Language used in your invoice PDF',
    invoiceTemplate: 'Invoice Template',
    templatePreview: 'Preview',
    selectTemplate: 'Select Template',
    templateTraditional: 'Traditional',
    templateTraditionalDesc: 'Classic saffron style',
    templateModern: 'Modern Premium',
    templateModernDesc: 'Gold accent, clean layout',
    templateClassic: 'Classic',
    templateClassicDesc: 'Navy professional',
    templateMinimal: 'Minimal',
    templateMinimalDesc: 'Clean black & white',
  },

  /* Blank printable forms. Serves a shopkeeper handing a form to someone who
     does not use the app, and the fallback when a bill cannot be generated and
     details are written in by hand. */
  /* In-app video tutorials. Only the UI chrome lives here — every video's own
     title and description comes from /api/tutorials in the shopkeeper's
     language, so copy can be fixed without a release. */
  tutorials: {
    title: 'Video Tutorials',
    subtitle: 'Short videos on how to use the app',
    forThisScreen: 'Help for this screen',
    inEnglish: 'In English',
    onlyInEnglish: 'This video is only available in English for now.',
    emptyTitle: 'Tutorials coming soon',
    emptyTopicTitle: 'No tutorial for this screen yet',
    emptyHint: 'We are recording these now. Contact support any time for help.',
    seeAll: 'See all tutorials',
    notFound: 'This tutorial is no longer available.',
    openInYouTube: 'Open in YouTube',
    share: 'Share on WhatsApp',
    watch: 'Watch a tutorial',
    watchSub: 'Short how-to videos',
    newHere: 'New here? Watch a short video',
  },

  forms: {
    title: 'Download Forms',
    subtitle: 'Blank forms to print or share',
    /* One entry per form in print/forms/catalog.ts. The form's name is not
       here — it is read from the form's own section, so the list and the
       printed sheet can never drift apart. */
    items: {
      declaration: {
        desc: 'Blank form for old gold bought or exchanged',
      },
    },
    notFound: 'This form is no longer available',
    language: 'Language',
    languageHint: 'Starts at your app language. Change it if this form is for someone else.',
    includeShop: 'Include my shop details',
    includeShopHint:
      'Turn off to print a blank header — use this when the form is for another shop.',
    print: 'Print Form',
    share: 'Download / Share Form',
    failed: 'Could not generate the form',
  },

  // Optional photos of the item SOLD — distinct from declaration.photos, which
  // are the old ornaments taken IN.
  printDetails: {
    title: 'Print Details',
  },
  itemPhotos: {
    uploadFailed: 'Some item photos could not be uploaded. Open the bill and add them again.',
    title: 'Item Photos',
    subtitle: 'Optional — so you can find this piece later',
    limit: 'You can add up to {count} photos per item',
    viewPhoto: 'View photo',
    onBillTitle: 'Print photos on the bill',
    onBillSubtitle: 'Off by default — photos stay in your records',
  },

  /* Old-gold declaration / affidavit.
     Entirely optional: a shopkeeper who only wants to note an old ornament's
     name and the amount deducted from the bill never sees any of this. */
  signature: {
    title: 'Signature',
    shopTitle: 'Your signature',
    undo: 'Undo',
    clear: 'Clear',
    save: 'Save',
  },

  declaration: {
    // Entry point
    entryTitle: 'Old Gold Purchase',
    entryDesc: 'Buy old gold and print a declaration',

    photosOnDoc: {
      title: 'Print photos on the declaration',
      subtitle: 'On by default — the photos are the record of what came in',
      hint: 'Ornament photos are printed under the declaration',
    },
    signature: {
      title: 'Retailer Signature',
      hint: 'Optional. Hand the device to the retailer to sign.',
      take: 'Take retailer signature',
      redo: 'Sign again',
      rotate: 'Rotate signature',
    },

    language: {
      title: 'Declaration Language',
      hint: 'The printed declaration and PDF will use this. The form above stays in your app language.',
    },

    // A customer's phone number is optional everywhere else in the app; a
    // declaration is the one document that still requires it.
    customer: {
      phone: 'Phone Number *',
      phoneRequired:
        'Enter the retailer’s phone number. A declaration is a legal record of who sold you the gold, so it cannot be saved without one.',
      photoHint: 'Tap to add a photo (optional)',
      savedToProfile:
        'Saved to this retailer’s profile and printed on the declaration.',
      photoUploadFailed:
        'The retailer photo could not be uploaded. The declaration was saved without it.',
    },

    title: 'Declaration / Affidavit',
    generateButton: 'Generate Declaration',
      notGeneratedHint: 'No declaration has been generated for this exchange yet.',
    download: 'Download Declaration',
    printFailed: 'Could not print the declaration',
    createTitle: 'Old Gold Purchase',
    editTitle: 'Edit Declaration',
    optional: 'Optional',
    generate: 'Declaration / Affidavit',
    generateHint: 'Optional — you can print a declaration for these old ornaments after saving.',

    // Ornaments
    ornaments: {
      emptyTitle: 'No ornaments added yet',
      emptySubtitle: 'Tap Add Gold or Add Silver to begin',
      title: 'Old Ornaments',
      subtitle: 'What is the retailer handing over?',
      add: 'Add Ornament',
      itemLabel: 'Ornament',
      description: 'Description of Jewellery *',
      descriptionPlaceholder: 'e.g. Old gold bangles',
      grams: 'Grams *',
      metalType: 'Metal',
      purity: 'Purity',
      ratePerGm: 'Rate/gm (₹)',
      amount: 'Amount (₹)',
      totalGrams: 'Total Grams',
      totalAmount: 'Total Amount',
      required: 'Description and grams are required for every ornament',
    },

    // Ownership
    ownership: {
      title: 'Ownership',
      /* isSelf / isFamily are full sentences, still used by the preview page.
         The form asks the same thing as a two-button choice, which needs the
         short labels below. */
      isSelf: 'The ornaments belong to the retailer',
      isFamily: 'They belong to a family member',
      question: 'Who do the ornaments belong to?',
      optionSelf: 'The retailer',
      optionFamily: 'A family member',
      familyMemberName: 'Family Member Name *',
      familyMemberPlaceholder: 'Whose ornaments are these?',
      familyMemberRequired: 'Please name the family member who owns the ornaments',
    },

    // ID proof
    idProof: {
      add: 'Add another ID',
      rowLabel: 'ID {number}',
      incomplete: 'Please complete or remove the blank ID proof',
      title: 'ID Proof',
      type: 'ID Proof Type *',
      number: 'ID Proof Number *',
      numberPlaceholder: 'e.g. ABCDE1234F',
      otherLabel: 'Name of Document *',
      otherPlaceholder: 'Which document?',
      required: 'ID proof type and number are required',
      otherRequired: 'Please name the ID proof document',
      photos: {
        label: 'Photo of ID (optional)',
        limitReached: 'You can add up to {count} photos per ID',
        uploadFailed: 'ID photos could not be uploaded. The declaration was saved.',
      },
      types: {
        aadhaar: 'Aadhaar Card',
        pan: 'PAN Card',
        voter: 'Voter ID',
        driving_licence: 'Driving Licence',
        passport: 'Passport',
        other: 'Other',
      },
    },

    // Purchase receipt
    receipt: {
      question: 'Does the retailer have the purchase receipt?',
      title: 'Purchase Receipt',
      details: 'Details of Purchase Receipt / Bill',
      detailsPlaceholder: 'Bill number, shop, date…',
      noReason: 'Reason for not having a receipt',
      noReasonPlaceholder: 'e.g. Inherited, receipt lost',
    },

    // Payout
    payout: {
      title: 'Payment to Retailer',
      subtitle: 'How was the retailer paid?',
      method: 'Payment Mode',
      cash: 'Cash',
      online: 'Online',
      none: 'Nothing payable',
      noneHint: 'The exchange value is less than the new purchase, so nothing is owed to the retailer.',
      onlineType: 'Online Type',
      selectType: 'Select payment type',
      upi: 'UPI',
      bank_transfer: 'Bank Transfer',
      cheque: 'Cheque',
      card: 'Card',
      other: 'Other',
      reference: 'Transaction / Cheque No.',
      referencePlaceholder: 'For your records',
      bankDetails: 'Retailer Bank Details',
      bankDetailsHint: 'Optional — kept for your audit trail only.',
      bankName: 'Bank Name',
      bankAccountName: 'Account Holder Name',
      bankAccountNumber: 'Account Number',
      bankIfsc: 'IFSC Code',
      upiId: 'UPI ID',
      required: 'Please select a payment mode',
      onlineTypeRequired: 'Please select an online payment type',
    },

    // Photos
    photos: {
      title: 'Ornament Photos',
      subtitle: 'Optional — a visual record of what was taken in',
      takePhoto: 'Take Photo',
      choosePhoto: 'Choose Photo',
      remove: 'Remove',
      limitReached: 'You can add up to {count} photos',
      cameraUnavailable: 'Camera is not available on this device',
      uploadFailed: 'Photos could not be uploaded. The declaration was saved — you can retry from the declaration.',
      retryUpload: 'Retry photo upload',
      tapToEnlarge: 'Tap a photo to enlarge',
      // Attaching photos to a record that is already saved — the desktop-web
      // case, where the bill is finished on a PC and photographed on a phone.
      addPhotos: 'Add Photos',
      addPhotosTitle: 'Add Photos',
      noPhotos: 'No photos',
      uploadedCount: '{used} of {max} added',
      upload: 'Upload',
      uploaded: 'Photos added',
      deletePhoto: 'Delete photo',
      deleteFailed: 'Photo could not be removed.',
      deleteConfirmTitle: 'Delete this photo?',
      deleteConfirmBody:
        'It will be removed straight away and cannot be recovered. You can take a new one afterwards.',
      // Shutter button on the desktop-web camera overlay.
      capture: 'Capture',
    },

    // Witnesses
    witnesses: {
      add: 'Add Witness',
      rowLabel: 'Witness {number}',
      nameLabel: 'Name',
      phoneLabel: 'Phone',
      title: 'Witnesses',
      subtitle: 'Optional',
      name: 'Witness {number} Name',
      phone: 'Witness {number} Phone',
      /* ID proof for a witness. Kept on the record and shown in the app, never
         printed — the declaration PDF is shared with the customer. */
      photos: {
        label: 'ID proof (optional)',
        limitReached: 'You can add up to {count} photos per witness',
        uploadFailed:
          'Witness photos could not be uploaded. The declaration was saved.',
      },
    },

    // Actions / status
    save: 'Save & Preview',
    saveAndPrint: 'Save Declaration',
    saved: 'Declaration Saved',
    savedFor: 'Declaration for {name}',
    print: 'Print Declaration',
    share: 'Share Declaration',
    empty: 'No declarations yet',
    emptyDesc: 'Declarations you create for old gold will appear here.',
    listTitle: 'Declarations',
    deleteConfirm: 'Delete this declaration?',
    deleteConfirmDesc: 'A signed declaration is a legal record. Delete it only if it was created by mistake.',

    /* ─── Printed document ───
       Marathi is the source text supplied by the shop; the other languages are
       translations of it. Any change to the legal clauses must be made in
       Marathi first and then carried across. */
    doc: {
      regarding: 'Regarding ownership of old or used jewellery...',
      heading: 'DECLARATION / AFFIDAVIT',
      part1: 'Part-1',
      part1Note: '(Information to be filled in by retailers after reading the following conditions)',

      clause1:
        'I hereby certify through this declaration/affidavit that the jewellery described below is under the complete ownership of myself / my family member (Name: {ownerName}). The described jewellery has been legally acquired by me/my family member, and if any legal action arises in the future regarding ownership rights, I and my family shall be entirely responsible.',
      clause2:
        'I am selling all the jewellery described below to you with my own consent as well as the consent of all my family members. No complaint regarding this will be made by me or my family.',
      clause2Exchange:
        'I am giving all the jewellery described below to you in exchange with my own consent as well as the consent of all my family members. No complaint regarding this will be made by me or my family.',
      clause3:
        'In the future, if any legal action or financial loss occurs to the said Jewellers due to the jewellery sold by me, I and my family shall be fully responsible for compensating the damages.',

      srNo: 'Sr. No.',
      // Exchange declarations print the bill's number here instead of a serial
      // of their own - see the declaration template.
      billNo: 'Bill No.',
      date: 'Date',
      customerName: 'Retailer Name',
      address: 'Address',
      mobile: 'Mobile Number',
      idProofType: 'ID Proof Type (e.g., PAN / Aadhaar Card)',
      idProofNumber: 'ID Proof Number (e.g., PAN / Aadhaar Card No.)',
      receiptDetails: 'Details of Purchase Receipt/Bill',
      noReceiptReason: 'Reason for not having Purchase Receipt',

      itemsHeading: '＊ Description of Jewellery ＊',
      colSr: 'Sr. No.',
      colDescription: 'Description of Jewellery',
      colGrams: 'Grams',
      colAmount: 'Amount',
      total: 'Total',

      payoutHeading: 'Payment Details',
      payoutMethod: 'Paid By',
      payoutReference: 'Reference',
      payoutBank: 'Bank',
      payoutAccount: 'Account No.',
      payoutIfsc: 'IFSC',
      payoutUpi: 'UPI ID',

      photosHeading: 'Photographs of the ornaments',

      witnesses: 'Witness',
      customerSignature: 'Retailer Signature',
      boughtFrom: 'Bought From',
      invoiceRef: 'Against Invoice',
    },
  },
};
