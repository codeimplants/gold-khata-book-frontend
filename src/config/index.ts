import { development } from './environments/development';
import { preprod } from './environments/preprod';
import { production } from './environments/production';
import { AppConfig } from './types';

/**
 * Environment selection from script.
 * Default to dev if no environment is set.
 * Using a safer check to prevent "Cannot read property 'APP_ENV' of undefined".
 */
const getAppEnv = (): 'dev' | 'preprod' | 'prod' => {
  let env: string | undefined;

  try {
    // @ts-ignore - __APP_ENV__ is injected by Babel transform-define
    if (typeof __APP_ENV__ !== 'undefined') {
      // @ts-ignore
      env = __APP_ENV__;
    } else if (typeof process !== 'undefined' && process.env && process.env.APP_ENV) {
      env = process.env.APP_ENV;
    }
  } catch (e) {
    console.warn('Config: Error detecting environment', e);
  }

  // Exact match to prevent invalid keys
  if (env === 'dev' || env === 'preprod' || env === 'prod') {
    return env;
  }

  return 'prod';
};

const CURRENT_ENV = getAppEnv();
console.log(`[Config] Running in ${CURRENT_ENV} mode`);

const configs: Record<string, AppConfig> = {
  dev: development,
  preprod,
  prod: production,
};

export const Config = configs[CURRENT_ENV];

// Individual exports for convenience
export const {
  APP_ENV,
  APP_VERSION,
  ANALYTICS_ENABLED,
  ONESIGNAL_APP_ID,
  API_BASE_URL,
  VITE_VC_API_KEY,
  VITE_VC_BACKEND,
  VITE_VC_DEBUG,
  supportEmail,
  supportPhone,
  supportWhatsapp,
  supportAddress,
} = Config;

export default Config;
