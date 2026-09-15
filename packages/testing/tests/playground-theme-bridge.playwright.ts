import AxePlaywrightBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

async function assertMeasuredContrast(page: Page, selector: string, label: string): Promise<void> {
  const result = await new AxePlaywrightBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .include(selector)
    .analyze();
  const incomplete = result.incomplete.filter((entry) => entry.id === 'color-contrast');
  const passes = result.passes.filter((entry) => entry.id === 'color-contrast');
  expect(result.violations, `${label} accessibility violations`).toHaveLength(0);
  expect(incomplete, `${label} contrast measurement incomplete`).toHaveLength(0);
  expect(passes, `${label} has no applicable contrast measurement`).not.toHaveLength(0);
}

const editorRoutes = [
  {
    name: 'SourceDiffViewer',
    route: '/page/source-diff-viewer',
    selector: '.cinder-source-diff-viewer',
  },
  { name: 'MarkdownEditor', route: '/page/markdown-editor', selector: '.markdown-editor-wrapper' },
  { name: 'ReviewEditor', route: '/page/review-editor', selector: '[data-testid="review-editor"]' },
  { name: 'DiffViewer', route: '/page/diff-viewer', selector: '.diff-viewer' },
] as const;

async function openEditor(page: Page, route: string, themeQuery = ''): Promise<void> {
  await page.goto(`${route}?snapshot=1${themeQuery}`, { waitUntil: 'load' });
  await expect(page.locator('[data-component-page]')).toBeVisible();
  await expect(page.locator('#example-mount-basic')).toBeVisible();
}

async function tokenState(page: Page, selector: string, expectedTheme: 'light' | 'dark') {
  return page
    .locator(selector)
    .first()
    .evaluate((element, expectedTheme) => {
      const root = getComputedStyle(document.documentElement);
      const surface = getComputedStyle(element as Element);
      const probe = document.createElement('span');
      // Scope the probe to the test's expected theme instead of copying the page
      // attribute. This keeps the assertion independent from the bridge under
      // test: a stale or missing root attribute must not make the probe agree
      // with the same defect.
      probe.dataset['theme'] = expectedTheme;
      probe.style.cssText =
        'background: var(--cinder-surface); color: var(--cinder-text-default); position: fixed; width: 1px; height: 1px;';
      document.body.append(probe);
      const probeStyle = getComputedStyle(probe);
      const probeSurface = probeStyle.backgroundColor;
      const probeText = probeStyle.color;
      const expectedSurface = probeStyle.getPropertyValue('--cinder-surface').trim();
      const expectedText = probeStyle.getPropertyValue('--cinder-text-default').trim();
      probe.remove();
      return {
        attribute: document.documentElement.getAttribute('data-theme'),
        colorScheme: document.documentElement.style.colorScheme,
        semanticSurface: root.getPropertyValue('--cinder-surface').trim(),
        semanticText: root.getPropertyValue('--cinder-text-default').trim(),
        expectedSurface,
        expectedText,
        visibleSurface: surface.backgroundColor,
        visibleText: surface.color,
        probeSurface,
        probeText,
      };
    }, expectedTheme);
}

