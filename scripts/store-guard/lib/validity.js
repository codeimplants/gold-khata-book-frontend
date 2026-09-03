'use strict';

// How long a manual attestation stays true.
//
// Attestations used to be keyed by version and reset on every bump, so a patch
// release re-asked all ten store-console questions verbatim. That reads as
// diligence and is the opposite: ten identical questions train a reflex "y",
// and once you are clicking through, the two gates that DO have an independent
// failure mode get clicked through with the rest. The evidence is in this
// repo's own attestations.json — 1.0.15's five Play gates were recorded at
// 04:23:53, 04:23:59, 04:24:03, 04:24:07, 04:24:13. Five compliance
// confirmations in twenty seconds, every note empty.
//
// So a gate now declares what makes its answer go stale, and the answer is
// carried forward until that thing actually happens:
//
//   always  — genuinely per-release. The repo cannot see it and it rots with no
//             commit involved: a demo account dies when a backend redeploys.
//             Must be re-attested for each version.
//   signal  — carried forward while a set of fingerprints is unchanged. Privacy
//             labels do not go stale because a version number moved; they go
//             stale when a permission, a usage-description key or a third-party
//             SDK appears.
//   expiry  — carried forward until it is simply old. For the near-static gates
//             (age rating, content rating) where nothing in the repo predicts
//             drift but a periodic re-read still earns its keep.
//
// Mechanically `mode` only decides whether the attested version must match the
// current one; declared `signals` and `expiresDays` are evaluated in every mode.
// The three names exist because they document intent at the call site, and the
// catalog is meant to be read.
//
// A rule with no `validity` block behaves as `always`, so a gate added without
// thinking about staleness fails safe rather than silently carrying forward.

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DAY = 24 * 60 * 60 * 1000;

function digest(parts) {
  return crypto.createHash('sha1').update(parts.join('\n')).digest('hex').slice(0, 12);
}

// Signals are deliberately coarse. Each one answers "has the thing this gate is
// about changed shape?", not "has any byte changed?" — a fingerprint that moves
// on every commit would put us straight back to asking every release.
const SIGNALS = {
  // Names and maxSdkVersion, not the whole manifest. A maxSdkVersion change is
  // a real change in what the app can reach and belongs in the fingerprint.
  //
  // The provenance prefix matters: an attestation made against the merged
  // manifest must never compare equal to a run that could only read the source
  // manifest, because the merged one contains everything autolinked libraries
  // injected. Different provenance means "cannot compare", which re-asks.
  androidPermissions(ctx) {
    if (!ctx.manifest) return 'unavailable';
    const names = ctx.android
      .permissions(ctx.manifest)
      .map((p) => `${p.name}@${p.maxSdkVersion === null ? '-' : p.maxSdkVersion}`)
      .sort();
    return `${ctx.manifestIsMerged ? 'merged' : 'source'}:${digest(names)}`;
  },

  // Keys only. Rewording a purpose string does not change what is collected, so
  // it should not re-open the privacy-label question.
  iosUsageDescriptions(ctx) {
    if (!ctx.plist) return 'unavailable';
    const keys = Object.keys(ctx.plist).filter((k) => /UsageDescription$/.test(k)).sort();
    return digest(keys);
  },

  // Dependency NAMES, without versions. A new SDK is what puts a new data type
  // in the privacy labels; bumping lucide-react-native does not, and hashing
  // versions in a React Native app would fire on nearly every release.
  sdks(ctx) {
    const pkgFile = path.join(ctx.root, 'package.json');
    if (!fs.existsSync(pkgFile)) return 'unavailable';
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8'));
      return digest(Object.keys(pkg.dependencies || {}).sort());
    } catch (e) {
      return 'unavailable';
    }
  },

  // File paths, not file contents — the app's screen inventory. Adding or
  // removing a screen is the thing that dates a screenshot set or a listing
  // description. Editing inside an existing screen usually is not, and treating
  // it as such would re-ask on every release.
  screens(ctx) {
    const rel = ctx.files.map((f) => path.relative(ctx.root, f).split(path.sep).join('/'));
    const screenish = rel.filter((p) => /(^|\/)(screens|pages|views)\//.test(p));
    // No conventional screen directory — fall back to the whole source list
    // rather than fingerprinting an empty set, which would never change.
    return digest((screenish.length ? screenish : rel).sort());
  },

  profile(ctx) {
    const p = ctx.cfg.profile || {};
    return digest(Object.keys(p).sort().map((k) => `${k}=${p[k]}`));
  },
};

const SIGNAL_LABEL = {
  androidPermissions: 'Android permissions',
  iosUsageDescriptions: 'iOS usage-description keys',
  sdks: 'third-party SDKs',
  screens: 'screen files',
  profile: 'app profile flags',
};

function label(name) {
  return SIGNAL_LABEL[name] || name;
}

function list(items, conj = 'and') {
  if (items.length <= 1) return items.join('');
  if (items.length === 2) return items.join(` ${conj} `);
  return `${items.slice(0, -1).join(', ')} ${conj} ${items[items.length - 1]}`;
}

