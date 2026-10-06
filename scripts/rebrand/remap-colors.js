// One-off rebrand: rewrites SoneBill's colour literals to Gold Khata Book's
// Ledger palette (src/theme/brand.ts). Kept in the repo as the record of what
// was mapped to what. It is idempotent, so re-running after a merge that brings
// SoneBill colours back is safe.
//
//   node scripts/rebrand/remap-colors.js          dry run, prints per-file counts
//   node scripts/rebrand/remap-colors.js --write  rewrites files
//
// Mapping is by family and by lightness: a light purple tint (selected-state
// background) becomes a light green tint, a strong purple (button, link)
// becomes the strong green, a dark purple becomes the dark green. That keeps
// each literal's role without reading every call site first. Screens are then
// restyled by hand where structure, not colour, is what made them SoneBill's.
//
// Families:
//  - SoneBill's brand (indigo, violet, purple, fuchsia, pink) -> ledger green
//  - amber/orange (SoneBill's colour for gold amounts) -> antique gold
//  - teal (SoneBill's Orders-tab colour) -> ledger green
//  - cool Tailwind greys -> warm paper neutrals, UI only. src/print/ keeps its
//    neutrals: paper output is printed in black and grey on white.
// Left alone: reds (errors, deletes, dues), success greens, informational blues,
// WhatsApp's brand greens, and white or black.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const TARGETS = ['src', 'App.tsx'];
const SKIP = new Set([path.join(ROOT, 'src/theme/brand.ts')]);

const BRAND = {
  // strong
  '#6D5EF7': '#0E4D3C', '#6366F1': '#0E4D3C', '#7857FF': '#0E4D3C', '#7C5CFF': '#0E4D3C',
  '#8B5CF6': '#145F4A', '#A855F7': '#145F4A', '#7C3AED': '#145F4A', '#9333EA': '#145F4A', '#EC4899': '#145F4A',
  // gradient ends and dark
  '#D946EF': '#0A3A2D', '#4F46E5': '#0A3A2D', '#4338CA': '#0A3A2D', '#6D28D9': '#0A3A2D',
  '#6B21A8': '#0A3A2D', '#5B21B6': '#0A3A2D', '#3730A3': '#0A3A2D',
  '#312E81': '#072A20', '#3B0764': '#072A20',
  // mid and light
  '#F472B6': '#5FA88E',
  '#C4B5FD': '#93C4B1', '#BBABFF': '#93C4B1', '#BAABFF': '#93C4B1', '#F5A5BA': '#93C4B1',
  '#DDD6FE': '#C3DDD2', '#C7D2FE': '#C3DDD2', '#C7C9D9': '#C9D6D0',
  '#EDE9FE': '#DCEBE4', '#E9DCF7': '#DCEBE4', '#E0E7FF': '#DCEBE4', '#E3D7F5': '#DCEBE4',
  '#EEF2FF': '#E7F0EC', '#F1E9FF': '#E7F0EC', '#F3E8FF': '#E7F0EC', '#F0EDFF': '#E7F0EC',
  '#F5F3FF': '#F3F8F5', '#FDF2F8': '#F3F8F5', '#FCFAFE': '#F7FAF8', '#F8F9FF': '#F7FAF8',
  // SoneBill's theme accent pink (src/theme/colors.ts)
  '#F0426A': '#0E4D3C',
};

const AMBER = {
  '#B45309': '#87661F', '#C85A00': '#87661F', '#EA580C': '#87661F',
  '#92400E': '#6F5318',
  '#D97706': '#9A7425', '#F97316': '#9A7425', '#E06A00': '#9A7425',
  '#F59E0B': '#B08A3A', '#F5A623': '#B08A3A',
  '#FB923C': '#C6A25A', '#FBBF24': '#C6A25A', '#FACC15': '#C6A25A',
  '#FCD34D': '#DCC38A',
  '#FDE68A': '#EBD9AE',
  '#FEF3C7': '#F5ECD7', '#FDE8C8': '#F5ECD7',
  '#FFFBEB': '#FBF6EA', '#FFF3E0': '#FBF6EA',
};

