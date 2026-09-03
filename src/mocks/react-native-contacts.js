// Web has no reliable cross-browser device-contacts API, so the contacts
// picker affordance is gated off on web at the call site (LAYOUT.isWeb).
// This stub only exists so the package resolves in the webpack bundle.
export default {
  checkPermission: () => Promise.resolve('denied'),
  requestPermission: () => Promise.resolve('denied'),
  getAll: () => Promise.resolve([]),
};