// A signal value may carry a `provenance:hash` prefix (androidPermissions does,
// because the source manifest and the merged one are different questions). Two
// values with different provenance are not "different" — they are incomparable,
// and saying "changed" for that would send someone hunting a change that never
// happened.
function split(value) {
  const i = String(value).indexOf(':');
  return i === -1 ? { from: null, hash: value } : { from: value.slice(0, i), hash: value.slice(i + 1) };
}

function policyOf(rule) {
  const v = rule.validity || {};
  return {
    mode: v.mode || 'always',
    signals: Array.isArray(v.signals) ? v.signals : [],
    expiresDays: typeof v.expiresDays === 'number' ? v.expiresDays : null,
  };
}

// Fingerprints for the named signals only. Recording just what a rule declares
// keeps attestations.json readable and makes the stored record say exactly what
// the answer was believed to depend on.
function fingerprint(ctx, names) {
  const out = {};
  for (const name of names || []) {
    const fn = SIGNALS[name];
    out[name] = fn ? fn(ctx) : 'unknown-signal';
  }
  return out;
}

function ageInDays(iso) {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return (Date.now() - t) / DAY;
}

// The newest attestation for a rule across every version, not just the current
// one — carrying forward is the whole point, so the lookup cannot be scoped to
// the version the way it used to be.
function latestFor(all, ruleId) {
  let best = null;
  for (const [version, byRule] of Object.entries(all || {})) {
    const entry = byRule && byRule[ruleId];
    if (!entry) continue;
    const t = Date.parse(entry.at || '') || 0;
    if (!best || t > best.time) best = { version, entry, time: t };
  }
  return best;
}

function describePolicy(rule) {
  const p = policyOf(rule);
  const bits = [];
  if (p.mode === 'always') bits.push('re-attest every version');
  // "or", not "and" — any one of them going stale re-opens the gate.
  if (p.signals.length) bits.push(`re-attest when ${list(p.signals.map(label), 'or')} change`);
  if (p.expiresDays) bits.push(`expires after ${p.expiresDays} days`);
  return bits.length ? bits.join('; ') : 're-attest every version';
}

// Returns { state, message, previous }.
//   valid   — carried forward or attested for this version. Reported as a pass.
//   ask     — must be answered. Reported as an unattested manual gate.
//   blocked — answered "no", and that answer is still valid. Reported as a
//             violation: an unfixed "no" keeps blocking, but only for as long as
//             the answer would have been carried forward had it been a "yes".
function evaluate(rule, ctx, all) {
  const policy = policyOf(rule);
  const found = latestFor(all, rule.id);

  if (!found) {
    return { state: 'ask', message: 'never attested', previous: null };
  }

  const { version, entry } = found;
  const reasons = [];

  if (policy.mode === 'always' && version !== ctx.version) {
    reasons.push(`attested for ${version}, this build is ${ctx.version}`);
  }

  if (policy.expiresDays !== null) {
    const age = ageInDays(entry.at);
    if (age === null) reasons.push('attestation has no usable timestamp');
    else if (age > policy.expiresDays) {
      reasons.push(`attested ${Math.round(age)} days ago, valid for ${policy.expiresDays}`);
    }
  }

  const unchanged = [];
  if (policy.signals.length) {
    const now = fingerprint(ctx, policy.signals);
    const then = entry.signals || {};
    // Attestations made before this model existed carry no fingerprints at all,
    // so there is nothing to compare against and carrying them forward would be
    // a guess. Say that once, plainly, instead of listing every missing
    // fingerprint — it is a one-time migration, not a finding.
    if (!policy.signals.some((name) => name in then)) {
      reasons.push(
        `attested for ${version} with no staleness fingerprint recorded — ` +
        'answering once more records what the answer depends on'
      );
    }
    for (const name of policy.signals) {
      if (!(name in then)) {
        if (policy.signals.some((n) => n in then)) {
          reasons.push(`no ${label(name)} fingerprint recorded for ${version}`);
        }
      } else if (now[name] === 'unavailable' || then[name] === 'unavailable') {
        reasons.push(`${label(name)} could not be read`);
      } else if (split(now[name]).from !== split(then[name]).from) {
        reasons.push(
          `${label(name)} cannot be compared — recorded from the ${split(then[name]).from} manifest, ` +
          `this run reads the ${split(now[name]).from} one`
        );
      } else if (now[name] !== then[name]) {
        reasons.push(`${label(name)} changed since ${version}`);
      } else {
        unchanged.push(label(name));
      }
    }
  }

  if (reasons.length) {
    return { state: 'ask', message: reasons.join('; '), previous: found };
  }

  const who = `${entry.by || 'unknown'}${entry.note ? ` — ${entry.note}` : ''}`;
  if (!entry.confirmed) {
    return {
      state: 'blocked',
      message: `explicitly NOT confirmed for ${version} by ${who}`,
      previous: found,
    };
  }

  if (version === ctx.version) {
    return { state: 'valid', message: `attested for ${version} by ${who}`, previous: found };
  }

  const because = unchanged.length ? ` — ${list(unchanged)} unchanged` : '';
  const on = (entry.at || '').slice(0, 10);
  return {
    state: 'valid',
    message: `carried forward from ${version} (${on}, ${who})${because}`,
    previous: found,
  };
}

module.exports = { evaluate, fingerprint, policyOf, describePolicy, label, SIGNALS, SIGNAL_LABEL };
