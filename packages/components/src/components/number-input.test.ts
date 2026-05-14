/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../test/happy-dom.ts';

setupHappyDom();

const { render, fireEvent, cleanup } = await import('@testing-library/svelte');
const { default: NumberInput } = await import('./number-input.svelte');

afterEach(() => {
  // Tear down any standalone <form> elements appended to body by form tests
  // FIRST so cleanup() doesn't try to remove children of an already-detached
  // form. happy-dom throws if removeChild can't find the node.
  document.querySelectorAll('body > form').forEach((form) => {
    try {
      form.remove();
    } catch {
      // ignore detached-node errors
    }
  });
  cleanup();
});

function getInput(container: Element, id = 'n'): HTMLInputElement {
  return container.querySelector(`#${id}`) as HTMLInputElement;
}

function getHidden(container: Element): HTMLInputElement | null {
  return container.querySelector('input[type="hidden"]');
}

function getIncrement(container: Element): HTMLButtonElement {
  return container.querySelector('[aria-label="Increment"]') as HTMLButtonElement;
}
function getDecrement(container: Element): HTMLButtonElement {
  return container.querySelector('[aria-label="Decrement"]') as HTMLButtonElement;
}

async function type(input: HTMLInputElement, text: string) {
  input.value = text;
  await fireEvent.input(input, { target: { value: text } });
}

async function blur(input: HTMLInputElement) {
  await fireEvent.blur(input);
}

async function focus(input: HTMLInputElement) {
  await fireEvent.focus(input);
}

describe('NumberInput basics', () => {
  test('renders with defaultValue formatted in en-US', () => {
    const { container } = render(NumberInput, {
      props: { id: 'n', defaultValue: 1234.5, locale: 'en-US' },
    });
    expect(getInput(container).value).toBe('1,234.5');
  });

  test('controlled value updates display', async () => {
    const { container, rerender } = render(NumberInput, {
      props: { id: 'n', value: 1, locale: 'en-US' },
    });
    expect(getInput(container).value).toBe('1');
    await rerender({ id: 'n', value: 42, locale: 'en-US' });
    expect(getInput(container).value).toBe('42');
  });

  test('per-keystroke does not commit `0.`', async () => {
    const calls: Array<number | null> = [];
    const { container } = render(NumberInput, {
      props: {
        id: 'n',
        value: null,
        locale: 'en-US',
        onchange: (v: number | null) => calls.push(v),
      },
    });
    const input = getInput(container);
    await focus(input);
    await type(input, '0.');
    expect(input.value).toBe('0.');
    expect(calls).toEqual([]);
  });

  test('bare `-` survives mid-typing without committing', async () => {
    const calls: Array<number | null> = [];
    const { container } = render(NumberInput, {
      props: { id: 'n', locale: 'en-US', onchange: (v: number | null) => calls.push(v) },
    });
    const input = getInput(container);
    await focus(input);
    await type(input, '-');
    expect(input.value).toBe('-');
    expect(calls).toEqual([]);
  });

  test('blur commits valid number and reformats', async () => {
    const calls: Array<number | null> = [];
    const { container } = render(NumberInput, {
      props: { id: 'n', locale: 'en-US', onchange: (v: number | null) => calls.push(v) },
    });
    const input = getInput(container);
    await focus(input);
    await type(input, '1234.5');
    await blur(input);
    expect(calls).toEqual([1234.5]);
    expect(input.value).toBe('1,234.5');
  });

  test('blur empty fires onchange(null)', async () => {
    const calls: Array<number | null> = [];
    const { container } = render(NumberInput, {
      props: { id: 'n', value: 5, locale: 'en-US', onchange: (v: number | null) => calls.push(v) },
    });
    const input = getInput(container);
    await focus(input);
    await type(input, '');
    await blur(input);
    expect(calls).toEqual([null]);
  });

  test('blur `0.` → 0', async () => {
    const calls: Array<number | null> = [];
    const { container } = render(NumberInput, {
      props: { id: 'n', locale: 'en-US', onchange: (v: number | null) => calls.push(v) },
    });
    const input = getInput(container);
    await focus(input);
    await type(input, '0.');
    await blur(input);
    expect(calls).toEqual([0]);
  });

  test('blur `.5` → 0.5', async () => {
    const calls: Array<number | null> = [];
    const { container } = render(NumberInput, {
      props: { id: 'n', locale: 'en-US', onchange: (v: number | null) => calls.push(v) },
    });
    const input = getInput(container);
    await focus(input);
    await type(input, '.5');
    await blur(input);
    expect(calls).toEqual([0.5]);
  });

  test('blur `+1` → 1', async () => {
    const calls: Array<number | null> = [];
    const { container } = render(NumberInput, {
      props: { id: 'n', locale: 'en-US', onchange: (v: number | null) => calls.push(v) },
    });
    const input = getInput(container);
    await focus(input);
    await type(input, '+1');
    await blur(input);
    expect(calls).toEqual([1]);
  });

  test('blur bare `-` → null', async () => {
    const calls: Array<number | null> = [];
    const { container } = render(NumberInput, {
      props: { id: 'n', locale: 'en-US', onchange: (v: number | null) => calls.push(v) },
    });
    const input = getInput(container);
    await focus(input);
    await type(input, '-');
    await blur(input);
    expect(calls).toEqual([null]);
  });
});

