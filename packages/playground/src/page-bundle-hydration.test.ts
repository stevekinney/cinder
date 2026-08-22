import { describe, expect, test } from 'bun:test';

describe('page bundle hydration policy', () => {
  test('starts hydration eagerly and never uses scrolling as the trigger', async () => {
    const source = await Bun.file(new URL('./page-bundle.ts', import.meta.url)).text();

    expect(source).not.toContain("window.addEventListener('scroll'");
    expect(source).toContain('void hydratePage().catch');
  });

  test('does not replay early interactions until the overview preview is interactive', async () => {
    const source = await Bun.file(new URL('./page-bundle.ts', import.meta.url)).text();
    const waitForPreview = source.indexOf('await overviewPreviewReady');
    const markPageHydrated = source.indexOf('pageHydrated = true', waitForPreview);

    expect(source).toContain('onOverviewPreviewSettled: () => resolveOverviewPreview?.()');
    expect(waitForPreview).toBeGreaterThan(-1);
    expect(markPageHydrated).toBeGreaterThan(waitForPreview);
  });

  test('re-resolves an early button against the interactive tree before replaying it', async () => {
    const source = await Bun.file(new URL('./page-bundle.ts', import.meta.url)).text();

    expect(source).toContain('const buttonLocation = elementLocation(button)');
    expect(source).toContain('const hydratedButton = resolveElementLocation(buttonLocation)');
    expect(source).not.toContain('hydrateAfter(event, () => button.click())');
  });

  test('re-resolves an early tab before replaying keyboard navigation', async () => {
    const source = await Bun.file(new URL('./page-bundle.ts', import.meta.url)).text();

    expect(source).toContain('resolveElementLocation(buttonLocation)?.dispatchEvent');
    expect(source).not.toContain('button.dispatchEvent');
  });

  test('re-resolves hash anchors before replaying activation', async () => {
    const source = await Bun.file(new URL('./page-bundle.ts', import.meta.url)).text();

    expect(source).toContain('const anchorLocation = elementLocation(anchor)');
    expect(source).toContain('const hydratedAnchor = resolveElementLocation(anchorLocation)');
    expect(source).not.toContain('hydrateAfter(event, () => anchor.click())');
  });

  test('preserves checked state and change semantics when replaying form input', async () => {
    const source = await Bun.file(new URL('./page-bundle.ts', import.meta.url)).text();

    expect(source).toContain("['checkbox', 'radio'].includes(input.type)");
    expect(source).toContain('hydratedInput.checked = checked');
    expect(source).toContain("new Event('change', { bubbles: true })");
  });

  test('replays select values and change semantics against the hydrated control', async () => {
    const source = await Bun.file(new URL('./page-bundle.ts', import.meta.url)).text();

    expect(source).toContain('input instanceof HTMLSelectElement');
    expect(source).toContain('hydratedInput instanceof HTMLSelectElement');
    expect(source).toContain('checked !== undefined || hydratedInput instanceof HTMLSelectElement');
  });

  test('reuses the rendered overview instead of embedding a duplicate HTML payload', async () => {
    const source = await Bun.file(new URL('./page-bundle.ts', import.meta.url)).text();

    expect(source).toContain(".querySelector<HTMLElement>('[data-overview-preview-rendered]')");
    expect(source).toContain('.innerHTML.replace(pageHtmlBlockMarker');
    expect(source).toContain(".replace(svelteHydrationMarker, '')");
    expect(source).not.toContain('__CINDER_OVERVIEW_EXAMPLE_HTML__');
  });
});
