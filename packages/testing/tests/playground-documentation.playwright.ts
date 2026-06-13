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
  test('button exposes single-scroll sections and generated raw artifacts', async ({ page }) => {
    await page.goto('/c/button', { waitUntil: 'load' });
    const preview = page.frameLocator('iframe[data-cinder-preview]');

    // The hero shows the component name as the page title, and the content
    // sections render as headings on one scrolling page — no tabs.
    await expect(preview.getByRole('heading', { level: 1, name: 'Button' })).toBeVisible();
    for (const section of ['Overview', 'When to use', 'Examples', 'Props', 'Related']) {
      await expect(preview.getByRole('heading', { name: section })).toBeVisible();
    }
    // The removed tabs no longer exist anywhere on the page.
    await expect(preview.getByRole('tab')).toHaveCount(0);

    // Each example renders inline with a lazy "Show code" disclosure.
    await expect(preview.locator('.dx-example').first()).toBeVisible();
    await expect(
      preview.locator('.dx-example').first().getByRole('button', { name: 'Show code' }),
    ).toBeVisible();

    // Generated artifacts live in the collapsed "Raw artifacts" section. Opening
    // it renders the manifest entry and schema as highlighted code blocks.
    const rawArtifacts = preview.getByRole('button', { name: 'Raw artifacts' });
    await expect(rawArtifacts).toHaveAttribute('aria-expanded', 'false');
    await rawArtifacts.click();

    await expect(preview.getByRole('heading', { name: 'Manifest entry' })).toBeVisible();
    await expect(preview.getByRole('heading', { name: 'Schema' })).toBeVisible();
    await expect(preview.getByText('"id": "button"')).toBeVisible();
    await expect(preview.locator('.cinder-code-block__highlighted .shiki').first()).toBeVisible();
  });

  test('avatar-group exposes its styling variables in the raw artifacts', async ({ page }) => {
    await page.goto('/c/avatar-group', { waitUntil: 'load' });
    const preview = page.frameLocator('iframe[data-cinder-preview]');

    // Styling variables are part of the generated raw artifacts, collapsed by
    // default. Open the section, then assert the variables artifact rendered.
    await preview.getByRole('button', { name: 'Raw artifacts' }).click();

    await expect(preview.getByRole('heading', { name: 'Variables' })).toBeVisible();
    await expect(preview.getByText('--cinder-avatar-group-overlap')).toBeVisible();
  });
});
