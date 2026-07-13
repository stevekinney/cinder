/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { cleanup, render } = await import('@testing-library/svelte');

afterEach(() => cleanup());
const { default: StatGroup } = await import('./stat-group.svelte');
const { default: statGroupVariables } = await import('./stat-group.variables.ts');
const { createRawSnippet } = await import('svelte');

function textSnippet(text: string) {
  return createRawSnippet(() => ({
    render: () => `<span>${text}</span>`,
  }));
}

describe('StatGroup', () => {
  test('renders .cinder-stat-group wrapping its children', () => {
    const { container } = render(StatGroup, {
      children: textSnippet('stat content'),
    });
    const root = container.querySelector('.cinder-stat-group');
    expect(root).not.toBeNull();
    expect(root?.textContent).toContain('stat content');
  });

  test.each([1, 2, 3, 4, 'auto'] as const)(
    'columns=%s drives data-cinder-columns attribute',
    (columns) => {
      const { container } = render(StatGroup, {
        children: textSnippet('x'),
        columns,
      });
      const root = container.querySelector('.cinder-stat-group');
      expect(root?.getAttribute('data-cinder-columns')).toBe(String(columns));
    },
  );

  test.each(['default', 'cards', 'shared-borders'] as const)(
    'variant="%s" drives data-cinder-variant attribute',
    (variant) => {
      const { container } = render(StatGroup, {
        children: textSnippet('x'),
        variant,
      });
      const root = container.querySelector('.cinder-stat-group');
      expect(root?.getAttribute('data-cinder-variant')).toBe(variant);
    },
  );

  test('defaults: omitting columns and variant produces data-cinder-columns="auto" and data-cinder-variant="default"', () => {
    const { container } = render(StatGroup, {
      children: textSnippet('x'),
    });
    const root = container.querySelector('.cinder-stat-group');
    expect(root?.getAttribute('data-cinder-columns')).toBe('auto');
    expect(root?.getAttribute('data-cinder-variant')).toBe('default');
  });

  test('label prop gives the group an accessible group name', () => {
    const { container } = render(StatGroup, {
      children: textSnippet('x'),
      label: 'Dashboard metrics',
    });
    const root = container.querySelector('.cinder-stat-group');
    expect(root?.getAttribute('role')).toBe('group');
    expect(root?.getAttribute('aria-label')).toBe('Dashboard metrics');
  });

  test('omitting label does not force group semantics', () => {
    const { container } = render(StatGroup, {
      children: textSnippet('x'),
    });
    const root = container.querySelector('.cinder-stat-group');
    expect(root?.hasAttribute('role')).toBe(false);
    expect(root?.hasAttribute('aria-label')).toBe(false);
  });

  test('class prop is merged with cinder-stat-group on the root', () => {
    const { container } = render(StatGroup, {
      children: textSnippet('x'),
      class: 'custom',
    });
    const root = container.querySelector('.cinder-stat-group');
    expect(root?.getAttribute('class')).toContain('cinder-stat-group');
    expect(root?.getAttribute('class')).toContain('custom');
  });

  test('consumer data-cinder-variant does not override prop-driven value', () => {
    const { container } = render(StatGroup, {
      children: textSnippet('x'),
      variant: 'cards',
      'data-cinder-variant': 'bogus',
    });
    const root = container.querySelector('.cinder-stat-group');
    expect(root?.getAttribute('data-cinder-variant')).toBe('cards');
  });

  test('consumer data-cinder-columns does not override prop-driven value', () => {
    const { container } = render(StatGroup, {
      children: textSnippet('x'),
      columns: 3,
      'data-cinder-columns': 'bogus',
    });
    const root = container.querySelector('.cinder-stat-group');
    expect(root?.getAttribute('data-cinder-columns')).toBe('3');
  });

  test('benign rest props are forwarded to the root element', () => {
    const { container } = render(StatGroup, {
      children: textSnippet('x'),
      'data-testid': 'stat-group',
      id: 'my-group',
    });
    const root = container.querySelector('.cinder-stat-group');
    expect(root?.getAttribute('data-testid')).toBe('stat-group');
    expect(root?.getAttribute('id')).toBe('my-group');
  });

  test('auto columns use a readable track floor to avoid orphaned dashboard rows', async () => {
    const css = await Bun.file(new URL('./stat-group.css', import.meta.url)).text();

    expect(css).toMatch(
      /\.cinder-stat-group\[data-cinder-columns='auto'\]\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(min\(16rem,\s*100%\),\s*1fr\)\);/,
    );
  });

  test('public CSS variables cover compact group spacing and tile padding', async () => {
    expect(statGroupVariables).toEqual([
      '--cinder-stat-group-card-padding',
      '--cinder-stat-group-gap',
      '--cinder-stat-group-shared-cell-padding',
    ]);

    const css = await Bun.file(new URL('./stat-group.css', import.meta.url)).text();
    expect(css).toContain('gap: var(--cinder-stat-group-gap,');
    expect(css).toContain('padding: var(--cinder-stat-group-card-padding,');
    expect(css).toContain('padding: var(--cinder-stat-group-shared-cell-padding,');
    expect(css).toContain('--cinder-stat-group-gap: 1px;');
    expect(css).not.toMatch(/(^|\n)\s*gap:\s*1px;/);
  });
});
