'use strict';

// Attestations for the manual gates.
//
// The non-code requirements — privacy labels, data safety form, screenshots,
// demo account — cannot be read from the repo. They can only be confirmed by a
// person looking at the store console. So they are recorded here, against the
// version they were made for.
//
// Storage stays keyed by version because that is the readable history: who
// confirmed what, when, for which release. But the version is no longer what
// decides whether an answer still holds — `validity.js` does, from the
// fingerprints recorded alongside each entry. Resetting every gate on every
// bump asked ten identical questions per release and got ten reflex answers;
// see the header of validity.js for what that actually produced.

const fs = require('fs');
const path = require('path');

function file(root) {
  return path.join(root, '.store-guard', 'attestations.json');
}

function load(root) {
  const f = file(root);
  if (!fs.existsSync(f)) return {};
  try {
    return JSON.parse(fs.readFileSync(f, 'utf8'));
  } catch (e) {
    return {};
  }
}

function save(root, data) {
  const f = file(root);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, `${JSON.stringify(data, null, 2)}\n`);
  return f;
}

// `signals` is the fingerprint of everything this answer was believed to depend
// on at the moment it was given. Without it an entry cannot be carried forward —
// there would be nothing to compare a later build against — so a gate attested
// by an older store-guard is asked once more and recorded properly.
function record(root, version, ruleId, { confirmed, note, by, signals }) {
  const all = load(root);
  if (!all[version]) all[version] = {};
  all[version][ruleId] = {
    confirmed,
    note: note || null,
    by: by || process.env.USER || process.env.USERNAME || 'unknown',
    at: new Date().toISOString(),
    signals: signals && Object.keys(signals).length ? signals : {},
  };
  save(root, all);
  return all[version][ruleId];
}

module.exports = { load, save, record, file };
