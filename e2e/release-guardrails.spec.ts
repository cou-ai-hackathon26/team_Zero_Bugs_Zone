import { expect, test, type APIRequestContext } from '@playwright/test';

async function login(request: APIRequestContext, role: 'doctor' | 'student' | 'admin') {
  const response = await request.post('/api/auth/login', {
    data: { email: `${role}@docmate.ai`, password: 'demo123' },
  });
  expect(response.ok()).toBe(true);
}

test.describe('Offline synthetic release guardrails', () => {
  test.skip(process.env.DOCMATE_QA_SYNTHETIC !== '1', 'Requires an isolated, seeded synthetic database.');

  test('physician records a synthetic case and follow-up, then gets a blocked prescription and a report preview', async ({ page }) => {
    await login(page.request, 'doctor');
    const casesResponse = await page.request.get('/api/cases');
    expect(casesResponse.ok()).toBe(true);
    const fixture = (await casesResponse.json()).cases.find((record: { patient_code: string }) => record.patient_code === 'P-103');
    expect(fixture).toBeDefined();
    const fixtureAnalysis = await page.request.post(`/api/cases/${fixture.id}/analyze`, { data: { locale: 'en' } });
    expect(await fixtureAnalysis.json()).toMatchObject({
      analysis: { status: 'insufficient_evidence', differentials: [], missing_information: [expect.anything(), expect.anything()] },
    });

    await page.goto('/en/cases/new');
    const code = `P-${Date.now().toString().slice(-8)}`;
    await page.getByLabel('Patient ID / Code').fill(code);
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByLabel('Chief Complaint').fill('Synthetic fatigue for workflow testing');
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('button', { name: 'Run AI Diagnostic Analysis' }).click();
    await expect(page).toHaveURL(/\/en\/cases\/[0-9a-f-]+$/);
    const id = new URL(page.url()).pathname.split('/').at(-1);
    await page.getByRole('tab', { name: 'Missing Info' }).click();
    await expect(page.getByText('What findings did the physician document on examination?')).toBeVisible();
    await page.getByPlaceholder('Enter clinical finding, test result, or note...').fill('Synthetic observation recorded.');
    await page.getByRole('button', { name: 'Save Answer' }).click();
    await expect.poll(async () => {
      const response = await page.request.get(`/api/cases/${id}`);
      return (await response.json()).turns.length;
    }).toBe(1);

    await page.getByRole('tab', { name: 'Treatment' }).click();
    await page.getByRole('button', { name: 'Select & Confirm Diagnosis' }).click();
    await page.getByRole('radio', { name: 'Other / Clinical Override' }).click();
    await page.getByPlaceholder('Enter clinical condition...').fill('Synthetic physician assessment');
    const diagnosis = page.waitForResponse((response) =>
      response.url().endsWith(`/api/cases/${id}`) && response.request().method() === 'PATCH',
    );
    await page.getByRole('dialog').getByRole('button', { name: 'Proceed to Treatment Planning' }).click();
    expect((await diagnosis).ok()).toBe(true);
    await expect(page.getByText('Treatment suggestions are unavailable', { exact: false })).toBeVisible();
    const finalization = await page.request.post(`/api/cases/${id}/finalize`);
    expect(finalization.status()).toBe(409);
    await page.getByRole('tab', { name: 'Printable Report' }).click();
    await expect(page.getByRole('button', { name: 'Print Official Report' })).toBeDisabled();
  });

  test('unrelated Ask abstains, evidence search returns excerpts, and the command dialog opens and closes', async ({ page }) => {
    await login(page.request, 'doctor');
    await page.goto('/en/ask');
    const question = page.getByRole('textbox');
    await question.fill('quantum entanglement');
    await question.press('Enter');
    await expect(page.getByText('This clinical query could not be substantiated', { exact: false })).toBeVisible();
    await question.fill('amoxicillin');
    await question.press('Enter');
    await expect(page.getByText('The library contains the following matching source excerpts.')).toBeVisible();

    await page.keyboard.press('Control+k');
    await expect(page.getByRole('dialog', { name: 'Command Palette' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Command Palette' })).toHaveCount(0);
  });

  test('student is denied cases and admin can add source metadata', async ({ browser, page }) => {
    await login(page.request, 'student');
    expect((await page.request.get('/api/cases')).status()).toBe(403);
    await page.goto('/en/cases');
    await expect(page).toHaveURL(/\/en\/library$/);

    const admin = await browser.newContext();
    try {
      await login(admin.request, 'admin');
      const view = await admin.newPage();
      await view.goto('/en/library');
      await view.getByRole('button', { name: 'Add New Source' }).click();
      await expect(view.getByRole('dialog')).toBeVisible();
      const title = `Synthetic QA source ${Date.now()}`;
      await view.locator('#source-title').fill(title);
      await view.locator('#source-year').fill('2024');
      await view.getByRole('dialog').locator('button[type=submit]').click();
      await expect(view.getByText(title)).toBeVisible();
    } finally {
      await admin.close();
    }
  });
});
