export interface AppConfig {
  APP_ENV: 'dev' | 'preprod' | 'prod';
  APP_VERSION: string;
  ANALYTICS_ENABLED: boolean;
  /**
   * OneSignal App ID. Public by design — it ships inside the app binary and
   * only says which OneSignal app to register with. Its secret counterpart is
   * the REST API key, which must never appear here: that lives solely in the
   * backend's .env on the server.
   *
   * Empty string disables push entirely (see src/services/push.ts), which is
   * how unconfigured builds behave.
   */
  ONESIGNAL_APP_ID: string;
  API_BASE_URL: string;
  VITE_VC_API_KEY: string;
  VITE_VC_BACKEND: string;
  VITE_VC_DEBUG: boolean;
  supportEmail: string;
  supportPhone: string;
  supportWhatsapp: string;
  supportAddress: string;
}
