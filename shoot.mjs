// Capture 4 screenshots of Nocturne Ledger via its ?shot= hooks.
import { chromium } from '/tmp/node_modules/playwright-core/index.mjs';
import { spawn } from 'node:child_process';

const PORT = 8391;
const server = spawn('node', ['serve.ts', '--port', String(PORT)], { cwd: process.cwd(), stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1500));

const shots = [
  ['1-start.png', '?shot=start&seed=7'],
  ['2-play.png', '?shot=play&seed=7'],
  ['3-lure.png', '?shot=lure&seed=7'],
  ['4-end.png', '?shot=end&seed=7'],
];
const browser = await chromium.launch({
  executablePath: '/root/.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell',
  args: ['--no-sandbox', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
const errs = [];
page.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
for (const [name, query] of shots) {
  await page.goto(`http://localhost:${PORT}/${query}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `screenshots/${name}` });
  console.log('shot', name);
}
await browser.close();
server.kill();
if (errs.length) { console.log(errs.join('\n')); process.exit(1); }
console.log('SHOTS-OK');