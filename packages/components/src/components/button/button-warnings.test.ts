import { setupHappyDom } from '@lostgradient/testing';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
setupHappyDom();
const { cleanup, render } = await import('@testing-library/svelte');
const { default: ButtonWarningConsumer } = await import('./button-warning-consumer.test.svelte');
afterEach(cleanup);

const originalConsoleWarn = console.warn;
afterEach(() => {
  console.warn = originalConsoleWarn;
});
describe('Button dev warnings', () => {
  let warnMessages: string[] = [];

  beforeEach(() => {
    warnMessages = [];
    console.warn = (...args: unknown[]) => {
      warnMessages.push(args.join(' '));
    };
  });

  test('rechecks an icon-only accessible name when its label changes', async () => {
    const { rerender } = render(ButtonWarningConsumer, {
      props: { mode: 'changing-label', label: '' },
    });
    expect(warnMessages).toEqual([
      '[cinder/Button] iconOnly=true requires aria-label, aria-labelledby, or a non-empty label.',
    ]);

    warnMessages = [];
    await rerender({ mode: 'changing-label', label: 'Close' });
    expect(warnMessages).toHaveLength(0);

    await rerender({ mode: 'changing-label', label: '   ' });
    expect(warnMessages).toEqual([
      '[cinder/Button] iconOnly=true requires aria-label, aria-labelledby, or a non-empty label.',
    ]);
  });

  test('iconOnly=true with aria-label: no iconOnly name warning', () => {
    render(ButtonWarningConsumer, { props: { mode: 'icon-aria-label' } });
    const iconOnlyWarnings = warnMessages.filter((m) =>
      m.includes('iconOnly=true requires aria-label'),
    );
    expect(iconOnlyWarnings).toHaveLength(0);
  });

  test('iconOnly=true with label: no iconOnly name warning', () => {
    render(ButtonWarningConsumer, { props: { mode: 'icon-label' } });
    const iconOnlyWarnings = warnMessages.filter((m) =>
      m.includes('iconOnly=true requires aria-label'),
    );
    expect(iconOnlyWarnings).toHaveLength(0);
  });

  test('iconOnly=true with neither label nor aria-label: iconOnly name warning IS emitted', () => {
    render(ButtonWarningConsumer, { props: { mode: 'unnamed-icon' } });
    const iconOnlyWarnings = warnMessages.filter((m) =>
      m.includes('iconOnly=true requires aria-label'),
    );
    expect(iconOnlyWarnings.length).toBeGreaterThan(0);
  });

  test('iconOnly=true + aria-label + no visual icon: visible-icon warning IS emitted', () => {
    render(ButtonWarningConsumer, { props: { mode: 'icon-aria-label' } });
    const visualWarnings = warnMessages.filter((m) => m.includes('requires a visible icon'));
    expect(visualWarnings.length).toBeGreaterThan(0);
  });

  test('baseline guard: aria-label alone satisfies name requirement, no baseline warning', () => {
    render(ButtonWarningConsumer, { props: { mode: 'aria-label-only' } });
    const baselineWarnings = warnMessages.filter((m) =>
      m.includes('rendered without an accessible name'),
    );
    expect(baselineWarnings).toHaveLength(0);
  });
});
