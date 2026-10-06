// Removes whole top-level string namespaces from all four translation files.
// Used for the strings of screens deleted in the 4.3(a) rework: the files are
// bundled whole, so those strings would otherwise still ship in the binary.
//
//   node scripts/rebrand/remove-namespaces.js ns1 ns2 ...
//
// Check a namespace is unused first (scripts/rebrand/unused-namespaces.js),
// then confirm with `npx tsc --noEmit` and a run of the app.
const fs = require('fs');
const path = require('path');

const names = process.argv.slice(2);
if (!names.length) { console.error('usage: remove-namespaces.js ns1 ns2 ...'); process.exit(1); }

for (const lang of ['en', 'hi', 'mr', 'gu']) {
  const file = path.join(__dirname, '../../src/localization', `${lang}.ts`);
  const raw = fs.readFileSync(file, 'utf8');
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  const lines = raw.split(/\r?\n/);
  const removed = [];
  for (const ns of names) {
    const start = lines.findIndex(l => l === `  ${ns}: {`);
    if (start < 0) continue;
    let end = start + 1;
    while (end < lines.length && lines[end] !== '  },') end++;
    if (end >= lines.length) throw new Error(`${lang}: no close for ${ns}`);
    // Take a blank line after the block with it, so no double gap is left.
    const extra = lines[end + 1] === '' ? 1 : 0;
    lines.splice(start, end - start + 1 + extra);
    removed.push(`${ns} (${end - start + 1} lines)`);
  }
  fs.writeFileSync(file, lines.join(eol));
  console.log(`${lang}: ${removed.join(', ') || 'nothing'}`);
}
