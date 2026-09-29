/// <reference lib="dom" />
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { parse, type ChildNode, type Declaration } from 'postcss';

import { requiredInstance, setupHappyDom } from '@lostgradient/testing';

setupHappyDom();

const { render, fireEvent } = await import('@testing-library/svelte');
const { createRawSnippet, mount, unmount } = await import('svelte');
const { default: RadioGroup } = await import('./radio-group.svelte');
const { default: Radio } = await import('../_radio/radio.svelte');

/**
 * RadioGroup uses Svelte context, so we need to render a parent that contains
 * actual Radio children. testing-library/svelte handles snippet props well, so
 * we render a small wrapper component inline via `createRawSnippet` that mounts
 * Radios directly.
 *
 * Since createRawSnippet renders pre-built HTML strings, we instead use Svelte's
 * mount() API directly with a wrapper component composed via JSX-like API in a
 * .svelte.ts test fixture.
 */

// Dedicated test fixture (under-test-only) that wires RadioGroup with N Radio
// children. Kept under src/test/fixtures so the convention test and exports
// drift test don't consider it a public component.
const { default: Wrapper } = await import('../../test/fixtures/radio-group-fixture.svelte');

describe('RadioGroup', () => {
  test('renders a fieldset with the given legend', () => {
    const { container } = render(Wrapper, {
      label: 'Pick one',
      name: 'choice',
      value: 'a',
      options: [
        { id: 'r-a', value: 'a', label: 'A' },
        { id: 'r-b', value: 'b', label: 'B' },
      ],
    });
    expect(container.querySelector('fieldset')).not.toBeNull();
    expect(container.querySelector('legend')?.textContent?.trim()).toBe('Pick one');
  });

  test('renders one radio input per option, sharing a name', () => {
    const { container } = render(Wrapper, {
      name: 'choice',
      value: 'a',
      options: [
        { id: 'r-a', value: 'a', label: 'A' },
        { id: 'r-b', value: 'b', label: 'B' },
      ],
    });
    const radios = Array.from(container.querySelectorAll('input[type="radio"]'));
    expect(radios.length).toBe(2);
    expect(radios[0]?.getAttribute('name')).toBe('choice');
    expect(radios[1]?.getAttribute('name')).toBe('choice');
  });

  test('only the radio matching value is checked', () => {
    const { container } = render(Wrapper, {
      name: 'choice',
      value: 'b',
      options: [
        { id: 'r-a', value: 'a', label: 'A' },
        { id: 'r-b', value: 'b', label: 'B' },
      ],
    });
    const a = requiredInstance(container.querySelector('#r-a'), HTMLInputElement);
    const b = requiredInstance(container.querySelector('#r-b'), HTMLInputElement);
    expect(a.checked).toBe(false);
    expect(b.checked).toBe(true);
  });

  test('clicking a radio updates the bound value', async () => {
    const { container } = render(Wrapper, {
      name: 'choice',
      value: 'a',
      options: [
        { id: 'r-a', value: 'a', label: 'A' },
        { id: 'r-b', value: 'b', label: 'B' },
      ],
    });
    const a = requiredInstance(container.querySelector('#r-a'), HTMLInputElement);
    const b = requiredInstance(container.querySelector('#r-b'), HTMLInputElement);
    expect(a.checked).toBe(true);

    await fireEvent.click(b);
    expect(b.checked).toBe(true);
    expect(a.checked).toBe(false);
  });

  test('disabled at the group level disables every radio', () => {
    const { container } = render(Wrapper, {
      name: 'choice',
      value: 'a',
      disabled: true,
      options: [
        { id: 'r-a', value: 'a', label: 'A' },
        { id: 'r-b', value: 'b', label: 'B' },
      ],
    });
    const a = requiredInstance(container.querySelector('#r-a'), HTMLInputElement);
    const b = requiredInstance(container.querySelector('#r-b'), HTMLInputElement);
    expect(a.disabled).toBe(true);
    expect(b.disabled).toBe(true);
  });

  test('error sets aria-invalid on each radio', () => {
    const { container } = render(Wrapper, {
      name: 'choice',
      value: 'a',
      error: 'Required',
      options: [
        { id: 'r-a', value: 'a', label: 'A' },
        { id: 'r-b', value: 'b', label: 'B' },
      ],
    });
    const radios = Array.from(container.querySelectorAll('input[type="radio"]'));
    expect(radios[0]?.getAttribute('aria-invalid')).toBe('true');
    expect(radios[1]?.getAttribute('aria-invalid')).toBe('true');
  });

  test('Radio outside RadioGroup throws a clear error', () => {
    let error: Error | null = null;
    try {
      const target = document.createElement('div');
      const instance = mount(Radio, {
        target,
        props: { id: 'r', value: 'x', label: 'X' },
      });
      unmount(instance);
    } catch (err) {
      error = err instanceof Error ? err : new Error(String(err));
    }
    expect(error).not.toBeNull();
    // Verify the throw comes from Svelte's context machinery (createContext missing_context),
    // not from an unrelated code path.
    expect(error?.message).toMatch(/missing_context/);
  });

  // Reference imports so tree-shaking doesn't drop them; they're used through
  // the Wrapper fixture above.
  test('imports are wired', () => {
    expect(typeof RadioGroup).toBe('function');
    expect(typeof Radio).toBe('function');
    expect(typeof createRawSnippet).toBe('function');
  });

  // ── Per-option description ──────────────────────────────────────────────

  test('renders per-option description with id={id}-description', () => {
    const { container } = render(Wrapper, {
      name: 'choice',
      value: 'a',
      options: [
        { id: 'r-a', value: 'a', label: 'A', description: 'Helper text' },
        { id: 'r-b', value: 'b', label: 'B' },
      ],
    });
    const description = container.querySelector('p#r-a-description');
    expect(description).not.toBeNull();
    expect(description?.textContent?.trim()).toBe('Helper text');
    // Option without description should not render a description element
    expect(container.querySelector('p#r-b-description')).toBeNull();
  });

  test('wires aria-describedby to the description id', () => {
    const { container } = render(Wrapper, {
      name: 'choice',
      value: 'a',
      options: [{ id: 'r-a', value: 'a', label: 'A', description: 'Helper' }],
    });
    const input = requiredInstance(container.querySelector('#r-a'), HTMLInputElement);
    const describedBy = input.getAttribute('aria-describedby') ?? '';
    expect(describedBy.split(' ')).toContain('r-a-description');
  });

  test('aria-describedby is absent when there is no description and no consumer-supplied value', () => {
    const { container } = render(Wrapper, {
      name: 'choice',
      value: 'a',
      options: [{ id: 'r-a', value: 'a', label: 'A' }],
    });
    const input = requiredInstance(container.querySelector('#r-a'), HTMLInputElement);
    expect(input.hasAttribute('aria-describedby')).toBe(false);
  });

  test('aria-describedby contains only the consumer value when there is no description', () => {
    const { container } = render(Wrapper, {
      name: 'choice',
      value: 'a',
      options: [{ id: 'r-a', value: 'a', label: 'A', ariaDescribedBy: 'external-help' }],
    });
    const input = requiredInstance(container.querySelector('#r-a'), HTMLInputElement);
    const value = input.getAttribute('aria-describedby');
    expect(value).toBe('external-help');
    expect(value).not.toContain('r-a-description');
  });

  test('composes aria-describedby with consumer-supplied value', () => {
    const { container } = render(Wrapper, {
      name: 'choice',
      value: 'a',
      options: [
        { id: 'r-a', value: 'a', label: 'A', description: 'x', ariaDescribedBy: 'external-help' },
      ],
    });
    const input = requiredInstance(container.querySelector('#r-a'), HTMLInputElement);
    const parts = (input.getAttribute('aria-describedby') ?? '').split(' ');
    expect(parts).toContain('r-a-description');
    expect(parts).toContain('external-help');
    // description id comes first, consumer second
    expect(parts.indexOf('r-a-description')).toBeLessThan(parts.indexOf('external-help'));
  });

  test('row carries the has-description modifier class when description is set', () => {
    const { container } = render(Wrapper, {
      name: 'choice',
      value: 'a',
      options: [{ id: 'r-a', value: 'a', label: 'A', description: 'Helper' }],
    });
    const row = requiredInstance(
      container.querySelector('#r-a')?.closest('.cinder-radio-row'),
      HTMLElement,
    );
    expect(row.classList.contains('cinder-radio-row--has-description')).toBe(true);
  });

  test('row omits the has-description modifier class when no description', () => {
    const { container } = render(Wrapper, {
      name: 'choice',
      value: 'a',
      options: [{ id: 'r-a', value: 'a', label: 'A' }],
    });
    const row = requiredInstance(
      container.querySelector('#r-a')?.closest('.cinder-radio-row'),
      HTMLElement,
    );
    expect(row.classList.contains('cinder-radio-row--has-description')).toBe(false);
  });

  // ── Card variant ────────────────────────────────────────────────────────

  test("variant='card' emits data-variant='card' on the fieldset", () => {
    const { container } = render(Wrapper, {
      name: 'choice',
      value: 'a',
      variant: 'card',
      options: [
        { id: 'r-a', value: 'a', label: 'A' },
        { id: 'r-b', value: 'b', label: 'B' },
      ],
    });
    const fieldset = container.querySelector('fieldset');
    expect(fieldset?.getAttribute('data-variant')).toBe('card');
  });

  test('variant defaults to omitting data-variant', () => {
    const { container } = render(Wrapper, {
      name: 'choice',
      value: 'a',
      options: [{ id: 'r-a', value: 'a', label: 'A' }],
    });
    const fieldset = container.querySelector('fieldset');
    expect(fieldset?.hasAttribute('data-variant')).toBe(false);
  });

  test('card variant DOM contract: fieldset[data-variant=card] > items > rows', () => {
    const { container } = render(Wrapper, {
      name: 'choice',
      value: 'a',
      variant: 'card',
      options: [
        { id: 'r-a', value: 'a', label: 'A' },
        { id: 'r-b', value: 'b', label: 'B' },
      ],
    });
    const rows = container.querySelectorAll(
      "fieldset[data-variant='card'] .cinder-radio-group__items .cinder-radio-row",
    );
    expect(rows.length).toBe(2);
  });

  // ── Row modifier classes ────────────────────────────────────────────────

  test('the checked modifier class reflects the bound value', async () => {
    const { container } = render(Wrapper, {
      name: 'choice',
      value: 'b',
      options: [
        { id: 'r-a', value: 'a', label: 'A' },
        { id: 'r-b', value: 'b', label: 'B' },
      ],
    });
    const rowA = requiredInstance(
      container.querySelector('#r-a')?.closest('.cinder-radio-row'),
      HTMLElement,
    );
    const rowB = requiredInstance(
      container.querySelector('#r-b')?.closest('.cinder-radio-row'),
      HTMLElement,
    );
    expect(rowA.classList.contains('cinder-radio-row--checked')).toBe(false);
    expect(rowB.classList.contains('cinder-radio-row--checked')).toBe(true);

    await fireEvent.click(requiredInstance(container.querySelector('#r-a'), HTMLElement));
    expect(rowA.classList.contains('cinder-radio-row--checked')).toBe(true);
    expect(rowB.classList.contains('cinder-radio-row--checked')).toBe(false);
  });

  // ── aria-invalid + invalid modifier class ───────────────────────────────

  test('aria-invalid is exactly "true" when error is set', () => {
    const { container } = render(Wrapper, {
      name: 'choice',
      value: 'a',
      error: 'Required',
      options: [
        { id: 'r-a', value: 'a', label: 'A' },
        { id: 'r-b', value: 'b', label: 'B' },
      ],
    });
    const radios = Array.from(container.querySelectorAll('input[type="radio"]'));
    expect(radios[0]?.getAttribute('aria-invalid')).toBe('true');
    expect(radios[1]?.getAttribute('aria-invalid')).toBe('true');
  });

  test('the invalid modifier class is mirrored on each row when error is set', () => {
    const { container } = render(Wrapper, {
      name: 'choice',
      value: 'a',
      error: 'Required',
      options: [
        { id: 'r-a', value: 'a', label: 'A' },
        { id: 'r-b', value: 'b', label: 'B' },
      ],
    });
    const rows = Array.from(container.querySelectorAll('.cinder-radio-row'));
    expect(rows.length).toBe(2);
    rows.forEach((row) =>
      expect(
        requiredInstance(row, HTMLElement).classList.contains('cinder-radio-row--invalid'),
      ).toBe(true),
    );

    // Without error, no row carries the invalid modifier class
    const { container: c2 } = render(Wrapper, {
      name: 'choice2',
      value: 'a',
      options: [{ id: 'r-c', value: 'a', label: 'A' }],
    });
    const cleanRows = Array.from(c2.querySelectorAll('.cinder-radio-row'));
    cleanRows.forEach((row) =>
      expect(
        requiredInstance(row, HTMLElement).classList.contains('cinder-radio-row--invalid'),
      ).toBe(false),
    );
  });

  // ── disabled modifier class ─────────────────────────────────────────────

  test('the disabled modifier class is mirrored on disabled rows', async () => {
    // Group-level disabled: every row carries the disabled modifier class
    const { container: c1 } = render(Wrapper, {
      name: 'choice',
      value: 'a',
      disabled: true,
      options: [
        { id: 'r-a', value: 'a', label: 'A' },
        { id: 'r-b', value: 'b', label: 'B' },
      ],
    });
    const rows1 = Array.from(c1.querySelectorAll('.cinder-radio-row'));
    rows1.forEach((row) =>
      expect(
        requiredInstance(row, HTMLElement).classList.contains('cinder-radio-row--disabled'),
      ).toBe(true),
    );

    // Only one option disabled: only that row carries the disabled modifier class
    const { container: c2 } = render(Wrapper, {
      name: 'choice2',
      value: 'a',
      options: [
        { id: 'r-c', value: 'a', label: 'A', disabled: true },
        { id: 'r-d', value: 'b', label: 'B' },
      ],
    });
    const rowC = requiredInstance(
      c2.querySelector('#r-c')?.closest('.cinder-radio-row'),
      HTMLElement,
    );
    const rowD = requiredInstance(
      c2.querySelector('#r-d')?.closest('.cinder-radio-row'),
      HTMLElement,
    );
    expect(rowC.classList.contains('cinder-radio-row--disabled')).toBe(true);
    expect(rowD.classList.contains('cinder-radio-row--disabled')).toBe(false);

    // Fully enabled group: no row carries the disabled modifier class
    const { container: c3 } = render(Wrapper, {
      name: 'choice3',
      value: 'a',
      options: [
        { id: 'r-e', value: 'a', label: 'A' },
        { id: 'r-f', value: 'b', label: 'B' },
      ],
    });
    const rows3 = Array.from(c3.querySelectorAll('.cinder-radio-row'));
    rows3.forEach((row) =>
      expect(
        requiredInstance(row, HTMLElement).classList.contains('cinder-radio-row--disabled'),
      ).toBe(false),
    );
  });
  // ── required propagation ────────────────────────────────────────────────

  test('required=true sets the native required attribute on every radio input', () => {
    const { container } = render(Wrapper, {
      name: 'choice',
      value: 'a',
      required: true,
      options: [
        { id: 'r-a', value: 'a', label: 'A' },
        { id: 'r-b', value: 'b', label: 'B' },
      ],
    });
    const radios = Array.from(container.querySelectorAll<HTMLInputElement>('input[type="radio"]'));
    expect(radios.length).toBe(2);
    radios.forEach((radio) => {
      expect(radio.required).toBe(true);
    });
  });

  test('required=true sets aria-required="true" on the fieldset', () => {
    const { container } = render(Wrapper, {
      name: 'choice',
      value: 'a',
      required: true,
      options: [{ id: 'r-a', value: 'a', label: 'A' }],
    });
    const fieldset = container.querySelector('fieldset');
    expect(fieldset?.getAttribute('aria-required')).toBe('true');
  });

  test('required defaults to false — inputs lack the required attribute and fieldset lacks aria-required', () => {
    const { container } = render(Wrapper, {
      name: 'choice',
      value: 'a',
      options: [
        { id: 'r-a', value: 'a', label: 'A' },
        { id: 'r-b', value: 'b', label: 'B' },
      ],
    });
    const radios = Array.from(container.querySelectorAll<HTMLInputElement>('input[type="radio"]'));
    radios.forEach((radio) => {
      expect(radio.required).toBe(false);
    });
    const fieldset = container.querySelector('fieldset');
    expect(fieldset?.hasAttribute('aria-required')).toBe(false);
  });
});

