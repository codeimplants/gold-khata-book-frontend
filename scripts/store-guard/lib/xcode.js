'use strict';

// Reads build settings out of project.pbxproj.
//
// pbxproj is a NeXTSTEP property list, not JSON or XML. Rather than pull in a
// parser, we extract the handful of settings we need by pattern — the same
// approach the original preflight-ios.sh used, and enough for build settings
// which are always simple `KEY = value;` assignments.

const fs = require('fs');

// Every build configuration carries its own copy of these settings. A version
// bump that edits only the Release block produces a build whose version depends
// on which configuration was used — so we return ALL values, not the first.
function settingAll(pbxprojText, key) {
  const re = new RegExp(`^\\s*${key} = ([^;]+);`, 'gm');
  const values = [];
  let m;
  while ((m = re.exec(pbxprojText)) !== null) {
    values.push(m[1].trim().replace(/^["']|["']$/g, ''));
  }
  return values;
}

function setting(pbxprojText, key) {
  const all = settingAll(pbxprojText, key);
  return all.length ? all[0] : null;
}

function read(pbxprojPath) {
  if (!fs.existsSync(pbxprojPath)) return null;
  const text = fs.readFileSync(pbxprojPath, 'utf8');
  return {
    text,
    setting: (k) => setting(text, k),
    settingAll: (k) => settingAll(text, k),
  };
}

module.exports = { read, setting, settingAll };
