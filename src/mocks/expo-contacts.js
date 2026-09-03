/**
 * Web stub for expo-contacts.
 *
 * There is no phone book in a browser, so the web build never shows the
 * contacts step at all — AddCustomerModal starts on the form (see LAYOUT.isWeb)
 * and ContactsStep, the only caller of usePhoneContacts, is never rendered.
 *
 * The import still has to resolve, though: AddCustomerModal pulls ContactsStep
 * in statically, so webpack follows the chain into expo-contacts and chokes on
 * its untranspiled TypeScript source. This stub cuts the chain.
 *
 * Everything here answers as "no access, nothing found" rather than throwing,
 * so that if a future change does render the step on web it degrades to an
 * empty list instead of a crash.
 */
const denied = {
  status: 'denied',
  granted: false,
  canAskAgain: false,
  expires: 'never',
  accessPrivileges: 'none',
};

module.exports = {
  Fields: { Name: 'name', PhoneNumbers: 'phoneNumbers' },
  SortTypes: { FirstName: 'firstName', LastName: 'lastName', UserDefault: 'userDefault' },
  getPermissionsAsync: async () => denied,
  requestPermissionsAsync: async () => denied,
  getContactsAsync: async () => ({ data: [], hasNextPage: false, hasPreviousPage: false, total: 0 }),
  presentContactPickerAsync: async () => null,
  presentAccessPickerAsync: async () => [],
};