const TEAL = {
  '#14B8A6': '#145F4A', '#0D9488': '#0E4D3C', '#2DD4BF': '#5FA88E',
  '#BFE7E2': '#C3DDD2', '#E9F7F4': '#E7F0EC',
};

const NEUTRAL = {
  '#111827': '#1D1B16', '#0F172A': '#1D1B16',
  '#1F2937': '#2A2721', '#1E293B': '#2A2721',
  '#374151': '#3A372F', '#334155': '#3A372F',
  '#4B5563': '#545047', '#475569': '#545047',
  '#6B7280': '#6B665B',
  '#9CA3AF': '#A39E92', '#94A3B8': '#A39E92',
  '#D1D5DB': '#D6CFC0',
  '#DCDFE5': '#DDD6C8',
  '#E5E7EB': '#E3DCCD', '#E2E8F0': '#E3DCCD',
  '#F3F4F6': '#F1ECE2', '#F1F5F9': '#F1ECE2', '#EEF2F7': '#F1ECE2', '#EEF0F3': '#F1ECE2', '#F4F4F6': '#F1ECE2',
  '#F6F7F9': '#F4F0E8',
  '#F9FAFB': '#F8F5EE', '#F8FAFC': '#F8F5EE', '#FAFAFB': '#F8F5EE',
};

// rgb triples inside rgba(...): SoneBill's brand family only.
const RGB = {
  '109,94,247': '14,77,60', '99,102,241': '14,77,60', '124,92,255': '14,77,60',
  '139,92,246': '20,95,74', '217,70,239': '10,58,45', '17,12,46': '10,22,18',
  '217,119,6': '154,116,37', '180,83,9': '135,102,31',
};

// gluestack colour tokens. The brand and gold scales are registered in App.tsx's
// createConfig from src/theme/brand.ts.
const TOKEN_FAMILY = { purple: 'brand', violet: 'brand', indigo: 'brand', fuchsia: 'brand', teal: 'brand', amber: 'gold' };
const GOLD_STEPS = new Set(['50', '100', '200', '300', '400', '500', '600', '700', '800', '900']);

function files() {
  const out = [];
  const walk = p => {
    const s = fs.statSync(p);
    if (s.isDirectory()) { for (const f of fs.readdirSync(p)) walk(path.join(p, f)); return; }
    if (/\.(tsx?|jsx?|css)$/.test(p) && !SKIP.has(p)) out.push(p);
  };
  for (const t of TARGETS) walk(path.join(ROOT, t));
  return out;
}

const write = process.argv.includes('--write');
let total = 0;
for (const file of files()) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  const isPrint = rel.startsWith('src/print/');
  const hexMap = { ...BRAND, ...AMBER, ...TEAL, ...(isPrint ? {} : NEUTRAL) };
  const src = fs.readFileSync(file, 'utf8');
  let n = 0;
  let next = src.replace(/#[0-9A-Fa-f]{6}\b/g, m => {
    const to = hexMap[m.toUpperCase()];
    if (!to) return m;
    n++;
    return to;
  });
  next = next.replace(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/g, (m, r, g, b) => {
    const to = RGB[`${r},${g},${b}`];
    if (!to) return m;
    n++;
    return m.replace(/\d+\s*,\s*\d+\s*,\s*\d+/, to.replace(/,/g, ', '));
  });
  next = next.replace(/\$(purple|violet|indigo|fuchsia|teal|amber)(\d{2,3})\b/g, (m, fam, step) => {
    const to = TOKEN_FAMILY[fam];
    if (to === 'gold' && !GOLD_STEPS.has(step)) return m;
    n++;
    return `$${to}${step}`;
  });
  if (n) {
    total += n;
    console.log(String(n).padStart(4), rel);
    if (write) fs.writeFileSync(file, next);
  }
}
console.log(`${write ? 'rewrote' : 'would rewrite'} ${total} colour references`);
