/// <reference lib="dom" />
import * as matchers from '@testing-library/jest-dom/matchers';
import { describe, expect, spyOn, test } from 'bun:test';
import { readFileSync } from 'node:fs';

import { stripCinderComponentsLayer } from '../../test/css.ts';
import { setupHappyDom } from '../../test/happy-dom.ts';

// Extend Bun's expect with @testing-library/jest-dom matchers (e.g. toBeDisabled, toBeVisible).
// The cast to `Parameters<typeof expect.extend>[0]` satisfies Bun's extend signature while
// preserving the full jest-dom matcher set at runtime.
expect.extend(matchers as Parameters<typeof expect.extend>[0]);

// setupHappyDom() MUST run before any `@testing-library/svelte` import. testing-library
// reads `globalThis.document` / `window` at module-init (top-level, not inside test bodies),
// so we register happy-dom's globals first and then dynamic-import testing-library below.
setupHappyDom();

const { render, fireEvent } = await import('@testing-library/svelte');
const { default: Select } = await import('./select.svelte');
const { default: FormFieldSelectFixture } =
  await import('../../test/fixtures/form-field-select-fixture.svelte');

const defaultOptions = [
  { value: 'a', label: 'Option A' },
  { value: 'b', label: 'Option B' },
  { value: 'c', label: 'Option C' },
];

function readSelectStyles(): string {
  // Strip the @layer wrapper: happy-dom does not apply layer-nested rules to
  // getComputedStyle. Inner declarations are unchanged.
  return stripCinderComponentsLayer(readFileSync(new URL('./select.css', import.meta.url), 'utf8'));
}

function idsIn(container: Element): string[] {
  return Array.from(container.querySelectorAll('[id]'), (element) => element.id);
}

describe('Select', () => {
  test('renders <select id={id}> with one <option> per option in options array', () => {
    const { container } = render(Select, {
      props: { id: 'test-select', value: 'a', options: defaultOptions },
    });
    const selectEl = container.querySelector('select#test-select');
    expect(selectEl).not.toBeNull();
    // Non-null assertion is safe: the expect above would have thrown if selectEl were null.
    const optionEls = Array.from(selectEl!.querySelectorAll('option'));
    expect(optionEls.length).toBe(3);
    expect(optionEls[0]!.getAttribute('value')).toBe('a');
    expect(optionEls[0]!.textContent).toBe('Option A');
    expect(optionEls[1]!.getAttribute('value')).toBe('b');
    expect(optionEls[2]!.getAttribute('value')).toBe('c');
  });

  test('renders without a value prop (undefined unselected sentinel does not crash)', () => {
    // `value` is now optional (was required) — `$bindable()` yields undefined when
    // omitted. Rendering with no initial selection must not throw, and the native
    // <select> falls back to its first option.
    const { container } = render(Select, {
      props: { id: 'no-value-select', options: defaultOptions },
    });
    const selectEl = container.querySelector('select#no-value-select') as HTMLSelectElement;
    expect(selectEl).not.toBeNull();
    expect(Array.from(selectEl.querySelectorAll('option')).length).toBe(3);
    // Native <select> with no explicit selection reports the first option's value.
    expect(selectEl.value).toBe('a');
  });

  test('<select> value matches initial bound value', () => {
    const { container } = render(Select, {
      props: { id: 'test-select', value: 'b', options: defaultOptions },
    });
    const selectEl = container.querySelector('select') as HTMLSelectElement;
    expect(selectEl.value).toBe('b');
  });

  test('<select> is actually disabled when disabled=true', () => {
    const { container } = render(Select, {
      props: { id: 'test-select', value: 'a', options: defaultOptions, disabled: true },
    });
    const selectEl = container.querySelector('select') as HTMLSelectElement;
    // toBeDisabled() from @testing-library/jest-dom checks the native disabled attribute.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (expect(selectEl) as any).toBeDisabled();
  });

  test('label prop creates <label for={id}>', () => {
    const { container } = render(Select, {
      props: { id: 'labeled-select', value: 'a', options: defaultOptions, label: 'Choose one' },
    });
    const labelEl = container.querySelector('label[for="labeled-select"]');
    expect(labelEl).not.toBeNull();
    expect(labelEl!.textContent?.trim()).toBe('Choose one');
  });

  test('on user change event, bound value updates', async () => {
    const { container } = render(Select, {
      props: { id: 'test-select', value: 'a', options: defaultOptions },
    });
    const selectEl = container.querySelector('select') as HTMLSelectElement;
    await fireEvent.change(selectEl, { target: { value: 'c' } });
    expect(selectEl.value).toBe('c');
  });

  test('empty options: dev warning emitted and data-cinder-empty="true" on select', () => {
    const warnSpy = spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const { container } = render(Select, {
        props: { id: 'empty-select', value: '', options: [] },
      });
      const selectEl = container.querySelector('select#empty-select');
      expect(selectEl).not.toBeNull();
      expect(selectEl!.getAttribute('data-cinder-empty')).toBe('true');
      expect(warnSpy).toHaveBeenCalledWith(
        '[cinder/Select] options is empty — pass at least one option, or ignore during async load.',
      );
    } finally {
      warnSpy.mockRestore();
    }
  });
});

