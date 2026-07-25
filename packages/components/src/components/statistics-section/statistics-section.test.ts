/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

// setupHappyDom() MUST run before any `@testing-library/svelte` import. testing-library
// reads `globalThis.document` / `window` at module-init (top-level, not inside test bodies),
// so we register happy-dom's globals first and then dynamic-import testing-library below.
setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: StatisticsSection } = await import('./statistics-section.svelte');
const { createRawSnippet } = await import('svelte');
const runtimePatchSnippet = createRawSnippet(() => ({
  render: () => '<span></span>',
  setup: () => {},
}));
void runtimePatchSnippet;

const stats = [
  { label: 'Uptime', value: '99.99%' },
  { label: 'Deploys', value: 240, changeValue: '+12%', changeDirection: 'up' as const },
];

describe('StatisticsSection', () => {
  test('renders title and stat entries', () => {
    const { container } = render(StatisticsSection, {
      props: {
        title: 'Outcomes that matter',
        stats,
      },
    });

    const element = container.querySelector('.cinder-statistics-section');
    expect(element).not.toBeNull();
    expect(container.querySelector('.cinder-statistics-section__title')?.textContent).toContain(
      'Outcomes that matter',
    );
    expect(container.querySelectorAll('.cinder-statistic')).toHaveLength(2);
    expect(container.querySelector('.cinder-statistic__label')?.textContent).toContain('Uptime');
  });

  test('forwards columns and variant to stat group', () => {
    const { container } = render(StatisticsSection, {
      props: {
        stats,
        columns: 2,
        variant: 'shared-borders',
      },
    });
    const group = container.querySelector('.cinder-statistic-group');
    expect(group?.getAttribute('data-cinder-columns')).toBe('2');
    expect(group?.getAttribute('data-cinder-variant')).toBe('shared-borders');
  });

  test('merges custom class alongside root class', () => {
    const { container } = render(StatisticsSection, {
      props: {
        stats,
        class: 'my-custom-class',
      },
    });
    const element = container.querySelector('.cinder-statistics-section');
    expect(element?.classList.contains('cinder-statistics-section')).toBe(true);
    expect(element?.classList.contains('my-custom-class')).toBe(true);
  });
});
