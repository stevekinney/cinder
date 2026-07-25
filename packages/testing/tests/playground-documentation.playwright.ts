import { expect, test } from '@playwright/test';

/**
 * The component documentation page is a single scrolling reference (the
 * three-tab Documentation / Examples / Raw Artifacts layout was removed). Every
 * section renders on one page under an `<h2>`; the generated reference artifacts
 * (manifest entry, JSON schema, styling variables) live in a final collapsed
 * "Raw artifacts" `Collapsible` that lazy-renders its Shiki code blocks on first
 * open.
 */
test.describe('playground component documentation', () => {
  test('button hydrates server-rendered canonical documentation without replacing it', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('pageerror', (error) => errors.push(error.message));
    await page.emulateMedia({ colorScheme: 'dark' });

    await page.goto('/c/button?w=768', { waitUntil: 'load' });
    const documentation = page.locator('[data-canonical-documentation]');
    await expect(documentation).toHaveCount(1);
    await expect(documentation.getByRole('heading', { level: 1, name: 'Button' })).toBeVisible();
    await expect(documentation.getByRole('heading', { name: 'Overview' })).toBeVisible();
    await expect(documentation.getByRole('heading', { name: 'Props' })).toBeVisible();
    const readme = documentation.locator('.cinder-markdown-content');
    await expect(readme).toBeVisible();
    expect(
      await readme
        .locator('p')
        .first()
        .evaluate((paragraph) => {
          return Number.parseFloat(getComputedStyle(paragraph).marginBlockEnd);
        }),
    ).toBeGreaterThan(0);
    await expect(page.locator('iframe[data-cinder-preview]')).toHaveAttribute(
      'src',
      '/page/button?preview=1',
    );
    await expect(page.locator('#viewport-width-input')).toHaveValue('768');
    await expect(page.getByRole('radio', { name: 'Dark' })).toBeChecked();
    await expect(
      page.getByRole('link', { name: 'Open interactive documentation' }),
    ).toHaveAttribute('href', '/page/button');
    await expect(page.getByTestId('preview-loading-overlay')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('restores a persisted theme after hydration without changing the server tree', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript(() => {
      localStorage.setItem('cinder-playground-theme', 'dark');
    });

    await page.goto('/c/button', { waitUntil: 'load' });

    await expect(page.getByRole('radio', { name: 'Dark' })).toBeChecked();
    expect(errors).toEqual([]);
  });

  test('playground preview re-renders live as a prop control changes (#405)', async ({ page }) => {
    // `toggle` is used here (not `button`) because its generated playground
    // actually renders: Toggle has no required prop the control synthesizer
    // can't fill, so `showGeneratedPlayground` is true and the live mount
    // appears. Button requires an accessible name with no default, which flags
    // `hasUnsatisfiedRequired` and suppresses the generated playground entirely.
    await page.goto('/page/toggle', { waitUntil: 'load' });
    const preview = page;

    // The Playground section mounts the BARE component live with the synthesized
    // prop values, labelled "Live preview" — not the static "Featured example".
    const playground = preview.locator('#playground');
    await expect(playground).toBeVisible();
    const liveMount = preview.locator('#playground-live-mount');
    await expect(liveMount).toBeVisible();
    await expect(playground.getByText('Live preview')).toBeVisible();

    // A real Toggle instance rendered inside the live mount — a `role="switch"`
    // button, enabled to start (the synthesized `disabled` default is false).
    const liveSwitch = liveMount.getByRole('switch');
    await expect(liveSwitch).toBeVisible();
    await expect(liveSwitch).toBeEnabled();

    // Flip the `disabled` boolean control. The bare Toggle forwards `disabled`
    // onto its `<button role="switch">`, so the live mount re-renders with a
    // DISABLED switch — proving the preview is prop-driven, not static. The
    // control id follows the `pg-<prop>` pattern the controls panel emits; the
    // boolean control renders as a switch button, so `.click()` flips it.
    await playground.locator('#pg-disabled').click();
    await expect(liveMount.getByRole('switch')).toBeDisabled();
  });

  test('avatar-group exposes its styling variables in the raw artifacts', async ({ page }) => {
    await page.goto('/page/avatar-group', { waitUntil: 'load' });
    const preview = page;

    // Styling variables are part of the generated raw artifacts, collapsed by
    // default. Open the section, then assert the variables artifact rendered.
    await preview.getByRole('button', { name: 'Raw artifacts' }).click();

    await expect(preview.getByRole('heading', { name: 'Variables' })).toBeVisible();
    await expect(preview.getByText('--cinder-avatar-group-overlap')).toBeVisible();
  });
});
