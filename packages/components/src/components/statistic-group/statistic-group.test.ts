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
        /\.cinder-statistic-group\[data-cinder-variant='cards'\]\s*>\s*\.cinder-statistic-group__grid\s*>\s*\.cinder-statistic\s*\{[^}]*\}/,
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

    // The enabler is enumerated per fixed count rather than written as one
    // `:not():not()` rule, so it carries the same (0,6,0) specificity as the
    // row-end suppressors and source order decides. See the CSS comment.
    for (const columnCount of [2, 3, 4]) {
      const enabler = blockAfter(
        normalized,
        `[data-cinder-variant='default'][data-cinder-columns='${columnCount}'] > .cinder-statistic-group__grid > .cinder-statistic:not(:last-child)`,
      );
      expect(enabler, `columns=${columnCount} enabler`).toBeDefined();
      expect(enabler).toContain('border-inline-end: 1px solid var(--cinder-border-muted)');
    }

    // Row ends, one rule per fixed count.
    for (const columnCount of [2, 3, 4]) {
      expect(normalized).toContain(
        `[data-cinder-columns='${columnCount}'] > .cinder-statistic-group__grid > .cinder-statistic:nth-child(${columnCount}n)`,
      );
    }
  });

  test('divider rules mirror the layout collapse thresholds', async () => {
    const css = await Bun.file(new URL('./statistic-group.css', import.meta.url)).text();

    // The layout's collapse rules (30rem -> two tracks, 18rem -> one) fire because the
    // root, not the grid, is the query container. The dividers must describe the
    // grid that actually renders, so they mirror those exact thresholds: under 30rem a
    // declared 3 or 4 suppresses every 2nd cell; under 18rem every fixed count flips to
    // horizontal dividers. An earlier revision could not do this because the collapse
    // never fired for a standalone group and the dividers were kept width-blind.
    const sectionStart = css.indexOf('default-variant dividers');
    const sectionEnd = css.indexOf('variant: cards');
    expect(sectionStart).toBeGreaterThan(-1);
    expect(sectionEnd).toBeGreaterThan(sectionStart);
    const dividers = normalizeCss(css.slice(sectionStart, sectionEnd));

    expect(dividers).toContain('@container cinder-statistic-group (max-width: 30rem)');
    expect(dividers).toContain('@container cinder-statistic-group (max-width: 18rem)');
    // Two-track band: 3 and 4 suppress every 2nd cell.
    for (const columnCount of [3, 4]) {
      expect(dividers).toContain(
        `[data-cinder-columns='${columnCount}'] > .cinder-statistic-group__grid > .cinder-statistic:nth-child(2n)`,
      );
    }
    // One-track band: the inline divider is removed and a block divider takes over.
    const oneTrack = dividers.slice(dividers.indexOf('(max-width: 18rem)'));
    expect(oneTrack).toContain('border-inline-end: none');
    expect(oneTrack).toContain('border-block-end: 1px solid var(--cinder-border-muted)');
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
      "[data-cinder-columns='auto'] > .cinder-statistic-group__grid > .cinder-statistic:not(:last-child)",
    );
  });

  test('divider bands follow the declared-layout rules in source order', async () => {
    const css = await Bun.file(new URL('./statistic-group.css', import.meta.url)).text();
    const normalized = normalizeCss(css);

    // ORDER IS LOAD-BEARING. Every divider rule is (0,6,0), so the cascade is
    // decided purely by source position: each fixed count's enabler must precede its
    // row-end suppressor, the two-track band must follow all declared-layout rules,
    // and the one-track band must follow the two-track band.
    // `from` matters: the same `@container … (max-width: 30rem)` header opens the
    // LAYOUT collapse block near the top of the file, so a band must be looked for
    // after the divider rules it is supposed to follow, not from the start.
    const at = (needle: string, from = 0): number => {
      const index = normalized.indexOf(needle, from);
      expect(index, `expected divider rule after ${from}: ${needle}`).toBeGreaterThan(-1);
      return index;
    };
    for (const columnCount of [2, 3, 4]) {
      const enabler = at(
        `[data-cinder-variant='default'][data-cinder-columns='${columnCount}'] > .cinder-statistic-group__grid > .cinder-statistic:not(:last-child)`,
      );
      const rowEnd = at(
        `[data-cinder-columns='${columnCount}'] > .cinder-statistic-group__grid > .cinder-statistic:nth-child(${columnCount}n)`,
      );
      expect(rowEnd).toBeGreaterThan(enabler);
    }
    const lastDeclaredRule = at(
      "[data-cinder-variant='default'][data-cinder-columns='1'] > .cinder-statistic-group__grid > .cinder-statistic:not(:last-child)",
    );
    const twoTrackBand = at(
      '@container cinder-statistic-group (max-width: 30rem)',
      lastDeclaredRule,
    );
    const oneTrackBand = at('@container cinder-statistic-group (max-width: 18rem)', twoTrackBand);
    expect(twoTrackBand).toBeGreaterThan(lastDeclaredRule);
    expect(oneTrackBand).toBeGreaterThan(twoTrackBand);
  });

  test('the public root is the query container and the cells render in an inner grid', async () => {
    // An element can never query itself, so the collapse rules need an ancestor
    // container. That ancestor is the ROOT -- the element that receives `class`,
    // `style`, and `...rest` -- not an extra wrapper above it, so a consumer that
    // constrains the group's inline size constrains exactly what the queries
    // measure (the P1 on cinder#1501).
    const { container } = render(StatisticGroup, {
      children: textSnippet('stat content'),
      class: 'consumer-sizing',
    });
    const root = container.querySelector<HTMLElement>('.cinder-statistic-group');
    expect(root).not.toBeNull();
    expect(container.firstElementChild).toBe(root);
    expect(root?.classList.contains('consumer-sizing')).toBe(true);
    const grid = root?.firstElementChild;
    expect(grid?.classList.contains('cinder-statistic-group__grid')).toBe(true);
    expect(grid?.textContent).toContain('stat content');
    expect(container.querySelector('.cinder-statistic-group__container')).toBeNull();

    const css = await Bun.file(new URL('./statistic-group.css', import.meta.url)).text();
    expect(css).toMatch(
      /\.cinder-statistic-group\s*\{[^}]*container-type:\s*inline-size;[^}]*container-name:\s*cinder-statistic-group;/,
    );
    expect(css).not.toMatch(/\.cinder-statistic-group__grid\s*\{[^}]*container-type/);
    expect(css).toMatch(/\.cinder-statistic-group__grid\s*\{[^}]*display:\s*grid;/);
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
      /\.cinder-statistic-group\[data-cinder-columns='auto'\]\s*>\s*\.cinder-statistic-group__grid\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(min\(16rem,\s*100%\),\s*1fr\)\);/,
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
