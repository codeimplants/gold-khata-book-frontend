// Lists top-level namespaces in the English strings file that no source file
// outside src/localization/ refers to. The translation files are bundled
// whole, so strings for deleted screens still ship in the binary.
//
//   node scripts/rebrand/unused-namespaces.js
//
// A namespace counts as used if any code mentions "ns." inside a string or
// template literal, so t('ns.key'), t(`ns.${k}`) and keys built from a prefix
// are all caught. A namespace read as a whole object (translations.ns) would
// be missed, so check the candidates by hand before deleting any.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const en = fs.readFileSync(path.join(ROOT, 'src/localization/en.ts'), 'utf8');
const namespaces = [...en.matchAll(/^  ([A-Za-z0-9_]+): \{/gm)].map(m => m[1]);

const code = [];
(function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) { if (!/localization|mocks/.test(f)) walk(p); }
    else if (/\.(tsx?|jsx?)$/.test(f)) code.push(fs.readFileSync(p, 'utf8'));
  }
})(path.join(ROOT, 'src'));
code.push(fs.readFileSync(path.join(ROOT, 'App.tsx'), 'utf8'));
const all = code.join('\n');

const unused = namespaces.filter(ns => !new RegExp(`['"\`]${ns}\\.`).test(all) && !new RegExp(`\\b${ns}\\b`).test(all.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '')));
const loose = namespaces.filter(ns => !unused.includes(ns) && !new RegExp(`['"\`]${ns}\\.`).test(all));
console.log('unreferenced:', unused.join(', ') || '(none)');
console.log('only bare-word matches, check by hand:', loose.join(', ') || '(none)');
