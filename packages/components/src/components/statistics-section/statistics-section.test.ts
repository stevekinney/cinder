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

  test('renders the custom element tag supplied via `as`', () => {
    const { container } = render(StatisticsSection, {
      props: {
        as: 'div',
        title: 'Outcomes that matter',
        stats,
      },
    });
    const element = container.querySelector('.cinder-statistics-section');
    expect(element?.tagName).toBe('DIV');
  });

  test('omits the header block entirely when no title is provided', () => {
    const { container } = render(StatisticsSection, {
      props: {
        stats,
      },
    });
    expect(container.querySelector('.cinder-statistics-section__header')).toBeNull();
  });

  test('renders the description alongside the title', () => {
    const { container } = render(StatisticsSection, {
      props: {
        title: 'Outcomes that matter',
        description: 'Tracked over the trailing 30 days.',
        stats,
      },
    });
    expect(container.querySelector('.cinder-statistics-section__description')?.textContent).toBe(
      'Tracked over the trailing 30 days.',
    );
  });

  test('renders the exact changeDescription text on a stat change indicator', () => {
    const { container } = render(StatisticsSection, {
      props: {
        title: 'Outcomes that matter',
        stats: [
          {
            label: 'Deploys',
            value: 240,
            changeValue: '+12%',
            changeDirection: 'up',
            changeDescription: 'vs. last quarter',
          },
        ],
      },
    });
    expect(container.querySelector('.cinder-statistic__change-description')?.textContent).toBe(
      'vs. last quarter',
    );
  });

  test('omits the change-description element entirely when changeDescription is not provided', () => {
    const { container } = render(StatisticsSection, {
      props: {
        title: 'Outcomes that matter',
        stats: [
          {
            label: 'Deploys',
            value: 240,
            changeValue: '+12%',
            changeDirection: 'up',
          },
        ],
      },
    });
    expect(container.querySelector('.cinder-statistic__change-description')).toBeNull();
  });

  test('title renders as the section heading text with no native title attribute on the root', () => {
    const { container } = render(StatisticsSection, {
      props: {
        title: 'Heading text',
        stats,
      },
    });
    expect(container.querySelector('.cinder-statistics-section__title')?.textContent).toBe(
      'Heading text',
    );
    expect(container.querySelector('.cinder-statistics-section')?.hasAttribute('title')).toBe(
      false,
    );
  });
});
