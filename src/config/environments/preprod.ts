import { AppConfig } from '../types';
import { VITE_VC_API_KEY } from '../secrets';

export const preprod: AppConfig = {
  APP_ENV: 'preprod',
  APP_VERSION: '0.0.1',
  // Disabled until Gold Khata Book has its own Firebase project. SoneBill's
  // config was NOT inherited (see src/config/firebaseWeb.ts), so with the
  // placeholder values in place this would report nowhere. Flip to true once
  // the real google-services.json / GoogleService-Info.plist are in.
  ANALYTICS_ENABLED: true,
  // OneSignal App ID — public, ships in the binary. Empty disables push.
  ONESIGNAL_APP_ID: '',
  // Staging API URL
  API_BASE_URL: 'https://preprod.api.goldkhatabook.codeimplants.com/api/',
  VITE_VC_API_KEY,
  VITE_VC_BACKEND: 'https://preprod.api.nexus.codeimplants.com',
  VITE_VC_DEBUG: false,
  supportEmail: 'codeimplants@gmail.com',
  supportPhone: '+919850929634',
  supportWhatsapp: '919850929634',
  supportAddress: 'Code Implants Software Technologies Pvt. Ltd., Thergaon, Pimpri-Chinchwad, Pune, Maharashtra 411033',
};