describe('Clamping and snapping', () => {
  test('blur clamps to max', async () => {
    const calls: Array<number | null> = [];
    const { container } = render(NumberInput, {
      props: { id: 'n', max: 10, locale: 'en-US', onchange: (v: number | null) => calls.push(v) },
    });
    const input = getInput(container);
    await focus(input);
    await type(input, '999');
    await blur(input);
    expect(calls).toEqual([10]);
  });

  test('blur clamps to min', async () => {
    const calls: Array<number | null> = [];
    const { container } = render(NumberInput, {
      props: { id: 'n', min: 0, locale: 'en-US', onchange: (v: number | null) => calls.push(v) },
    });
    const input = getInput(container);
    await focus(input);
    await type(input, '-999');
    await blur(input);
    expect(calls).toEqual([0]);
  });

  test('blur snaps to step only when step provided', async () => {
    const calls: Array<number | null> = [];
    const { container } = render(NumberInput, {
      props: { id: 'n', step: 0.5, locale: 'en-US', onchange: (v: number | null) => calls.push(v) },
    });
    const input = getInput(container);
    await focus(input);
    await type(input, '1.3');
    await blur(input);
    expect(calls).toEqual([1.5]);
  });

  test('default-step does NOT snap', async () => {
    const calls: Array<number | null> = [];
    const { container } = render(NumberInput, {
      props: { id: 'n', locale: 'en-US', onchange: (v: number | null) => calls.push(v) },
    });
    const input = getInput(container);
    await focus(input);
    await type(input, '1234.5');
    await blur(input);
    expect(calls).toEqual([1234.5]);
  });

  test('snap-then-clamp ordering: clamp wins', async () => {
    const calls: Array<number | null> = [];
    const { container } = render(NumberInput, {
      props: {
        id: 'n',
        min: 0,
        max: 1,
        step: 0.6,
        locale: 'en-US',
        onchange: (v: number | null) => calls.push(v),
      },
    });
    const input = getInput(container);
    await focus(input);
    await type(input, '0.9');
    await blur(input);
    expect(calls).toEqual([1]);
  });

  test('snap origin respects min', async () => {
    const calls: Array<number | null> = [];
    const { container } = render(NumberInput, {
      props: {
        id: 'n',
        min: 0.1,
        step: 0.2,
        locale: 'en-US',
        onchange: (v: number | null) => calls.push(v),
      },
    });
    const input = getInput(container);
    await focus(input);
    await type(input, '0.4');
    await blur(input);
    expect(calls).toEqual([0.5]);
  });

  test('roundToPrecision removes float artifacts', async () => {
    const calls: Array<number | null> = [];
    const { container } = render(NumberInput, {
      props: { id: 'n', step: 0.1, locale: 'en-US', onchange: (v: number | null) => calls.push(v) },
    });
    const input = getInput(container);
    await focus(input);
    await type(input, '0.3');
    await blur(input);
    expect(calls[0]).toBe(0.3);
    expect(Object.is(calls[0], 0.3)).toBe(true);
  });

  test('invalid step (0, -5, NaN, Infinity) falls back to increment=1', async () => {
    for (const bad of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const calls: Array<number | null> = [];
      const { container, unmount } = render(NumberInput, {
        props: {
          id: 'n',
          value: 1,
          step: bad,
          locale: 'en-US',
          onchange: (v: number | null) => calls.push(v),
        },
      });
      getIncrement(container).click();
      expect(calls).toEqual([2]);
      unmount();
    }
  });

  test('exponential step precision', async () => {
    const calls: Array<number | null> = [];
    const { container } = render(NumberInput, {
      props: {
        id: 'n',
        step: 1e-7,
        locale: 'en-US',
        onchange: (v: number | null) => calls.push(v),
      },
    });
    const input = getInput(container);
    await focus(input);
    await type(input, '0.0000003');
    await blur(input);
    expect(calls[0]).toBeCloseTo(0.0000003, 10);
  });
});

