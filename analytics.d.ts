declare module '@codeimplants/analytics' {
  // Runtime SDK object; kept as any to avoid tight coupling to package types
  // while still enabling typed imports in the app code.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const Analytics: any;

  // Event constants (APP_OPEN, LOGIN_SUCCESS, etc.).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  // export const AnalyticsEvents: any;
}

