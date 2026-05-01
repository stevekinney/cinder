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
      props: { id: 't1', checked: false, label: 'Dark mode' },
    });
    const button = container.querySelector('button');
    expect(button?.getAttribute('type')).toBe('button');
  });

  test('checked API button has role="switch"', () => {
    const { container } = render(Toggle, {
      props: { id: 't1b', checked: false, label: 'Dark mode' },
    });
    const button = container.querySelector('button');
    expect(button?.getAttribute('role')).toBe('switch');
  });

  test('checked API button does not use toggle-button aria-pressed semantics', () => {
    const { container } = render(Toggle, {
      props: { id: 't1c', checked: false, label: 'Dark mode' },
    });
    const button = container.querySelector('button');
    expect(button?.hasAttribute('aria-pressed')).toBe(false);
  });

  test('button has aria-checked="false" initially', () => {
    const { container } = render(Toggle, {
      props: { id: 't2', checked: false, label: 'Dark mode' },
    });
    const button = container.querySelector('button');
    expect(button?.getAttribute('aria-checked')).toBe('false');
  });

  test('button has aria-checked="true" when checked=true', () => {
    const { container } = render(Toggle, {
      props: { id: 't3', checked: true, label: 'Dark mode' },
    });
    const button = container.querySelector('button');
    expect(button?.getAttribute('aria-checked')).toBe('true');
  });

  test('label prop becomes aria-label on the button', () => {
    const { container } = render(Toggle, {
      props: { id: 't4', checked: false, label: 'Enable notifications' },
    });
    const button = container.querySelector('button');
    expect(button?.getAttribute('aria-label')).toBe('Enable notifications');
  });

  test('id prop is set on the button element', () => {
    const { container } = render(Toggle, {
      props: { id: 'my-toggle', checked: false, label: 'Toggle' },
    });
    const button = container.querySelector('button');
    expect(button?.getAttribute('id')).toBe('my-toggle');
  });

  test('root class is cinder-toggle', () => {
    const { container } = render(Toggle, { props: { id: 't5', checked: false, label: 'Toggle' } });
    const button = container.querySelector('button');
    expect(button?.classList.contains('cinder-toggle')).toBe(true);
  });

  test('custom class merges with cinder-toggle', () => {
    const { container } = render(Toggle, {
      props: { id: 't6', checked: false, label: 'Toggle', class: 'extra-class' },
    });
    const classAttr = container.querySelector('button')?.getAttribute('class') ?? '';
    expect(classAttr).toContain('cinder-toggle');
    expect(classAttr).toContain('extra-class');
  });

  test('thumb span is present and aria-hidden', () => {
    const { container } = render(Toggle, { props: { id: 't7', checked: false, label: 'Toggle' } });
    const thumb = container.querySelector('.cinder-toggle__thumb');
    expect(thumb).not.toBeNull();
    expect(thumb?.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('Toggle — disabled state', () => {
  test('disabled button has disabled attribute', () => {
    const { container } = render(Toggle, {
      props: { id: 't8', checked: false, label: 'Toggle', disabled: true },
    });
    const button = container.querySelector('button');
    expect(button?.hasAttribute('disabled')).toBe(true);
  });

  test('disabled button does not have aria-disabled (native disabled is sufficient)', () => {
    const { container } = render(Toggle, {
      props: { id: 't9', checked: false, label: 'Toggle', disabled: true },
    });
    const button = container.querySelector('button');
    // The native `disabled` attribute is authoritative for <button>. Adding aria-disabled
    // alongside it causes double-announcement in some screen readers.
    expect(button?.hasAttribute('disabled')).toBe(true);
    expect(button?.hasAttribute('aria-disabled')).toBe(false);
  });

  test('enabled button does not have aria-disabled', () => {
    const { container } = render(Toggle, {
      props: { id: 't10', checked: false, label: 'Toggle', disabled: false },
    });
    const button = container.querySelector('button');
    expect(button?.hasAttribute('aria-disabled')).toBe(false);
  });

  test('disabled blocks toggle — click does not change checked', () => {
    const { container } = render(Toggle, {
      props: { id: 't11', checked: false, label: 'Toggle', disabled: true },
    });
    const button = container.querySelector('button') as HTMLButtonElement;
    // Disabled buttons do not fire click events in browsers; verify aria-checked unchanged.
    fireEvent.click(button);
    expect(button.getAttribute('aria-checked')).toBe('false');
  });
});

describe('Toggle — interactive behaviour', () => {
  test('click toggles aria-checked from false to true', async () => {
    const { container } = render(Toggle, { props: { id: 't12', checked: false, label: 'Toggle' } });
    const button = container.querySelector('button') as HTMLButtonElement;
    await fireEvent.click(button);
    expect(button.getAttribute('aria-checked')).toBe('true');
  });

  test('second click toggles aria-checked back to false', async () => {
    const { container } = render(Toggle, { props: { id: 't13', checked: false, label: 'Toggle' } });
    const button = container.querySelector('button') as HTMLButtonElement;
    await fireEvent.click(button);
    await fireEvent.click(button);
    expect(button.getAttribute('aria-checked')).toBe('false');
  });

  test('data-cinder-checked attribute reflects checked state', async () => {
    const { container } = render(Toggle, { props: { id: 't14', checked: false, label: 'Toggle' } });
    const button = container.querySelector('button') as HTMLButtonElement;
    expect(button.hasAttribute('data-cinder-checked')).toBe(false);
    await fireEvent.click(button);
    expect(button.getAttribute('data-cinder-checked')).toBe('');
  });

  // Enter and Space are handled by native <button> behavior in real browsers. However,
  // happy-dom does not synthesize a click from keydown, so we cannot assert that
  // aria-checked changes here. Instead we verify that the keydown fires without throwing
  // and that the button carries the correct ARIA semantics for real browsers to act on.
  test('Enter key fires without error; button has correct aria-checked and type', async () => {
    const { container } = render(Toggle, { props: { id: 't15', checked: false, label: 'Toggle' } });
    const button = container.querySelector('button') as HTMLButtonElement;
    expect(button.getAttribute('type')).toBe('button');
    expect(button.getAttribute('aria-checked')).toBe('false');

    // Should not throw.
    await fireEvent.keyDown(button, { key: 'Enter', code: 'Enter' });
  });

  test('Space key fires without error; button has correct aria-checked and type', async () => {
    const { container } = render(Toggle, { props: { id: 't16', checked: false, label: 'Toggle' } });
    const button = container.querySelector('button') as HTMLButtonElement;
    expect(button.getAttribute('type')).toBe('button');
    expect(button.getAttribute('aria-checked')).toBe('false');

    // Should not throw.
    await fireEvent.keyDown(button, { key: ' ', code: 'Space' });
  });
});
