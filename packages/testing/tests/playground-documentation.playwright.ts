import { expect, test } from '@playwright/test';

import { runAxe } from '../src/helpers/axe.ts';

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

    await page.goto('/page/button', { waitUntil: 'load' });
    const documentation = page.locator('[data-component-page]');
    await expect(documentation).toHaveCount(1);
    await expect(documentation.getByRole('heading', { level: 1, name: 'Button' })).toBeVisible();
    await expect(documentation.getByRole('heading', { name: 'Overview' })).toBeVisible();
    await expect(documentation.getByRole('heading', { name: 'Props' })).toBeVisible();
    // The canonical page renders README prose as `.dx-prose.readme-content`;
    // `.cinder-markdown-content` belonged to the deleted condensed page.
    const readme = documentation.locator('.dx-prose.readme-content');
    await expect(readme).toBeVisible();
    expect(
      await readme
        .locator('p')
        .first()
        .evaluate((paragraph) => {
          return Number.parseFloat(getComputedStyle(paragraph).marginBlockEnd);
        }),
    ).toBeGreaterThan(0);
    // One documentation surface: no iframe, no second page to link out to, and
    // no loading state. `/c/<name>` 301s here.
    await expect(page.locator('iframe')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Open interactive documentation' })).toHaveCount(0);
    await expect(page.getByTestId('preview-loading-overlay')).toHaveCount(0);
    // Documentation and Playground are two VIEWS now, not prose plus a fixed
    // 38rem rail. The documentation view carries no stage at all — that is what
    // gives the prose, the props table, and the a11y notes the full width.
    await expect(page.locator('.dx-playground')).toHaveCount(0);
    await expect(page.getByRole('tab', { name: 'Documentation' })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    await page.getByRole('tab', { name: 'Playground' }).click();
    await expect(page.locator('.dx-playground')).toHaveCount(1);
    // Labelled for what it does — these buttons clamp the stage's width, they do
    // not emulate a device.
    await expect(page.getByRole('group', { name: 'Stage width' })).toBeVisible();
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

    await page.goto('/page/button', { waitUntil: 'load' });

    // The pre-paint script seeds `data-cinder-theme` from the persisted key
    // before first paint; the page adopts it after hydration without changing
    // the server tree.
    await expect(page.locator('html')).toHaveAttribute('data-cinder-theme', 'dark');
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

    // The Playground view mounts the BARE component live with the synthesized
    // prop values, labelled "Live preview" — not the static "Featured example".
    await preview.getByRole('tab', { name: 'Playground' }).click();
    const playground = preview.locator('.dx-playground');
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

test.describe('canonical page preview controls', () => {
  test('Expand enters focus mode and Escape leaves it', async ({ page }) => {
    await page.goto('/page/badge', { waitUntil: 'load' });

    const page_ = page.locator('[data-component-page]');
    await expect(page_).not.toHaveClass(/is-focus-mode/);

    // Focus mode expands the STAGE, so it is reached from the Playground view.
    await page.getByRole('tab', { name: 'Playground' }).click();
    await page.getByRole('button', { name: 'Expand' }).click();
    await expect(page_).toHaveClass(/is-focus-mode/);
    // The component nav must leave the tab order while the preview covers it.
    await expect(page.locator('nav.dx-nav')).toBeHidden();

    await page.keyboard.press('Escape');
    await expect(page_).not.toHaveClass(/is-focus-mode/);
    await expect(page.locator('nav.dx-nav')).toBeVisible();
  });

  test('seeds the preview width from a shared ?w= link', async ({ page }) => {
    // `/c/<name>?w=768` preserves its query across the 301, so these links must
    // keep meaning what they did on the shell.
    await page.goto('/page/badge?w=768', { waitUntil: 'load' });

    await page.getByRole('tab', { name: 'Playground' }).click();
    await expect(page.getByRole('group', { name: 'Stage width' })).toContainText('768px');
  });
});

test.describe('generated Playground accessibility', () => {
  for (const name of [
    'floating-action',
    'meter',
    'phone-input',
    'pin-input',
    'progress',
    'rating',
  ]) {
    test(`mounts ${name} without accessibility warnings at desktop and mobile widths`, async ({
      page,
    }) => {
      for (const [viewport, width] of [
        ['desktop', 1440],
        ['mobile', 390],
      ] as const) {
        const errors: string[] = [];
        page.removeAllListeners('console');
        page.on('console', (message) => {
          if (message.type() === 'error' || message.type() === 'warning')
            errors.push(message.text());
        });
        await page.setViewportSize({ width, height: 844 });
        await page.goto(`/page/${name}?view=playground`, { waitUntil: 'load' });
        await expect(page.locator('#playground-live-mount')).toBeVisible();

        const buckets = await runAxe(page, {
          slug: name,
          theme: 'light',
          viewport,
          fixture: 'generated-playground',
        });
        expect(buckets.critical, `${name} at ${viewport}`).toEqual([]);
        expect(buckets.serious, `${name} at ${viewport}`).toEqual([]);
        expect(
          errors.filter((message) => /accessible name|aria-label|ariaLabel/i.test(message)),
          `${name} at ${viewport}`,
        ).toEqual([]);
      }
    });
  }
});

test.describe('contract-specific Playground preview seeds', () => {
  for (const [name, mountedSelector] of [
    ['bar-chart', '.cinder-bar-chart'],
    ['data-table', '.cinder-data-table'],
    ['keyboard-shortcuts', '.cinder-keyboard-shortcuts'],
  ] as const) {
    test(`${name} mounts its contract-valid default preview without a console error`, async ({
      page,
    }) => {
      const errors: string[] = [];
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });
      page.on('pageerror', (error) => errors.push(error.message));

      await page.goto(`/page/${name}?view=playground`, { waitUntil: 'load' });
      const liveMount = page.locator('#playground-live-mount');
      await expect(liveMount).toBeVisible();
      await expect(liveMount.locator(mountedSelector)).toBeVisible();
      expect(errors, `${name} preview errors`).toEqual([]);
    });
  }
});

