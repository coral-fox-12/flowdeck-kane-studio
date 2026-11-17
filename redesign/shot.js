// Usage: node shot.js <url> <width> <height> <outfile> [full]
const { chromium } = require('playwright-core');
const path = require('path');
const os = require('os');
(async () => {
  const [url, w, h, out, full] = process.argv.slice(2);
  const exe = path.join(os.homedir(), '.cache/ms-playwright/chromium_headless_shell-1148/chrome-linux/headless_shell');
  const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox', '--proxy-server=http://127.0.0.1:18080'] });
  const page = await browser.newPage({ viewport: { width: +w, height: +h } });
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: out, fullPage: full === 'full' });
  await browser.close();
  console.log('wrote', out);
})().catch(e => { console.error(e); process.exit(1); });
