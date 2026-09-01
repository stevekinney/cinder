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
/**
 * Canonicalise selector whitespace so assertions survive the formatter.
 *
 * Prettier wraps a long selector across lines -- `:not(\n  [data-cinder-columns='auto']\n)`
 * -- and it does so at COMMIT time, after a local test run has already passed. Matching
 * the unwrapped single-line form therefore fails only in CI, which is exactly what
 * happened. Collapsing whitespace runs and closing up the space inside parentheses makes
 * every selector assertion below indifferent to how the file is wrapped, while leaving
 * declarations (`border-inline-end: 1px solid ...`) readable.
 */
function normalizeCss(css: string): string {
  return css.replace(/\s+/g, ' ').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')');
}

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

    // A divider belongs BETWEEN two adjacent cells, so a divider rule is only correct
    // where the effective column count is knowable. Single-column layouts get horizontal
    // dividers; fixed multi-column layouts get vertical ones with each row's last cell
    // suppressed.
    const normalized = normalizeCss(css);

    const singleColumnDividers = blockAfter(
      normalized,
      "[data-cinder-variant='default'][data-cinder-columns='1']",
    );
    expect(singleColumnDividers).toBeDefined();
    expect(singleColumnDividers).toContain(
      'border-block-end: 1px solid var(--cinder-border-muted)',
    );
    expect(singleColumnDividers).not.toContain('border-inline-end:');

    const fixedMultiColumn = blockAfter(
      normalized,
      "[data-cinder-variant='default']:not([data-cinder-columns='1']):not([data-cinder-columns='auto'])",
    );
    expect(fixedMultiColumn).toBeDefined();
    expect(fixedMultiColumn).toContain('border-inline-end: 1px solid var(--cinder-border-muted)');
    expect(fixedMultiColumn).not.toContain('border-block-end:');

    // Row ends, one rule per fixed count.
    for (const columnCount of [2, 3, 4]) {
      expect(normalized).toContain(
        `[data-cinder-columns='${columnCount}'] > .cinder-statistic:nth-child(${columnCount}n)`,
      );
    }
  });

  test('divider rules use no container queries', async () => {
    const css = await Bun.file(new URL('./statistic-group.css', import.meta.url)).text();

    // The layout's own collapse rules (30rem, 18rem) are inert: their subject is
    // `.cinder-statistic-group`, which IS the named query container, and an element is
    // never its own container -- a container query resolves against the nearest ANCESTOR
    // container. So a fixed `columns` count renders that many tracks at every width.
    //
    // The dividers must describe the grid that actually renders. An earlier revision
    // mirrored those thresholds and so flipped to horizontal dividers at narrow widths
    // while the grid still showed its full column count. With the thresholds gone,
    // `nth-child(Nn)` needs no width bands, and any reintroduced `@container` in this
    // section would be reintroducing the mismatch.
    // Assert the sentinels resolve before slicing between them. Unchecked, a renamed
    // marker gives indexOf -1, and the resulting slice is an unrelated fragment that
    // trivially contains no '@container' -- the guard would pass for the wrong reason,
    // which is the exact failure mode it exists to prevent.
    const sectionStart = css.indexOf('default-variant dividers');
    const sectionEnd = css.indexOf('variant: cards');
    expect(sectionStart).toBeGreaterThan(-1);
    expect(sectionEnd).toBeGreaterThan(sectionStart);

    const dividerSection = css.slice(sectionStart, sectionEnd);
    expect(dividerSection).not.toContain('@container');
  });

  test("columns='auto' carries no per-cell divider rules at any width", async () => {
    const css = await Bun.file(new URL('./statistic-group.css', import.meta.url)).text();

    // `repeat(auto-fit, ...)` renders however many 16rem tracks fit, with no upper
    // bound, and CSS cannot select "the last cell in a row" without knowing that count.
    // Enumerating width bands only moved the failure outward: a previous revision
    // covered twelve columns and justified the cap by claiming 203rem was past any real
    // display, which is false -- a 3520px region on a 4K display exceeds it.
    //
    // This test exists to stop the bands being reintroduced: every previous attempt
    // looked correct at the widths someone happened to check.
    const declarations = normalizeCss(css.replace(/\/\*[\s\S]*?\*\//g, ''));

    // Split on rule boundaries rather than newlines: the formatter decides where lines
    // break, so a line-based scan would pass or fail on wrapping rather than on content.
    const autoRules = declarations
      .split('}')
      .filter((rule) => rule.includes("[data-cinder-columns='auto']"));

    for (const rule of autoRules) {
      expect(rule).not.toContain(':nth-child(');
    }

    // And no rule may select an `auto` group's cells directly -- that is the shape every
    // reintroduced band would take.
    expect(declarations).not.toContain(
      "[data-cinder-columns='auto'] > .cinder-statistic:not(:last-child)",
    );
  });

  test('row-end and single-column resets follow the generic multi-column rule', async () => {
    const css = await Bun.file(new URL('./statistic-group.css', import.meta.url)).text();

    // Every divider rule carries the same specificity -- one class, one attribute, one
    // pseudo-class -- so source order alone decides the cascade. The resets that turn
    // `border-inline-end` OFF must come AFTER the generic rule that turns it on. When
    // they came first, that rule re-applied a vertical border underneath them and a
    // narrow group rendered BOTH dividers at once.
    //
    // Order is the entire fix, and nothing else here would catch a regression: both
    // orderings parse, and every content assertion above passes either way.
    const normalized = normalizeCss(css);
    const genericMultiColumn = normalized.indexOf(
      "[data-cinder-variant='default']:not([data-cinder-columns='1']):not([data-cinder-columns='auto'])",
    );
    const rowEndReset = normalized.indexOf(
      "[data-cinder-columns='2'] > .cinder-statistic:nth-child(2n)",
    );
    const lastChildReset = normalized.indexOf(
      "[data-cinder-variant='default'] > .cinder-statistic:last-child",
    );

    expect(genericMultiColumn).toBeGreaterThan(-1);
    expect(rowEndReset).toBeGreaterThan(-1);
    expect(lastChildReset).toBeGreaterThan(-1);
    expect(rowEndReset).toBeGreaterThan(genericMultiColumn);
    expect(lastChildReset).toBeGreaterThan(genericMultiColumn);
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
    expect(statGroupVariables).toEqual(['--cinder-statistic-group-gap']);

    const css = await Bun.file(new URL('./statistic-group.css', import.meta.url)).text();
    expect(css).toContain('gap: var(--cinder-statistic-group-gap,');
    expect(css).toContain('padding: var(--cinder-statistic-group-card-padding,');
    expect(css).toContain('padding: var(--cinder-statistic-group-shared-cell-padding,');
    expect(css).toContain('--cinder-statistic-group-gap: 1px;');
    expect(css).not.toMatch(/(^|\n)\s*gap:\s*1px;/);
  });
});
