import { AppConfig } from '../types';
import { VITE_VC_API_KEY } from '../secrets';

export const development: AppConfig = {
  APP_ENV: 'dev',
  APP_VERSION: '0.0.1',
  // Disabled until Gold Khata Book has its own Firebase project. SoneBill's
  // config was NOT inherited (see src/config/firebaseWeb.ts), so with the
  // placeholder values in place this would report nowhere. Flip to true once
  // the real google-services.json / GoogleService-Info.plist are in.
  ANALYTICS_ENABLED: true,
  // OneSignal App ID — public, ships in the binary. Empty disables push.
  ONESIGNAL_APP_ID: '',
  // Hosted dev backend (VPS) - reachable from any phone/network. Sends REAL
  // OTP SMS: dev uses the same 2Factor path as prod (the dev-only local-OTP
  // bypass was removed in gold-khata-book-backend login.controller.ts).
  // Overridable so start.cmd can run the web app against the backend on this
  // machine (http://localhost:7100/api/). Unset everywhere else, which leaves
  // the hosted dev host below — note it is not provisioned yet.
  API_BASE_URL:
    process.env.API_BASE_URL || 'https://dev.api.goldkhatabook.codeimplants.com/api/',
  VITE_VC_API_KEY,
  VITE_VC_BACKEND: 'https://dev.api.nexus.codeimplants.com',
  VITE_VC_DEBUG: true,
  supportEmail: 'codeimplants@gmail.com',
  supportPhone: '+919850929634',
  supportWhatsapp: '919850929634',
  supportAddress:
    'Code Implants Software Technologies Pvt. Ltd., Thergaon, Pimpri-Chinchwad, Pune, Maharashtra 411033',
};
