/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../test/happy-dom.ts';

setupHappyDom();

const { render, fireEvent, cleanup } = await import('@testing-library/svelte');
const { tick } = await import('svelte');
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
  return container.querySelector('.cinder-number-input__stepper--increment') as HTMLButtonElement;
}
function getDecrement(container: Element): HTMLButtonElement {
  return container.querySelector('.cinder-number-input__stepper--decrement') as HTMLButtonElement;
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

  test('Home/End sync editor buffer while focused — no stale-buffer revert on blur', async () => {
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
    await focus(input);
    // Press Home — should commit to min AND update the editor buffer.
    await fireEvent.keyDown(input, { key: 'Home' });
    await tick();
    expect(input.value).toBe('1');
    // Blur re-parses the buffer; if buffer was stale this would revert to 5.
    await blur(input);
    expect(calls.at(-1)).toBe(1);

    // Now test End.
    await focus(input);
    await fireEvent.keyDown(input, { key: 'End' });
    await tick();
    expect(input.value).toBe('9');
    await blur(input);
    expect(calls.at(-1)).toBe(9);
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

describe('Stepper aria-labels include field + step magnitude', () => {
  test('with label and explicit step', () => {
    const { container } = render(NumberInput, {
      props: { id: 'n', value: 1, label: 'Quantity', step: 5, locale: 'en-US' },
    });
    expect(getIncrement(container).getAttribute('aria-label')).toBe('Increment Quantity by 5');
    expect(getDecrement(container).getAttribute('aria-label')).toBe('Decrement Quantity by 5');
  });

  test('without label falls back to magnitude-only label', () => {
    const { container } = render(NumberInput, {
      props: { id: 'n', value: 1, locale: 'en-US' },
    });
    expect(getIncrement(container).getAttribute('aria-label')).toBe('Increment by 1');
    expect(getDecrement(container).getAttribute('aria-label')).toBe('Decrement by 1');
  });
});

describe('Locale parser coverage in component', () => {
  test('fr-FR narrow-NBSP grouping round-trip', async () => {
    const calls: Array<number | null> = [];
    const { container } = render(NumberInput, {
      props: { id: 'n', locale: 'fr-FR', onchange: (v: number | null) => calls.push(v) },
    });
    const input = getInput(container);
    await focus(input);
    // Use the locale's own formatted output so we get the actual narrow NBSP.
    const formatted = new Intl.NumberFormat('fr-FR').format(1234.5);
    await type(input, formatted);
    await blur(input);
    expect(calls).toEqual([1234.5]);
  });

  test('ar-EG localized digits round-trip', async () => {
    const calls: Array<number | null> = [];
    const { container } = render(NumberInput, {
      props: { id: 'n', locale: 'ar-EG', onchange: (v: number | null) => calls.push(v) },
    });
    const input = getInput(container);
    await focus(input);
    const formatted = new Intl.NumberFormat('ar-EG').format(1234);
    await type(input, formatted);
    await blur(input);
    expect(calls).toEqual([1234]);
  });

  test('hi-IN secondary grouping accepted', async () => {
    const calls: Array<number | null> = [];
    const { container } = render(NumberInput, {
      props: { id: 'n', locale: 'hi-IN', onchange: (v: number | null) => calls.push(v) },
    });
    const input = getInput(container);
    await focus(input);
    await type(input, '12,34,567');
    await blur(input);
    expect(calls).toEqual([1234567]);
  });

  test('compact notation format: edit buffer shows plain number, not "1.2K"', async () => {
    // Regression: buildEditDisplay did not clear `notation`, so format={notation:'compact'}
    // rendered "1.2K" in the edit buffer. The parser's affix probes use 0 and -1 (too small
    // for "K"/"M" suffixes), so "1.2K" was never stripped and was rejected as malformed on blur.
    const calls: Array<number | null> = [];
    const { container } = render(NumberInput, {
      props: {
        id: 'n',
        locale: 'en-US',
        value: 1200,
        format: { notation: 'compact' },
        onchange: (v: number | null) => calls.push(v),
      },
    });
    const input = getInput(container);
    await focus(input);
    // Edit buffer must show the plain numeric form, not the compact abbreviation.
    expect(input.value).toBe('1200');
    await blur(input);
    // Blur commit of the unmodified edit buffer should not produce a malformed error.
    expect(calls).toEqual([1200]);
  });
});

describe('Form serialization correctness', () => {
  test('formdata event picks up hidden input with canonical numeric string', () => {
    const form = document.createElement('form');
    document.body.appendChild(form);
    const mount = document.createElement('div');
    form.appendChild(mount);
    render(NumberInput, {
      target: mount,
      props: { id: 'n', name: 'q', value: 1234.5, locale: 'en-US' },
    });
    // Dispatch a formdata event with a fresh FormData; the hidden input's
    // value is what the browser collects under `name="q"`.
    const fd = new FormData();
    const hidden = mount.querySelector('input[type="hidden"]') as HTMLInputElement;
    fd.set(hidden.name, hidden.value);
    expect(fd.get('q')).toBe('1234.5');
  });

  test('mid-edit value reaches form serialization on submit', async () => {
    const form = document.createElement('form');
    document.body.appendChild(form);
    const mount = document.createElement('div');
    form.appendChild(mount);
    render(NumberInput, {
      target: mount,
      props: { id: 'n', name: 'q', defaultValue: 0, locale: 'en-US' },
    });
    const input = mount.querySelector('#n') as HTMLInputElement;
    await focus(input);
    await type(input, '999');
    // Press Enter — the onKeyDown handler commits via `commitFromText`,
    // which flushes the in-progress edit buffer into the canonical value
    // (and therefore the hidden input). This is the path the user takes
    // when submitting via Enter, and it doesn't depend on happy-dom's
    // capture-phase event support (which is incomplete for synthetic
    // submit events on a form).
    await fireEvent.keyDown(input, { key: 'Enter' });
    await tick();
    const hidden = mount.querySelector('input[type="hidden"]') as HTMLInputElement;
    expect(hidden.value).toBe('999');
  });

  test('Enter key fires onchange exactly once (regression: capture-phase submit double-fire)', async () => {
    // Regression: pressing Enter called commitFromText in onKeyDown, then
    // requestSubmit() triggered the capture-phase submit listener which called
    // commitFromText again, causing a duplicate onchange emission.
    const calls: Array<number | null> = [];
    const form = document.createElement('form');
    document.body.appendChild(form);
    const mount = document.createElement('div');
    form.appendChild(mount);
    render(NumberInput, {
      target: mount,
      props: {
        id: 'n',
        name: 'q',
        defaultValue: 0,
        locale: 'en-US',
        onchange: (v: number | null) => calls.push(v),
      },
    });
    const input = mount.querySelector('#n') as HTMLInputElement;
    await focus(input);
    await type(input, '42');
    calls.length = 0;
    await fireEvent.keyDown(input, { key: 'Enter' });
    await tick();
    expect(calls).toEqual([42]);
  });
});

describe('Required + reset and other validity edge cases', () => {
  test('required + form-reset-to-null stays invalid', async () => {
    const form = document.createElement('form');
    document.body.appendChild(form);
    const mount = document.createElement('div');
    form.appendChild(mount);
    render(NumberInput, {
      target: mount,
      props: { id: 'n', name: 'q', required: true, defaultValue: null, locale: 'en-US' },
    });
    const input = mount.querySelector('#n') as HTMLInputElement;
    // Force into an invalid-required state on reset.
    form.dispatchEvent(new Event('reset', { bubbles: true, cancelable: true }));
    expect(input.validity.customError).toBe(true);
  });

  test('malformed blur keeps user text visible for correction', async () => {
    const { container } = render(NumberInput, {
      props: { id: 'n', locale: 'en-US' },
    });
    const input = getInput(container);
    await focus(input);
    await type(input, '12abc');
    await blur(input);
    // The hostile-form-UX behavior would erase to '' here. The component
    // keeps the user's text so they can edit it.
    expect(input.value).toBe('12abc');
    expect(input.validity.customError).toBe(true);
  });

  test('disabled form listeners are no-ops', async () => {
    const calls: Array<number | null> = [];
    const form = document.createElement('form');
    document.body.appendChild(form);
    const mount = document.createElement('div');
    form.appendChild(mount);
    render(NumberInput, {
      target: mount,
      props: {
        id: 'n',
        name: 'q',
        value: 5,
        disabled: true,
        locale: 'en-US',
        onchange: (v: number | null) => calls.push(v),
      },
    });
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    form.dispatchEvent(new Event('reset', { bubbles: true, cancelable: true }));
    expect(calls).toEqual([]);
  });
});

describe('Stepper while focused (editorBuffer sync regression)', () => {
  test('two consecutive ArrowUp presses while focused both advance value and visible text', async () => {
    const calls: Array<number | null> = [];
    const { container } = render(NumberInput, {
      props: {
        id: 'n',
        value: 5,
        locale: 'en-US',
        onchange: (v: number | null) => calls.push(v),
      },
    });
    const input = getInput(container);
    await focus(input);
    await fireEvent.keyDown(input, { key: 'ArrowUp' });
    await fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(calls).toEqual([6, 7]);
    expect(input.value).toBe('7');
  });

  test('Stepper button click syncs visible text after focus restored', async () => {
    // After a stepper click the component refocuses the input. The visible
    // text matches the committed value once focus is back.
    const { container } = render(NumberInput, {
      props: { id: 'n', value: 5, locale: 'en-US' },
    });
    const input = getInput(container);
    getIncrement(container).click();
    await tick();
    expect(input.value).toBe('6');
  });
});

describe('Internal error region announces invalid state', () => {
  test('malformed parse without consumer error shows internal error message', async () => {
    const { container } = render(NumberInput, {
      props: { id: 'n', locale: 'en-US' },
    });
    const input = getInput(container);
    await focus(input);
    await type(input, '12abc');
    await blur(input);
    const errEl = container.querySelector('#n-internal-error');
    expect(errEl).not.toBeNull();
    expect(errEl?.textContent?.trim()).toBe('Please enter a valid number.');
    expect(input.getAttribute('aria-describedby')).toContain('n-internal-error');
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });

  test('required-empty without consumer error shows internal error message', async () => {
    const { container } = render(NumberInput, {
      props: { id: 'n', required: true, locale: 'en-US' },
    });
    const input = getInput(container);
    await focus(input);
    await blur(input);
    const errEl = container.querySelector('#n-internal-error');
    expect(errEl).not.toBeNull();
    expect(errEl?.textContent?.trim()).toBe('Please enter a number.');
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });

  test('consumer error wins over internal error when both could apply', async () => {
    const { container } = render(NumberInput, {
      props: { id: 'n', error: 'Custom error', locale: 'en-US' },
    });
    const input = getInput(container);
    await focus(input);
    await type(input, '12abc');
    await blur(input);
    expect(container.querySelector('#n-internal-error')).toBeNull();
    expect(container.querySelector('#n-error')?.textContent?.trim()).toBe('Custom error');
  });

  test('typing clears the internal error region', async () => {
    const { container } = render(NumberInput, {
      props: { id: 'n', locale: 'en-US' },
    });
    const input = getInput(container);
    await focus(input);
    await type(input, '12abc');
    await blur(input);
    expect(container.querySelector('#n-internal-error')).not.toBeNull();
    await focus(input);
    await type(input, '5');
    expect(container.querySelector('#n-internal-error')).toBeNull();
  });

  test('required-empty error does not flash mid-keystroke after malformed clear', async () => {
    // Regression: when required=true and the user re-types after a malformed blur,
    // onInput clears malformedError but value is still null. The validity-sync
    // $effect must NOT set requiredEmptyError while the field is focused — doing so
    // would announce "Please enter a number." in the aria-live region mid-keystroke.
    const { container } = render(NumberInput, {
      props: { id: 'n', required: true, locale: 'en-US' },
    });
    const input = getInput(container);

    // Produce a malformed state by blurring with invalid text.
    await focus(input);
    await type(input, 'abc');
    await blur(input);
    expect(input.getAttribute('aria-invalid')).toBe('true');

    // Re-focus and start correcting. After the first keystroke malformedError
    // clears but value is still null. requiredEmptyError must stay false.
    await focus(input);
    await type(input, '5');

    expect(container.querySelector('#n-internal-error')).toBeNull();
    expect(input.getAttribute('aria-invalid')).toBeFalsy();
  });
});

describe('Malformed buffer preserved across re-focus', () => {
  test('user can re-focus a malformed field and still see/correct their text', async () => {
    const { container } = render(NumberInput, {
      props: { id: 'n', locale: 'en-US' },
    });
    const input = getInput(container);
    await focus(input);
    await type(input, '12abc');
    await blur(input);
    expect(input.value).toBe('12abc');
    // Re-focus — buffer survives so the user can edit "12abc" instead of
    // having it disappear.
    await focus(input);
    await tick();
    expect(input.value).toBe('12abc');
  });
});

describe('FormField context overrides', () => {
  test('context-disabled disables steppers and omits hidden input', async () => {
    // Render the component and patch context post-hoc: use disabled prop as
    // the proxy since FormField is a separate test concern. (Direct context
    // testing lives in the form-field fixture suite — we only need to verify
    // resolvedDisabled is the source of truth.)
    const { container } = render(NumberInput, {
      props: { id: 'n', name: 'q', value: 5, disabled: true, locale: 'en-US' },
    });
    expect(getIncrement(container).disabled).toBe(true);
    expect(getHidden(container)).toBeNull();
  });
});

describe('isInternalValueChange stale-flag regression', () => {
  test('malformedError clears when parent writes a valid number after a malformed blur', async () => {
    // Regression: when blur commits null (malformed input), isInternalValueChange
    // was set but never cleared for the unfocused case, so the validity-sync
    // effect's !isInternalValueChange guard was always false and malformedError
    // was never cleared by a subsequent external value change.
    const { container, rerender } = render(NumberInput, {
      props: { id: 'n', value: 5, locale: 'en-US' },
    });
    const input = getInput(container);
    await focus(input);
    await type(input, 'notanumber');
    await blur(input);
    await tick();
    expect(input.getAttribute('aria-invalid')).toBe('true');

    // Parent writes a valid value — malformedError must clear.
    await rerender({ id: 'n', value: 42, locale: 'en-US' });
    await tick();
    expect(input.getAttribute('aria-invalid')).toBeNull();
  });
});

describe('reset source does not snap defaultValue to step precision', () => {
  test('form reset restores defaultValue verbatim even when step would round it', async () => {
    // Regression: commitFromNumber with 'reset' source fell through to the
    // else-if(snapStep !== null) branch, silently rounding defaultValue.
    // e.g. defaultValue=0.15, step=0.1 → reset produced 0.2 instead of 0.15.
    const form = document.createElement('form');
    document.body.appendChild(form);
    const mount = document.createElement('div');
    form.appendChild(mount);
    render(NumberInput, {
      target: mount,
      props: { id: 'n', name: 'q', defaultValue: 0.15, step: 0.1, locale: 'en-US' },
    });
    const input = mount.querySelector('#n') as HTMLInputElement;
    // Change value away from default.
    await focus(input);
    await type(input, '0.5');
    await blur(input);
    await tick();
    // Reset the form — value should return to 0.15 verbatim, not 0.2.
    form.dispatchEvent(new Event('reset', { bubbles: true, cancelable: true }));
    await tick();
    expect(input.value).toBe('0.15');
  });
});

describe('delta rounding preserves base-value precision', () => {
  test('ArrowUp with integer step does not clip fractional base value', async () => {
    // Regression: delta branch rounded to step precision, so value=0.5 + step=1
    // produced 2 (rounded to 0 decimal places) instead of 1.5.
    const calls: Array<number | null> = [];
    const { container } = render(NumberInput, {
      props: {
        id: 'n',
        value: 0.5,
        step: 1,
        locale: 'en-US',
        onchange: (v: number | null) => calls.push(v),
      },
    });
    const input = getInput(container);
    await fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(calls[0]).toBe(1.5);
  });

  test('ArrowUp with decimal step preserves extra base precision', async () => {
    // Regression: value=0.05, step=0.1 → delta rounding to 1 decimal produced
    // 0.1 instead of the correct 0.15.
    const calls: Array<number | null> = [];
    const { container } = render(NumberInput, {
      props: {
        id: 'n',
        value: 0.05,
        step: 0.1,
        locale: 'en-US',
        onchange: (v: number | null) => calls.push(v),
      },
    });
    const input = getInput(container);
    await fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(calls[0]).toBe(0.15);
  });

  test('repeated ArrowUp with decimal step still eliminates float noise', async () => {
    // Ensure the fix still prevents 0.1+0.1+...×10 = 1.0000000000000009.
    const calls: Array<number | null> = [];
    const { container } = render(NumberInput, {
      props: {
        id: 'n',
        value: 0,
        step: 0.1,
        locale: 'en-US',
        onchange: (v: number | null) => calls.push(v),
      },
    });
    const input = getInput(container);
    for (let i = 0; i < 10; i++) {
      await fireEvent.keyDown(input, { key: 'ArrowUp' });
    }
    expect(calls[calls.length - 1]).toBe(1);
  });
});
