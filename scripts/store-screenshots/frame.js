// Composes the store screenshots: each raw capture from store.js is placed
// under a caption on a ledger-green canvas, rendered at the exact pixel size
// each store asks for, into store-assets/screenshots/.
//
//   node frame.js            all targets
//   node frame.js --only ios/iphone-6.9
//
// These replace the SoneBill screenshots that sat in store-assets/ and were
// part of the 4.3(a) rejection (APP_STORE_4.3_REWORK.md). Every image here is
// this app, captured from the current build.
//
// Output is JPEG at high quality: App Store and Play both accept it, and it
// has no alpha channel, which Play rejects in a PNG.
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const { keriSvg } = require('./motifs');

const ROOT = path.resolve(__dirname, '../..');
const RAW = path.resolve(__dirname, 'raw');
const OUT = path.join(ROOT, 'store-assets', 'screenshots');

// The order is the listing's: the first three are what most people see, so
// they are the three things only a wholesaler's khata does. `file` is the raw
// capture; outputs are numbered in this order (01-khata.jpg, 02-statement.jpg
// ...) so they upload in the right order. Tablets take the first six.
const SHOTS = [
  { file: '01-khata', name: 'khata', title: "Every retailer's dues, in fine gold and cash", sub: 'Know who owes what, at a glance' },
  { file: '03-statement', name: 'statement', title: 'A clear statement for each retailer', sub: 'Remind on WhatsApp or share a PDF' },
  { file: '09-fix-rate', name: 'fix-rate', title: 'Cash now, gold rate later', sub: 'Hold it until the retailer fixes the rate' },
  { file: '02-daybook', name: 'daybook', title: 'A day book that adds itself up', sub: 'Gold out, gold in and cash in, day by day' },
  { file: '08-item-list', name: 'item-list', title: 'Name every item from a ready list', sub: '127 ornaments in four languages, or your own' },
  { file: '06-sale', name: 'sale', title: 'Fine gold worked out for you', sub: "Purity, wastage and today's 99.50 rate" },
  { file: '04-new-entry', name: 'new-entry', title: 'Record a sale, a receipt or an advance', sub: 'In gold, in cash, or both' },
  { file: '05-retailers', name: 'retailers', title: 'All your retailers in one ledger', sub: 'Search, sort and follow up' },
  { file: '07-welcome', name: 'welcome', title: 'Built for gold wholesalers', sub: 'English, हिंदी, मराठी and ગુજરાતી' },
];

// w x h is the store size. `shot` is the screenshot's width on the canvas,
// chosen so the whole app screen, tab bar included, fits under the caption.
const TARGETS = [
  { dir: 'ios/iphone-6.9', raw: 'iphone69', w: 1320, h: 2868, shot: 1000, title: 88, sub: 48, top: 150 },
  { dir: 'ios/ipad-13', raw: 'ipad13', w: 2064, h: 2752, shot: 1640, title: 104, sub: 56, top: 140, max: 6 },
  { dir: 'android/phone', raw: 'iphone69', w: 1080, h: 1920, shot: 700, title: 64, sub: 36, top: 96 },
  { dir: 'android/tablet-10', raw: 'tablet', w: 1600, h: 2560, shot: 1240, title: 92, sub: 50, top: 130, max: 6 },
  { dir: 'android/tablet-7', raw: 'tablet', w: 1200, h: 1920, shot: 930, title: 70, sub: 38, top: 100, max: 6 },
];

const only = (() => { const i = process.argv.indexOf('--only'); return i >= 0 ? process.argv[i + 1] : null; })();

