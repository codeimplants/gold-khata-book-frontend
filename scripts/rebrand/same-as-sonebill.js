// Lists every image, icon and font in this app that is byte-identical to a
// file in the SoneBill checkout. Identical assets are part of how App Review
// recognised this app as a SoneBill copy (guideline 4.3(a)); the Android
// launcher icons were still SoneBill's artwork until 2026-10-06, long after
// the iOS icon had been replaced.
//
//   node scripts/rebrand/same-as-sonebill.js [path/to/sonebill-frontend]
//
// Fonts are reported too. They are licensed files (Outfit, Space Grotesk),
// identical in any app that bundles them, so they are not evidence of a
// copy, but they are no longer used and can be dropped on the Mac.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '../..');
const SONEBILL = path.resolve(process.argv[2] || path.join(ROOT, '../../sonebill/sonebill-frontend'));
const SKIP = new Set(['node_modules', '.git', 'build', 'Pods', 'dist', 'screenshots', 'raw', '.gradle']);
const EXT = /\.(png|jpe?g|webp|ico|gif|svg|ttf|otf)$/i;

const md5 = buf => crypto.createHash('md5').update(buf).digest('hex');
const walk = (dir, out = []) => {
  if (!fs.existsSync(dir)) return out;
  for (const f of fs.readdirSync(dir)) {
    if (SKIP.has(f)) continue;
    const p = path.join(dir, f);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (EXT.test(f)) out.push(p);
  }
  return out;
};

const sone = new Map();
for (const p of walk(SONEBILL)) sone.set(md5(fs.readFileSync(p)), p);

let same = 0;
for (const p of walk(ROOT)) {
  const hit = sone.get(md5(fs.readFileSync(p)));
  if (!hit) continue;
  same++;
  console.log(`SAME  ${path.relative(ROOT, p).replace(/\\/g, '/')}  ==  ${path.relative(SONEBILL, hit).replace(/\\/g, '/')}`);
}
console.log(`${same} file(s) identical to SoneBill (checked against ${sone.size} SoneBill assets)`);
