// Prints every string in a localization file whose value matches a pattern,
// with its dotted key path. Used for the copy pass that replaces SoneBill's
// billing wording with the khata's.
//
//   node scripts/rebrand/list-strings.js en "invoice|bill|customer"
const fs = require('fs');
const path = require('path');

const lang = process.argv[2] || 'en';
const pattern = new RegExp(process.argv[3] || 'invoice|bill|customer', 'i');
const file = path.join(__dirname, '../../src/localization', `${lang}.ts`);
const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);

const stack = [];
lines.forEach((line, i) => {
  const open = line.match(/^(\s*)([A-Za-z0-9_]+|'[^']+'):\s*\{\s*$/);
  if (open) { stack.push({ indent: open[1].length, key: open[2].replace(/'/g, '') }); return; }
  const close = line.match(/^(\s*)\},?\s*$/);
  if (close) { while (stack.length && stack[stack.length - 1].indent >= close[1].length) stack.pop(); return; }
  const kv = line.match(/^\s*([A-Za-z0-9_]+|'[^']+'):\s*(['"`])(.*)\2,?\s*$/);
  if (kv && pattern.test(kv[3])) {
    const keyPath = [...stack.map(s => s.key), kv[1].replace(/'/g, '')].join('.');
    console.log(`${String(i + 1).padStart(5)}  ${keyPath} = ${kv[3]}`);
  }
});
