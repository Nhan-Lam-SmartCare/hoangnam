import { chromium } from '@playwright/test';

const baseUrl = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:4173';
const paths = ['/', '/service'];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

const consoleErrors = [];
const pageErrors = [];
const failed404 = [];

page.on('console', (msg) => {
  if (msg.type() === 'error') {
    consoleErrors.push(msg.text());
  }
});

page.on('pageerror', (err) => {
  pageErrors.push(String(err));
});

page.on('response', (res) => {
  if (res.status() === 404) {
    const url = res.url();
    if (url.includes('/rest/v1/branches') || url.includes('/rest/v1/payroll_records')) {
      failed404.push(url);
    }
  }
});

for (const path of paths) {
  try {
    await page.goto(`${baseUrl}${path}`, { waitUntil: 'networkidle', timeout: 30000 });
  } catch (e) {
    consoleErrors.push(`Navigation failed for ${path}: ${String(e)}`);
  }
}

const summary = {
  baseUrl,
  checkedPaths: paths,
  pageErrorCount: pageErrors.length,
  consoleErrorCount: consoleErrors.length,
  target404Count: failed404.length,
  pageErrors,
  consoleErrors,
  target404Urls: Array.from(new Set(failed404)),
};

console.log(JSON.stringify(summary, null, 2));

await context.close();
await browser.close();