const html = (t, shot, img) => `<!doctype html><html><head><meta charset="utf-8"><style>
  html, body { margin: 0; padding: 0; }
  body {
    width: ${t.w}px; height: ${t.h}px; overflow: hidden;
    background: #0E4D3C;
    font-family: "Segoe UI", system-ui, -apple-system, Roboto, "Nirmala UI", sans-serif;
    display: flex; flex-direction: column; align-items: center;
    position: relative;
  }
  .keri { position: absolute; right: ${-Math.round(t.w * 0.10)}px; top: ${-Math.round(t.w * 0.06)}px; }
  .cap, .shot { position: relative; }
  .cap { width: ${Math.round(t.w * 0.84)}px; margin-top: ${t.top}px; text-align: left; }
  .rule { width: ${Math.round(t.title * 1.4)}px; height: ${Math.max(6, Math.round(t.title / 12))}px; background: #9A7425; border-radius: 3px; }
  h1 { color: #FFFFFF; font-size: ${t.title}px; line-height: 1.08; font-weight: 800; letter-spacing: -0.5px; margin: ${Math.round(t.title * 0.35)}px 0 0; }
  p { color: #DCC38A; font-size: ${t.sub}px; line-height: 1.25; font-weight: 600; margin: ${Math.round(t.sub * 0.45)}px 0 0; }
  .shot {
    margin-top: ${Math.round(t.title * 0.75)}px;
    width: ${t.shot}px; border-radius: ${Math.round(t.shot * 0.055)}px; overflow: hidden;
    border: ${Math.max(6, Math.round(t.shot * 0.008))}px solid #072A20;
    box-shadow: 0 ${Math.round(t.shot * 0.03)}px ${Math.round(t.shot * 0.08)}px rgba(0, 0, 0, 0.38);
    background: #F2F4EF;
  }
  .shot img { display: block; width: 100%; height: auto; }
</style></head><body>
  ${keriSvg({ height: Math.round(t.w * 0.62), opacity: 0.11, style: '' }).replace('<svg ', '<svg class="keri" ')}
  <div class="cap"><div class="rule"></div><h1>${shot.title}</h1><p>${shot.sub}</p></div>
  <div class="shot"><img src="data:image/png;base64,${img}"></div>
</body></html>`;

function findChromium() {
  const root = path.join(process.env.LOCALAPPDATA || '', 'ms-playwright');
  if (!fs.existsSync(root)) return undefined;
  for (const d of fs.readdirSync(root).filter(x => /^chromium-\d+$/.test(x)).sort().reverse()) {
    const exe = path.join(root, d, 'chrome-win64', 'chrome.exe');
    if (fs.existsSync(exe)) return exe;
  }
  return undefined;
}

(async () => {
  const exe = findChromium();
  const browser = await chromium.launch(exe ? { executablePath: exe } : { channel: 'chrome' });
  for (const t of TARGETS) {
    if (only && only !== t.dir) continue;
    const outDir = path.join(OUT, t.dir);
    const rawDir = path.join(RAW, t.raw);
    if (!fs.existsSync(rawDir)) { console.log(`skip ${t.dir}: no raw captures in ${rawDir}`); continue; }
    // Clear the old set, SoneBill's or a previous run's, so nothing stale is
    // left beside the new images.
    fs.mkdirSync(outDir, { recursive: true });
    for (const f of fs.readdirSync(outDir)) if (/\.(png|jpe?g)$/i.test(f)) fs.unlinkSync(path.join(outDir, f));

    const page = await browser.newPage({ viewport: { width: t.w, height: t.h }, deviceScaleFactor: 1 });
    let n = 0;
    for (const shot of SHOTS.slice(0, t.max || SHOTS.length)) {
      const number = String(n + 1).padStart(2, '0');
      const src = path.join(rawDir, shot.file + '.png');
      if (!fs.existsSync(src)) { console.log(`  missing ${t.raw}/${shot.file}`); continue; }
      await page.setContent(html(t, shot, fs.readFileSync(src).toString('base64')), { waitUntil: 'load' });
      await page.waitForTimeout(150);
      const dest = path.join(outDir, `${number}-${shot.name}.jpg`);
      await page.screenshot({ path: dest, type: 'jpeg', quality: 92 });
      n++;
    }
    await page.close();
    console.log(`${t.dir}: ${n} images at ${t.w} x ${t.h}`);
  }
  await browser.close();
})().catch(e => { console.error(e); process.exitCode = 1; });
