// Functional smoke test on the live redesigned site.
const { chromium } = require('playwright-core');
const path = require('path');
const os = require('os');
(async () => {
  const exe = path.join(os.homedir(), '.cache/ms-playwright/chromium_headless_shell-1148/chrome-linux/headless_shell');
  const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox', '--proxy-server=http://127.0.0.1:18080'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto('https://flowdeck-kane-studio.surge.sh', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1200);
  const h1 = await page.textContent('h1');
  const flows = await page.$$eval('#flow-list .flow', els => els.map(e => e.querySelector('h3').textContent.trim()));
  const stats = await page.textContent('#result-stats');
  // Draft flow: type sample description, generate, save one draft as flow
  await page.fill('#draft-desc', 'user logs in with valid credentials and sees the dashboard');
  await page.click('#generate-drafts');
  await page.waitForTimeout(500);
  const drafts = await page.$$eval('#draft-list .draft-card', els => els.length);
  let saved = null;
  if (drafts > 0) {
    await page.click('#draft-list [data-act="save-draft"]');
    await page.waitForTimeout(500);
    saved = await page.textContent('#flow-count');
  }
  // Export buttons present and wired (check the suite export buttons exist)
  const exportBtns = await page.$$eval('[data-act="export-json"]', els => els.length);
  // Search filter works
  await page.fill('#search', 'login');
  await page.waitForTimeout(300);
  const filtered = await page.textContent('#flow-count');
  console.log(JSON.stringify({ h1, flows, stats: stats.replace(/\s+/g, ' ').trim(), drafts, saved, exportBtns, filtered, errors }, null, 2));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
