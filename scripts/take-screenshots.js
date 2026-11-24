const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function capture() {
  const outDir = path.join(__dirname, '..', 'docs', 'screenshots');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2
  });
  const page = await context.newPage();

  console.log('1. Capturing Login Page...');
  await page.goto('http://localhost:3000/bn/login', { waitUntil: 'networkidle' });
  await page.screenshot({ path: path.join(outDir, '01_login_bn.png'), fullPage: false });

  console.log('2. Logging in as Doctor...');
  await page.fill('input[type="email"]', 'doctor@docmate.ai');
  await page.fill('input[type="password"]', 'demo123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);

  console.log('3. Capturing Doctor Dashboard...');
  await page.goto('http://localhost:3000/bn/dashboard', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(outDir, '02_doctor_dashboard.png'), fullPage: false });

  console.log('4. Capturing Cases List...');
  await page.goto('http://localhost:3000/bn/cases', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(outDir, '03_cases_list.png'), fullPage: false });

  console.log('5. Capturing Case Clinical Workspace (P-101)...');
  try {
    const caseLink = page.locator('text=P-101').first();
    if (await caseLink.isVisible()) {
      await caseLink.click();
      await page.waitForTimeout(2500);
      await page.screenshot({ path: path.join(outDir, '04_clinical_workspace.png'), fullPage: false });
    }
  } catch (err) {
    console.error('Error opening case:', err.message);
  }

  console.log('6. Capturing Patient Intake / Case New...');
  await page.goto('http://localhost:3000/bn/cases/new', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(outDir, '05_patient_intake.png'), fullPage: false });

  console.log('7. Capturing Patient Portal (Login with Phone & OTP)...');
  const portalContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2
  });
  const portalPage = await portalContext.newPage();
  await portalPage.goto('http://localhost:3000/bn/portal', { waitUntil: 'networkidle' });
  await portalPage.waitForTimeout(1500);
  await portalPage.screenshot({ path: path.join(outDir, '06_patient_portal.png'), fullPage: false });

  await browser.close();
  console.log('All screenshots captured successfully in docs/screenshots!');
}

capture().catch(err => {
  console.error('Capture failed:', err);
  process.exit(1);
});
