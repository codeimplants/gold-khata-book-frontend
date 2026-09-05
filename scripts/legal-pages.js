/**
 * Builds the standalone legal pages that Play Console links to.
 *
 * Google requires a publicly reachable URL for the privacy policy and for
 * account deletion — reachable *without* installing the app, so the in-app
 * screens do not satisfy it on their own.
 *
 * ── Why generate rather than hand-write ─────────────────────────────────────
 *
 * The text is read out of src/localization/en.ts, the same source the in-app
 * screens render through src/screens/legal/documents.ts. A hand-written copy
 * would be a second original: the two would agree on the day they were written
 * and drift from the first edit onwards, and the one a regulator or a reviewer
 * reads is the one nobody remembered to update. Here there is one text, and the
 * web page cannot fall behind the app.
 *
 * ── Why the TypeScript compiler ─────────────────────────────────────────────
 *
 * webpack.config.js is plain CommonJS run by Node, which cannot require a .ts
 * file. This project has no esbuild, ts-node or @babel/register, but it does
 * have `typescript`, so the file is transpiled in memory and evaluated. That
 * works only because en.ts is a single `export default {...}` literal with no
 * imports — if it ever grows one, this will throw at build time rather than
 * emit a silently empty page.
 */

const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const Module = require('module');

const EN_PATH = path.resolve(__dirname, '..', 'src', 'localization', 'en.ts');

/** Load the English strings by transpiling en.ts in memory. */
const loadStrings = () => {
  const source = fs.readFileSync(EN_PATH, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 },
  });

  const m = new Module(EN_PATH, null);
  m.filename = EN_PATH;
  m.paths = Module._nodeModulePaths(path.dirname(EN_PATH));
  m._compile(outputText, EN_PATH);

  const strings = m.exports && (m.exports.default || m.exports);
  if (!strings || typeof strings !== 'object') {
    throw new Error(`legal-pages: could not load strings from ${EN_PATH}`);
  }
  return strings;
};

// Escaped because the source is prose written by people, and an ampersand in
// "Account & Data Deletion" is enough to produce invalid markup.
const esc = s =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * Turn bare URLs in the prose into links.
 *
 * The deletion document tells the reader to visit the web app, and a page whose
 * instructions cannot be followed by clicking is a worse page. Runs AFTER
 * escaping, so the pattern only ever sees already-safe text.
 */
const linkify = s => s.replace(/(https?:\/\/[^\s<)]+)/g, '<a href="$1">$1</a>');

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const renderPage = (doc, { canonicalPath }) => {
  const now = new Date();
  const stamp = `${MONTHS[now.getMonth()]} ${now.getFullYear()}`;

  const sections = (doc.sections || [])
    .map(
      s => `
      <section>
        <h2>${esc(s.title)}</h2>
        <p>${linkify(esc(s.content))}</p>
      </section>`,
    )
    .join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(doc.title)} — Gold Khata Book</title>
<link rel="canonical" href="https://goldkhatabook.codeimplants.com${canonicalPath}">
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 2rem 1.25rem 4rem;
    font: 16px/1.65 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: #1f2937; background: #ffffff;
  }
  main { max-width: 46rem; margin: 0 auto; }
  header { border-bottom: 1px solid #e5e7eb; padding-bottom: 1.25rem; margin-bottom: 2rem; }
  h1 { font-size: 1.75rem; line-height: 1.25; margin: 0 0 .5rem; }
  .meta { color: #6b7280; font-size: .875rem; margin: 0; }
  h2 { font-size: 1.0625rem; margin: 2rem 0 .5rem; }
  p { margin: 0; }
  a { color: #7c3aed; }
  footer { margin-top: 3rem; padding-top: 1.25rem; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: .875rem; }
  @media (prefers-color-scheme: dark) {
    body { color: #e5e7eb; background: #111827; }
    header, footer { border-color: #374151; }
    .meta, footer { color: #9ca3af; }
    a { color: #c4b5fd; }
  }
</style>
</head>
<body>
<main>
  <header>
    <h1>${esc(doc.title)}</h1>
    <p class="meta">Gold Khata Book &middot; Last updated: ${stamp}</p>
  </header>
  ${sections}
  <footer>
    <p>Code Implants Software Technologies Pvt. Ltd. &middot;
       <a href="mailto:codeimplants@gmail.com">codeimplants@gmail.com</a></p>
  </footer>
</main>
</body>
</html>
`;
};

/**
 * The pages to emit. `id` matches LegalDocId in src/screens/legal/documents.ts,
 * so adding `terms` here later needs no new code.
 *
 * Directory-style paths (`privacy-policy/index.html`) rather than
 * `privacy-policy.html`: firebase.json rewrites every unmatched path to the
 * SPA's index.html, so a bare /privacy-policy would load the app instead of the
 * policy. A real file at that directory is matched first and wins.
 */
const PAGES = [
  { id: 'privacy', out: 'privacy-policy/index.html', canonicalPath: '/privacy-policy/' },
  { id: 'accountDeletion', out: 'delete-account/index.html', canonicalPath: '/delete-account/' },
];

/** @returns {{ filename: string, content: string }[]} */
const buildLegalPages = () => {
  const strings = loadStrings();

  return PAGES.map(({ id, out, canonicalPath }) => {
    const doc = strings[id];
    if (!doc || !Array.isArray(doc.sections) || doc.sections.length === 0) {
      // Loud, because the failure this replaces is a live URL serving an empty
      // page — which Play accepts at review time and a user finds later.
      throw new Error(
        `legal-pages: "${id}" is missing or has no sections in src/localization/en.ts. ` +
          `Play Console links to this page, so an empty one cannot be allowed to ship.`,
      );
    }
    return { filename: out, content: renderPage(doc, { canonicalPath }) };
  });
};

module.exports = { buildLegalPages };
