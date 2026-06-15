/// <reference lib="dom" />
import { afterEach, describe, expect, mock, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { cleanup, fireEvent, render } = await import('@testing-library/svelte');
const { tick } = await import('svelte');
const { default: TagInput } = await import('./tag-input.svelte');
const { default: FormFieldTagInputFixture } =
  await import('../../test/fixtures/form-field-tag-input-fixture.svelte');

afterEach(() => cleanup());

function getInput(container: HTMLElement): HTMLInputElement {
  return container.querySelector('.cinder-tag-input__input') as HTMLInputElement;
}

// Committed tags render as a plain list (implicit role="list") of listitems,
// not a listbox of options — see tag-input.svelte for why. These helpers keep
// the historical names but target the list / chip elements so existing
// count/text assertions stay meaningful across the model change.
function getListbox(container: HTMLElement): HTMLElement {
  return container.querySelector('.cinder-tag-input__listbox') as HTMLElement;
}

function getOptions(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll('.cinder-tag-input__chip'));
}

// The focusable, keyboard-removable element per chip is the remove <button>.
// Keyboard tests assert focus / fire keydown against these, not the listitems.
function getRemoveButtons(container: HTMLElement): HTMLButtonElement[] {
  return Array.from(container.querySelectorAll('.cinder-tag-input__remove'));
}

function renderTagInputInForm(props: Record<string, unknown>) {
  const form = document.createElement('form');
  document.body.appendChild(form);
  const result = render(TagInput, { target: form, props });

  return {
    ...result,
    form,
    cleanup() {
      if (form.isConnected) document.body.removeChild(form);
    },
  };
}

