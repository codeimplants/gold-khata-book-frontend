'use strict';

// iOS checks.
//
// Most of these began as scripts/preflight-ios.sh in sonebill-mobile. Every one
// exists because a real submission was rejected or an upload was refused; none
// is speculative. The comments name the incident where there was one.

const path = require('path');
const fs = require('fs');

// Strings shipped by the frameworks themselves. A purpose string that still
// looks like one of these has never been written by a human, and that is exactly
// what Apple rejects under 5.1.1(ii).
const FRAMEWORK_DEFAULTS = [
  /\$\(PRODUCT_NAME\)/,
  /allow .{0,30} to access your/i,
  /this app (needs|requires) access/i,
  /^we need access to/i,
  /\bexpo\b|development server|dev launcher|localhost/i,
];

function purposeStrings(ctx, rule, report) {
  const { plist } = ctx;
  if (!plist) return report.warn(rule, 'no Info.plist found — cannot check purpose strings');

  const keys = Object.keys(plist).filter((k) => /^NS.*UsageDescription$/.test(k));
  if (!keys.length) {
    return report.pass(rule, 'no permission strings declared (nothing to justify)');
  }

  for (const key of keys) {
    const val = plist[key];
    if (typeof val !== 'string' || !val.trim()) {
      // An empty string still shows the system prompt, with no explanation.
      report.violation(rule, `${key} is empty — a permission prompt with no justification`);
      continue;
    }
    const matched = FRAMEWORK_DEFAULTS.find((re) => re.test(val));
    if (matched) {
      report.violation(
        rule,
        `${key} looks like a framework default, not app-specific text`,
        `"${val.slice(0, 90)}${val.length > 90 ? '…' : ''}"`
      );
    } else if (val.length < 40) {
      report.warn(
        rule,
        `${key} is only ${val.length} chars — reviewers want the specific reason`,
        `"${val}"`
      );
    } else {
      report.pass(rule, `${key} is specific (${val.length} chars)`);
    }
  }
}

function privacyManifest(ctx, rule, report) {
  const { cfg, root } = ctx;
  const p = path.join(root, 'ios', cfg.app.iosScheme || '', 'PrivacyInfo.xcprivacy');
  if (!fs.existsSync(p)) {
    return report.violation(rule, 'PrivacyInfo.xcprivacy missing', `expected at ${path.relative(root, p)}`);
  }
  const manifest = require('../../lib/plist').read(p);
  const collected = (manifest && manifest.NSPrivacyCollectedDataTypes) || [];

  // The stock template ships an empty array. An app that transmits names, phone
  // numbers and photos while declaring it collects nothing contradicts its own
  // App Store Connect privacy labels — which is a 5.1.2 problem, not a nitpick.
  if (!collected.length && cfg.profile.collectsPersonalData) {
    return report.violation(
      rule,
      'NSPrivacyCollectedDataTypes is empty, but profile.collectsPersonalData is true',
      'The manifest must match the App Store Connect privacy labels.'
    );
  }
  report.pass(rule, `PrivacyInfo.xcprivacy present, ${collected.length} data type(s) declared`);
}

function exportCompliance(ctx, rule, report) {
  const { plist } = ctx;
  if (!plist) return report.warn(rule, 'no Info.plist found');
  if (plist.ITSAppUsesNonExemptEncryption === undefined) {
    // Without this, every upload stops and waits for a manual answer.
    return report.violation(rule, 'ITSAppUsesNonExemptEncryption not declared — every upload will block on the encryption question');
  }
  report.pass(rule, `ITSAppUsesNonExemptEncryption = ${plist.ITSAppUsesNonExemptEncryption}`);
}

function versioning(ctx, rule, report) {
  const { pbx, cfg } = ctx;
  if (!pbx) return report.warn(rule, 'no project.pbxproj found');

  const versions = [...new Set(pbx.settingAll('MARKETING_VERSION'))];
  const builds = [...new Set(pbx.settingAll('CURRENT_PROJECT_VERSION'))];

  if (versions.length > 1) {
    report.violation(rule, 'MARKETING_VERSION differs between build configurations', versions.join(' vs '));
  } else if (versions.length === 1) {
    report.pass(rule, `MARKETING_VERSION ${versions[0]} consistent across configurations`);
  }

  if (builds.length > 1) {
    report.violation(rule, 'CURRENT_PROJECT_VERSION differs between build configurations', builds.join(' vs '));
  } else if (builds.length === 1) {
    report.pass(rule, `CURRENT_PROJECT_VERSION ${builds[0]} consistent across configurations`);
  }

  // Compare against what is actually live, when the app records it. This is the
  // only way to catch a reused build number without querying App Store Connect.
  const live = cfg.liveVersions && cfg.liveVersions.ios;
  if (live && builds.length === 1) {
    const local = Number(builds[0]);
    if (live.version === versions[0] && Number(live.build) >= local) {
      report.violation(
        rule,
        `build ${local} is not higher than the live build ${live.build} for version ${live.version}`,
        'ITMS-90062 will refuse this upload. Bump CURRENT_PROJECT_VERSION.'
      );
    } else {
      report.pass(rule, `build ${local} is ahead of live (${live.version} build ${live.build})`);
    }
  } else {
    report.warn(rule, 'build-number uniqueness unverified — set liveVersions.ios in store-guard.config.json after each release');
  }
}

