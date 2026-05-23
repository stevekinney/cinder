/// <reference lib="dom" />
import { describe, expect, mock, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { render, fireEvent } = await import('@testing-library/svelte');
const { default: PinInput } = await import('./pin-input.svelte');

function segments(container: Element): HTMLInputElement[] {
  return Array.from(container.querySelectorAll<HTMLInputElement>('input[data-cinder-pin-segment]'));
}

describe('PinInput rendering', () => {
  test('renders 6 segments by default', () => {
    const { container } = render(PinInput, { props: { id: 'otp', value: '' } });
    expect(segments(container)).toHaveLength(6);
  });

  test('honors configurable length', () => {
    const { container } = render(PinInput, { props: { id: 'otp', value: '', length: 4 } });
    expect(segments(container)).toHaveLength(4);
  });

  test('clamps length below 1 to 1', () => {
    const { container } = render(PinInput, { props: { id: 'otp', value: '', length: 0 } });
    expect(segments(container)).toHaveLength(1);
  });

  test('clamps length above 12 to 12', () => {
    const { container } = render(PinInput, { props: { id: 'otp', value: '', length: 99 } });
    expect(segments(container)).toHaveLength(12);
  });

  test('group has role="group" and references the label', () => {
    const { container } = render(PinInput, {
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
    const { container } = render(PinInput, {
      props: { id: 'otp', value: '', 'aria-label': 'Security code' },
    });
    const group = container.querySelector('[role="group"]')!;
    expect(group.getAttribute('aria-label')).toBe('Security code');
    expect(group.getAttribute('aria-labelledby')).toBeNull();
  });

  test('each segment has a unique visually hidden position label', () => {
    const { container } = render(PinInput, {
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
    const { container: noName } = render(PinInput, { props: { id: 'a', value: '' } });
    expect(noName.querySelector('input[type="hidden"]')).toBeNull();

    const { container: withName } = render(PinInput, {
      props: { id: 'b', value: '123', name: 'otp' },
    });
    const hidden = withName.querySelector<HTMLInputElement>('input[type="hidden"]')!;
    expect(hidden).not.toBeNull();
    expect(hidden.getAttribute('name')).toBe('otp');
    expect(hidden.value).toBe('123');
  });

  test('first segment carries the one-time-code autocomplete hint', () => {
    const { container } = render(PinInput, { props: { id: 'otp', value: '' } });
    const all = segments(container);
    expect(all[0]?.getAttribute('autocomplete')).toBe('one-time-code');
    expect(all[1]?.getAttribute('autocomplete')).toBe('off');
  });
});

describe('PinInput numeric filtering', () => {
  test('filters non-digits in numeric mode on initial value', () => {
    const { container } = render(PinInput, { props: { id: 'otp', value: 'a1b2c3' } });
    const all = segments(container);
    expect(all.map((segment) => segment.value).join('')).toBe('123');
  });

  test('rejects typed letters in numeric mode', async () => {
    const { container } = render(PinInput, { props: { id: 'otp', value: '' } });
    const first = segments(container)[0]!;
    await fireEvent.input(first, { target: { value: 'a' } });
    expect(first.value).toBe('');
  });

  test('accepts typed digits in numeric mode and auto-advances', async () => {
    const { container } = render(PinInput, { props: { id: 'otp', value: '', length: 4 } });
    const all = segments(container);
    await fireEvent.input(all[0]!, { target: { value: '1' } });
    expect(all[0]!.value).toBe('1');
    expect(document.activeElement).toBe(all[1] ?? null);
  });
});

describe('PinInput alphanumeric mode', () => {
  test('accepts letters and digits', () => {
    const { container } = render(PinInput, {
      props: { id: 'otp', value: 'ab12!@cd', mode: 'alphanumeric', length: 6 },
    });
    const all = segments(container);
    expect(all.map((segment) => segment.value).join('')).toBe('ab12cd');
  });
});

describe('PinInput keyboard navigation', () => {
  test('Backspace on empty segment moves focus back and clears previous', async () => {
    const { container } = render(PinInput, { props: { id: 'otp', value: '12', length: 4 } });
    const all = segments(container);
    all[2]!.focus();
    await fireEvent.keyDown(all[2]!, { key: 'Backspace' });
    expect(document.activeElement).toBe(all[1] ?? null);
    expect(all[1]!.value).toBe('');
  });

  test('Backspace on filled segment clears it without moving focus', async () => {
    const { container } = render(PinInput, { props: { id: 'otp', value: '12', length: 4 } });
    const all = segments(container);
    all[1]!.focus();
    await fireEvent.keyDown(all[1]!, { key: 'Backspace' });
    expect(document.activeElement).toBe(all[1] ?? null);
    expect(all[1]!.value).toBe('');
  });

  test('arrow keys navigate between segments', async () => {
    const { container } = render(PinInput, { props: { id: 'otp', value: '12', length: 4 } });
    const all = segments(container);
    all[0]!.focus();
    await fireEvent.keyDown(all[0]!, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(all[1] ?? null);
    await fireEvent.keyDown(all[1]!, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(all[0] ?? null);
  });
});

describe('PinInput paste and autofill', () => {
  test('paste distributes characters across segments from the focused one', async () => {
    const { container } = render(PinInput, { props: { id: 'otp', value: '', length: 6 } });
    const all = segments(container);
    all[0]!.focus();
    const data = new DataTransfer();
    data.setData('text', '123456');
    await fireEvent.paste(all[0]!, { clipboardData: data });
    expect(all.map((segment) => segment.value).join('')).toBe('123456');
  });

  test('multi-character autofill into first segment distributes across', async () => {
    const { container } = render(PinInput, { props: { id: 'otp', value: '', length: 4 } });
    const all = segments(container);
    await fireEvent.input(all[0]!, { target: { value: '4321' } });
    expect(all.map((segment) => segment.value).join('')).toBe('4321');
  });
});

describe('PinInput masked mode', () => {
  test('renders type="password" segments but emits raw value', () => {
    const { container } = render(PinInput, {
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
  test('error sets aria-invalid on every segment and renders message', () => {
    const { container } = render(PinInput, {
      props: { id: 'otp', value: '', error: 'Invalid code', length: 3 },
    });
    const all = segments(container);
    expect(all.every((segment) => segment.getAttribute('aria-invalid') === 'true')).toBe(true);
    const errorNode = container.querySelector('#otp-error');
    expect(errorNode?.textContent).toContain('Invalid code');
  });

  test('description wires aria-describedby on every segment', () => {
    const { container } = render(PinInput, {
      props: { id: 'otp', value: '', description: 'Enter the 6-digit code we sent you.' },
    });
    const all = segments(container);
    expect(
      all.every((segment) => segment.getAttribute('aria-describedby') === 'otp-description'),
    ).toBe(true);
  });

  test('disabled disables every segment and the hidden input', () => {
    const { container } = render(PinInput, {
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
    const { container } = render(PinInput, {
      props: { id: 'otp', value: '', length: 4, onchange },
    });
    const all = segments(container);
    await fireEvent.input(all[0]!, { target: { value: '5' } });
    expect(onchange).toHaveBeenCalledWith('5');
  });

  test('does not fire on external value prop synchronization', async () => {
    const onchange = mock((_value: string) => {});
    const { rerender } = render(PinInput, {
      props: { id: 'otp', value: '', length: 4, onchange },
    });
    await rerender({ id: 'otp', value: '12', length: 4, onchange });
    expect(onchange).not.toHaveBeenCalled();
  });
});