describe('Radio indicator', () => {
  test('renders exactly one aria-hidden indicator per radio input', () => {
    const { container } = render(Wrapper, {
      name: 'ind-group',
      value: 'a',
      options: [
        { id: 'ind-a', value: 'a', label: 'A' },
        { id: 'ind-b', value: 'b', label: 'B' },
      ],
    });
    const inputs = container.querySelectorAll('input[type="radio"]');
    const indicators = container.querySelectorAll('.cinder-radio-row__indicator');
    expect(indicators.length).toBe(inputs.length);
    indicators.forEach((indicator) => {
      expect(indicator.getAttribute('aria-hidden')).toBe('true');
    });
    const controls = container.querySelectorAll('.cinder-radio-row__control');
    expect(controls.length).toBe(inputs.length);
    controls.forEach((control) => {
      expect(control.querySelector('input[type="radio"]')).not.toBeNull();
      expect(control.querySelector('.cinder-radio-row__indicator')).not.toBeNull();
    });
  });
});

// ---------------------------------------------------------------------------
// RadioGroup.Option namespace contract
//
// These tests import RadioGroup from the public index (not the internal .svelte
// path) to verify that the Object.assign namespace wiring actually exposes Option
// at the module level. The existing suite already verifies that Radio (= Option)
// renders correctly via the fixture; the tests here pin the namespace contract.
// ---------------------------------------------------------------------------
// Import from the public index to exercise the Object.assign export path.
// Must be at file level (like the other await imports above) because bun
// only supports top-level await at module scope, not inside describe callbacks.
const { default: RadioGroupPublic } = await import('./index.ts');

