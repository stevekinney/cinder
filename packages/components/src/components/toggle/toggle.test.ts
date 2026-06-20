/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';
import type { ComponentProps } from 'svelte';

import { setupHappyDom } from '../../test/happy-dom.ts';

// setupHappyDom() MUST run before any `@testing-library/svelte` import. testing-library
// reads `globalThis.document` / `window` at module-init (top-level, not inside test bodies),
// so we register happy-dom's globals first and then dynamic-import testing-library below.
setupHappyDom();

const { render, fireEvent, screen, cleanup } = await import('@testing-library/svelte');
const { default: Toggle } = await import('./toggle.svelte');

// Unmount renders between tests; shared document.body otherwise leaks activeElement/nodes.
afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

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

  test('label prop becomes the accessible name of the switch (via the rendered label)', () => {
    render(Toggle, {
      props: { id: 't4', checked: false, label: 'Enable notifications' },
    });
    // getByRole throws if the accessible name does not resolve, so reaching the
    // assertion already proves the name; assert on the element to avoid a vacuous check.
    expect(screen.getByRole('switch', { name: 'Enable notifications' }).tagName).toBe('BUTTON');
  });

  test('switch is named via aria-labelledby pointing at the rendered label element, not aria-label', () => {
    const { container } = render(Toggle, {
      props: { id: 't4b', checked: false, label: 'Enable notifications' },
    });
    const button = container.querySelector('button');
    const label = container.querySelector('.cinder-toggle-field__label');
    expect(button?.hasAttribute('aria-label')).toBe(false);
    expect(label?.getAttribute('id')).toBe('t4b-label');
    expect(button?.getAttribute('aria-labelledby')).toBe('t4b-label');
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

describe('Toggle — rendered label', () => {
  test('clicking the label flips checked (label onclick calls toggle)', async () => {
    const { container } = render(Toggle, {
      props: { id: 't17', checked: false, label: 'Dark mode' },
    });
    const button = container.querySelector('button') as HTMLButtonElement;
    const label = container.querySelector('.cinder-toggle-field__label') as HTMLElement;
    await fireEvent.click(label);
    expect(button.getAttribute('aria-checked')).toBe('true');
  });

  test('clicking the label of a disabled toggle does not flip checked', async () => {
    const { container } = render(Toggle, {
      props: { id: 't18', checked: false, label: 'Dark mode', disabled: true },
    });
    const button = container.querySelector('button') as HTMLButtonElement;
    const label = container.querySelector('.cinder-toggle-field__label') as HTMLElement;
    await fireEvent.click(label);
    expect(button.getAttribute('aria-checked')).toBe('false');
  });

  test('disabled sets data-disabled on the label', () => {
    const { container } = render(Toggle, {
      props: { id: 't19', checked: false, label: 'Dark mode', disabled: true },
    });
    const label = container.querySelector('.cinder-toggle-field__label');
    expect(label?.hasAttribute('data-disabled')).toBe(true);
  });

  test('enabled toggle label has no data-disabled', () => {
    const { container } = render(Toggle, {
      props: { id: 't20', checked: false, label: 'Dark mode' },
    });
    const label = container.querySelector('.cinder-toggle-field__label');
    expect(label?.hasAttribute('data-disabled')).toBe(false);
  });
});

describe('Toggle — form participation', () => {
  test('no hidden input is rendered when name is unset', () => {
    const { container } = render(Toggle, {
      props: { id: 'tf1', checked: false, label: 'Notifications' },
    });
    expect(container.querySelector('input[type="checkbox"]')).toBeNull();
  });

  test('hidden checkbox input appears when name is set', () => {
    const { container } = render(Toggle, {
      props: { id: 'tf2', checked: false, label: 'Notifications', name: 'notifications' },
    });
    const input = container.querySelector('input[type="checkbox"]');
    expect(input).not.toBeNull();
    expect(input?.getAttribute('name')).toBe('notifications');
  });

  test('hidden input defaults its submitted value to "on"', () => {
    // Form submission reads the input's `value` DOM *property*, which defaults to
    // the native checkbox default "on" when no explicit value is passed. We assert
    // the property (not the attribute) because that is exactly what FormData carries.
    const { container } = render(Toggle, {
      props: { id: 'tf3', checked: false, label: 'Notifications', name: 'notifications' },
    });
    const input = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(input.value).toBe('on');
  });

  test('hidden input carries a custom value', () => {
    const { container } = render(Toggle, {
      props: {
        id: 'tf4',
        checked: false,
        label: 'Notifications',
        name: 'notifications',
        value: 'enabled',
      },
    });
    const input = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(input.value).toBe('enabled');
  });

  test('hidden input reflects checked=true', () => {
    const { container } = render(Toggle, {
      props: { id: 'tf5', checked: true, label: 'Notifications', name: 'notifications' },
    });
    const input = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(input.checked).toBe(true);
  });

  test('hidden input reflects checked=false', () => {
    const { container } = render(Toggle, {
      props: { id: 'tf6', checked: false, label: 'Notifications', name: 'notifications' },
    });
    const input = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(input.checked).toBe(false);
  });

  test('hidden input tracks checked after a click', async () => {
    const { container } = render(Toggle, {
      props: { id: 'tf7', checked: false, label: 'Notifications', name: 'notifications' },
    });
    const button = container.querySelector('button') as HTMLButtonElement;
    const input = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(input.checked).toBe(false);
    await fireEvent.click(button);
    expect(input.checked).toBe(true);
  });

  test('hidden input uses the `hidden` attribute (non-focusable, out of the a11y tree)', () => {
    const { container } = render(Toggle, {
      props: { id: 'tf8', checked: false, label: 'Notifications', name: 'notifications' },
    });
    const input = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
    // `hidden` (display:none) makes the control genuinely non-focusable and absent
    // from the accessibility tree — no aria-hidden-focus violation. It must NOT
    // carry aria-hidden/tabindex (those would imply a focusable-but-hidden element).
    expect(input.hidden).toBe(true);
    expect(input.hasAttribute('aria-hidden')).toBe(false);
    expect(input.hasAttribute('tabindex')).toBe(false);
  });

  test('form prop associates the hidden input with a form by id', () => {
    const { container } = render(Toggle, {
      props: {
        id: 'tf9',
        checked: false,
        label: 'Notifications',
        name: 'notifications',
        form: 'settings-form',
      },
    });
    const input = container.querySelector('input[type="checkbox"]');
    expect(input?.getAttribute('form')).toBe('settings-form');
  });

  test('form prop associates the input with an EXTERNAL form by id (real association)', () => {
    const externalForm = document.createElement('form');
    externalForm.id = 'external-settings-form';
    document.body.appendChild(externalForm);
    try {
      // Render the toggle OUTSIDE the form; the `form` attribute must associate
      // the hidden input with the external form so it submits with it.
      const { container } = render(Toggle, {
        props: {
          id: 'tf9b',
          checked: true,
          label: 'Notifications',
          name: 'notifications',
          form: 'external-settings-form',
        },
      });
      const input = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
      expect(input.form).toBe(externalForm);
    } finally {
      externalForm.remove();
    }
  });

  // The feature's actual contract is native form serialization. We render the
  // toggle INTO a real <form> and assert the hidden input is form-associated and
  // carries the exact properties a browser's FormData reads (`name`, live
  // `.checked` and `.value` DOM properties, `disabled`). We assert the DOM
  // properties rather than `new FormData(form)` because happy-dom's FormData
  // serializer does not pick up a checkbox nested under wrapper elements (it
  // returns null even though `input.form === form` and `input.checked` is true);
  // the properties below ARE what a real browser serializes, so this proves the
  // contract without depending on the test environment's FormData implementation.
  function renderInForm(props: ComponentProps<typeof Toggle>) {
    const form = document.createElement('form');
    document.body.appendChild(form);
    const result = render(Toggle, { target: form, props });
    const input = form.querySelector('input[type="checkbox"]') as HTMLInputElement;
    return { form, input, ...result, teardown: () => form.remove() };
  }

  test('checked toggle: input is form-associated and submits name=on', () => {
    const { form, input, teardown } = renderInForm({
      id: 'tf10',
      checked: true,
      label: 'Notifications',
      name: 'notifications',
    });
    try {
      expect(input.form).toBe(form); // associated with THIS form → included in submission
      expect(input.name).toBe('notifications');
      expect(input.checked).toBe(true); // checked → field is submitted
      expect(input.value).toBe('on'); // default submitted value
      expect(input.disabled).toBe(false);
    } finally {
      teardown();
    }
  });

  test('checked toggle carries a custom submitted value', () => {
    const { input, teardown } = renderInForm({
      id: 'tf11',
      checked: true,
      label: 'Notifications',
      name: 'notifications',
      value: 'enabled',
    });
    try {
      expect(input.checked).toBe(true);
      expect(input.value).toBe('enabled');
    } finally {
      teardown();
    }
  });

  test('unchecked toggle: input is present but checked=false (omitted from submission)', () => {
    const { input, teardown } = renderInForm({
      id: 'tf12',
      checked: false,
      label: 'Notifications',
      name: 'notifications',
    });
    try {
      expect(input.checked).toBe(false); // unchecked checkboxes are omitted from FormData
    } finally {
      teardown();
    }
  });

  // Note: the click→input.checked-tracks assertion (which proves `bind:checked`
  // updates the live property, not just the initial attribute) is covered by the
  // "hidden input tracks checked after a click" test above using the standard
  // render. fireEvent.click does not propagate through testing-library's
  // `target: <form>` mount, so it is asserted there, not here.

  test('disabled toggle: hidden input is disabled (excluded from submission) even when checked', () => {
    const { input, teardown } = renderInForm({
      id: 'tf14',
      checked: true,
      label: 'Notifications',
      name: 'notifications',
      disabled: true,
    });
    try {
      expect(input.disabled).toBe(true); // disabled controls are excluded from FormData
      expect(input.checked).toBe(true);
    } finally {
      teardown();
    }
  });
});

describe('Toggle — hideLabel', () => {
  test('accessible name is preserved when hideLabel is set', () => {
    render(Toggle, {
      props: { id: 't21', checked: false, label: 'Mute', hideLabel: true },
    });
    // A broken hidden recipe, detached reference, or duplicate id would fail this query
    // (getByRole throws on miss). Assert on the element to avoid a vacuous null check.
    expect(screen.getByRole('switch', { name: 'Mute' }).tagName).toBe('BUTTON');
  });

  test('hideLabel sets data-hidden on the label so it is removed from layout flow', () => {
    const { container } = render(Toggle, {
      props: { id: 't22', checked: false, label: 'Mute', hideLabel: true },
    });
    const label = container.querySelector('.cinder-toggle-field__label');
    expect(label?.hasAttribute('data-hidden')).toBe(true);
  });

  test('default render does not set data-hidden', () => {
    const { container } = render(Toggle, {
      props: { id: 't23', checked: false, label: 'Mute' },
    });
    const label = container.querySelector('.cinder-toggle-field__label');
    expect(label?.hasAttribute('data-hidden')).toBe(false);
  });
});

describe('Toggle — FormField context', () => {
  test('inherits disabled from a wrapping FormField when own disabled is unset', async () => {
    const { default: FormFieldToggleFixture } =
      await import('../../test/fixtures/form-field-toggle-fixture.svelte');
    const { container } = render(FormFieldToggleFixture, {
      props: { fieldId: 'ctx-toggle', fieldLabel: 'Notifications', disabled: true },
    });
    const button = container.querySelector('button[role="switch"]') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  test('an unwrapped Toggle is enabled by default', () => {
    const { container } = render(Toggle, {
      props: { id: 't-ctx-default', checked: false, label: 'Standalone' },
    });
    const button = container.querySelector('button[role="switch"]') as HTMLButtonElement;
    expect(button.disabled).toBe(false);
  });
});