test.describe('authored Playground preview fallbacks', () => {
  for (const [name, visibleControl] of [
    ['alert-dialog', 'Open alert dialog'],
    ['backdrop', 'Show dimmed backdrop'],
    ['confirm-dialog', 'Delete item'],
    ['command-palette', 'Open palette'],
    ['drawer', 'Open drawer'],
    ['modal', 'Invite teammate'],
  ] as const) {
    test(`${name} shows its interactive example instead of an inert bare mount`, async ({
      page,
    }) => {
      await page.goto(`/page/${name}?view=playground`, { waitUntil: 'load' });

      await expect(page.getByText('Featured example', { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: visibleControl })).toBeVisible();
      await expect(page.locator('#playground-live-mount')).toHaveCount(0);
    });
  }

  for (const [name, trigger, visibleContent] of [
    ['alert-dialog', 'Open alert dialog', 'Session requires attention'],
    [
      'confirm-dialog',
      'Delete item',
      'This permanently removes the item. This action cannot be undone.',
    ],
    ['command-palette', 'Open palette', 'New file'],
    ['drawer', 'Open drawer', 'This is the drawer body. You can put any content here.'],
    ['modal', 'Invite teammate', 'Full name'],
  ] as const) {
    test(`${name} opens its authored overlay content`, async ({ page }) => {
      await page.goto(`/page/${name}?view=playground`, { waitUntil: 'load' });

      await page.getByRole('button', { name: trigger }).click();
      await expect(page.getByText(visibleContent, { exact: true })).toBeVisible();
    });
  }

  test('command-menu shows its anchored interactive example instead of a bare mount', async ({
    page,
  }) => {
    await page.goto('/page/command-menu?view=playground', { waitUntil: 'load' });

    await expect(page.getByText('Featured example', { exact: true })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Notes' })).toBeVisible();
    await expect(page.locator('#playground-live-mount')).toHaveCount(0);
  });

  test('command-menu opens its authored completion list', async ({ page }) => {
    await page.goto('/page/command-menu?view=playground', { waitUntil: 'load' });

    const notes = page.getByRole('textbox', { name: 'Notes' });
    await notes.focus();
    await page.keyboard.press('End');
    await page.keyboard.type('/');
    await expect(page.getByRole('listbox', { name: 'Slash commands' })).toBeVisible();
    await expect(page.getByText('Summary', { exact: true })).toBeVisible();
  });

  test('backdrop renders a real, dismissible scrim through its authored example', async ({
    page,
  }) => {
    await page.goto('/page/backdrop?view=playground', { waitUntil: 'load' });

    await page.getByRole('button', { name: 'Show dimmed backdrop' }).click();
    const scrim = page.locator('.cinder-backdrop');
    await expect(scrim).toBeVisible();
    await expect(scrim.getByText('Loading… click anywhere to dismiss')).toBeVisible();

    await scrim.click({ position: { x: 8, y: 8 } });
    await expect(scrim).toBeHidden();
  });
});

test.describe('Svelte 5 snippet-contract Playground routes', () => {
  const routeNames = [
    'alert',
    'badge',
    'banner',
    'button',
    'button-group',
    'callout',
    'card',
    'checkbox-group',
    'container',
    'copy-button',
    'floating-action',
    'form-field',
    'form-section',
    'kbd',
    'keyboard-shortcuts',
    'link',
    'marquee',
    'masonry',
    'message',
    'resizable-panels',
    'scroll-area',
    'segmented-control',
    'shortcut-hint',
    'skip-link',
    'visually-hidden',
  ];

  for (const name of routeNames) {
    test(`${name} reaches a rendered preview without snippet diagnostics`, async ({ page }) => {
      const diagnostics: string[] = [];
      page.on('console', (message) => {
        if (message.type() === 'error' || message.type() === 'warning') {
          diagnostics.push(message.text());
        }
      });
      page.on('pageerror', (error) => diagnostics.push(error.message));

      await page.goto(`/page/${name}?view=playground`, { waitUntil: 'load' });
      const stage = page.locator('.dx-playground .dx-stage').first();
      await expect(stage).toBeVisible();
      await expect(stage.locator('.cinder-callout[data-cinder-variant="danger"]')).toHaveCount(0);
      await expect(stage.locator('.example-preview')).toBeVisible();
      expect(diagnostics, `${name} diagnostics`).toEqual([]);
    });
  }
});

test('marquee keeps its generated live preview', async ({ page }) => {
  await page.goto('/page/marquee?view=playground', { waitUntil: 'load' });

  await expect(page.getByText('Live preview', { exact: true })).toBeVisible();
  await expect(page.locator('#playground-live-mount')).toBeVisible();
  await expect(page.getByLabel('label')).toHaveValue('Announcements');
  const generatedSnippet = page.locator('.dx-playground__panel .cinder-code-block').first();
  await expect(generatedSnippet).toContainText('<Marquee label="Announcements">');
  await expect(generatedSnippet).toContainText('{#snippet children()}');
  await expect(generatedSnippet).toContainText('aria-hidden="true"');

  // A recipe value seeds a useful initial preview, but clearing its control is
  // still an explicit reader choice. The live mount and copied source must both
  // drop the baseline rather than quietly restoring it.
  await page.getByLabel('label').fill('');
  await expect(page.locator('#playground-live-mount .cinder-marquee')).not.toHaveAttribute(
    'aria-label',
  );
  await expect(generatedSnippet).not.toContainText('label="Announcements"');
});

test('authored previews retain the focus-mode control', async ({ page }) => {
  await page.goto('/page/sidebar?view=playground', { waitUntil: 'load' });

  await expect(page.getByText('Featured example', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Expand' }).click();
  await expect(page.locator('[data-component-page]')).toHaveClass(/is-focus-mode/);
});

test('masonry keeps its recipe items as direct component children', async ({ page }) => {
  await page.goto('/page/masonry?view=playground', { waitUntil: 'load' });

  await expect(page.locator('#playground-live-mount .cinder-masonry > .dx-recipe-box')).toHaveCount(
    3,
  );
  await expect(page.locator('.dx-playground__panel .cinder-code-block').first()).toContainText(
    'Item 1',
  );
});

test('text children stay text when VisuallyHidden changes its rendered element', async ({
  page,
}) => {
  await page.goto('/page/visually-hidden?view=playground', { waitUntil: 'load' });

  await page.getByLabel('as').selectOption('textarea');
  const preview = page.locator('#playground-live-mount textarea');
  await expect(preview).toHaveText('VisuallyHidden');
  await expect(preview.locator('span')).toHaveCount(0);
});

test.describe('mobile view switching on component pages', () => {
  for (const name of ['side-navigation', 'sidebar']) {
    test(`${name} switches views with pointer and keyboard input from 320px through 430px`, async ({
      page,
    }) => {
      for (const width of [320, 375, 390, 430]) {
        await page.setViewportSize({ width, height: 844 });
        await page.goto(`/page/${name}`, { waitUntil: 'load' });

        const documentation = page.getByRole('tab', { name: 'Documentation' });
        const playground = page.getByRole('tab', { name: 'Playground' });
        await expect(documentation).toHaveAttribute('aria-selected', 'true');

        await playground.click();
        await expect(playground).toHaveAttribute('aria-selected', 'true');
        await expect(page).toHaveURL(new RegExp(`/page/${name}\\?view=playground$`));
        await expect(page.getByRole('tabpanel', { name: 'Playground' })).toBeVisible();

        await documentation.focus();
        await page.keyboard.press('Enter');
        await expect(documentation).toHaveAttribute('aria-selected', 'true');
        await expect(page).toHaveURL(new RegExp(`/page/${name}$`));
        await expect(page.getByRole('tabpanel', { name: 'Documentation' })).toBeVisible();

        await playground.focus();
        await page.keyboard.press('Space');
        await expect(playground).toHaveAttribute('aria-selected', 'true');

        await playground.focus();
        await page.keyboard.press('ArrowLeft');
        await expect(documentation).toHaveAttribute('aria-selected', 'true');

        await documentation.focus();
        await page.keyboard.press('ArrowRight');
        await expect(playground).toHaveAttribute('aria-selected', 'true');
        await expect(page.getByRole('tabpanel', { name: 'Playground' })).toBeVisible();
      }
    });
  }
});

test.describe('narrow documentation layout', () => {
  for (const name of [
    'autocomplete',
    'chat-composer-popover',
    'checkbox',
    'permission-matrix',
    'pin-input',
    'sortable-list',
    'table',
    'waveform',
  ]) {
    test(`${name} does not widen the document`, async ({ page }) => {
      for (const width of [320, 375, 390, 430]) {
        await page.setViewportSize({ width, height: 844 });
        await page.goto(`/page/${name}`, { waitUntil: 'load' });
        const dimensions = await page.evaluate(() => ({
          clientWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
        }));
        expect(dimensions.scrollWidth, `${name} at ${width}px`).toBeLessThanOrEqual(
          dimensions.clientWidth,
        );
      }
    });
  }
});
