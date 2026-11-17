const { chromium } = require('playwright-core');
const path = require('path');
const os = require('os');
(async () => {
  const exe = path.join(os.homedir(), '.cache/ms-playwright/chromium_headless_shell-1148/chrome-linux/headless_shell');
  const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox', '--proxy-server=http://127.0.0.1:18080'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('requestfailed', r => console.log('FAILED:', r.url(), '|', (r.failure() || {}).errorText));
  page.on('response', r => { if (r.status() >= 400) console.log('HTTP', r.status(), r.url()); });
  await page.goto(process.argv[2] || 'https://flowdeck-kane-studio.surge.sh', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1500);
  const fonts = await page.evaluate(() => ({
    h1: getComputedStyle(document.querySelector('h1')).fontFamily,
    h1loaded: document.fonts.check('600 58px Fraunces'),
    mono: document.fonts.check('500 12px "IBM Plex Mono"'),
    grot: document.fonts.check('500 15px "Space Grotesk"'),
  }));
  console.log(JSON.stringify(fonts));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
