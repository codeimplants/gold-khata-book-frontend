'use strict';

// Android / Play checks.
//
// The important structural point: wherever possible these read the MERGED
// manifest, not the source one. Autolinked React Native libraries inject
// permissions at merge time that never appear in the file you wrote — which is
// exactly how an app ends up requesting RECORD_AUDIO nobody asked for and
// getting flagged by Play.

const path = require('path');

// Play raises the floor each year. Keeping it here rather than in the catalog
// because it is a number that changes on a schedule, independent of the rule.
// Verify against https://support.google.com/googleplay/android-developer/answer/11926878
const TARGET_SDK_FLOOR = 35;
const TARGET_SDK_FLOOR_REVIEWED = '2026-07-20';

// Permissions Play treats as restricted: each needs a Console declaration and an
// approved use case, and several are refused outright for most app categories.
const RESTRICTED = {
  'android.permission.SYSTEM_ALERT_WINDOW': 'Display over other apps — needs a declared use case; refused for most categories',
  'android.permission.QUERY_ALL_PACKAGES': 'Broad package visibility — allowed only for a narrow set of app types',
  'android.permission.MANAGE_EXTERNAL_STORAGE': 'All-files access — needs an approved use case',
  'android.permission.READ_SMS': 'SMS access — restricted, needs declaration',
  'android.permission.RECEIVE_SMS': 'SMS access — restricted, needs declaration',
  'android.permission.READ_CALL_LOG': 'Call Log — restricted, needs declaration',
  'android.permission.WRITE_CALL_LOG': 'Call Log — restricted, needs declaration',
  'android.permission.ACCESS_BACKGROUND_LOCATION': 'Background location — needs declaration and a video demo',
  'android.permission.REQUEST_INSTALL_PACKAGES': 'Installing packages — needs an approved use case',
  'android.permission.BIND_ACCESSIBILITY_SERVICE': 'Accessibility API — misuse is a common suspension cause',
};

function targetSdk(ctx, rule, report) {
  const { android, root } = ctx;
  const { value, source } = android.resolveSdkVersion(root, 'targetSdkVersion');
  if (value === null) {
    return report.warn(rule, 'could not resolve targetSdkVersion from Gradle, merged manifest or Expo defaults');
  }
  if (value < TARGET_SDK_FLOOR) {
    return report.violation(
      rule,
      `targetSdkVersion ${value} is below Play's floor of ${TARGET_SDK_FLOOR}`,
      `resolved from ${source} — floor last verified ${TARGET_SDK_FLOOR_REVIEWED}`
    );
  }
  report.pass(rule, `targetSdkVersion ${value} meets Play's floor (${TARGET_SDK_FLOOR}) — via ${source}`);
}

function versioning(ctx, rule, report) {
  const { android, root, cfg } = ctx;
  const { value: versionCode } = android.gradleValue(root, 'versionCode');
  const { value: versionName } = android.gradleValue(root, 'versionName');

  if (versionCode === null) {
    return report.warn(rule, 'could not read versionCode from Gradle');
  }

  const live = cfg.liveVersions && cfg.liveVersions.android;
  if (!live || live.versionCode === undefined || live.versionCode === null) {
    return report.warn(
      rule,
      `versionCode ${versionCode} (${versionName}) — cannot verify it beats the live release`,
      'Set liveVersions.android.versionCode in store-guard.config.json after each Play release.'
    );
  }
  if (Number(versionCode) <= Number(live.versionCode)) {
    return report.violation(
      rule,
      `versionCode ${versionCode} is not greater than the live versionCode ${live.versionCode}`,
      `Play will refuse this upload. Bump versionCode in android/app/build.gradle.` +
        (versionName ? `\nversionName is "${versionName}" and live is "${live.versionName || '?'}".` : '')
    );
  }
  report.pass(rule, `versionCode ${versionCode} is ahead of live (${live.versionCode})`);
}

function permissions(ctx, rule, report) {
  const { android, root, cfg, manifest, manifestSource } = ctx;
  if (!manifest) return report.warn(rule, 'no AndroidManifest.xml found');

  const perms = android.permissions(manifest);
  if (!perms.length) return report.pass(rule, 'no permissions requested');

  const allowed = new Set(cfg.allowedPermissions || []);
  if (!allowed.size) {
    return report.warn(
      rule,
      `${perms.length} permission(s) requested, none declared as expected in config`,
      `Add these to allowedPermissions in store-guard.config.json once you have justified each:\n` +
        perms.map((p) => `  "${p.name}"`).join('\n')
    );
  }

  const unexpected = perms.filter((p) => !allowed.has(p.name));
  if (unexpected.length) {
    report.violation(
      rule,
      `${unexpected.length} permission(s) in the manifest are not in allowedPermissions`,
      `Read from ${manifestSource}.\n` +
        unexpected.map((p) => `  ${p.name}`).join('\n') +
        `\nThese are usually injected by an autolinked library. Justify and add them, or remove the library.`
    );
  } else {
    report.pass(rule, `all ${perms.length} permission(s) accounted for in config`);
  }
}