describe('RadioGroup.Option namespace (public API contract)', () => {
  test('RadioGroup.Option is a callable Svelte component via the namespace', () => {
    // Object.assign adds Option to the RadioGroup object; verify it is a
    // function (Svelte 5 components are functions) and is not undefined.
    expect(typeof RadioGroupPublic.Option).toBe('function');
  });

  test('RadioGroup.Option and the internal Radio component are the same reference', () => {
    // This pins the identity contract: importing via the public API must
    // return the same component as the direct .svelte import used in tests.
    expect(RadioGroupPublic.Option).toBe(Radio);
  });
});

describe('RadioGroup — missing-label dev warning', () => {
  let originalWarn: typeof console.warn;
  let warnings: string[];

  beforeEach(() => {
    originalWarn = console.warn;
    warnings = [];
    console.warn = (...args: unknown[]) => {
      warnings.push(args.join(' '));
    };
  });

  afterEach(() => {
    console.warn = originalWarn;
  });

  test('warns when label prop is omitted', () => {
    render(Wrapper, {
      name: 'choice',
      value: 'a',
      options: [{ id: 'r-a', value: 'a', label: 'A' }],
    });
    expect(warnings.some((w) => w.includes('[cinder/RadioGroup]'))).toBe(true);
    expect(warnings.some((w) => w.includes('label prop'))).toBe(true);
  });

  test('does not warn when label prop is provided', () => {
    render(Wrapper, {
      name: 'choice',
      value: 'a',
      label: 'Choose one',
      options: [{ id: 'r-a', value: 'a', label: 'A' }],
    });
    expect(warnings.some((w) => w.includes('[cinder/RadioGroup]'))).toBe(false);
  });
});

