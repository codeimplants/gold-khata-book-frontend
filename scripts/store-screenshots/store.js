// Captures the raw app screens used for the store listing, at each store
// device's pixel size, by walking the app the way a user would.
//
//   node store.js [--base http://localhost:8081] [--out raw] [--devices iphone69,ipad13,tablet]
//
// Needs the local stack with the store book seeded (APP_STORE_4.3_REWORK.md,
// section 7: `npm run seed:store` in the backend, on the demo database).
// frame.js then turns these raw captures into captioned store images.
//
// Device profiles are CSS size times scale = pixels:
//   iphone69  440 x 956  @3 = 1320 x 2868  (App Store 6.9", required)
//   ipad13   1032 x 1376 @2 = 2064 x 2752  (App Store 13" iPad, required)
//   tablet    800 x 1280 @2 = 1600 x 2560  (Play tablets; framed down for 7")
// Play's phone images are framed from the iphone69 captures.
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf('--' + name);
  return i >= 0 ? args[i + 1] : dflt;
};
const base = opt('base', 'http://localhost:8081');
const outRoot = path.resolve(__dirname, opt('out', 'raw'));
const DEVICES = {
  iphone69: { width: 440, height: 956, scale: 3, mobile: true },
  ipad13: { width: 1032, height: 1376, scale: 2, mobile: false },
  tablet: { width: 800, height: 1280, scale: 2, mobile: false },
};
const which = opt('devices', Object.keys(DEVICES).join(',')).split(',').filter(d => DEVICES[d]);

function findChromium() {
  const root = path.join(process.env.LOCALAPPDATA || '', 'ms-playwright');
  if (!fs.existsSync(root)) return undefined;
  for (const d of fs.readdirSync(root).filter(x => /^chromium-\d+$/.test(x)).sort().reverse()) {
    const exe = path.join(root, d, 'chrome-win64', 'chrome.exe');
    if (fs.existsSync(exe)) return exe;
  }
  return undefined;
}

async function captureDevice(browser, name, dev) {
  const out = path.join(outRoot, name);
  fs.mkdirSync(out, { recursive: true });
  const ctx = await browser.newContext({
    viewport: { width: dev.width, height: dev.height },
    deviceScaleFactor: dev.scale,
    isMobile: dev.mobile,
    hasTouch: true,
  });
  const page = await ctx.newPage();
  // Fail fast and say where: a missing element should not cost 30s each.
  page.setDefaultTimeout(15000);
  page.on('pageerror', e => console.log(`[${name}] pageerror:`, e.message));
  const settle = (ms = 1200) => page.waitForTimeout(ms);
  const step = label => console.log(`[${name}] ${label}`);
  const shot = async file => {
    await settle();
    await page.screenshot({ path: path.join(out, file + '.png') });
    step('shot ' + file);
  };
  // Tab screens stay mounted under the active one, so the same text can be in
  // the DOM several times with only one copy on top. Tap whichever match
  // actually receives the click, trying the most recent first.
  // first: true tries matches in page order, for a screen where an earlier
  // match is the one wanted and nothing covers it.
  const tap = async (target, label, { first = false } = {}) => {
    const all = await target.all();
    for (const el of first ? all : all.reverse()) {
      try {
        await el.click({ timeout: 1500 });
        await settle(1200);
        return;
      } catch {
        // Covered by another screen. Try the next match.
      }
    }
    throw new Error('nothing tappable for ' + label);
  };
  const dismissRatePrompt = async () => {
    const live = page.getByText(/Use the live rate/i);
    if (await live.count()) await live.first().click().catch(() => {});
    await settle(500);
  };
  const tab = label => tap(page.getByText(new RegExp('^' + label + '$')), 'tab ' + label);

  const login = async () => {
    step('login');
    await page.goto(base, { waitUntil: 'networkidle' });
    await settle(1500);
    await page.locator('input:visible').first().fill('1234567890');
    await page.getByText(/Get OTP|Send OTP/i).first().click();
    await settle(1500);
    await page.locator('input:visible').last().fill('123456');
    await page.getByText(/Verify/i).last().click();
    await settle(3500);
    await dismissRatePrompt();
  };
  const logout = async () => {
    // A fresh start for the next walk: going back through two pushed screens
    // races the stack animation on web, so each walk logs in again instead.
    await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch { /* fine */ } });
    await ctx.clearCookies();
  };

  step('open');
  await page.goto(base, { waitUntil: 'networkidle' });
  await settle(1500);
  await shot('07-welcome');

  // Walk 1: the tabs and the New Entry sheet.
  await login();
  await shot('01-khata');
  await tab('Day Book');
  await shot('02-daybook');
  await tab('Retailers');
  await shot('05-retailers');
  await tab('Khata');
  await tap(page.locator('[aria-label="New Entry"]'), 'new entry');
  await shot('04-new-entry');
  await logout();

  // Walk 2: into a retailer from the Khata balances, then into one of their
  // sales. Raj Gold House owes gold and has cash held with the rate not fixed
  // (the seed's first account case), so the statement shows Held and Fix
  // rate, and the sale shows the same.
  await login();
  // Page order: on a tall screen the same name is also in Recent entries
  // further down, and that row opens a sale, not the statement.
  await tap(page.getByText('Raj Gold House', { exact: true }), 'retailer', { first: true });
  await shot('03-statement');
  await tap(page.getByText(/^Fix rate$/), 'fix rate');
  await shot('09-fix-rate');
  // Closed by its own backdrop: Escape first, then a tap high on the screen.
  await page.keyboard.press('Escape').catch(() => {});
  await settle(600);
  if (await page.getByText(/^Fix rate and apply$/).count()) await page.mouse.click(dev.width / 2, 40);
  await settle(900);
  await tap(page.getByText(/^INV-[0-9]+$/), 'sale');
  await shot('06-sale');
  await logout();

  // Walk 3: the item list on New sale, searched the way a shopkeeper types.
  await login();
  await tap(page.getByText('Raj Gold House', { exact: true }), 'retailer', { first: true });
  await tap(page.getByText(/^New sale$/), 'new sale');
  await settle(1200);
  await tap(page.getByText(/^Search or type$/), 'item name');
  await page.keyboard.type('haar', { delay: 60 });
  await shot('08-item-list');

  await ctx.close();
}

(async () => {
  const exe = findChromium();
  const browser = await chromium.launch(exe ? { executablePath: exe } : { channel: 'chrome' });
  for (const name of which) await captureDevice(browser, name, DEVICES[name]);
  await browser.close();
})().catch(e => { console.error(e.message || e); process.exitCode = 1; });
