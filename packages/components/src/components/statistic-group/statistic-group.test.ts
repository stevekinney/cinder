/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { cleanup, render } = await import('@testing-library/svelte');

afterEach(() => cleanup());
const { default: StatisticGroup } = await import('./statistic-group.svelte');
const { default: statGroupVariables } = await import('./statistic-group.variables.ts');
const { createRawSnippet } = await import('svelte');

function textSnippet(text: string) {
  return createRawSnippet(() => ({
    render: () => `<span>${text}</span>`,
  }));
}

describe('StatisticGroup', () => {
  test('imports the Statistic leaf source for compound namespace composition', async () => {
    const source = await readFile(new URL('./index.ts', import.meta.url), 'utf8');
    expect(source).toContain("import Statistic from '../statistic/statistic.svelte';");
    expect(source).not.toContain("import Statistic from '../statistic/index.ts';");
  });

  test('aggregates Statistic styles in the parent CSS sidecar', async () => {
    const css = await Bun.file(new URL('./statistic-group.css', import.meta.url)).text();
    expect(css).toContain("@import '../statistic/statistic.css';");
  });

  test('cards use a full-strength outer border', async () => {
    const css = await Bun.file(new URL('./statistic-group.css', import.meta.url)).text();
    const cardsBlock =
      css.match(
        /\.cinder-statistic-group\[data-cinder-variant='cards'\]\s*>\s*\.cinder-statistic\s*\{[^}]*\}/,
      )?.[0] ?? '';

    expect(cardsBlock).toContain('border: 1px solid var(--cinder-border)');
    expect(cardsBlock).not.toContain('var(--cinder-border-muted)');
  });

  test('renders .cinder-statistic-group wrapping its children', () => {
    const { container } = render(StatisticGroup, {
      children: textSnippet('stat content'),
    });
    const root = container.querySelector('.cinder-statistic-group');
    expect(root).not.toBeNull();
    expect(root?.textContent).toContain('stat content');
  });

  test.each([1, 2, 3, 4, 'auto'] as const)(
    'columns=%s drives data-cinder-columns attribute',
    (columns) => {
      const { container } = render(StatisticGroup, {
        children: textSnippet('x'),
        columns,
      });
      const root = container.querySelector('.cinder-statistic-group');
      expect(root?.getAttribute('data-cinder-columns')).toBe(String(columns));
    },
  );

  test.each(['default', 'cards', 'shared-borders'] as const)(
    'variant="%s" drives data-cinder-variant attribute',
    (variant) => {
      const { container } = render(StatisticGroup, {
        children: textSnippet('x'),
        variant,
      });
      const root = container.querySelector('.cinder-statistic-group');
      expect(root?.getAttribute('data-cinder-variant')).toBe(variant);
    },
  );

  test('defaults: omitting columns and variant produces data-cinder-columns="auto" and data-cinder-variant="default"', () => {
    const { container } = render(StatisticGroup, {
      children: textSnippet('x'),
    });
    const root = container.querySelector('.cinder-statistic-group');
    expect(root?.getAttribute('data-cinder-columns')).toBe('auto');
    expect(root?.getAttribute('data-cinder-variant')).toBe('default');
  });

  test('label prop gives the group an accessible group name', () => {
    const { container } = render(StatisticGroup, {
      children: textSnippet('x'),
      label: 'Dashboard metrics',
    });
    const root = container.querySelector('.cinder-statistic-group');
    expect(root?.getAttribute('role')).toBe('group');
    expect(root?.getAttribute('aria-label')).toBe('Dashboard metrics');
  });

  test('omitting label does not force group semantics', () => {
    const { container } = render(StatisticGroup, {
      children: textSnippet('x'),
    });
    const root = container.querySelector('.cinder-statistic-group');
    expect(root?.hasAttribute('role')).toBe(false);
    expect(root?.hasAttribute('aria-label')).toBe(false);
  });

  test('class prop is merged with cinder-statistic-group on the root', () => {
    const { container } = render(StatisticGroup, {
      children: textSnippet('x'),
      class: 'custom',
    });
    const root = container.querySelector('.cinder-statistic-group');
    expect(root?.getAttribute('class')).toContain('cinder-statistic-group');
    expect(root?.getAttribute('class')).toContain('custom');
  });

  test('consumer data-cinder-variant does not override prop-driven value', () => {
    const { container } = render(StatisticGroup, {
      children: textSnippet('x'),
      variant: 'cards',
      'data-cinder-variant': 'bogus',
    });
    const root = container.querySelector('.cinder-statistic-group');
    expect(root?.getAttribute('data-cinder-variant')).toBe('cards');
  });

  test('consumer data-cinder-columns does not override prop-driven value', () => {
    const { container } = render(StatisticGroup, {
      children: textSnippet('x'),
      columns: 3,
      'data-cinder-columns': 'bogus',
    });
    const root = container.querySelector('.cinder-statistic-group');
    expect(root?.getAttribute('data-cinder-columns')).toBe('3');
  });

  test('benign rest props are forwarded to the root element', () => {
    const { container } = render(StatisticGroup, {
      children: textSnippet('x'),
      'data-testid': 'statistic-group',
      id: 'my-group',
    });
    const root = container.querySelector('.cinder-statistic-group');
    expect(root?.getAttribute('data-testid')).toBe('statistic-group');
    expect(root?.getAttribute('id')).toBe('my-group');
  });

  test('auto columns use a readable track floor to avoid orphaned dashboard rows', async () => {
    const css = await Bun.file(new URL('./statistic-group.css', import.meta.url)).text();

    expect(css).toMatch(
      /\.cinder-statistic-group\[data-cinder-columns='auto'\]\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(min\(16rem,\s*100%\),\s*1fr\)\);/,
    );
  });

  test('public CSS variables cover compact group spacing and tile padding', async () => {
    expect(statGroupVariables).toEqual([
      '--cinder-statistic-group-card-padding',
      '--cinder-statistic-group-gap',
      '--cinder-statistic-group-shared-cell-padding',
    ]);

    const css = await Bun.file(new URL('./statistic-group.css', import.meta.url)).text();
    expect(css).toContain('gap: var(--cinder-statistic-group-gap,');
    expect(css).toContain('padding: var(--cinder-statistic-group-card-padding,');
    expect(css).toContain('padding: var(--cinder-statistic-group-shared-cell-padding,');
    expect(css).toContain('--cinder-statistic-group-gap: 1px;');
    expect(css).not.toMatch(/(^|\n)\s*gap:\s*1px;/);
  });
});