test.describe('CIN-592 semantic theme bridge', () => {
  const explicitStates = new Map<string, { surface: string; text: string }>();

  for (const operatingSystem of ['light', 'dark'] as const) {
    for (const choice of ['light', 'dark', 'system'] as const) {
      test(`CodeBlock colors follow ${choice} with ${operatingSystem} OS preference`, async ({
        page,
      }) => {
        await page.emulateMedia({ colorScheme: operatingSystem });
        await page.addInitScript(() => localStorage.removeItem('cinder-playground-theme'));
        const query = choice === 'system' ? '' : `?theme=${choice}`;
        await page.goto(`/page/code-block${query}`, { waitUntil: 'load' });
        const example = page.locator('#example-mount-with-language');
        await example.scrollIntoViewIfNeeded();
        await expect(example).toBeVisible();
        const spans = page.locator(
          '#example-mount-with-language .cinder-code-block pre.shiki span[style*="--shiki-dark"]',
        );
        await expect(spans.first()).toBeVisible();
        const effectiveTheme = choice === 'system' ? operatingSystem : choice;
        const readColors = () =>
          spans.evaluateAll((elements) => {
            const probe = document.createElement('span');
            document.body.append(probe);
            try {
              return elements.map((element) => {
                const style = (element as HTMLElement).style;
                probe.style.color = style.color;
                const light = getComputedStyle(probe).color;
                probe.style.color = style.getPropertyValue('--shiki-dark');
                return {
                  light,
                  dark: getComputedStyle(probe).color,
                  actual: getComputedStyle(element).color,
                };
              });
            } finally {
              probe.remove();
            }
          });
        const colors = await readColors();
        expect(colors.length).toBeGreaterThan(0);
        expect(colors.some(({ light, dark }) => light !== dark)).toBe(true);
        expect(colors.map(({ actual }) => actual)).toEqual(
          colors.map((entry) => entry[effectiveTheme]),
        );
        await expect(page.locator('html')).toHaveAttribute('data-cinder-theme', choice);

        const nextTheme = effectiveTheme === 'light' ? 'dark' : 'light';
        await page.getByRole('button', { name: `Preview theme: switch to ${nextTheme}` }).click();
        await expect(page.locator('html')).toHaveAttribute('data-cinder-theme', nextTheme);
        await expect
          .poll(async () => {
            const currentColors = await readColors();
            return currentColors.map(({ actual }) => actual);
          })
          .toEqual(colors.map((entry) => entry[nextTheme]));
      });
    }
  }

  test('explicit theme scopes the documentation canvas independently of OS preference', async ({
    browser,
  }) => {
    for (const choice of ['light', 'dark'] as const) {
      const oppositeContext = await browser.newContext({
        colorScheme: choice === 'light' ? 'dark' : 'light',
      });
      const matchingContext = await browser.newContext({ colorScheme: choice });
      const readCanvas = async (page: Page) => {
        await page.goto(`/page/button?theme=${choice}`, { waitUntil: 'load' });
        await expect(page.locator('.dx-shell')).toBeVisible();
        return page.locator('.dx').evaluate((canvas) => {
          const probe = document.createElement('span');
          probe.dataset['theme'] = document.documentElement.dataset['theme']!;
          probe.style.cssText =
            'color-scheme: ' +
            document.documentElement.dataset['theme'] +
            '; background: light-dark(oklch(100% 0 0), var(--cinder-surface-canvas));';
          document.body.append(probe);
          const probeStyle = getComputedStyle(probe);
          const expectedCanvas = probeStyle.backgroundColor;
          probe.style.background = 'var(--cinder-surface-canvas)';
          const expectedBody = getComputedStyle(probe).backgroundColor;
          probe.remove();
          return {
            attribute: document.documentElement.getAttribute('data-theme'),
            canvas: getComputedStyle(canvas).backgroundColor,
            body: getComputedStyle(document.body).backgroundColor,
            expectedCanvas,
            expectedBody,
          };
        });
      };
      const opposite = await readCanvas(await oppositeContext.newPage());
      const matching = await readCanvas(await matchingContext.newPage());
      expect(opposite.attribute).toBe(choice);
      expect(opposite.canvas).toBe(opposite.expectedCanvas);
      expect(opposite.body).toBe(opposite.expectedBody);
      expect(opposite.canvas).toBe(matching.canvas);
      expect(opposite.body).toBe(matching.body);
      await oppositeContext.close();
      await matchingContext.close();
    }
  });

  test('explicit light wins over dark OS and explicit dark wins over light OS', async ({
    browser,
  }) => {
    for (const choice of ['light', 'dark'] as const) {
      const oppositeContext = await browser.newContext({
        colorScheme: choice === 'light' ? 'dark' : 'light',
      });
      const matchingContext = await browser.newContext({ colorScheme: choice });
      const page = await oppositeContext.newPage();
      const matchingPage = await matchingContext.newPage();
      for (const editor of editorRoutes) {
        await openEditor(page, editor.route, `&theme=${choice}`);
        const state = await tokenState(page, editor.selector, choice);
        await openEditor(matchingPage, editor.route, `&theme=${choice}`);
        const matchingState = await tokenState(matchingPage, editor.selector, choice);
        expect(state.attribute, editor.name).toBe(choice);
        expect(state.colorScheme, editor.name).toBe('');
        expect(state.semanticSurface, editor.name).not.toBe('');
        expect(state.semanticText, editor.name).not.toBe('');
        expect(state.semanticSurface, `${editor.name} expected ${choice} surface`).toBe(
          state.expectedSurface,
        );
        expect(state.semanticText, `${editor.name} expected ${choice} text`).toBe(
          state.expectedText,
        );
        expect(state.visibleSurface, editor.name).not.toBe('rgba(0, 0, 0, 0)');
        expect(state.visibleText, editor.name).not.toBe('');
        expect(state.probeSurface, `${editor.name} probe surface`).not.toBe('rgba(0, 0, 0, 0)');
        expect(state.probeText, `${editor.name} probe text`).not.toBe('');
        expect(state.semanticSurface, `${editor.name} cross-OS surface`).toBe(
          matchingState.semanticSurface,
        );
        expect(state.semanticText, `${editor.name} cross-OS text`).toBe(matchingState.semanticText);
        expect(state.visibleSurface, `${editor.name} cross-OS visible surface`).toBe(
          matchingState.visibleSurface,
        );
        expect(state.visibleText, `${editor.name} cross-OS visible text`).toBe(
          matchingState.visibleText,
        );
        const previous = explicitStates.get(editor.name);
        if (previous !== undefined) {
          expect(state.semanticSurface, `${editor.name} light/dark surface`).not.toBe(
            previous.surface,
          );
          expect(state.semanticText, `${editor.name} light/dark text`).not.toBe(previous.text);
        }
        explicitStates.set(editor.name, {
          surface: state.semanticSurface,
          text: state.semanticText,
        });
      }
      await openEditor(page, '/page/markdown-editor', `&theme=${choice}`);
      const modeGroup = page
        .locator('#example-mount-basic')
        .getByRole('radiogroup', { name: 'Editor mode' });
      await expect(modeGroup).toBeVisible();
      for (const mode of [
        { label: 'Raw Markdown', name: 'Source' },
        { label: 'Rich editor', name: 'Rich' },
      ] as const) {
        await modeGroup.getByRole('radio', { name: mode.label, exact: true }).click();
        const modeState = await tokenState(page, '.markdown-editor-wrapper', choice);
        expect(modeState.attribute, `MarkdownEditor ${mode.name}`).toBe(choice);
        expect(modeState.semanticSurface, `MarkdownEditor ${mode.name}`).not.toBe('');
        expect(modeState.semanticText, `MarkdownEditor ${mode.name}`).not.toBe('');
        expect(
          modeState.semanticSurface,
          `MarkdownEditor ${mode.name} expected ${choice} surface`,
        ).toBe(modeState.expectedSurface);
        expect(modeState.semanticText, `MarkdownEditor ${mode.name} expected ${choice} text`).toBe(
          modeState.expectedText,
        );
        expect(modeState.visibleSurface, `MarkdownEditor ${mode.name}`).not.toBe(
          'rgba(0, 0, 0, 0)',
        );
        expect(modeState.visibleText, `MarkdownEditor ${mode.name}`).not.toBe('');
        const inner =
          mode.name === 'Source'
            ? page.locator('#example-mount-basic textarea.markdown-editor.source-mode')
            : page.locator('#example-mount-basic .markdown-editor-wrapper .ProseMirror');
        await expect(inner, `MarkdownEditor ${mode.name} inner surface`).toBeVisible();
        const innerState = await inner.evaluate((element) => {
          const style = getComputedStyle(element);
          return { background: style.backgroundColor, color: style.color };
        });
        expect(innerState.color, `MarkdownEditor ${mode.name} inner text`).not.toBe('');
        await assertMeasuredContrast(
          page,
          `#example-mount-basic ${
            mode.name === 'Source'
              ? 'textarea.markdown-editor.source-mode'
              : '.markdown-editor-wrapper .ProseMirror'
          }`,
          `MarkdownEditor ${mode.name} effective contrast`,
        );
      }
      await oppositeContext.close();
      await matchingContext.close();
    }
  });

  test('URL choice wins over stored choice through prepaint and hydration', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('cinder-playground-theme', 'dark'));
    let interceptionStarted = false;
    let releaseRequests = false;
    let activeHandlers = 0;
    let resolveDrained: (() => void) | undefined;
    const drained = new Promise<void>((resolve) => {
      resolveDrained = resolve;
    });
    const heldRequests = new Set<() => void>();
    const holdHydrationScript = async (route: import('@playwright/test').Route): Promise<void> => {
      activeHandlers += 1;
      interceptionStarted = true;
      try {
        if (!releaseRequests) {
          await new Promise<void>((resolve) => heldRequests.add(resolve));
        }
        await route.continue();
      } finally {
        activeHandlers -= 1;
        if (releaseRequests && activeHandlers === 0) resolveDrained?.();
      }
    };
    await page.route('**/*.js', holdHydrationScript);
    try {
      await page.goto('/page/markdown-editor?snapshot=1&theme=light', { waitUntil: 'commit' });
      // The route holds hydration scripts after the parser executes the inline
      // pre-paint script, so this observes the actual pre-hydration DOM state.
      await expect.poll(() => interceptionStarted).toBe(true);
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
      await expect(page.locator('html')).toHaveAttribute('data-cinder-theme', 'light');
    } finally {
      releaseRequests = true;
      heldRequests.forEach((release) => release());
      heldRequests.clear();
      if (activeHandlers > 0) await drained;
      await page.unroute('**/*.js');
    }
    await page.waitForLoadState('load');
    await expect(page.locator('[data-component-page]')).toBeVisible();
    const state = await tokenState(page, '.markdown-editor-wrapper', 'light');
    expect(state.attribute).toBe('light');
    expect(state.semanticSurface).not.toBe('');
    expect(state.semanticText).not.toBe('');
    expect(state.semanticSurface).toBe(state.expectedSurface);
    expect(state.semanticText).toBe(state.expectedText);
  });

  test('explicit choice transitions to system mode and follows both OS transitions', async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/page/source-diff-viewer?theme=dark', { waitUntil: 'load' });
    await expect(page.locator('[data-component-page]')).toBeVisible();
    await expect(page.locator('#example-mount-basic')).toBeVisible();
    expect(await page.locator('html').getAttribute('data-theme')).toBe('dark');
    await page.evaluate(() => localStorage.removeItem('cinder-playground-theme'));
    await page.goto('/page/source-diff-viewer', { waitUntil: 'load' });
    await expect(page.getByRole('button', { name: 'Preview theme: switch to dark' })).toBeVisible();
    const light = await tokenState(page, '.cinder-source-diff-viewer', 'light');
    expect(light.attribute).toBeNull();
    expect(light.colorScheme).toBe('');
    expect(light.semanticSurface).not.toBe('');
    expect(light.semanticText).not.toBe('');
    expect(light.semanticSurface).toBe(light.expectedSurface);
    expect(light.semanticText).toBe(light.expectedText);
    const lightCanvas = await page
      .locator('.dx')
      .evaluate((element) => getComputedStyle(element).backgroundColor);

    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(
      page.getByRole('button', { name: 'Preview theme: switch to light' }),
    ).toBeVisible();
    const dark = await tokenState(page, '.cinder-source-diff-viewer', 'dark');
    expect(dark.attribute).toBeNull();
    expect(dark.colorScheme).toBe('');
    expect(dark.semanticSurface).toBe(dark.expectedSurface);
    expect(dark.semanticText).toBe(dark.expectedText);
    expect(dark.semanticSurface).not.toBe(light.semanticSurface);
    expect(dark.semanticText).not.toBe(light.semanticText);
    expect(dark.visibleSurface).not.toBe(light.visibleSurface);
    const darkCanvas = await page
      .locator('.dx')
      .evaluate((element) => getComputedStyle(element).backgroundColor);
    expect(darkCanvas).not.toBe(lightCanvas);

    await page.emulateMedia({ colorScheme: 'light' });
    await expect(page.getByRole('button', { name: 'Preview theme: switch to dark' })).toBeVisible();
    const lightAgain = await tokenState(page, '.cinder-source-diff-viewer', 'light');
    expect(lightAgain.attribute).toBeNull();
    expect(lightAgain.semanticSurface).toBe(lightAgain.expectedSurface);
    expect(lightAgain.semanticText).toBe(lightAgain.expectedText);
    expect(lightAgain.semanticSurface).toBe(light.semanticSurface);
    expect(lightAgain.semanticText).toBe(light.semanticText);
    await expect
      .poll(() =>
        page.locator('.dx').evaluate((element) => getComputedStyle(element).backgroundColor),
      )
      .toBe(lightCanvas);
  });

  test('ReviewEditor reaches Editor, Diff, and Summary with themed surfaces', async ({ page }) => {
    for (const theme of ['light', 'dark'] as const) {
      await openEditor(page, '/page/review-editor', `&theme=${theme}`);
      const editor = page.locator('#example-mount-basic');
      for (const view of ['Editor', 'Diff', 'Summary'] as const) {
        await editor.getByRole('tab', { name: view, exact: true }).click();
        const panel = editor.locator('[role="tabpanel"]:visible');
        await expect(panel).toBeVisible();
        const state = await tokenState(page, '[data-testid="review-editor"]', theme);
        expect(state.attribute).toBe(theme);
        expect(state.semanticSurface).not.toBe('');
        expect(state.semanticText).not.toBe('');
        expect(state.semanticSurface).toBe(state.expectedSurface);
        expect(state.semanticText).toBe(state.expectedText);
        expect(state.visibleSurface).not.toBe('rgba(0, 0, 0, 0)');
        const panelState = await panel.evaluate((element) => {
          const style = getComputedStyle(element);
          return { background: style.backgroundColor, color: style.color };
        });
        expect(panelState.color).not.toBe('');
        await assertMeasuredContrast(
          page,
          '#example-mount-basic [role="tabpanel"]',
          `${view} panel effective contrast`,
        );
      }
    }
  });
});
