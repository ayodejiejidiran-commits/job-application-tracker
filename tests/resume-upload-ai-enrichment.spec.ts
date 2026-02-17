import { test, expect } from '@playwright/test';
import path from 'path';

// Helpers
const fixturePath = path.join(process.cwd(), 'tests/fixtures/resume.pdf');

// Fail on console errors / page errors / failed requests
const installGuards = (page: any) => {
  page.on('console', (msg: any) => {
    if (msg.type() === 'error') throw new Error(`Console error: ${msg.text()}`);
  });
  page.on('pageerror', (err: any) => {
    throw new Error(`Page error: ${err.message}`);
  });
  page.on('requestfinished', (req: any) => {
    const url = req.url();
    try {
      const parsed = new URL(url);
      const isAppHost = parsed.host.includes('localhost') || parsed.host.includes('vercel.app');
      if (!isAppHost) return;
    } catch {
      return;
    }
    if (url.includes('/api/') || url.includes('/resume/upload')) {
      const resp = req.response();
      if (resp && resp.status() >= 400) {
        throw new Error(`Request failed ${resp.status()} ${url}`);
      }
    }
  });
};

test.describe('Resume Upload & AI Enrichment', () => {
  test('full flow', async ({ page, context }) => {
    test.slow();
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    installGuards(page);

    await page.goto('/resume');
    await expect(page.getByRole('heading', { name: /Resume Upload & AI Enrichment/i })).toBeVisible();

    // Upload & Parse
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(fixturePath);
    const uploadResp = page.waitForResponse((res) => res.url().includes('/api/resume/upload') && res.status() === 200);
    await page.getByRole('button', { name: /Upload & Parse/i }).click();
    await uploadResp;
    await page.waitForURL('**/resume', { timeout: 15000 });

    // Editors should have parsed text (check summary/experience fields)
    await expect(page.getByText(/Test Resume Content/i)).toBeVisible();

    // Editor toolbar actions across sections (focus first editor area)
    const editors = page.getByTestId('editor-shell');
    const toolbarButtons = {
      bold: page.getByRole('button', { name: /Bold/i }),
      h2: page.getByRole('button', { name: /^H2$/i }),
      h3: page.getByRole('button', { name: /^H3$/i }),
      bullet: page.getByRole('button', { name: /Bullet/i }),
      numbered: page.getByRole('button', { name: /Numbered/i }),
      improve: page.getByRole('button', { name: /Improve bullet/i })
    };

    const applyToolbar = async (index: number) => {
      const editor = editors.nth(index);
      await editor.click();
      await page.keyboard.type('Sample bullet');
      await toolbarButtons.bold.click();
      await toolbarButtons.h2.click();
      await toolbarButtons.h3.click();
      await toolbarButtons.bullet.click();
      await toolbarButtons.numbered.click();
      await toolbarButtons.improve.click();
      await expect(editor).toContainText('(improved)', { timeout: 5000 });
    };

    const editorCount = await editors.count();
    const limit = Math.min(3, editorCount);
    for (let i = 0; i < limit; i++) {
      await applyToolbar(i);
    }

    // Tailor to Job Description
    const jdBox = page.getByRole('textbox', { name: /job description/i });
    await jdBox.fill('Sample JD for tailoring');
    await page.getByRole('button', { name: /Tailor Resume/i }).click();
    await expect(page.getByText('[Tailored to JD]')).toBeVisible();

    // Template CSS accordion
    await page.getByRole('button', { name: /Show/i }).click();
    await expect(page.locator('pre')).toBeVisible();
    await page.getByRole('button', { name: /Copy CSS/i }).click();

    // Export PDF
    await page.getByRole('combobox').selectOption('modern');
    const pdfRespPromise = page.waitForResponse((res) => res.url().includes('/api/pdf') && res.status() === 200);
    await page.getByRole('button', { name: /Export PDF/i }).click();
    const pdfResp = await pdfRespPromise;
    expect(await pdfResp.headerValue('content-type')).toContain('application/pdf');
    const pdfBody = await pdfResp.body();
    expect(pdfBody.byteLength).toBeGreaterThan(50);

    // Back navigation
    await page.getByRole('link', { name: /Back to dashboard/i }).click();
    await expect(page).toHaveURL(/dashboard/);
  });
});
