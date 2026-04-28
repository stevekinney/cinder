/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../test/happy-dom.ts';

// setupHappyDom() MUST run before any `@testing-library/svelte` import. testing-library
// reads `globalThis.document` / `window` at module-init (top-level, not inside test bodies),
// so we register happy-dom's globals first and then dynamic-import testing-library below.
setupHappyDom();

const { render, fireEvent } = await import('@testing-library/svelte');
const { default: Toggle } = await import('./toggle.svelte');

describe('Toggle — static rendering', () => {
  test('button has type="button"', () => {
    const { container } = render(Toggle, {
      props: { id: 't1', pressed: false, label: 'Dark mode' },
    });
    const button = container.querySelector('button');
    expect(button?.getAttribute('type')).toBe('button');
  });

  test('button has aria-pressed="false" initially', () => {
    const { container } = render(Toggle, {
      props: { id: 't2', pressed: false, label: 'Dark mode' },
    });
    const button = container.querySelector('button');
    expect(button?.getAttribute('aria-pressed')).toBe('false');
  });

  test('button has aria-pressed="true" when pressed=true', () => {
    const { container } = render(Toggle, {
      props: { id: 't3', pressed: true, label: 'Dark mode' },
    });
    const button = container.querySelector('button');
    expect(button?.getAttribute('aria-pressed')).toBe('true');
  });

  test('label prop becomes aria-label on the button', () => {
    const { container } = render(Toggle, {
      props: { id: 't4', pressed: false, label: 'Enable notifications' },
    });
    const button = container.querySelector('button');
    expect(button?.getAttribute('aria-label')).toBe('Enable notifications');
  });

  test('id prop is set on the button element', () => {
    const { container } = render(Toggle, {
      props: { id: 'my-toggle', pressed: false, label: 'Toggle' },
    });
    const button = container.querySelector('button');
    expect(button?.getAttribute('id')).toBe('my-toggle');
  });

  test('root class is cinder-toggle', () => {
    const { container } = render(Toggle, { props: { id: 't5', pressed: false, label: 'Toggle' } });
    const button = container.querySelector('button');
    expect(button?.classList.contains('cinder-toggle')).toBe(true);
  });

  test('custom class merges with cinder-toggle', () => {
    const { container } = render(Toggle, {
      props: { id: 't6', pressed: false, label: 'Toggle', class: 'extra-class' },
    });
    const classAttr = container.querySelector('button')?.getAttribute('class') ?? '';
    expect(classAttr).toContain('cinder-toggle');
    expect(classAttr).toContain('extra-class');
  });

  test('thumb span is present and aria-hidden', () => {
    const { container } = render(Toggle, { props: { id: 't7', pressed: false, label: 'Toggle' } });
    const thumb = container.querySelector('.cinder-toggle__thumb');
    expect(thumb).not.toBeNull();
    expect(thumb?.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('Toggle — disabled state', () => {
  test('disabled button has disabled attribute', () => {
    const { container } = render(Toggle, {
      props: { id: 't8', pressed: false, label: 'Toggle', disabled: true },
    });
    const button = container.querySelector('button');
    expect(button?.hasAttribute('disabled')).toBe(true);
  });

  test('disabled button does not have aria-disabled (native disabled is sufficient)', () => {
    const { container } = render(Toggle, {
      props: { id: 't9', pressed: false, label: 'Toggle', disabled: true },
    });
    const button = container.querySelector('button');
    // The native `disabled` attribute is authoritative for <button>. Adding aria-disabled
    // alongside it causes double-announcement in some screen readers.
    expect(button?.hasAttribute('disabled')).toBe(true);
    expect(button?.hasAttribute('aria-disabled')).toBe(false);
  });

  test('enabled button does not have aria-disabled', () => {
    const { container } = render(Toggle, {
      props: { id: 't10', pressed: false, label: 'Toggle', disabled: false },
    });
    const button = container.querySelector('button');
    expect(button?.hasAttribute('aria-disabled')).toBe(false);
  });

  test('disabled blocks toggle — click does not change pressed', () => {
    const { container } = render(Toggle, {
      props: { id: 't11', pressed: false, label: 'Toggle', disabled: true },
    });
    const button = container.querySelector('button') as HTMLButtonElement;
    // Disabled buttons do not fire click events in browsers; verify aria-pressed unchanged.
    fireEvent.click(button);
    expect(button.getAttribute('aria-pressed')).toBe('false');
  });
});

describe('Toggle — interactive behaviour', () => {
  test('click toggles aria-pressed from false to true', async () => {
    const { container } = render(Toggle, { props: { id: 't12', pressed: false, label: 'Toggle' } });
    const button = container.querySelector('button') as HTMLButtonElement;
    await fireEvent.click(button);
    expect(button.getAttribute('aria-pressed')).toBe('true');
  });

  test('second click toggles aria-pressed back to false', async () => {
    const { container } = render(Toggle, { props: { id: 't13', pressed: false, label: 'Toggle' } });
    const button = container.querySelector('button') as HTMLButtonElement;
    await fireEvent.click(button);
    await fireEvent.click(button);
    expect(button.getAttribute('aria-pressed')).toBe('false');
  });

  test('data-cinder-pressed attribute reflects pressed state', async () => {
    const { container } = render(Toggle, { props: { id: 't14', pressed: false, label: 'Toggle' } });
    const button = container.querySelector('button') as HTMLButtonElement;
    expect(button.hasAttribute('data-cinder-pressed')).toBe(false);
    await fireEvent.click(button);
    expect(button.getAttribute('data-cinder-pressed')).toBe('');
  });

  // Enter and Space are handled by native <button> behavior in real browsers. However,
  // happy-dom does not synthesize a click from keydown, so we cannot assert that
  // aria-pressed changes here. Instead we verify that the keydown fires without throwing
  // and that the button carries the correct ARIA semantics for real browsers to act on.
  test('Enter key fires without error; button has correct aria-pressed and type', async () => {
    const { container } = render(Toggle, { props: { id: 't15', pressed: false, label: 'Toggle' } });
    const button = container.querySelector('button') as HTMLButtonElement;
    expect(button.getAttribute('type')).toBe('button');
    expect(button.getAttribute('aria-pressed')).toBe('false');

    // Should not throw.
    await fireEvent.keyDown(button, { key: 'Enter', code: 'Enter' });
  });

  test('Space key fires without error; button has correct aria-pressed and type', async () => {
    const { container } = render(Toggle, { props: { id: 't16', pressed: false, label: 'Toggle' } });
    const button = container.querySelector('button') as HTMLButtonElement;
    expect(button.getAttribute('type')).toBe('button');
    expect(button.getAttribute('aria-pressed')).toBe('false');

    // Should not throw.
    await fireEvent.keyDown(button, { key: ' ', code: 'Space' });
  });
});
