// Gets or sets the VALUES of existing string keys in all four languages, by
// dotted path. It is the copy pass of the 4.3(a) rework: SoneBill's billing
// words (order, invoice, bill, payment) become the khata's (sale, receipt,
// statement).
//
//   node scripts/rebrand/set-strings.js get orders.title orders.newOrder
//   node scripts/rebrand/set-strings.js set         applies COPY below
//
// Keys stay as they are: they are code. Only what the user reads changes.
// Printed documents keep their wording (bill.*, taxInvoice.*): a GST bill
// is legally a "Tax Invoice", whatever the app calls a sale on screen.
const fs = require('fs');
const path = require('path');

const LANGS = ['en', 'hi', 'mr', 'gu'];
const file = lang => path.join(__dirname, '../../src/localization', `${lang}.ts`);

/** Line index of a dotted key, walking nested blocks by indentation. */
function locate(lines, keyPath) {
  const parts = keyPath.split('.');
  let from = 0;
  let to = lines.length;
  for (let depth = 0; depth < parts.length; depth++) {
    const indent = ' '.repeat(2 * (depth + 1));
    const last = depth === parts.length - 1;
    const keyRe = new RegExp(`^${indent}'?${parts[depth]}'?:\\s*${last ? '' : '\\{\\s*$'}`);
    let found = -1;
    for (let i = from; i < to; i++) {
      if (keyRe.test(lines[i])) { found = i; break; }
    }
    if (found < 0) return -1;
    if (last) return found;
    // The block runs to the first line closing at this indent.
    let end = found + 1;
    while (end < to && !new RegExp(`^${indent}\\},?\\s*$`).test(lines[end])) end++;
    from = found + 1;
    to = end;
  }
  return -1;
}

const quote = s => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

const [, , mode, ...keys] = process.argv;

if (mode === 'get') {
  for (const key of keys) {
    console.log(key);
    for (const lang of LANGS) {
      const lines = fs.readFileSync(file(lang), 'utf8').split(/\r?\n/);
      const i = locate(lines, key);
      console.log(`  ${lang}: ${i < 0 ? '(missing)' : lines[i].trim()}`);
    }
  }
  process.exit(0);
}

if (mode !== 'set') {
  console.error('usage: set-strings.js get <key...> | set');
  process.exit(1);
}

const COPY = require('./copy');
for (const lang of LANGS) {
  const raw = fs.readFileSync(file(lang), 'utf8');
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  const lines = raw.split(/\r?\n/);
  let changed = 0;
  const missing = [];
  for (const [key, byLang] of Object.entries(COPY)) {
    const value = byLang[lang];
    if (value === undefined) continue;
    const i = locate(lines, key);
    if (i < 0) { missing.push(key); continue; }
    const m = lines[i].match(/^(\s*'?[A-Za-z0-9_]+'?:\s*)(['"`])(.*)\2(,?)\s*$/);
    if (m) {
      const next = `${m[1]}${quote(value)}${m[4] || ','}`;
      if (next !== lines[i]) { lines[i] = next; changed++; }
      continue;
    }
    // A long value wrapped onto the line after its key ("key:" then the
    // string). Folded back onto one line.
    const head = lines[i].match(/^(\s*'?[A-Za-z0-9_]+'?:)\s*$/);
    const body = lines[i + 1] && lines[i + 1].match(/^\s*(['"`])(.*)\1(,?)\s*$/);
    if (head && body) {
      lines.splice(i, 2, `${head[1]} ${quote(value)}${body[3] || ','}`);
      changed++;
      continue;
    }
    missing.push(key + ' (not a simple string)');
  }
  fs.writeFileSync(file(lang), lines.join(eol));
  console.log(`${lang}: ${changed} changed${missing.length ? '; not found: ' + missing.join(', ') : ''}`);
}
