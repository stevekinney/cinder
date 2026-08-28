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

/**
 * Extract the `{ ... }` block that follows `header`, matching braces rather than
 * assuming a particular indentation. An earlier version of these tests sliced
 * `@container` blocks with `/\n {2}\}/`, which silently matched nothing the moment
 * the formatter reflowed the file -- and a regex that matches nothing makes every
 * `toContain` on it fail loudly but for the wrong reason.
 */
function blockAfter(css: string, header: string, mustContain?: string): string | undefined {
  let searchFrom = 0;
  for (;;) {
    const start = css.indexOf(header, searchFrom);
    if (start === -1) return undefined;
    searchFrom = start + 1;
    const open = css.indexOf('{', start + header.length - 1);
    if (open === -1) return undefined;
    let depth = 0;
    for (let index = open; index < css.length; index += 1) {
      if (css[index] === '{') depth += 1;
      else if (css[index] === '}') {
        depth -= 1;
        if (depth === 0) {
          const block = css.slice(start, index + 1);
          // Several blocks can share a header -- the 18rem `@container` guards both the
          // layout collapse and the divider flip. `mustContain` picks the intended one by
          // content rather than by ordinal position or indentation.
          if (mustContain === undefined || block.includes(mustContain)) return block;
          break;
        }
      }
    }
  }
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

  test('default variant has an intentional resting surface', async () => {
    const css = await Bun.file(new URL('./statistic-group.css', import.meta.url)).text();
    const defaultBlock =
      css.match(/\.cinder-statistic-group\[data-cinder-variant='default'\]\s*\{[^}]*\}/)?.[0] ?? '';

    expect(defaultBlock).toContain('background: var(--cinder-surface-inset)');
    expect(defaultBlock).toContain('padding: var(--cinder-statistic-group-card-padding,');
  });

  test('default variant has a resting border and per-cell dividers', async () => {
    const css = await Bun.file(new URL('./statistic-group.css', import.meta.url)).text();
    const defaultBlock =
      css.match(/\.cinder-statistic-group\[data-cinder-variant='default'\]\s*\{[^}]*\}/)?.[0] ?? '';

    expect(defaultBlock).toContain('border: 1px solid var(--cinder-border)');

    // Divider direction follows the EFFECTIVE column count -- how many tracks the grid
    // actually renders at the current width -- not the `columns` prop alone and not a
    // standalone breakpoint. A single-column layout gets horizontal dividers; a
    // multi-column one gets vertical dividers, suppressed on each row's last cell.
    const singleColumnDividers = blockAfter(
      css,
      "[data-cinder-variant='default'][data-cinder-columns='1']",
    );
    expect(singleColumnDividers).toBeDefined();
    expect(singleColumnDividers).toContain(
      'border-block-end: 1px solid var(--cinder-border-muted)',
    );
    expect(singleColumnDividers).not.toContain('border-inline-end:');

    const multiColumnDividers = blockAfter(
      css,
      "[data-cinder-variant='default']:not([data-cinder-columns='1'])",
    );
    expect(multiColumnDividers).toBeDefined();
    expect(multiColumnDividers).toContain(
      'border-inline-end: 1px solid var(--cinder-border-muted)',
    );
    expect(multiColumnDividers).not.toContain('border-block-end:');

    // The fixed-count collapse threshold must match the LAYOUT rules (18rem), not the
    // 30rem an earlier version used -- between 18rem and 30rem a columns='2' group is
    // still two columns and must keep its vertical dividers.
    const collapsedDividers = blockAfter(
      css,
      '@container cinder-statistic-group (max-width: 18rem)',
      "[data-cinder-variant='default']",
    );
    expect(collapsedDividers).toBeDefined();
    expect(collapsedDividers).toContain('border-inline-end: none');
    expect(collapsedDividers).toContain('border-block-end: 1px solid var(--cinder-border-muted)');

    // `auto` is NOT covered by the 18rem rule: auto-fit keeps a single 16rem track until
    // the container can hold two of them plus the 1rem gap, at 33rem. Flipping it at
    // 18rem left an auto group between 18rem and 33rem single-column with vertical
    // dividers hanging off its cells.
    const autoSingleColumn = blockAfter(
      css,
      '@container cinder-statistic-group (max-width: 32.99rem)',
    );
    expect(autoSingleColumn).toBeDefined();
    expect(autoSingleColumn).toContain("[data-cinder-columns='auto']");
    expect(autoSingleColumn).toContain('border-block-end: 1px solid var(--cinder-border-muted)');

    // Row ends. In a multi-ROW grid the last cell of a row has no neighbour to its right,
    // so `:not(:last-child)` alone drew a divider off the grid's trailing edge. Each
    // effective count suppresses its own `nth-child(Nn)`.
    const twoColumnRowEnds = blockAfter(
      css,
      '@container cinder-statistic-group (min-width: 18.01rem) {',
    );
    expect(twoColumnRowEnds).toBeDefined();
    expect(twoColumnRowEnds).toContain(':nth-child(2n)');
    expect(twoColumnRowEnds).toContain('border-inline-end: none');

    const wideFixedRowEnds = blockAfter(
      css,
      '@container cinder-statistic-group (min-width: 30.01rem)',
    );
    expect(wideFixedRowEnds).toBeDefined();
    expect(wideFixedRowEnds).toContain(':nth-child(3n)');
    expect(wideFixedRowEnds).toContain(':nth-child(4n)');
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

  test('role prop is used as the ARIA role when label is absent', () => {
    const { container } = render(StatisticGroup, {
      children: textSnippet('x'),
      role: 'region',
    });
    const root = container.querySelector('.cinder-statistic-group');
    expect(root?.getAttribute('role')).toBe('region');
  });

  test('aria-label prop passes through when label is absent', () => {
    const { container } = render(StatisticGroup, {
      children: textSnippet('x'),
      'aria-label': 'Custom',
    });
    const root = container.querySelector('.cinder-statistic-group');
    expect(root?.getAttribute('aria-label')).toBe('Custom');
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