describe('Stepper buttons and keyboard', () => {
  test('Increment button fires onchange(value+step)', () => {
    const calls: Array<number | null> = [];
    const { container } = render(NumberInput, {
      props: {
        id: 'n',
        value: 1,
        step: 2,
        locale: 'en-US',
        onchange: (v: number | null) => calls.push(v),
      },
    });
    getIncrement(container).click();
    expect(calls).toEqual([3]);
  });

  test('Increment disabled at max', () => {
    const { container } = render(NumberInput, {
      props: { id: 'n', value: 10, max: 10, locale: 'en-US' },
    });
    expect(getIncrement(container).disabled).toBe(true);
  });

  test('Decrement fires onchange(value-step), disabled at min', () => {
    const calls: Array<number | null> = [];
    const { container } = render(NumberInput, {
      props: { id: 'n', value: 5, locale: 'en-US', onchange: (v: number | null) => calls.push(v) },
    });
    getDecrement(container).click();
    expect(calls).toEqual([4]);

    const { container: c2 } = render(NumberInput, {
      props: { id: 'm', value: 0, min: 0, locale: 'en-US' },
    });
    expect(getDecrement(c2).disabled).toBe(true);
  });

  test('ArrowUp / ArrowDown match increment / decrement', async () => {
    const calls: Array<number | null> = [];
    const { container } = render(NumberInput, {
      props: { id: 'n', value: 5, locale: 'en-US', onchange: (v: number | null) => calls.push(v) },
    });
    const input = getInput(container);
    await fireEvent.keyDown(input, { key: 'ArrowUp' });
    await fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(calls).toEqual([6, 5]);
  });

  test('PageUp / PageDown = ±10×step', async () => {
    const calls: Array<number | null> = [];
    const { container } = render(NumberInput, {
      props: {
        id: 'n',
        value: 0,
        step: 2,
        locale: 'en-US',
        onchange: (v: number | null) => calls.push(v),
      },
    });
    const input = getInput(container);
    await fireEvent.keyDown(input, { key: 'PageUp' });
    await fireEvent.keyDown(input, { key: 'PageDown' });
    expect(calls).toEqual([20, 0]);
  });

  test('Home → min when finite; End → max when finite', async () => {
    const calls: Array<number | null> = [];
    const { container } = render(NumberInput, {
      props: {
        id: 'n',
        value: 5,
        min: 1,
        max: 9,
        locale: 'en-US',
        onchange: (v: number | null) => calls.push(v),
      },
    });
    const input = getInput(container);
    await fireEvent.keyDown(input, { key: 'Home' });
    await fireEvent.keyDown(input, { key: 'End' });
    expect(calls).toEqual([1, 9]);
  });

  test('Home / End no-op when bound is infinite', async () => {
    const calls: Array<number | null> = [];
    const { container } = render(NumberInput, {
      props: { id: 'n', value: 5, locale: 'en-US', onchange: (v: number | null) => calls.push(v) },
    });
    const input = getInput(container);
    await fireEvent.keyDown(input, { key: 'Home' });
    await fireEvent.keyDown(input, { key: 'End' });
    expect(calls).toEqual([]);
  });

  test('Step from focused display, not stale value', async () => {
    const calls: Array<number | null> = [];
    const { container } = render(NumberInput, {
      props: { id: 'n', value: 0, locale: 'en-US', onchange: (v: number | null) => calls.push(v) },
    });
    const input = getInput(container);
    await focus(input);
    await type(input, '12');
    await fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(calls).toEqual([13]);
  });

  test('Refocus after stepper click', () => {
    const { container } = render(NumberInput, {
      props: { id: 'n', value: 1, locale: 'en-US' },
    });
    const input = getInput(container);
    getIncrement(container).click();
    expect(document.activeElement).toBe(input);
  });
});