function sensitivePermissions(ctx, rule, report) {
  const { android, manifest, manifestSource } = ctx;
  if (!manifest) return report.warn(rule, 'no AndroidManifest.xml found');

  const perms = android.permissions(manifest);
  const hits = perms.filter((p) => RESTRICTED[p.name]);

  if (!hits.length) {
    return report.pass(rule, 'no restricted permissions requested');
  }
  for (const p of hits) {
    report.violation(
      rule,
      `${p.name} is a restricted permission`,
      `${RESTRICTED[p.name]}\nFound in ${manifestSource}.`
    );
  }
}

function cleartextTraffic(ctx, rule, report) {
  const { android, root, manifest } = ctx;
  if (!manifest) return report.warn(rule, 'no AndroidManifest.xml found');

  const raw = android.applicationAttr(manifest, 'android:usesCleartextTraffic');
  if (raw === null) {
    return report.pass(rule, 'usesCleartextTraffic not set (defaults to false on API 28+)');
  }

  // A manifest placeholder is resolved in Gradle — the manifest alone says
  // nothing, so follow it through rather than reporting a false pass.
  const placeholder = raw.match(/^\$\{(.+)\}$/);
  if (placeholder) {
    const resolved = android.manifestPlaceholder(root, placeholder[1]);
    if (resolved === null) {
      return report.warn(
        rule,
        `usesCleartextTraffic is the placeholder \${${placeholder[1]}} and its release value could not be resolved`,
        'Check the release buildType in android/app/build.gradle.'
      );
    }
    if (resolved === 'true') {
      return report.violation(rule, `usesCleartextTraffic resolves to true in release via \${${placeholder[1]}}`);
    }
    return report.pass(rule, `usesCleartextTraffic resolves to ${resolved} in release`);
  }

  if (raw === 'true') {
    return report.violation(rule, 'usesCleartextTraffic is true — release builds must not permit plaintext HTTP');
  }
  report.pass(rule, `usesCleartextTraffic is ${raw}`);
}

function adsDeclaration(ctx, rule, report) {
  const { android, manifest, cfg } = ctx;
  if (!manifest) return report.warn(rule, 'no AndroidManifest.xml found');
  const perms = android.permissions(manifest).map((p) => p.name);
  const hasAdId = perms.includes('com.google.android.gms.permission.AD_ID');

  if (hasAdId && !cfg.profile.usesAds) {
    return report.violation(
      rule,
      'AD_ID permission requested but profile.usesAds is false',
      'Either remove the permission (usually injected by an ads or analytics SDK) or declare ads usage in Play Console.'
    );
  }
  if (!hasAdId && cfg.profile.usesAds) {
    return report.violation(rule, 'profile.usesAds is true but AD_ID permission is not declared');
  }
  report.pass(rule, hasAdId ? 'AD_ID declared and ads usage confirmed' : 'no advertising ID usage');
}

function foregroundServices(ctx, rule, report) {
  const { android, manifest, root } = ctx;
  if (!manifest) return report.warn(rule, 'no AndroidManifest.xml found');

  const target = android.resolveSdkVersion(root, 'targetSdkVersion').value;
  const svcs = android.services(manifest);
  const fgPerms = android
    .permissions(manifest)
    .map((p) => p.name)
    .filter((n) => n.startsWith('android.permission.FOREGROUND_SERVICE'));

  if (!fgPerms.length && !svcs.length) {
    return report.pass(rule, 'no foreground services declared');
  }
  if (Number(target) < 34) {
    return report.pass(rule, `targetSdk ${target} predates the foreground service type requirement`);
  }
  const untyped = svcs.filter((s) => !s.foregroundServiceType);
  if (fgPerms.length && untyped.length === svcs.length && svcs.length > 0) {
    return report.violation(
      rule,
      `${untyped.length} service(s) declared with no foregroundServiceType while targeting API ${target}`,
      untyped.map((s) => `  ${s.name}`).join('\n')
    );
  }
  report.pass(rule, 'foreground services declare a type');
}

module.exports = {
  targetSdk,
  versioning,
  permissions,
  sensitivePermissions,
  cleartextTraffic,
  adsDeclaration,
  foregroundServices,
};
