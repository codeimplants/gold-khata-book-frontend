'use strict';

const path = require('path');
const fs = require('fs');

const plistLib = require('./plist');
const xcode = require('./xcode');
const androidLib = require('./android');
const scan = require('./scan');
const configLib = require('./config');
const attest = require('./attest');
const validity = require('./validity');
const { Report } = require('./report');

const CATALOG = path.join(__dirname, '..', 'rules', 'catalog.json');
const CHECKS = {
  ios: require('../rules/checks/ios'),
  android: require('../rules/checks/android'),
  common: require('../rules/checks/common'),
};

function loadCatalog() {
  return JSON.parse(fs.readFileSync(CATALOG, 'utf8'));
}

// Everything a check might need, built once. Native files are read lazily-ish
// here rather than per-check so a 40-rule run doesn't re-read the same plist 40
// times.
function buildContext(cfg) {
  const root = cfg.root;
  const scheme = cfg.app.iosScheme;

  const plistPath = scheme ? path.join(root, 'ios', scheme, 'Info.plist') : null;
  const pbxPath = scheme ? path.join(root, 'ios', `${scheme}.xcodeproj`, 'project.pbxproj') : null;

  // Prefer the merged manifest — it is what actually ships. Fall back to source
  // and say so, because the difference between them is where injected
  // permissions hide.
  const merged = androidLib.mergedManifestPath(root);
  const sourceManifest = androidLib.manifestPath(root);
  const manifestFile = merged || sourceManifest;
  const manifestXml = androidLib.readIfExists(manifestFile);

  const files = scan.sourceFiles(root, cfg.app.srcDirs);

  const ctx = {
    cfg,
    root,
    files,
    scan,
    android: androidLib,
    plist: plistPath ? plistLib.read(plistPath) : null,
    pbx: pbxPath ? xcode.read(pbxPath) : null,
    manifest: manifestXml,
    manifestSource: manifestFile
      ? `${path.relative(root, manifestFile)}${merged ? ' (merged)' : ' (source — build first to check the merged manifest)'}`
      : 'none',
    manifestIsMerged: Boolean(merged),
  };

  // The version the manual gates are attested against.
  const iosVersion = ctx.pbx ? ctx.pbx.setting('MARKETING_VERSION') : null;
  const androidVersion = androidLib.gradleValue(root, 'versionName').value;
  ctx.version = iosVersion || androidVersion || '0.0.0';

  return ctx;
}

function resolveCheck(ref) {
  const [group, name] = ref.split('/');
  const mod = CHECKS[group];
  if (!mod || typeof mod[name] !== 'function') {
    throw new Error(`catalog references unknown check "${ref}"`);
  }
  return mod[name];
}

function platformOf(rule) {
  if (rule.store === 'apple') return 'ios';
  if (rule.store === 'play') return 'android';
  return 'both';
}

function run(cfg, { platform = 'all', includeManual = true } = {}) {
  const catalog = loadCatalog();
  const ctx = buildContext(cfg);
  const report = new Report();
  const attestations = attest.load(cfg.root);

  for (const rule of catalog.rules) {
    // Platform filter.
    const rulePlatform = platformOf(rule);
    if (platform !== 'all' && rulePlatform !== 'both' && rulePlatform !== platform) continue;

    // Explicit opt-out. Requires a reason so the list stays reviewable.
    if (cfg.ignore && cfg.ignore[rule.id]) {
      report.skip(rule, `ignored: ${cfg.ignore[rule.id]}`);
      continue;
    }

    // Profile gate — an app with no accounts is never asked about deletion.
    const applicable = configLib.applies(rule, cfg);
    if (!applicable.ok) {
      report.skip(rule, `not applicable (${applicable.reason})`);
      continue;
    }

    if (rule.mode === 'manual') {
      if (!includeManual) {
        report.skip(rule, 'manual gate skipped');
        continue;
      }
      // An answer holds until the thing it was about changes — not until the
      // version number moves. validity.js decides which, and says why.
      const v = validity.evaluate(rule, ctx, attestations);
      if (v.state === 'valid') {
        report.pass(rule, `${rule.title} — ${v.message}`);
      } else if (v.state === 'blocked') {
        report.violation(rule, v.message);
      } else {
        report.manual(
          rule,
          `${rule.title} — ${v.message}`,
          `${rule.prompt}\n↻ ${validity.describePolicy(rule)}`
        );
      }
      continue;
    }

    // Auto check. A crashing check must not take the whole run down — the other
    // rules still have something to say.
    try {
      resolveCheck(rule.check)(ctx, rule, report);
    } catch (err) {
      report.warn(rule, `check "${rule.check}" errored: ${err.message}`);
    }
  }

  return { report, ctx, catalog };
}

module.exports = { run, loadCatalog, buildContext };
