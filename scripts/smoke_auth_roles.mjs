import { chromium } from '@playwright/test';

const baseUrl = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:4173';

const roles = [
  {
    role: 'owner',
    email: process.env.OWNER_TEST_EMAIL || 'owner@motocare.vn',
    password: process.env.OWNER_TEST_PASSWORD || '123456',
  },
  {
    role: 'staff',
    email: process.env.STAFF_TEST_EMAIL || 'staff@motocare.vn',
    password: process.env.STAFF_TEST_PASSWORD || '123456',
  },
];

async function runRoleSmoke(browser, config) {
  const context = await browser.newContext();
  const page = await context.newPage();

  const pageErrors = [];
  const consoleErrors = [];
  const target404 = [];

  page.on('pageerror', (err) => pageErrors.push(String(err)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });
  page.on('response', (res) => {
    if (res.status() !== 404) return;
    const url = res.url();
    if (url.includes('/rest/v1/branches') || url.includes('/rest/v1/payroll_records')) {
      target404.push(url);
    }
  });

  let loginAttempted = false;
  let loginSucceeded = false;
  let loginError = '';

  try {
    await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle', timeout: 30000 });

    const loginButton = page.locator('button:has-text("Đăng nhập")');
    const loginVisible = await loginButton.isVisible({ timeout: 4000 }).catch(() => false);

    if (loginVisible) {
      loginAttempted = true;
      await page.fill('input[type="email"]', config.email);
      await page.fill('input[type="password"]', config.password);
      await loginButton.click();
      await page.waitForTimeout(3500);
    }

    const stillLogin = await page
      .locator('button:has-text("Đăng nhập")')
      .isVisible({ timeout: 1500 })
      .catch(() => false);

    loginSucceeded = !stillLogin;
    if (!loginSucceeded && loginAttempted) {
      loginError = 'Login button still visible after submit';
    }

    if (loginSucceeded) {
      for (const path of ['/#/service', '/#/settings']) {
        await page.goto(`${baseUrl}${path}`, {
          waitUntil: 'networkidle',
          timeout: 30000,
        }).catch((e) => {
          consoleErrors.push(`Navigation failed ${path}: ${String(e)}`);
        });
      }
    }
  } catch (e) {
    loginError = `Runtime exception: ${String(e)}`;
  }

  const result = {
    role: config.role,
    email: config.email,
    loginAttempted,
    loginSucceeded,
    loginError,
    pageErrorCount: pageErrors.length,
    consoleErrorCount: consoleErrors.length,
    target404Count: target404.length,
    pageErrors,
    consoleErrors,
    target404Urls: Array.from(new Set(target404)),
  };

  await context.close();
  return result;
}

const browser = await chromium.launch({ headless: true });
const results = [];

for (const roleConfig of roles) {
  results.push(await runRoleSmoke(browser, roleConfig));
}

await browser.close();

const summary = {
  baseUrl,
  checkedRoles: results.map((r) => r.role),
  allPassed: results.every(
    (r) => r.loginSucceeded && r.pageErrorCount === 0 && r.target404Count === 0
  ),
  results,
};

console.log(JSON.stringify(summary, null, 2));
