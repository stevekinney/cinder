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
});