function bundleNaming(ctx, rule, report) {
  const { pbx, plist } = ctx;
  if (!pbx) return report.warn(rule, 'no project.pbxproj found');
  const productName = pbx.setting('PRODUCT_NAME');
  if (productName && /[^\x20-\x7E]/.test(productName) && !productName.startsWith('$(')) {
    return report.violation(rule, `PRODUCT_NAME "${productName}" is not ASCII — the executable name must be ASCII`);
  }
  report.pass(rule, `PRODUCT_NAME "${productName}" is ASCII`);
  // The display name SHOULD be localised — that is the user-visible one.
  if (plist && plist.CFBundleDisplayName) {
    report.pass(rule, `CFBundleDisplayName "${plist.CFBundleDisplayName}"`);
  }
}

function ipadOrientations(ctx, rule, report) {
  const { plist } = ctx;
  if (!plist) return report.warn(rule, 'no Info.plist found');
  const orientations = plist['UISupportedInterfaceOrientations~ipad'] || [];
  if (orientations.length < 4) {
    return report.violation(
      rule,
      `iPad declares ${orientations.length}/4 orientations`,
      `have: ${orientations.join(', ') || 'none'} — all four are required, including PortraitUpsideDown`
    );
  }
  report.pass(rule, 'all four iPad orientations declared');
}

function ipadIcons(ctx, rule, report) {
  const { cfg, root } = ctx;
  const contents = path.join(
    root, 'ios', cfg.app.iosScheme || '', 'Images.xcassets', 'AppIcon.appiconset', 'Contents.json'
  );
  if (!fs.existsSync(contents)) {
    return report.warn(rule, `no AppIcon.appiconset found at ${path.relative(root, contents)}`);
  }
  const text = fs.readFileSync(contents, 'utf8');
  // Xcode writes `"size" : "76x76"` but other tools write `"size": "76x76"`.
  // A pattern that assumes one spacing reports every icon as missing.
  const missing = ['76x76', '83.5x83.5'].filter((sz) => {
    const re = new RegExp(`"size"\\s*:\\s*"${sz.replace('.', '\\.')}"`);
    return !re.test(text);
  });
  if (missing.length) {
    return report.violation(rule, `iPad icon sizes missing from asset catalog: ${missing.join(', ')}`);
  }
  report.pass(rule, 'iPad icon sizes present');
}

function appTransportSecurity(ctx, rule, report) {
  const { plist } = ctx;
  if (!plist) return report.warn(rule, 'no Info.plist found');
  const ats = plist.NSAppTransportSecurity || {};

  if (ats.NSAllowsArbitraryLoads === true) {
    report.violation(rule, 'NSAllowsArbitraryLoads is true — ATS disabled app-wide');
  } else {
    report.pass(rule, 'NSAllowsArbitraryLoads not enabled');
  }

  // Dev-server plumbing must never ship in a Release build.
  const bonjour = plist.NSBonjourServices || [];
  if (bonjour.some((s) => /_expo|_metro/.test(s))) {
    report.violation(rule, `NSBonjourServices advertises dev-server discovery: ${bonjour.join(', ')}`);
  }

  if (ats.NSAllowsLocalNetworking === true) {
    // Not an auto-fail: RN debug builds legitimately need this.
    report.warn(rule, 'NSAllowsLocalNetworking is true — confirm the shipping app actually needs local networking');
  }
}

function signInWithApple(ctx, rule, report) {
  const { root, files, scan } = ctx;
  const social = scan.grep(files, /(GoogleSignin|@react-native-google-signin|FacebookLogin|LoginManager|signInWithFacebook)/, { root });
  if (!social.total) {
    return report.pass(rule, 'no third-party social login found in source');
  }
  const apple = scan.grep(files, /(appleAuth|AppleAuthentication|expo-apple-authentication|SignInWithApple)/, { root });
  if (!apple.total) {
    return report.violation(
      rule,
      'third-party social login present with no Sign in with Apple',
      scan.formatHits(social)
    );
  }
  report.pass(rule, 'Sign in with Apple present alongside third-party login');
}

module.exports = {
  purposeStrings,
  privacyManifest,
  exportCompliance,
  versioning,
  bundleNaming,
  ipadOrientations,
  ipadIcons,
  appTransportSecurity,
  signInWithApple,
};