describe('Locale formatting', () => {
  test('en-US: 1234.5 → "1,234.5"', () => {
    const { container } = render(NumberInput, {
      props: { id: 'n', defaultValue: 1234.5, locale: 'en-US' },
    });
    expect(getInput(container).value).toBe('1,234.5');
  });

  test('de-DE: 1234.5 → "1.234,5"', () => {
    const { container } = render(NumberInput, {
      props: { id: 'n', defaultValue: 1234.5, locale: 'de-DE' },
    });
    expect(getInput(container).value).toBe('1.234,5');
  });

  test('de-DE round-trip: paste "1.234,5" parses to 1234.5', async () => {
    const calls: Array<number | null> = [];
    const { container } = render(NumberInput, {
      props: { id: 'n', locale: 'de-DE', onchange: (v: number | null) => calls.push(v) },
    });
    const input = getInput(container);
    await focus(input);
    await type(input, '1.234,5');
    await blur(input);
    expect(calls).toEqual([1234.5]);
  });

  test('Strict grouping rejection (en-US): "1,2,3.4" → null', async () => {
    const calls: Array<number | null> = [];
    const { container } = render(NumberInput, {
      props: { id: 'n', locale: 'en-US', onchange: (v: number | null) => calls.push(v) },
    });
    const input = getInput(container);
    await focus(input);
    await type(input, '1,2,3.4');
    await blur(input);
    expect(calls).toEqual([null]);
  });

  test('Malformed inputs commit null', async () => {
    for (const bad of ['12abc', '1.2.3', '$--5']) {
      const calls: Array<number | null> = [];
      const { container, unmount } = render(NumberInput, {
        props: { id: 'n', locale: 'en-US', onchange: (v: number | null) => calls.push(v) },
      });
      const input = getInput(container);
      await focus(input);
      await type(input, bad);
      await blur(input);
      expect(calls).toEqual([null]);
      unmount();
    }
  });

  test('Grouped + accepted: "+1,234" (en-US) → 1234', async () => {
    const calls: Array<number | null> = [];
    const { container } = render(NumberInput, {
      props: { id: 'n', locale: 'en-US', onchange: (v: number | null) => calls.push(v) },
    });
    const input = getInput(container);
    await focus(input);
    await type(input, '+1,234');
    await blur(input);
    expect(calls).toEqual([1234]);
  });
});

describe('Currency and percent formats', () => {
  test('currency: USD format', async () => {
    const { container } = render(NumberInput, {
      props: {
        id: 'n',
        defaultValue: 12.5,
        locale: 'en-US',
        format: { style: 'currency', currency: 'USD' },
      },
    });
    const input = getInput(container);
    expect(input.value).toBe('$12.50');
    await focus(input);
    expect(input.value).toBe('12.5');
  });

  test('percent: round-trip', async () => {
    const calls: Array<number | null> = [];
    const { container } = render(NumberInput, {
      props: {
        id: 'n',
        defaultValue: 0.5,
        locale: 'en-US',
        format: { style: 'percent' },
        onchange: (v: number | null) => calls.push(v),
      },
    });
    const input = getInput(container);
    expect(input.value).toBe('50%');
    await focus(input);
    expect(input.value).toBe('50');
    await type(input, '75');
    await blur(input);
    expect(calls).toEqual([0.75]);
    expect(input.value).toBe('75%');
  });

  test('percent: focus avoids precision artifacts', async () => {
    const { container } = render(NumberInput, {
      props: { id: 'n', defaultValue: 0.29, locale: 'en-US', format: { style: 'percent' } },
    });
    const input = getInput(container);
    await focus(input);
    expect(input.value).toBe('29');
  });

  test('percent step is canonical', async () => {
    const calls: Array<number | null> = [];
    const { container } = render(NumberInput, {
      props: {
        id: 'n',
        defaultValue: 0.5,
        step: 0.01,
        locale: 'en-US',
        format: { style: 'percent' },
        onchange: (v: number | null) => calls.push(v),
      },
    });
    const input = getInput(container);
    await focus(input);
    await fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(calls[0]).toBeCloseTo(0.51, 10);
  });
});

describe('Form integration', () => {
  test('disabled disables input and steppers AND omits hidden', () => {
    const { container } = render(NumberInput, {
      props: { id: 'n', name: 'q', value: 5, disabled: true, locale: 'en-US' },
    });
    expect(getInput(container).disabled).toBe(true);
    expect(getIncrement(container).disabled).toBe(true);
    expect(getDecrement(container).disabled).toBe(true);
    expect(getHidden(container)).toBeNull();
  });

  test('hidden input carries canonical numeric string when enabled+named', () => {
    const { container } = render(NumberInput, {
      props: { id: 'n', name: 'q', value: 1234.5, locale: 'en-US' },
    });
    expect(getHidden(container)?.value).toBe('1234.5');
  });

  test('visible input has no name attribute', () => {
    const { container } = render(NumberInput, {
      props: { id: 'n', name: 'q', value: 1, locale: 'en-US' },
    });
    expect(getInput(container).hasAttribute('name')).toBe(false);
  });

  test('hidden input value used for form submission is canonical numeric string', () => {
    const { container } = render(NumberInput, {
      props: { id: 'n', name: 'q', value: 1234.5, locale: 'en-US' },
    });
    const hidden = getHidden(container);
    expect(hidden).not.toBeNull();
    expect(hidden?.value).toBe('1234.5');
    expect(hidden?.getAttribute('name')).toBe('q');
  });

  test('form reset (uncontrolled) restores defaultValue and fires onchange', async () => {
    const calls: Array<number | null> = [];
    const form = document.createElement('form');
    document.body.appendChild(form);
    const mount = document.createElement('div');
    form.appendChild(mount);
    render(NumberInput, {
      target: mount,
      props: {
        id: 'n',
        defaultValue: 5,
        locale: 'en-US',
        onchange: (v: number | null) => calls.push(v),
      },
    });
    const input = mount.querySelector('#n') as HTMLInputElement;
    await focus(input);
    await type(input, '99');
    await blur(input);
    calls.length = 0;
    form.dispatchEvent(new Event('reset', { bubbles: true, cancelable: true }));
    expect(calls).toEqual([5]);
  });
});

