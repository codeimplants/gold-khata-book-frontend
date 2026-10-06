// Lists source files that nothing reachable from the app's entry points
// imports, i.e. files Metro does not bundle. After a screen is removed, its
// helpers often become unreachable too. This finds them.
//
//   node scripts/rebrand/unreachable.js
//
// A regex resolver, not a compiler: it follows static `import ... from`,
// `export ... from`, `require()` and `import()` with relative paths, and
// tries the platform extensions Metro does. Mocks, specs and tests are
// skipped as roots and as results.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const ENTRIES = ['index.js', 'index.web.js', 'App.tsx'].map(f => path.join(ROOT, f));
const EXTS = ['.tsx', '.ts', '.js', '.jsx', '.native.tsx', '.native.ts', '.ios.tsx', '.android.tsx', '.web.tsx', '.web.ts'];

const resolve = (from, spec) => {
  const base = path.resolve(path.dirname(from), spec);
  const found = [];
  for (const cand of [base, ...EXTS.map(e => base + e), ...EXTS.map(e => path.join(base, 'index' + e))]) {
    if (fs.existsSync(cand) && fs.statSync(cand).isFile()) found.push(cand);
  }
  // Platform variants (foo.web.ts beside foo.ts) are all reachable.
  return found;
};

const seen = new Set();
const stack = [...ENTRIES.filter(f => fs.existsSync(f))];
const IMPORT = /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]|require\(\s*['"]([^'"]+)['"]\s*\)|import\(\s*['"]([^'"]+)['"]\s*\)/g;
while (stack.length) {
  const file = stack.pop();
  if (seen.has(file)) continue;
  seen.add(file);
  const src = fs.readFileSync(file, 'utf8');
  for (const m of src.matchAll(IMPORT)) {
    const spec = m[1] || m[2] || m[3] || m[4];
    if (!spec || !spec.startsWith('.')) continue;
    for (const r of resolve(file, spec)) stack.push(r);
  }
}

const all = [];
(function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) { if (!/mocks|specs|__tests__/.test(f)) walk(p); }
    else if (/\.(tsx?|jsx?)$/.test(f) && !/\.d\.ts$/.test(f)) all.push(p);
  }
})(path.join(ROOT, 'src'));

const dead = all.filter(f => !seen.has(f)).map(f => path.relative(ROOT, f).replace(/\\/g, '/')).sort();
let lines = 0;
for (const f of dead) {
  const n = fs.readFileSync(path.join(ROOT, f), 'utf8').split('\n').length;
  lines += n;
  console.log(String(n).padStart(5), f);
}
console.log(`${dead.length} unreachable files, ${lines} lines`);