/**
 * Source-graph regressions for COR-452: the compound `.cinder-radio-row.cinder-form-field`
 * rule's `flex-direction: row` must reach a rendered row through BOTH ways
 * `@lostgradient/cinder`'s CSS is delivered — the full aggregated bundle
 * (`styles/all.css`) and the leaner per-component "sidecar" combination a
 * consumer imports when it wants only RadioGroup's styles — and the
 * described-row grid override (`.cinder-radio-row--has-description`) must
 * still win over it in both.
 *
 * Export targets: `components/cinder/package.json`'s `exports` map currently
 * declares only the root `.` entry (no `./styles/all` or `./<component>/styles`
 * subpaths exist in this workspace, unlike the standalone Cinder repo this
 * issue was written against), so there is nothing to resolve a subpath FROM.
 * The two graphs are instead resolved from the real files those aspirational
 * subpaths describe: `src/styles/all.css` (the all-styles aggregator that
 * every application actually imports) for the first graph, and
 * `src/styles/index.css` + `src/components/radio-group/radio-group.css` for
 * the second, per this ticket's own text ("the second starts at `./styles`
 * plus `./radio-group/styles`").
 *
 * `radio-group.css` does not itself `@import` `form-field/form-field.css`
 * the way sibling FormFieldFrame consumers do (input.css, setting-row.css,
 * time-field.css, date-picker.css, find-bar.css all do) — that is a separate,
 * pre-existing style-delivery gap this atomic fix does not touch (COR-452's
 * own scope excludes changing style delivery). The slim graph below therefore
 * also resolves `form-field/form-field.css` directly, as the third file a real
 * slim RadioGroup consumer needs today, rather than reaching it transitively.
 */
