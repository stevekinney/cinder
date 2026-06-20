/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

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
    const a = container.querySelector('#r-a') as HTMLInputElement;
    const b = container.querySelector('#r-b') as HTMLInputElement;
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
    const a = container.querySelector('#r-a') as HTMLInputElement;
    const b = container.querySelector('#r-b') as HTMLInputElement;
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
    const a = container.querySelector('#r-a') as HTMLInputElement;
    const b = container.querySelector('#r-b') as HTMLInputElement;
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
    const input = container.querySelector('#r-a') as HTMLInputElement;
    const describedBy = input.getAttribute('aria-describedby') ?? '';
    expect(describedBy.split(' ')).toContain('r-a-description');
  });

  test('aria-describedby is absent when there is no description and no consumer-supplied value', () => {
    const { container } = render(Wrapper, {
      name: 'choice',
      value: 'a',
      options: [{ id: 'r-a', value: 'a', label: 'A' }],
    });
    const input = container.querySelector('#r-a') as HTMLInputElement;
    expect(input.hasAttribute('aria-describedby')).toBe(false);
  });

  test('aria-describedby contains only the consumer value when there is no description', () => {
    const { container } = render(Wrapper, {
      name: 'choice',
      value: 'a',
      options: [{ id: 'r-a', value: 'a', label: 'A', ariaDescribedBy: 'external-help' }],
    });
    const input = container.querySelector('#r-a') as HTMLInputElement;
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
    const input = container.querySelector('#r-a') as HTMLInputElement;
    const parts = (input.getAttribute('aria-describedby') ?? '').split(' ');
    expect(parts).toContain('r-a-description');
    expect(parts).toContain('external-help');
    // description id comes first, consumer second
    expect(parts.indexOf('r-a-description')).toBeLessThan(parts.indexOf('external-help'));
  });

  test('row carries data-has-description when description is set', () => {
    const { container } = render(Wrapper, {
      name: 'choice',
      value: 'a',
      options: [{ id: 'r-a', value: 'a', label: 'A', description: 'Helper' }],
    });
    const row = container.querySelector('#r-a')?.closest('.cinder-radio-row') as HTMLElement;
    expect(row.hasAttribute('data-has-description')).toBe(true);
  });

  test('row omits data-has-description when no description', () => {
    const { container } = render(Wrapper, {
      name: 'choice',
      value: 'a',
      options: [{ id: 'r-a', value: 'a', label: 'A' }],
    });
    const row = container.querySelector('#r-a')?.closest('.cinder-radio-row') as HTMLElement;
    expect(row.hasAttribute('data-has-description')).toBe(false);
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

  // ── Row data attributes ─────────────────────────────────────────────────

  test('data-checked reflects the bound value', async () => {
    const { container } = render(Wrapper, {
      name: 'choice',
      value: 'b',
      options: [
        { id: 'r-a', value: 'a', label: 'A' },
        { id: 'r-b', value: 'b', label: 'B' },
      ],
    });
    const rowA = container.querySelector('#r-a')?.closest('.cinder-radio-row') as HTMLElement;
    const rowB = container.querySelector('#r-b')?.closest('.cinder-radio-row') as HTMLElement;
    expect(rowA.hasAttribute('data-checked')).toBe(false);
    expect(rowB.hasAttribute('data-checked')).toBe(true);

    await fireEvent.click(container.querySelector('#r-a') as HTMLElement);
    expect(rowA.hasAttribute('data-checked')).toBe(true);
    expect(rowB.hasAttribute('data-checked')).toBe(false);
  });

  // ── aria-invalid + data-invalid ─────────────────────────────────────────

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

  test('data-invalid is mirrored on each row when error is set', () => {
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
    rows.forEach((row) => expect((row as HTMLElement).hasAttribute('data-invalid')).toBe(true));

    // Without error, no row carries data-invalid
    const { container: c2 } = render(Wrapper, {
      name: 'choice2',
      value: 'a',
      options: [{ id: 'r-c', value: 'a', label: 'A' }],
    });
    const cleanRows = Array.from(c2.querySelectorAll('.cinder-radio-row'));
    cleanRows.forEach((row) =>
      expect((row as HTMLElement).hasAttribute('data-invalid')).toBe(false),
    );
  });

  // ── data-disabled ───────────────────────────────────────────────────────

  test('data-disabled is mirrored on disabled rows', async () => {
    // Group-level disabled: every row has data-disabled
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
    rows1.forEach((row) => expect((row as HTMLElement).hasAttribute('data-disabled')).toBe(true));

    // Only one option disabled: only that row has data-disabled
    const { container: c2 } = render(Wrapper, {
      name: 'choice2',
      value: 'a',
      options: [
        { id: 'r-c', value: 'a', label: 'A', disabled: true },
        { id: 'r-d', value: 'b', label: 'B' },
      ],
    });
    const rowC = c2.querySelector('#r-c')?.closest('.cinder-radio-row') as HTMLElement;
    const rowD = c2.querySelector('#r-d')?.closest('.cinder-radio-row') as HTMLElement;
    expect(rowC.hasAttribute('data-disabled')).toBe(true);
    expect(rowD.hasAttribute('data-disabled')).toBe(false);

    // Fully enabled group: no row has data-disabled
    const { container: c3 } = render(Wrapper, {
      name: 'choice3',
      value: 'a',
      options: [
        { id: 'r-e', value: 'a', label: 'A' },
        { id: 'r-f', value: 'b', label: 'B' },
      ],
    });
    const rows3 = Array.from(c3.querySelectorAll('.cinder-radio-row'));
    rows3.forEach((row) => expect((row as HTMLElement).hasAttribute('data-disabled')).toBe(false));
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
