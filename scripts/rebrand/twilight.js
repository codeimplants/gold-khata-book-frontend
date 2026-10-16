// Twilight rebrand (2026-10-16): moves the app from the Ledger palette (emerald
// on a pearl ground, warm greys) to Twilight, the theme the owner chose from
// the theme studio: sapphire into peacock blue, a cool pearl ground, slate
// greys, and the same antique gold. src/theme/brand.ts has the tokens and
// APP_STORE_4.3_REWORK.md (section 5 and 8) the reasons.
//
//   node scripts/rebrand/twilight.js          dry run, prints per-file counts
//   node scripts/rebrand/twilight.js --write  rewrites files
//
// Mapping is by role and lightness, as in remap-colors.js: each step of the
// green scale becomes the same step of the sapphire scale, so a tint stays a
// tint and the strong colour stays strong. The light steps lean toward peacock
// (hue about 208) and stay greyish, well away from SoneBill's indigo tints
// (#EEF2FF, #E0E7FF, #C7D2FE, hue about 227 and fully saturated).
//
// Idempotent: no target is also a source. remap-colors.js passes its output
// through these maps, so re-running it after a merge from SoneBill lands on
// Twilight rather than on the old green or ivory.
//
// Left alone: gold, reds (dues, errors, deletes), success greens (`received`
// is #1E7B4F), WhatsApp's greens, informational blues, white and black.
// src/print/ keeps its neutrals, as in remap-colors.js: paper output is
// printed in black and grey on white.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const TARGETS = ['src', 'App.tsx', 'public/index.html'];
const SKIP = new Set([path.join(ROOT, 'src/theme/brand.ts')]);

// The emerald scale and its in-between tints -> the sapphire scale.
const BRAND = {
  '#041A14': '#040B1D', // brand950
  '#072A20': '#081430', // brand900, primaryDeep
  '#0A3A2D': '#0C1C42', // brand800, primaryDark
  '#0E4D3C': '#132859', // brand700, primary
  '#145F4A': '#1D3A75', // brand600, primaryMid
  '#2E8B6E': '#2D5A8E', // brand500
  '#5FA88E': '#5A84AE', // brand400
  '#93C4B1': '#93B0CB', // brand300
  '#C3DDD2': '#C3D3E2', // brand200
  '#C9D6D0': '#C8D3DF',
  '#DCEBE4': '#DAE5EF',
  '#E7F0EC': '#E4ECF3', // brand100, primarySoft
  '#F3F8F5': '#F2F6F9', // brand50, primaryTint
  '#F7FAF8': '#F6F9FB',
};

// UI neutrals: the pearl ground and the warm greys -> cool pearl and slate.
const NEUTRAL = {
  // pearl (2026-10-06)
  '#F2F4EF': '#F1F4F7', // paper
  '#DCE2D8': '#DAE0E8', // line
  '#C9D2C5': '#C5CEDA', // lineStrong
  '#E8ECE5': '#E6EAF0', // sunken
  // the ivory that pearl replaced, which remap-colors.js still produces
  '#F8F5EE': '#F1F4F7',
  '#F4F0E8': '#EEF1F5',
  '#F1ECE2': '#E9EDF2',
  '#E3DCCD': '#DAE0E8',
  '#DDD6C8': '#D3DAE3',
  '#D6CFC0': '#C5CEDA',
  // warm greys for text
  '#1D1B16': '#171B23', // ink
  '#2A2721': '#222733',
  '#3A372F': '#353B48', // inkSoft
  '#545047': '#4B5262',
  '#6B665B': '#5C6372', // inkMuted
  '#A39E92': '#9399A6', // inkFaint
};

// rgb triples inside rgba(...): the emerald family only.
const RGB = {
  '14,77,60': '19,40,89',
  '20,95,74': '29,58,117',
  '10,58,45': '12,28,66',
  '10,22,18': '8,12,24',
};

/** The colour a literal becomes, or undefined if it stays. */
function twilightHex(hex, { print = false } = {}) {
  const key = hex.toUpperCase();
  return BRAND[key] || (print ? undefined : NEUTRAL[key]);
}

function twilightRgb(triple) {
  return RGB[triple.replace(/\s+/g, '')];
}

module.exports = { BRAND, NEUTRAL, RGB, twilightHex, twilightRgb };

function files() {
  const out = [];
  const walk = p => {
    if (!fs.existsSync(p)) return;
    const s = fs.statSync(p);
    if (s.isDirectory()) { for (const f of fs.readdirSync(p)) walk(path.join(p, f)); return; }
    if (/\.(tsx?|jsx?|css|html)$/.test(p) && !SKIP.has(p)) out.push(p);
  };
  for (const t of TARGETS) walk(path.join(ROOT, t));
  return out;
}

if (require.main === module) {
  const write = process.argv.includes('--write');
  let total = 0;
  for (const file of files()) {
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');
    const print = rel.startsWith('src/print/');
    const src = fs.readFileSync(file, 'utf8');
    let n = 0;
    let next = src.replace(/#[0-9A-Fa-f]{6}\b/g, m => {
      const to = twilightHex(m, { print });
      if (!to) return m;
      n++;
      return to;
    });
    next = next.replace(/rgba?\(\s*(\d+\s*,\s*\d+\s*,\s*\d+)/g, (m, triple) => {
      const to = twilightRgb(triple);
      if (!to) return m;
      n++;
      return m.replace(/\d+\s*,\s*\d+\s*,\s*\d+/, to.replace(/,/g, ', '));
    });
    if (n) {
      total += n;
      console.log(String(n).padStart(4), rel);
      if (write) fs.writeFileSync(file, next);
    }
  }
  console.log(`${write ? 'rewrote' : 'would rewrite'} ${total} colour references`);
}