describe('Select field-control contract', () => {
  test('description renders a <p> and is referenced by aria-describedby', () => {
    const { container } = render(Select, {
      props: { id: 'sel', value: 'a', options: defaultOptions, description: 'Pick carefully' },
    });
    const selectEl = container.querySelector('select');
    const descEl = container.querySelector('#sel-description');
    expect(descEl).not.toBeNull();
    expect(descEl!.textContent).toBe('Pick carefully');
    expect(selectEl!.getAttribute('aria-describedby')).toContain('sel-description');
  });

  test('error renders a <p> with aria-live="polite" and sets aria-invalid="true" on <select>', () => {
    const { container } = render(Select, {
      props: { id: 'sel', value: 'a', options: defaultOptions, error: 'Required field' },
    });
    const selectEl = container.querySelector('select');
    const errEl = container.querySelector('#sel-error');
    expect(errEl).not.toBeNull();
    expect(errEl!.textContent).toBe('Required field');
    expect(errEl!.getAttribute('aria-live')).toBe('polite');
    expect(selectEl!.getAttribute('aria-invalid')).toBe('true');
    expect(selectEl!.getAttribute('aria-describedby')).toContain('sel-error');
  });

  test('both description and error present: aria-describedby contains both ids in order', () => {
    const { container } = render(Select, {
      props: {
        id: 'sel',
        value: 'a',
        options: defaultOptions,
        description: 'Hint text',
        error: 'Error text',
      },
    });
    const selectEl = container.querySelector('select');
    const describedBy = selectEl!.getAttribute('aria-describedby') ?? '';
    const descIndex = describedBy.indexOf('sel-description');
    const errIndex = describedBy.indexOf('sel-error');
    expect(descIndex).toBeGreaterThanOrEqual(0);
    expect(errIndex).toBeGreaterThanOrEqual(0);
    expect(descIndex).toBeLessThan(errIndex);
  });

  test('required prop sets the native required attribute on <select>', () => {
    const { container } = render(Select, {
      props: { id: 'sel', value: 'a', options: defaultOptions, required: true },
    });
    const selectEl = container.querySelector('select');
    expect(selectEl!.hasAttribute('required')).toBe(true);
  });

  test('no description / no error: aria-describedby is absent (not empty string)', () => {
    const { container } = render(Select, {
      props: { id: 'sel', value: 'a', options: defaultOptions },
    });
    const selectEl = container.querySelector('select');
    expect(selectEl!.hasAttribute('aria-describedby')).toBe(false);
  });

  test('no error: aria-invalid is absent (not set to "false")', () => {
    const { container } = render(Select, {
      props: { id: 'sel', value: 'a', options: defaultOptions },
    });
    const selectEl = container.querySelector('select');
    expect(selectEl!.hasAttribute('aria-invalid')).toBe(false);
  });

  test('consumer-supplied aria-describedby is composed with component-generated ids', () => {
    const { container } = render(Select, {
      props: {
        id: 'sel',
        value: 'a',
        options: defaultOptions,
        description: 'Hint',
        'aria-describedby': 'external-tooltip',
      },
    });
    const selectEl = container.querySelector('select');
    const describedBy = selectEl!.getAttribute('aria-describedby') ?? '';
    expect(describedBy).toContain('sel-description');
    expect(describedBy).toContain('external-tooltip');
    expect(describedBy.indexOf('sel-description')).toBeLessThan(
      describedBy.indexOf('external-tooltip'),
    );
  });

  test('consumer-supplied aria-describedby alone (no description prop) is forwarded', () => {
    const { container } = render(Select, {
      props: {
        id: 'sel',
        value: 'a',
        options: defaultOptions,
        'aria-describedby': 'external-hint',
      },
    });
    const selectEl = container.querySelector('select');
    expect(selectEl!.getAttribute('aria-describedby')).toBe('external-hint');
  });

  test('consumer aria-invalid is preserved when no error prop is set', () => {
    const { container } = render(Select, {
      props: {
        id: 'sel',
        value: 'a',
        options: defaultOptions,
        'aria-invalid': 'true' as const,
      },
    });
    const selectEl = container.querySelector('select');
    expect(selectEl!.getAttribute('aria-invalid')).toBe('true');
  });

  test('error prop aria-invalid="true" wins over consumer aria-invalid="false"', () => {
    const { container } = render(Select, {
      props: {
        id: 'sel',
        value: 'a',
        options: defaultOptions,
        error: 'Bad value',
        'aria-invalid': 'false' as const,
      },
    });
    const selectEl = container.querySelector('select');
    expect(selectEl!.getAttribute('aria-invalid')).toBe('true');
  });

  test('empty options branch still carries aria-invalid and aria-describedby when error is set', () => {
    const warnSpy = spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const { container } = render(Select, {
        props: { id: 'empty-sel', value: '', options: [], error: 'Load failed' },
      });
      const selectEl = container.querySelector('select');
      expect(selectEl!.getAttribute('data-cinder-empty')).toBe('true');
      expect(selectEl!.getAttribute('aria-invalid')).toBe('true');
      expect(selectEl!.getAttribute('aria-describedby')).toContain('empty-sel-error');
    } finally {
      warnSpy.mockRestore();
    }
  });

  test('inactive error live region is removed from flex layout flow', () => {
    expect(readSelectStyles()).toContain(
      '.cinder-select-field__error:not([data-cinder-error]) {\n  position: absolute;',
    );
  });
});