describe('RadioGroup — row-direction cascade (COR-452)', () => {
  const cinderSource = join(import.meta.dir, '..', '..');

  type FlatCssRule = { selector: string; declarations: string };

  function resolveCssImportTarget(fromFile: string, params: string): string | null {
    const match = params.match(/['"]([^'"]+)['"]/);
    if (!match?.[1]) return null;
    return join(dirname(fromFile), match[1]);
  }

  function flattenCssRules(file: string): FlatCssRule[] {
    const out: FlatCssRule[] = [];
    const root = parse(readFileSync(file, 'utf8'), { from: file });

    const walk = (nodes: ChildNode[]): void => {
      for (const node of nodes) {
        if (node.type === 'rule') {
          out.push({
            selector: node.selector.replace(/\s+/g, ' ').trim(),
            declarations: node.nodes
              .filter((child): child is Declaration => child.type === 'decl')
              .map((decl) => `${decl.prop}: ${decl.value}`)
              .join('; '),
          });
        } else if (node.type === 'atrule') {
          if (node.name === 'import') {
            const target = resolveCssImportTarget(file, node.params);
            if (target) out.push(...flattenCssRules(target));
          } else if (node.nodes) {
            walk(node.nodes);
          }
        }
      }
    };

    walk(root.nodes);
    return out;
  }

  /**
   * Asserts the three-rule invariant against an already-resolved, ordered
   * rule stream: the FormField column declaration exists, the RadioGroup
   * row-direction override exists AFTER it (source order is how the equal,
   * two-class specificity tie between `.cinder-radio-row.cinder-form-field`
   * and `.cinder-form-field` gets broken in this rule's favor), and the
   * described-row grid override is present (unconditionally — it wins on
   * `display` regardless of `flex-direction`, since a grid container ignores
   * that property, so its mere presence is what "preserved" means here).
   */
  function expectRowDirectionCascade(rules: FlatCssRule[]): void {
    const formFieldColumnIndex = rules.findIndex(
      (rule) =>
        rule.selector === '.cinder-form-field' &&
        /flex-direction:\s*column/.test(rule.declarations),
    );
    const rowDirectionIndex = rules.findIndex(
      (rule) =>
        rule.selector.includes('.cinder-radio-row.cinder-form-field') &&
        /flex-direction:\s*row/.test(rule.declarations),
    );
    const describedGridIndex = rules.findIndex(
      (rule) =>
        rule.selector.includes('cinder-radio-row--has-description') &&
        /display:\s*grid/.test(rule.declarations),
    );

    expect(formFieldColumnIndex).toBeGreaterThanOrEqual(0);
    expect(rowDirectionIndex).toBeGreaterThan(formFieldColumnIndex);
    expect(describedGridIndex).toBeGreaterThanOrEqual(0);
  }

  test('RadioGroup all-styles row direction', () => {
    const rules = flattenCssRules(join(cinderSource, 'styles/all.css'));
    expectRowDirectionCascade(rules);
  });

  test('RadioGroup slim-styles row direction', () => {
    const rules = [
      ...flattenCssRules(join(cinderSource, 'styles/index.css')),
      ...flattenCssRules(join(cinderSource, 'components/form-field/form-field.css')),
      ...flattenCssRules(join(cinderSource, 'components/radio-group/radio-group.css')),
    ];
    expectRowDirectionCascade(rules);
  });
});
