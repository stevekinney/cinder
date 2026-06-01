/// <reference lib="dom" />
import { describe, expect, mock, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { render, fireEvent } = await import('@testing-library/svelte');
const { default: PinInput } = await import('./pin-input.svelte');

/**
 * Render PinInput with a default accessible name so the dev `No accessible name
 * source` warning does not flood the test output. If the test already supplies
 * a name source (`label`, `aria-label`, or `aria-labelledby`), it is preserved
 * untouched so name-resolution tests still exercise the real precedence.
 *
 * Mirrors the render(PinInput, { props }) shape so call sites only swap the
 * function name.
 */
function renderPin(options: {
  props: { id: string; value: string } & Record<string, unknown>;
}): ReturnType<typeof render> {
  const { props } = options;
  const hasName = 'label' in props || 'aria-label' in props || 'aria-labelledby' in props;
  const resolvedProps = hasName ? props : { ...props, 'aria-label': 'Code' };
  return render(PinInput, { props: resolvedProps });
}

function segments(container: Element): HTMLInputElement[] {
  return Array.from(container.querySelectorAll<HTMLInputElement>('input[data-cinder-pin-segment]'));
}

describe('PinInput rendering', () => {
  test('renders 6 segments by default', () => {
    const { container } = renderPin({ props: { id: 'otp', value: '' } });
    expect(segments(container)).toHaveLength(6);
  });

  test('honors configurable length', () => {
    const { container } = renderPin({ props: { id: 'otp', value: '', length: 4 } });
    expect(segments(container)).toHaveLength(4);
  });

  test('clamps length below 1 to 1', () => {
    const { container } = renderPin({ props: { id: 'otp', value: '', length: 0 } });
    expect(segments(container)).toHaveLength(1);
  });

  test('clamps length above 12 to 12', () => {
    const { container } = renderPin({ props: { id: 'otp', value: '', length: 99 } });
    expect(segments(container)).toHaveLength(12);
  });

  test('group has role="group" and references the label', () => {
    const { container } = renderPin({
      props: { id: 'otp', value: '', label: 'Verification code' },
    });
    const group = container.querySelector('[role="group"]')!;
    expect(group).not.toBeNull();
    const labelledBy = group.getAttribute('aria-labelledby');
    expect(labelledBy).toBe('otp-label');
    const labelElement = container.querySelector('#otp-label');
    expect(labelElement?.textContent?.trim()).toBe('Verification code');
  });

  test('falls back to aria-label when no other name source is supplied', () => {
    const { container } = renderPin({
      props: { id: 'otp', value: '', 'aria-label': 'Security code' },
    });
    const group = container.querySelector('[role="group"]')!;
    expect(group.getAttribute('aria-label')).toBe('Security code');
    expect(group.getAttribute('aria-labelledby')).toBeNull();
  });

  test('each segment has a unique visually hidden position label', () => {
    const { container } = renderPin({
      props: { id: 'otp', value: '', length: 3, label: 'Code' },
    });
    const ids = ['otp-segment-0-label', 'otp-segment-1-label', 'otp-segment-2-label'];
    for (const id of ids) {
      const node = container.querySelector(`#${id}`);
      expect(node).not.toBeNull();
      expect(node?.className).toContain('cinder-sr-only');
    }
  });

  test('renders hidden input only when name is provided', () => {
    const { container: noName } = renderPin({ props: { id: 'a', value: '' } });
    expect(noName.querySelector('input[type="hidden"]')).toBeNull();

    const { container: withName } = renderPin({
      props: { id: 'b', value: '123', name: 'otp' },
    });
    const hidden = withName.querySelector<HTMLInputElement>('input[type="hidden"]')!;
    expect(hidden).not.toBeNull();
    expect(hidden.getAttribute('name')).toBe('otp');
    expect(hidden.value).toBe('123');
  });

  test('first segment carries the one-time-code autocomplete hint', () => {
    const { container } = renderPin({ props: { id: 'otp', value: '' } });
    const all = segments(container);
    expect(all[0]?.getAttribute('autocomplete')).toBe('one-time-code');
    expect(all[1]?.getAttribute('autocomplete')).toBe('off');
  });
});

describe('PinInput numeric filtering', () => {
  test('filters non-digits in numeric mode on initial value', () => {
    const { container } = renderPin({ props: { id: 'otp', value: 'a1b2c3' } });
    const all = segments(container);
    expect(all.map((segment) => segment.value).join('')).toBe('123');
  });

  test('rejects typed letters in numeric mode', async () => {
    const { container } = renderPin({ props: { id: 'otp', value: '' } });
    const first = segments(container)[0]!;
    await fireEvent.input(first, { target: { value: 'a' } });
    expect(first.value).toBe('');
  });

  test('accepts typed digits in numeric mode and auto-advances', async () => {
    const { container } = renderPin({ props: { id: 'otp', value: '', length: 4 } });
    const all = segments(container);
    await fireEvent.input(all[0]!, { target: { value: '1' } });
    expect(all[0]!.value).toBe('1');
    expect(document.activeElement).toBe(all[1] ?? null);
  });
});

describe('PinInput alphanumeric mode', () => {
  test('accepts letters and digits', () => {
    const { container } = renderPin({
      props: { id: 'otp', value: 'ab12!@cd', mode: 'alphanumeric', length: 6 },
    });
    const all = segments(container);
    expect(all.map((segment) => segment.value).join('')).toBe('ab12cd');
  });
});

describe('PinInput keyboard navigation', () => {
  test('Backspace on empty segment moves focus back and clears previous', async () => {
    const { container } = renderPin({ props: { id: 'otp', value: '12', length: 4 } });
    const all = segments(container);
    all[2]!.focus();
    await fireEvent.keyDown(all[2]!, { key: 'Backspace' });
    expect(document.activeElement).toBe(all[1] ?? null);
    expect(all[1]!.value).toBe('');
  });

  test('Backspace on filled segment clears it without moving focus', async () => {
    const { container } = renderPin({ props: { id: 'otp', value: '12', length: 4 } });
    const all = segments(container);
    all[1]!.focus();
    await fireEvent.keyDown(all[1]!, { key: 'Backspace' });
    expect(document.activeElement).toBe(all[1] ?? null);
    expect(all[1]!.value).toBe('');
  });

  test('arrow keys navigate between segments', async () => {
    const { container } = renderPin({ props: { id: 'otp', value: '12', length: 4 } });
    const all = segments(container);
    all[0]!.focus();
    await fireEvent.keyDown(all[0]!, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(all[1] ?? null);
    await fireEvent.keyDown(all[1]!, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(all[0] ?? null);
  });

  test('ArrowLeft on the first segment does not wrap or move focus', async () => {
    const { container } = renderPin({ props: { id: 'otp', value: '12', length: 4 } });
    const all = segments(container);
    all[0]!.focus();
    await fireEvent.keyDown(all[0]!, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(all[0] ?? null);
  });

  test('ArrowRight on the last segment does not wrap or move focus', async () => {
    const { container } = renderPin({ props: { id: 'otp', value: '1234', length: 4 } });
    const all = segments(container);
    all[3]!.focus();
    await fireEvent.keyDown(all[3]!, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(all[3] ?? null);
  });

  test('Home focuses the first segment from any position', async () => {
    const { container } = renderPin({ props: { id: 'otp', value: '1234', length: 4 } });
    const all = segments(container);
    all[2]!.focus();
    await fireEvent.keyDown(all[2]!, { key: 'Home' });
    expect(document.activeElement).toBe(all[0] ?? null);
  });

  test('End focuses the last segment from any position', async () => {
    const { container } = renderPin({ props: { id: 'otp', value: '1', length: 4 } });
    const all = segments(container);
    all[0]!.focus();
    await fireEvent.keyDown(all[0]!, { key: 'End' });
    expect(document.activeElement).toBe(all[3] ?? null);
  });
});

describe('PinInput paste and autofill', () => {
  test('paste distributes characters across segments from the focused one', async () => {
    const { container } = renderPin({ props: { id: 'otp', value: '', length: 6 } });
    const all = segments(container);
    all[0]!.focus();
    const data = new DataTransfer();
    data.setData('text', '123456');
    await fireEvent.paste(all[0]!, { clipboardData: data });
    expect(all.map((segment) => segment.value).join('')).toBe('123456');
  });

  test('multi-character autofill into first segment distributes across', async () => {
    const { container } = renderPin({ props: { id: 'otp', value: '', length: 4 } });
    const all = segments(container);
    await fireEvent.input(all[0]!, { target: { value: '4321' } });
    expect(all.map((segment) => segment.value).join('')).toBe('4321');
  });
});

describe('PinInput masked mode', () => {
  test('renders type="password" segments but emits raw value', () => {
    const { container } = renderPin({
      props: { id: 'otp', value: '1234', masked: true, length: 4 },
    });
    const all = segments(container);
    expect(all.every((segment) => segment.getAttribute('type') === 'password')).toBe(true);
    const hiddenContainer = container.querySelector('.cinder-pin-input');
    expect(hiddenContainer).not.toBeNull();
    // bindable value reflects the raw characters even though the visible
    // segments are masked — segment.value still holds the real char.
    expect(all.map((segment) => segment.value).join('')).toBe('1234');
  });
});

describe('PinInput error / disabled / required', () => {
  test('error sets aria-invalid on the group and renders message', () => {
    const { container } = renderPin({
      props: { id: 'otp', value: '', error: 'Invalid code', length: 3 },
    });
    const group = container.querySelector<HTMLElement>('[role="group"]');
    expect(group?.getAttribute('aria-invalid')).toBe('true');
    // Individual segments should NOT carry aria-invalid — screen readers would
    // announce "invalid" on every segment as the user tabs through.
    const all = segments(container);
    expect(all.every((segment) => segment.getAttribute('aria-invalid') === null)).toBe(true);
    const errorNode = container.querySelector('#otp-error');
    expect(errorNode?.textContent).toContain('Invalid code');
  });

  test('group invalid state reaches visible segment styling without segment aria-invalid', async () => {
    const css = await Bun.file(new URL('./pin-input.css', import.meta.url)).text();
    expect(css).toContain(".cinder-pin-input[aria-invalid='true'] .cinder-pin-input__segment");
  });

  test('description wires aria-describedby on every segment', () => {
    const { container } = renderPin({
      props: { id: 'otp', value: '', description: 'Enter the 6-digit code we sent you.' },
    });
    const all = segments(container);
    expect(
      all.every((segment) => segment.getAttribute('aria-describedby') === 'otp-description'),
    ).toBe(true);
  });

  test('disabled disables every segment and the hidden input', () => {
    const { container } = renderPin({
      props: { id: 'otp', value: '1', name: 'otp', disabled: true },
    });
    const all = segments(container);
    expect(all.every((segment) => segment.disabled)).toBe(true);
    const hidden = container.querySelector<HTMLInputElement>('input[type="hidden"]')!;
    expect(hidden.disabled).toBe(true);
  });
});

describe('PinInput onchange', () => {
  test('fires for user-initiated input', async () => {
    const onchange = mock((_value: string) => {});
    const { container } = renderPin({
      props: { id: 'otp', value: '', length: 4, onchange },
    });
    const all = segments(container);
    await fireEvent.input(all[0]!, { target: { value: '5' } });
    expect(onchange).toHaveBeenCalledWith('5');
  });

  test('fires for paste', async () => {
    const onchange = mock((_value: string) => {});
    const { container } = renderPin({
      props: { id: 'otp', value: '', length: 4, onchange },
    });
    const all = segments(container);
    all[0]!.focus();
    const data = new DataTransfer();
    data.setData('text', '1234');
    await fireEvent.paste(all[0]!, { clipboardData: data });
    expect(onchange).toHaveBeenCalledWith('1234');
  });

  test('does not fire on external value prop synchronization', async () => {
    const onchange = mock((_value: string) => {});
    const { rerender } = renderPin({
      props: { id: 'otp', value: '', length: 4, onchange },
    });
    await rerender({ id: 'otp', value: '12', length: 4, onchange });
    expect(onchange).not.toHaveBeenCalled();
  });
});

describe('PinInput accessibility wiring', () => {
  test('Backspace on the first segment does not move focus away', async () => {
    const { container } = renderPin({ props: { id: 'otp', value: '1', length: 4 } });
    const all = segments(container);
    all[0]!.focus();
    await fireEvent.keyDown(all[0]!, { key: 'Backspace' });
    expect(document.activeElement).toBe(all[0] ?? null);
  });

  test('description + error compose into a single aria-describedby on every segment', () => {
    const { container } = renderPin({
      props: {
        id: 'otp',
        value: '',
        description: 'Enter the 6-digit code.',
        error: 'Code expired.',
      },
    });
    const all = segments(container);
    for (const segment of all) {
      const describedBy = segment.getAttribute('aria-describedby') ?? '';
      expect(describedBy).toContain('otp-description');
      expect(describedBy).toContain('otp-error');
    }
  });

  test('aria-required is announced on every segment, not on the group', () => {
    const { container } = renderPin({
      props: { id: 'otp', value: '', required: true },
    });
    const all = segments(container);
    expect(all.every((segment) => segment.getAttribute('aria-required') === 'true')).toBe(true);
    const group = container.querySelector('[role="group"]')!;
    expect(group.getAttribute('aria-required')).toBeNull();
  });

  test('aria-label-only group falls back to per-segment aria-label (no aria-labelledby)', () => {
    const { container } = renderPin({
      props: { id: 'otp', value: '', 'aria-label': 'Security code' },
    });
    const all = segments(container);
    expect(all[0]?.getAttribute('aria-labelledby')).toBeNull();
    expect(all[0]?.getAttribute('aria-label')).toContain('Security code');
    expect(all[0]?.getAttribute('aria-label')).toContain('character 1 of');
  });
});
