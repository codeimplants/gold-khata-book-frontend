'use strict';

// Per-app configuration.
//
// The catalog is identical in every app. This file is what differs: where the
// native projects live, and what KIND of app this is. The profile flags decide
// which rules apply at all — an app with no accounts is not asked about account
// deletion, and an app that sells nothing is not asked about IAP.

const fs = require('fs');
const path = require('path');

const DEFAULTS = {
  app: {
    name: null,
    iosScheme: null,
    bundleId: null,
    androidPackage: null,
    srcDirs: ['src', 'app'],
  },
  profile: {
    hasAccounts: false,
    hasAccountCreationInApp: false,
    collectsPersonalData: false,
    hasUserGeneratedContent: false,
    sellsDigitalGoods: false,
    usesThirdPartyLogin: false,
    isFinancialServices: false,
    usesAds: false,
    supportsTablet: false,
  },
  // Rules deliberately not enforced. Each needs a reason — an ignore list
  // without reasons becomes a place where rules go to be forgotten.
  ignore: {},
  // Android permissions this app knowingly requests. Anything in the merged
  // manifest that is not here gets flagged, which is how a permission injected
  // by an autolinked library gets noticed before Play does.
  allowedPermissions: [],
};

function deepMerge(base, override) {
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const [k, v] of Object.entries(override || {})) {
    if (v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object') {
      out[k] = deepMerge(base[k], v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function load(root) {
  const file = path.join(root, 'store-guard.config.json');
  if (!fs.existsSync(file)) {
    const err = new Error(
      `No store-guard.config.json found at ${file}\n` +
        `Run: npx store-guard init   (or copy store-guard.config.example.json)`
    );
    err.code = 'ENOCONFIG';
    throw err;
  }
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    throw new Error(`store-guard.config.json is not valid JSON: ${e.message}`);
  }
  const cfg = deepMerge(DEFAULTS, raw);
  cfg.root = root;
  cfg.configFile = file;

  if (!cfg.app.iosScheme) {
    // Infer from the ios/ directory rather than making every app state it.
    const iosDir = path.join(root, 'ios');
    if (fs.existsSync(iosDir)) {
      const proj = fs.readdirSync(iosDir).find((f) => f.endsWith('.xcodeproj'));
      if (proj) cfg.app.iosScheme = proj.replace('.xcodeproj', '');
    }
  }
  return cfg;
}

// A rule's `when` clause names a profile flag. Absent clause means always apply.
function applies(rule, cfg) {
  if (!rule.when) return { ok: true };
  if (rule.when.config) {
    const flag = rule.when.config;
    if (!(flag in cfg.profile)) {
      return { ok: false, reason: `profile.${flag} not set` };
    }
    return cfg.profile[flag]
      ? { ok: true }
      : { ok: false, reason: `profile.${flag} is false` };
  }
  return { ok: true };
}

module.exports = { load, applies, DEFAULTS };
