// Renders the Play Store feature graphic (1024 x 500) from the Khata capture.
//
//   node feature.js      (after store.js has captured raw/iphone69)
//
// Includes the app icon, recoloured to ledger green on 2026-10-06
// (scripts/rebrand/recolor-icon.py; APP_STORE_4.3_REWORK.md, question 2).
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');
const { keriSvg } = require('./motifs');

const ROOT = path.resolve(__dirname, '../..');
const src = path.join(__dirname, 'raw', 'iphone69', '01-khata.png');
const dest = path.join(ROOT, 'store-assets', 'graphics', 'play-feature-graphic.jpg');
const icon = path.join(ROOT, 'assets', 'logo.png');

function findChromium() {
  const root = path.join(process.env.LOCALAPPDATA || '', 'ms-playwright');
  if (!fs.existsSync(root)) return undefined;
  for (const d of fs.readdirSync(root).filter(x => /^chromium-\d+$/.test(x)).sort().reverse()) {
    const exe = path.join(root, d, 'chrome-win64', 'chrome.exe');
    if (fs.existsSync(exe)) return exe;
  }
  return undefined;
}

const html = (img, logo) => `<!doctype html><html><head><meta charset="utf-8"><style>
  html, body { margin: 0; }
  body { width: 1024px; height: 500px; overflow: hidden; background: #0E4D3C; position: relative;
         font-family: "Segoe UI", system-ui, -apple-system, Roboto, sans-serif; }
  .text { position: absolute; left: 64px; top: 58px; width: 560px; }
  .icon { width: 104px; height: 104px; border-radius: 24px; border: 3px solid #9A7425; display: block; margin-bottom: 26px; }
  .rule { width: 90px; height: 7px; border-radius: 3px; background: #9A7425; }
  .keri { position: absolute; left: 470px; top: -40px; }
  h1 { color: #fff; font-size: 54px; font-weight: 800; margin: 24px 0 0; letter-spacing: -0.5px; white-space: nowrap; }
  h2 { color: #DCC38A; font-size: 30px; font-weight: 600; margin: 10px 0 0; }
  p { color: #C3DDD2; font-size: 21px; margin: 22px 0 0; line-height: 1.4; }
  .phone { position: absolute; right: 70px; top: 46px; width: 300px; border-radius: 30px; overflow: hidden;
           border: 6px solid #072A20; box-shadow: 0 20px 50px rgba(0,0,0,.4); }
  .phone img { display: block; width: 100%; }
  .band { position: absolute; left: 0; right: 0; bottom: 0; height: 10px; background: #9A7425; }
</style></head><body>
  ${keriSvg({ height: 520, opacity: 0.10 }).replace('<svg ', '<svg class="keri" ')}
  <div class="text">
    <img class="icon" src="data:image/png;base64,${logo}">
    <div class="rule"></div>
    <h1>Gold Khata Book</h1>
    <h2>Wholesale gold ledger</h2>
    <p>Fine gold and cash dues for every retailer,<br>a day book, and statements on WhatsApp.</p>
  </div>
  <div class="phone"><img src="data:image/png;base64,${img}"></div>
  <div class="band"></div>
</body></html>`;

(async () => {
  if (!fs.existsSync(src)) throw new Error('run store.js first: ' + src + ' is missing');
  const exe = findChromium();
  const browser = await chromium.launch(exe ? { executablePath: exe } : { channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1024, height: 500 }, deviceScaleFactor: 1 });
  await page.setContent(html(fs.readFileSync(src).toString('base64'), fs.readFileSync(icon).toString('base64')), { waitUntil: 'load' });
  await page.waitForTimeout(150);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  await page.screenshot({ path: dest, type: 'jpeg', quality: 92 });
  await browser.close();
  console.log('wrote', path.relative(ROOT, dest));
})().catch(e => { console.error(e.message || e); process.exitCode = 1; });