describe('TagInput rendering', () => {
  test('renders committed tags as a list with the input after it in DOM order', () => {
    const { container } = render(TagInput, {
      props: { defaultValue: ['Svelte', 'Bun'] },
    });

    const control = container.querySelector('.cinder-tag-input__control');
    const listbox = getListbox(container);
    const input = getInput(container);

    expect(listbox).not.toBeNull();
    // The tag list is a plain list, NOT a listbox: it carries no role="listbox"
    // and its items carry no role="option"/aria-selected. Each tag is a real
    // listitem with a labeled remove button.
    expect(listbox.hasAttribute('role')).toBe(false);
    expect(container.querySelector('[role="listbox"]')).toBeNull();
    expect(container.querySelector('[role="option"]')).toBeNull();
    expect(getOptions(container)).toHaveLength(2);
    expect(control?.children[0]).toBe(listbox);
    expect(control?.children[1]).toBe(input);
  });

  test('hidden input mirrors committed tags when name is provided', () => {
    const { container } = render(TagInput, {
      props: { name: 'tags', defaultValue: ['Svelte', 'Bun'] },
    });

    const hiddenInputs = Array.from(
      container.querySelectorAll<HTMLInputElement>('input[type="hidden"][name="tags"]'),
    );
    expect(hiddenInputs.map((input) => input.value)).toEqual(['Svelte', 'Bun']);
  });

  test('the remove control is a real labeled button (reachable by pointer, voice, switch)', () => {
    const { container } = render(TagInput, {
      props: { defaultValue: ['Svelte'] },
    });

    const remove = container.querySelector('.cinder-tag-input__remove');
    // A real <button> with an accessible name — reachable by pointer, voice
    // control (Dragon, Voice Control), switch access, AND keyboard.
    expect(remove?.tagName.toLowerCase()).toBe('button');
    expect(remove?.getAttribute('aria-label')).toBe('Remove Svelte');
    // The button is a legal interactive child of a non-interactive listitem —
    // no nested-interactive, no aria-required-children (the list is not a
    // listbox). The first chip's button carries the roving tabindex.
    expect(remove?.getAttribute('tabindex')).toBe('0');

    const chip = getOptions(container)[0]!;
    expect(chip.getAttribute('role')).toBeNull();
    expect(chip.contains(remove)).toBe(true);
  });

  test('the first chip button is in the tab order; later chip buttons are roving (-1)', () => {
    const { container } = render(TagInput, {
      props: { defaultValue: ['Svelte', 'Bun'] },
    });
    const buttons = container.querySelectorAll<HTMLButtonElement>('.cinder-tag-input__remove');
    expect(buttons[0]?.getAttribute('tabindex')).toBe('0');
    expect(buttons[1]?.getAttribute('tabindex')).toBe('-1');
  });

  test('an empty tag input renders no remove buttons (roving index clamps to -1)', () => {
    const { container } = render(TagInput, { props: {} });
    // No tags → no buttons → no spurious tab stop. Guards the rovingChipIndex
    // clamp: a default of 0 with zero tags would be a dangling tab-stop index.
    expect(getOptions(container)).toHaveLength(0);
    expect(getRemoveButtons(container)).toHaveLength(0);
  });

  test('the tag list stays Tab-reachable after a controlled value shrinks below the focused index', async () => {
    // End-to-end guard for the stale-index scenario: focus is on a high chip
    // index, then the controlled value shrinks below it. The roving tab stop
    // must land on a surviving button (not vanish to all -1, which would make
    // the list Tab-unreachable). Two layers cooperate to guarantee this — the
    // rovingChipIndex `Math.min` clamp (synchronous) and the focusedChipIndex
    // reset $effect (after the DOM settles). This test asserts the user-facing
    // result; if BOTH guards regressed, it fails.
    const { container, rerender } = render(TagInput, { props: { value: ['A', 'B', 'C'] } });

    // Move the roving focus to the last chip's remove button (index 2).
    await fireEvent.focus(getRemoveButtons(container)[2]!);
    await tick();
    expect(getRemoveButtons(container)[2]!.getAttribute('tabindex')).toBe('0');

    // Controlled shrink to a single tag — index 2 no longer exists.
    await rerender({ value: ['A'] });
    await tick();

    const buttons = getRemoveButtons(container);
    expect(buttons).toHaveLength(1);
    // The surviving button must own the tab stop — the list is still reachable.
    expect(buttons[0]!.getAttribute('tabindex')).toBe('0');
  });

  test('readonly hides the remove control entirely and keeps the input read-only', () => {
    const { container } = render(TagInput, {
      props: { readonly: true, defaultValue: ['Svelte'] },
    });

    expect(getInput(container).readOnly).toBe(true);
    // In readonly mode the remove button is not rendered at all.
    expect(container.querySelector('.cinder-tag-input__remove')).toBeNull();
  });

  test('disabled hides the remove control entirely and keeps the input disabled', () => {
    const { container } = render(TagInput, {
      props: { disabled: true, defaultValue: ['Svelte'] },
    });

    expect(getInput(container).disabled).toBe(true);
    expect(container.querySelector('.cinder-tag-input__remove')).toBeNull();
  });

  test('standalone aria-label applies to both the input and the listbox', () => {
    const { container } = render(TagInput, {
      props: { 'aria-label': 'Tags', defaultValue: ['Svelte'] },
    } as any);

    expect(getInput(container).getAttribute('aria-label')).toBe('Tags');
    expect(getListbox(container).getAttribute('aria-label')).toBe('Tags');
  });

  test('standalone aria-labelledby applies to both the input and the listbox', () => {
    const { container } = render(TagInput, {
      props: { 'aria-labelledby': 'external-label', defaultValue: ['Svelte'] },
    } as any);

    expect(getInput(container).getAttribute('aria-labelledby')).toBe('external-label');
    expect(getListbox(container).getAttribute('aria-labelledby')).toBe('external-label');
  });
});

