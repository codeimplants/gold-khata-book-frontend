// Logs into the local web build and captures screens, for reviewing the UI and
// as raw material for store screenshots.
//
// Kept in the repo, not a temp folder, so the screenshot pipeline survives a
// restart and a new session can re-run it. APP_STORE_4.3_REWORK.md has the
// whole local setup (MongoDB, backend on the demo database, seed, web build).
//
//   cd scripts/store-screenshots && npm install      (once)
//   node capture.js <outDir> [--base http://localhost:8081] [--tabs "Orders,Retailers,Settings"]
//
// playwright-core ships no browser. It uses Playwright's Chromium if one is
// installed (%LOCALAPPDATA%\ms-playwright), and otherwise the installed Chrome.
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf('--' + name);
  return i >= 0 ? args[i + 1] : dflt;
};
const out = args[0] && !args[0].startsWith('--') ? args[0] : 'out';
const base = opt('base', 'http://localhost:8081');
const tabs = opt('tabs', '').split(',').map(s => s.trim()).filter(Boolean);
// iPhone 6.9" is 1320 x 2868 at 3x, so 440 x 956 CSS pixels.
const width = Number(opt('width', 440));
const height = Number(opt('height', 956));
const scale = Number(opt('scale', 1));

function findChromium() {
  const root = path.join(process.env.LOCALAPPDATA || '', 'ms-playwright');
  if (!fs.existsSync(root)) return undefined;
  const dirs = fs.readdirSync(root).filter(d => /^chromium-\d+$/.test(d)).sort().reverse();
  for (const d of dirs) {
    const exe = path.join(root, d, 'chrome-win64', 'chrome.exe');
    if (fs.existsSync(exe)) return exe;
  }
  return undefined;
}

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const exe = findChromium();
  const browser = await chromium.launch(exe ? { executablePath: exe } : { channel: 'chrome' });
  const ctx = await browser.newContext({
    viewport: { width, height }, deviceScaleFactor: scale, isMobile: true, hasTouch: true,
  });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('pageerror:', e.message));
  const shot = async name => {
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(out, name + '.png') });
    console.log('shot', name);
  };
  // The daily rate prompt opens over the first screen of the day. Dismiss it,
  // or every capture is of the prompt.
  const dismissRatePrompt = async () => {
    const live = page.getByText(/Use the live rate/i);
    if (await live.count()) await live.first().click().catch(() => {});
    await page.waitForTimeout(500);
  };

  await page.goto(base, { waitUntil: 'networkidle' });
  await shot('00-login');
  await page.locator('input:visible').first().fill('1234567890');
  await page.getByText(/Get OTP|Send OTP/i).first().click();
  await page.waitForTimeout(1500);
  await shot('01-otp');
  await page.locator('input:visible').last().fill('123456');
  await page.getByText(/Verify/i).last().click().catch(() => {});
  await page.waitForTimeout(3500);
  await dismissRatePrompt();
  await shot('02-home');

  for (const tab of tabs) {
    const target = page.getByText(new RegExp('^' + tab + '$'));
    if (!(await target.count())) { console.log('no tab', tab); continue; }
    await target.last().click();
    await dismissRatePrompt();
    await shot('tab-' + tab.replace(/\W+/g, '_'));
  }

  // --steps "click:Sundha Jewellers;shot:retailer;back;click:Day Book;wait:800;shot:daybook"
  // Semicolon-separated, run in order after login, for reaching inner screens:
  //   click:<exact text>   tap the last element showing exactly that text
  //   shot:<name>          capture to <outDir>/<name>.png
  //   back                 browser back (pops a pushed screen on web)
  //   wait:<ms>            pause, e.g. for an animation to settle
  const steps = opt('steps', '').split(';').map(s => s.trim()).filter(Boolean);
  for (const step of steps) {
    const [cmd, ...rest] = step.split(':');
    const arg = rest.join(':');
    if (cmd === 'click' || cmd === 'first') {
      // click: the last match (usually the screen on top). first: the first
      // match in page order, e.g. a header button whose label a tab below
      // it repeats ("Sales" on the Day Book).
      const target = page.getByText(arg, { exact: true });
      if (!(await target.count())) { console.log('not found:', arg); continue; }
      await (cmd === 'first' ? target.first() : target.last()).click();
      await page.waitForTimeout(900);
      await dismissRatePrompt();
    } else if (cmd === 'label') {
      // label:<accessibility label>, for icon-only buttons such as "New Entry".
      const target = page.locator(`[aria-label="${arg}"]`);
      if (!(await target.count())) { console.log('no label:', arg); continue; }
      await target.last().click();
      await page.waitForTimeout(900);
    } else if (cmd === 'shot') {
      await shot(arg);
    } else if (cmd === 'back') {
      await page.goBack();
      await page.waitForTimeout(900);
    } else if (cmd === 'wait') {
      await page.waitForTimeout(Number(arg) || 500);
    } else {
      console.log('unknown step:', step);
    }
  }
  await browser.close();
})().catch(e => { console.error(e); process.exitCode = 1; });