describe('Select context inheritance from FormField', () => {
  test('inherits FormField state when local description and error are absent', () => {
    const { container } = render(FormFieldSelectFixture, {
      props: {
        fieldId: 'ctx-select',
        fieldLabel: 'Select label',
        fieldDescription: 'Field helper',
        fieldError: 'Field error',
        fieldRequired: true,
        fieldDisabled: true,
      },
    });

    const select = container.querySelector('select') as HTMLSelectElement;
    expect(select.getAttribute('aria-describedby')).toBe('ctx-select-description ctx-select-error');
    expect(select.getAttribute('aria-invalid')).toBe('true');
    expect(select.required).toBe(true);
    expect(select.disabled).toBe(true);
    expect(idsIn(container).filter((id) => id === 'ctx-select-error')).toHaveLength(1);
  });

  test('local Select description and error use distinct ids and compose with FormField context', () => {
    const { container } = render(FormFieldSelectFixture, {
      props: {
        fieldId: 'ctx-select',
        fieldLabel: 'Select label',
        fieldDescription: 'Field helper',
        fieldError: 'Field error',
        selectDescription: 'Select helper',
        selectError: 'Select error',
      },
    });

    const select = container.querySelector('select') as HTMLSelectElement;
    expect(select.getAttribute('aria-describedby')).toBe(
      'ctx-select-select-description ctx-select-select-error ctx-select-description ctx-select-error',
    );
    expect(select.getAttribute('aria-invalid')).toBe('true');
    expect(container.querySelector('#ctx-select-select-description')?.textContent).toContain(
      'Select helper',
    );
    expect(container.querySelector('#ctx-select-select-error')?.textContent).toContain(
      'Select error',
    );
    expect(idsIn(container).filter((id) => id === 'ctx-select-error')).toHaveLength(1);
    expect(idsIn(container).filter((id) => id === 'ctx-select-select-error')).toHaveLength(1);
  });

  test('explicit Select required and disabled false override FormField context', () => {
    const { container } = render(FormFieldSelectFixture, {
      props: {
        fieldId: 'ctx-select',
        fieldLabel: 'Select label',
        fieldRequired: true,
        fieldDisabled: true,
        selectRequired: false,
        selectDisabled: false,
      },
    });

    const select = container.querySelector('select') as HTMLSelectElement;
    expect(select.required).toBe(false);
    expect(select.disabled).toBe(false);
  });
});

describe('Select chevron indicator', () => {
  test('renders exactly one aria-hidden chevron element after the <select> for non-empty options', () => {
    const { container } = render(Select, {
      props: { id: 'cv', value: 'a', options: defaultOptions },
    });
    const chevrons = container.querySelectorAll('.cinder-select-field__chevron');
    expect(chevrons.length).toBe(1);
    expect(chevrons[0]!.getAttribute('aria-hidden')).toBe('true');
    const controlWrapper = container.querySelector('.cinder-select-field__control');
    expect(controlWrapper).not.toBeNull();
    expect(controlWrapper!.querySelector('select')).not.toBeNull();
    expect(controlWrapper!.querySelector('.cinder-select-field__chevron')).not.toBeNull();
  });

  test('renders exactly one aria-hidden chevron element for the empty-options branch', () => {
    const warnSpy = spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const { container } = render(Select, {
        props: { id: 'cv-empty', value: '', options: [] },
      });
      const chevrons = container.querySelectorAll('.cinder-select-field__chevron');
      expect(chevrons.length).toBe(1);
      expect(chevrons[0]!.getAttribute('aria-hidden')).toBe('true');
    } finally {
      warnSpy.mockRestore();
    }
  });
});