describe('TagInput commits tags', () => {
  test('Enter commits the pending tag and clears the input', async () => {
    const { container } = render(TagInput, { props: {} });
    const input = getInput(container);

    await fireEvent.input(input, { target: { value: 'Svelte' } });
    await fireEvent.keyDown(input, { key: 'Enter' });

    expect(getOptions(container)).toHaveLength(1);
    expect(getOptions(container)[0]?.textContent).toContain('Svelte');
    expect(input.value).toBe('');
  });

  test('delimiter key commits the pending tag', async () => {
    const { container } = render(TagInput, { props: { delimiter: ',' } });
    const input = getInput(container);

    await fireEvent.input(input, { target: { value: 'Bun' } });
    await fireEvent.keyDown(input, { key: ',' });

    expect(getOptions(container)).toHaveLength(1);
    expect(getOptions(container)[0]?.textContent).toContain('Bun');
    expect(input.value).toBe('');
  });

  test('duplicate prevention blocks repeated tags', async () => {
    const { container } = render(TagInput, {
      props: { defaultValue: ['Svelte'] },
    });
    const input = getInput(container);

    await fireEvent.input(input, { target: { value: 'Svelte' } });
    await fireEvent.keyDown(input, { key: 'Enter' });

    expect(getOptions(container)).toHaveLength(1);
    expect(container.textContent).toContain('"Svelte" is already added.');
  });

  test('duplicate prevention compares trimmed values, not raw source strings', async () => {
    const { container } = render(TagInput, {
      props: { defaultValue: ['Svelte '] },
    });
    const input = getInput(container);

    await fireEvent.input(input, { target: { value: 'Svelte' } });
    await fireEvent.keyDown(input, { key: 'Enter' });

    expect(getOptions(container)).toHaveLength(1);
    expect(container.textContent).toContain('"Svelte" is already added.');
  });

  test('max cap blocks extra tags', async () => {
    const { container } = render(TagInput, {
      props: { defaultValue: ['Svelte', 'Bun'], max: 2 },
    });
    const input = getInput(container);

    await fireEvent.input(input, { target: { value: 'TypeScript' } });
    await fireEvent.keyDown(input, { key: 'Enter' });

    expect(getOptions(container)).toHaveLength(2);
    expect(container.textContent).toContain('You can add up to 2 tags.');
  });

  test('validate returning a string blocks invalid tags and surfaces the message', async () => {
    const { container } = render(TagInput, {
      props: {
        validate: (tag: string) => (tag.includes('@') ? true : 'Enter a valid email tag.'),
      },
    });
    const input = getInput(container);

    await fireEvent.input(input, { target: { value: 'invalid-tag' } });
    await fireEvent.keyDown(input, { key: 'Enter' });

    expect(getOptions(container)).toHaveLength(0);
    expect(container.textContent).toContain('Enter a valid email tag.');
  });

  test('controlled mode emits onchange without mutating the rendered tags itself', async () => {
    const onchange = mock((_tags: string[]) => {});
    const { container } = render(TagInput, {
      props: { value: ['Svelte'], onchange },
    });
    const input = getInput(container);

    await fireEvent.input(input, { target: { value: 'Bun' } });
    await fireEvent.keyDown(input, { key: 'Enter' });

    expect(onchange).toHaveBeenCalledWith(['Svelte', 'Bun']);
    expect(getOptions(container)).toHaveLength(1);
  });

  test('consumer onkeydown only runs for the input, not chip keyboard interaction', async () => {
    const onkeydown = mock((_event: KeyboardEvent) => {});
    const { container } = render(TagInput, {
      props: { defaultValue: ['Svelte'], onkeydown },
    });
    const input = getInput(container);

    await fireEvent.keyDown(input, { key: 'Backspace' });
    // Fire against the remove BUTTON — it owns the chip keydown handler in the
    // list model. Firing at the <li> would miss the handler entirely and pass
    // for the wrong reason (a false negative).
    const removeButton = getRemoveButtons(container)[0]!;
    await fireEvent.keyDown(removeButton, { key: 'Delete' });

    expect(onkeydown).toHaveBeenCalledTimes(1);
  });
});