describe('Validity and a11y wiring', () => {
  test('error prop sets aria-invalid and renders error element', () => {
    const { container } = render(NumberInput, {
      props: { id: 'n', value: null, locale: 'en-US', error: 'Bad' },
    });
    const input = getInput(container);
    expect(input.getAttribute('aria-invalid')).toBe('true');
    const errEl = container.querySelector('#n-error');
    expect(errEl).not.toBeNull();
    expect(input.getAttribute('aria-describedby')).toContain('n-error');
  });

  test('required + empty commit → customError', async () => {
    const form = document.createElement('form');
    document.body.appendChild(form);
    const mount = document.createElement('div');
    form.appendChild(mount);
    render(NumberInput, {
      target: mount,
      props: { id: 'n', name: 'q', required: true, locale: 'en-US' },
    });
    const input = mount.querySelector('#n') as HTMLInputElement;
    await focus(input);
    await blur(input);
    expect(input.validity.customError).toBe(true);
  });

  test('required + garbage → customError', async () => {
    const { container } = render(NumberInput, {
      props: { id: 'n', required: true, locale: 'en-US' },
    });
    const input = getInput(container);
    await focus(input);
    await type(input, '12abc');
    await blur(input);
    expect(input.validity.customError).toBe(true);
  });

  test('regression: no aria-value* attributes', () => {
    const { container } = render(NumberInput, {
      props: { id: 'n', value: 5, min: 0, max: 10, locale: 'en-US' },
    });
    const input = getInput(container);
    expect(input.hasAttribute('aria-valuemin')).toBe(false);
    expect(input.hasAttribute('aria-valuemax')).toBe(false);
    expect(input.hasAttribute('aria-valuenow')).toBe(false);
  });

  test('malformed customError cleared by external value change', async () => {
    const { container, rerender } = render(NumberInput, {
      props: { id: 'n', locale: 'en-US' },
    });
    const input = getInput(container);
    await focus(input);
    await type(input, '12abc');
    await blur(input);
    expect(input.validity.customError).toBe(true);
    await rerender({ id: 'n', value: 5, locale: 'en-US' });
    expect(input.validity.customError).toBe(false);
  });

  test('name omitted: no hidden input rendered, no "undefined" attribute', () => {
    const { container } = render(NumberInput, {
      props: { id: 'n', value: 5, locale: 'en-US' },
    });
    expect(getHidden(container)).toBeNull();
    expect(container.querySelector('[name="undefined"]')).toBeNull();
  });
});

describe('External updates and edge cases', () => {
  test('external value change during focus discards in-progress edit', async () => {
    const { container, rerender } = render(NumberInput, {
      props: { id: 'n', value: 1, locale: 'en-US' },
    });
    const input = getInput(container);
    await focus(input);
    await type(input, '999');
    // While focused, parent updates value:
    await rerender({ id: 'n', value: 42, locale: 'en-US' });
    // Simulate blur (focus lost — parent change wins on re-format).
    await blur(input);
    expect(input.value).toBe('42');
  });

  test('locale prop change after mount re-formats', async () => {
    const { container, rerender } = render(NumberInput, {
      props: { id: 'n', value: 1234.5, locale: 'en-US' },
    });
    expect(getInput(container).value).toBe('1,234.5');
    await rerender({ id: 'n', value: 1234.5, locale: 'de-DE' });
    expect(getInput(container).value).toBe('1.234,5');
  });

  test('onchange commit semantics, not change semantics', async () => {
    const calls: Array<number | null> = [];
    const { container } = render(NumberInput, {
      props: {
        id: 'n',
        value: 5,
        max: 5,
        locale: 'en-US',
        onchange: (v: number | null) => calls.push(v),
      },
    });
    const input = getInput(container);
    await fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(calls).toEqual([5]);
  });
});