describe('TagInput keyboard removal and navigation', () => {
  // Keyboard focus lands on the remove <button> of a chip (the focusable,
  // keyboard-removable element), so these assert against getRemoveButtons().
  test('Backspace on an empty input focuses the last chip, then removes it on a second Backspace', async () => {
    const { container } = render(TagInput, {
      props: { defaultValue: ['Svelte', 'Bun'] },
    });
    const input = getInput(container);

    await fireEvent.keyDown(input, { key: 'Backspace' });
    const lastButton = getRemoveButtons(container)[1]!;
    expect(document.activeElement).toBe(lastButton);

    await fireEvent.keyDown(lastButton, { key: 'Backspace' });
    expect(getOptions(container)).toHaveLength(1);
    expect(document.activeElement).toBe(getRemoveButtons(container)[0]!);
  });

  test('Delete on a focused chip removes it and returns focus to the input when it was the only chip', async () => {
    const { container } = render(TagInput, {
      props: { defaultValue: ['Svelte'] },
    });
    const input = getInput(container);

    await fireEvent.keyDown(input, { key: 'Backspace' });
    const button = getRemoveButtons(container)[0]!;
    expect(document.activeElement).toBe(button);

    await fireEvent.keyDown(button, { key: 'Delete' });
    expect(getOptions(container)).toHaveLength(0);
    expect(document.activeElement).toBe(input);
  });

  test('Arrow navigation from an empty input moves focus to the last chip when the caret is at position 0', async () => {
    const { container } = render(TagInput, {
      props: { defaultValue: ['Svelte', 'Bun'] },
    });
    const input = getInput(container);
    input.focus();
    input.setSelectionRange(0, 0);

    await fireEvent.keyDown(input, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(getRemoveButtons(container)[1]!);
  });

  test('Home, End, and ArrowRight follow the roving focus contract', async () => {
    const { container } = render(TagInput, {
      props: { defaultValue: ['Svelte', 'Bun', 'TypeScript'] },
    });
    const input = getInput(container);
    input.focus();
    input.setSelectionRange(0, 0);

    await fireEvent.keyDown(input, { key: 'ArrowLeft' });
    let buttons = getRemoveButtons(container);
    expect(document.activeElement).toBe(buttons[2]!);

    await fireEvent.keyDown(buttons[2]!, { key: 'Home' });
    buttons = getRemoveButtons(container);
    expect(document.activeElement).toBe(buttons[0]!);

    await fireEvent.keyDown(buttons[0]!, { key: 'End' });
    buttons = getRemoveButtons(container);
    expect(document.activeElement).toBe(buttons[2]!);

    await fireEvent.keyDown(buttons[2]!, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(input);
  });

  test('clicking the remove button removes the chip and focuses the previous chip', async () => {
    const { container } = render(TagInput, {
      props: { defaultValue: ['Svelte', 'Bun'] },
    });

    const removeButtons = getRemoveButtons(container);
    await fireEvent.click(removeButtons[1]!);

    expect(getOptions(container)).toHaveLength(1);
    expect(document.activeElement).toBe(getRemoveButtons(container)[0]!);
  });

  test('readonly blocks both commits and removals', async () => {
    const { container } = render(TagInput, {
      props: { readonly: true, defaultValue: ['Svelte', 'Bun'] },
    });
    const input = getInput(container);
    input.focus();

    await fireEvent.input(input, { target: { value: 'TypeScript' } });
    await fireEvent.keyDown(input, { key: 'Enter' });
    expect(getOptions(container)).toHaveLength(2);
    expect(input.value).toBe('');

    await fireEvent.keyDown(input, { key: 'Backspace' });
    expect(document.activeElement).toBe(input);

    // In readonly mode there is no remove control at all — nothing to focus and
    // no keyboard path to removal, so the tags are immutable.
    expect(container.querySelector('.cinder-tag-input__remove')).toBeNull();
    expect(getOptions(container)).toHaveLength(2);
  });
});

describe('TagInput form participation', () => {
  test('hidden input updates after commits and removals', async () => {
    const { container } = render(TagInput, {
      props: { name: 'tags', defaultValue: ['Svelte'] },
    });
    const input = getInput(container);

    await fireEvent.input(input, { target: { value: 'Bun' } });
    await fireEvent.keyDown(input, { key: 'Enter' });
    let hiddenInputs = Array.from(
      container.querySelectorAll<HTMLInputElement>('input[type="hidden"][name="tags"]'),
    );
    expect(hiddenInputs.map((hiddenInput) => hiddenInput.value)).toEqual(['Svelte', 'Bun']);

    await fireEvent.keyDown(input, { key: 'Backspace' });
    const lastButton = getRemoveButtons(container)[1]!;
    await fireEvent.keyDown(lastButton, { key: 'Delete' });

    hiddenInputs = Array.from(
      container.querySelectorAll<HTMLInputElement>('input[type="hidden"][name="tags"]'),
    );
    expect(hiddenInputs.map((hiddenInput) => hiddenInput.value)).toEqual(['Svelte']);
  });

  test('disabled tag inputs do not contribute hidden values to form data', () => {
    const mount = renderTagInputInForm({
      name: 'tags',
      disabled: true,
      defaultValue: ['Svelte', 'Bun'],
    });

    try {
      const hiddenInputs = Array.from(
        mount.container.querySelectorAll<HTMLInputElement>('input[type="hidden"][name="tags"]'),
      );
      expect(hiddenInputs).toHaveLength(2);
      expect(hiddenInputs.every((hiddenInput) => hiddenInput.disabled)).toBe(true);

      const formData = new FormData(mount.form);
      expect(formData.getAll('tags')).toEqual([]);
    } finally {
      mount.cleanup();
    }
  });

  test('uncontrolled reset restores defaultValue, clears draft text, clears inline error, and does not fire onchange', async () => {
    const onchange = mock((_tags: string[]) => {});
    const mount = renderTagInputInForm({
      name: 'tags',
      defaultValue: ['Svelte'],
      max: 1,
      onchange,
    });

    try {
      const input = getInput(mount.container);
      await fireEvent.input(input, { target: { value: 'Bun' } });
      await fireEvent.keyDown(input, { key: 'Enter' });

      expect(getOptions(mount.container)).toHaveLength(1);
      expect(mount.container.textContent).toContain('You can add up to 1 tag.');
      expect(onchange).not.toHaveBeenCalled();

      await fireEvent.input(input, { target: { value: 'Draft tag' } });
      mount.form.dispatchEvent(new Event('reset', { bubbles: true, cancelable: true }));
      await tick();

      expect(getOptions(mount.container)).toHaveLength(1);
      expect(getOptions(mount.container)[0]?.textContent).toContain('Svelte');
      expect(input.value).toBe('');
      expect(mount.container.textContent).not.toContain('You can add up to 1 tag.');
      const hiddenInputs = Array.from(
        mount.container.querySelectorAll<HTMLInputElement>('input[type="hidden"][name="tags"]'),
      );
      expect(hiddenInputs.map((hiddenInput) => hiddenInput.value)).toEqual(['Svelte']);
      expect(onchange).not.toHaveBeenCalled();
    } finally {
      mount.cleanup();
    }
  });

  test('controlled reset does not mutate the rendered tags without a parent rerender', async () => {
    const onchange = mock((_tags: string[]) => {});
    const mount = renderTagInputInForm({
      name: 'tags',
      value: ['Svelte'],
      onchange,
    });

    try {
      const input = getInput(mount.container);
      await fireEvent.input(input, { target: { value: 'Bun' } });
      await fireEvent.keyDown(input, { key: 'Enter' });

      expect(onchange).toHaveBeenCalledWith(['Svelte', 'Bun']);
      expect(getOptions(mount.container)).toHaveLength(1);
      expect(getOptions(mount.container)[0]?.textContent).toContain('Svelte');

      await fireEvent.input(input, { target: { value: 'Draft tag' } });
      expect(input.value).toBe('Draft tag');

      mount.form.dispatchEvent(new Event('reset', { bubbles: true, cancelable: true }));
      await tick();

      expect(getOptions(mount.container)).toHaveLength(1);
      expect(getOptions(mount.container)[0]?.textContent).toContain('Svelte');
      expect(input.value).toBe('');
      const hiddenInputs = Array.from(
        mount.container.querySelectorAll<HTMLInputElement>('input[type="hidden"][name="tags"]'),
      );
      expect(hiddenInputs.map((hiddenInput) => hiddenInput.value)).toEqual(['Svelte']);
    } finally {
      mount.cleanup();
    }
  });
});

describe('TagInput FormField wiring', () => {
  test('listbox reads aria-labelledby from FormField while input reads aria-describedby', () => {
    const { container } = render(FormFieldTagInputFixture, {
      props: {
        fieldId: 'tag-field',
        fieldLabel: 'Tags',
        fieldDescription: 'Add technologies',
      },
    });

    expect(getListbox(container).getAttribute('aria-labelledby')).toBe('tag-field-label');
    expect(getInput(container).getAttribute('aria-describedby')).toBe('tag-field-description');
    expect(container.querySelector('.cinder-tag-input')?.hasAttribute('aria-describedby')).toBe(
      false,
    );
  });

  test('input inherits invalid state and required semantics from FormField without rendering native required', () => {
    const { container } = render(FormFieldTagInputFixture, {
      props: {
        fieldId: 'required-tags',
        fieldLabel: 'Tags',
        fieldError: 'Required',
        fieldRequired: true,
      },
    });

    const input = getInput(container);
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-required')).toBe('true');
    expect(input.hasAttribute('required')).toBe(false);
    expect(container.querySelector('.cinder-tag-input')?.hasAttribute('data-invalid')).toBe(true);
  });

  test('disabled FormField context sets data-disabled on the root and disables the input', () => {
    const { container } = render(FormFieldTagInputFixture, {
      props: {
        fieldId: 'disabled-tags',
        fieldLabel: 'Tags',
        fieldDisabled: true,
      },
    });

    expect(container.querySelector('.cinder-tag-input')?.hasAttribute('data-disabled')).toBe(true);
    expect(getInput(container).disabled).toBe(true);
  });
});

describe('TagInput ARIA live announcements', () => {
  async function flushLiveRegion() {
    // VisuallyHiddenLiveRegion uses setTimeout(0) for blank-then-set timing;
    // we need to let that macro-task complete.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    await tick();
  }

  test('announces "<tag> added." in the live region after committing via Enter', async () => {
    const { container } = render(TagInput, { id: 'live-add' });
    const input = container.querySelector('input') as HTMLInputElement;

    await fireEvent.input(input, { target: { value: 'Svelte' } });
    await fireEvent.keyDown(input, { key: 'Enter' });
    await flushLiveRegion();

    const liveRegion = container.querySelector('[role="status"]');
    expect(liveRegion?.textContent).toContain('Svelte added.');
  });

  test('announces "<tag> removed." after clicking the remove button', async () => {
    const { container } = render(TagInput, { id: 'live-remove', defaultValue: ['Svelte'] });

    const removeButton = container.querySelector('.cinder-tag-input__remove') as HTMLElement;
    expect(removeButton).not.toBeNull();

    await fireEvent.click(removeButton);
    await flushLiveRegion();

    const liveRegion = container.querySelector('[role="status"]');
    expect(liveRegion?.textContent).toContain('Svelte removed.');
  });

  test('consecutive identical add announcements both fire via blank-then-set', async () => {
    // This test specifically exercises the blank-then-set reset path: the same
    // announcement string ("Svelte added.") must re-fire even when the live
    // region already contains that exact text from the previous commit. A naive
    // assignment of the same string would be a no-op for the AT; blank-then-set
    // is the only mechanism that guarantees re-announcement.
    const { container } = render(TagInput, { id: 'live-repeat', allowDuplicates: true });
    const input = container.querySelector('input') as HTMLInputElement;

    // First add — live region should show "Svelte added."
    await fireEvent.input(input, { target: { value: 'Svelte' } });
    await fireEvent.keyDown(input, { key: 'Enter' });
    await flushLiveRegion();

    const liveRegion = container.querySelector('[role="status"]');
    expect(liveRegion?.textContent).toContain('Svelte added.');

    // Second add of the SAME value (allowDuplicates=true, no intervening removal).
    // The live region still holds "Svelte added." — the announcementSequence bump
    // re-runs the region's effect, which blanks the text to '' first so the
    // identical string re-triggers the AT.
    await fireEvent.input(input, { target: { value: 'Svelte' } });
    await fireEvent.keyDown(input, { key: 'Enter' });

    // Load-bearing assertion: after the second add (before the deferred setTimeout(0)
    // fires) the region must transition through the blank state. Without the
    // announcementSequence fix, the same-value $state assignment is a Svelte 5 no-op,
    // the effect never runs, and the content stays "Svelte added." — making THIS
    // assertion fail. That is what makes this a genuine regression guard.
    await tick();
    expect(container.querySelector('[role="status"]')?.textContent?.trim()).toBe('');

    await flushLiveRegion();

    // After the macro-task the content must be back to "Svelte added." — proving the
    // identical message was genuinely re-announced.
    expect(container.querySelector('[role="status"]')?.textContent).toContain('Svelte added.');
  });
});

describe('TagInput CSS contract', () => {
  test('focus-within ring, invalid override, and forced-colors fallback stay encoded in the CSS', async () => {
    const css = await Bun.file(new URL('./tag-input.css', import.meta.url)).text();

    expect(css).toContain('.cinder-tag-input__control:focus-within');
    expect(css).toContain('outline: var(--cinder-ring-width) solid transparent;');
    expect(css).toContain('box-shadow:');
    expect(css).toContain('--_cinder-tag-input-ring: var(--cinder-danger);');
    expect(css).toContain('@media (forced-colors: active)');
    expect(css).toContain('outline: var(--cinder-ring-width) solid Highlight;');
  });
});
