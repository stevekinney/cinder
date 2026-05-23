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

function getListbox(container: HTMLElement): HTMLElement {
  return container.querySelector('[role="listbox"]') as HTMLElement;
}

function getOptions(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll('[role="option"]'));
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
  test('renders committed tags as a listbox with the input after it in DOM order', () => {
    const { container } = render(TagInput, {
      props: { defaultValue: ['Svelte', 'Bun'] },
    });

    const control = container.querySelector('.cinder-tag-input__control');
    const listbox = getListbox(container);
    const input = getInput(container);

    expect(listbox).not.toBeNull();
    expect(getOptions(container)).toHaveLength(2);
    expect(control?.children[0]).toBe(listbox);
    expect(control?.children[1]).toBe(input);
    expect(
      getOptions(container).every((option) => option.getAttribute('aria-selected') === 'true'),
    ).toBe(true);
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

  test('remove buttons expose the required aria-label', () => {
    const { container } = render(TagInput, {
      props: { defaultValue: ['Svelte'] },
    });

    const removeButton = container.querySelector('.cinder-tag-input__remove');
    expect(removeButton?.getAttribute('aria-label')).toBe('Remove Svelte');
    expect(removeButton?.getAttribute('tabindex')).toBe('-1');
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
    const option = getOptions(container)[0]!;
    await fireEvent.keyDown(option, { key: 'Delete' });

    expect(onkeydown).toHaveBeenCalledTimes(1);
  });
});

describe('TagInput keyboard removal and navigation', () => {
  test('Backspace on an empty input focuses the last chip, then removes it on a second Backspace', async () => {
    const { container } = render(TagInput, {
      props: { defaultValue: ['Svelte', 'Bun'] },
    });
    const input = getInput(container);

    await fireEvent.keyDown(input, { key: 'Backspace' });
    const options = getOptions(container);
    const lastOption = options[1]!;
    expect(document.activeElement).toBe(lastOption);

    await fireEvent.keyDown(lastOption, { key: 'Backspace' });
    expect(getOptions(container)).toHaveLength(1);
    const remainingOption = getOptions(container)[0]!;
    expect(document.activeElement).toBe(remainingOption);
  });

  test('Delete on a focused chip removes it and returns focus to the input when it was the only chip', async () => {
    const { container } = render(TagInput, {
      props: { defaultValue: ['Svelte'] },
    });
    const input = getInput(container);

    await fireEvent.keyDown(input, { key: 'Backspace' });
    const option = getOptions(container)[0]!;
    expect(document.activeElement).toBe(option);

    await fireEvent.keyDown(option, { key: 'Delete' });
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
    const lastOption = getOptions(container)[1]!;
    expect(document.activeElement).toBe(lastOption);
  });

  test('Home, End, and ArrowRight follow the roving focus contract', async () => {
    const { container } = render(TagInput, {
      props: { defaultValue: ['Svelte', 'Bun', 'TypeScript'] },
    });
    const input = getInput(container);
    input.focus();
    input.setSelectionRange(0, 0);

    await fireEvent.keyDown(input, { key: 'ArrowLeft' });
    let options = getOptions(container);
    expect(document.activeElement).toBe(options[2]!);

    await fireEvent.keyDown(options[2]!, { key: 'Home' });
    options = getOptions(container);
    expect(document.activeElement).toBe(options[0]!);

    await fireEvent.keyDown(options[0]!, { key: 'End' });
    options = getOptions(container);
    expect(document.activeElement).toBe(options[2]!);

    await fireEvent.keyDown(options[2]!, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(input);
  });

  test('clicking the remove button removes the chip and focuses the previous chip', async () => {
    const { container } = render(TagInput, {
      props: { defaultValue: ['Svelte', 'Bun'] },
    });

    const removeButtons = Array.from(
      container.querySelectorAll<HTMLButtonElement>('.cinder-tag-input__remove'),
    );
    await fireEvent.click(removeButtons[1]!);

    const options = getOptions(container);
    expect(options).toHaveLength(1);
    expect(document.activeElement).toBe(options[0]!);
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
    const lastOption = getOptions(container)[1]!;
    await fireEvent.keyDown(lastOption, { key: 'Delete' });

    hiddenInputs = Array.from(
      container.querySelectorAll<HTMLInputElement>('input[type="hidden"][name="tags"]'),
    );
    expect(hiddenInputs.map((hiddenInput) => hiddenInput.value)).toEqual(['Svelte']);
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

      mount.form.dispatchEvent(new Event('reset', { bubbles: true, cancelable: true }));
      await tick();

      expect(getOptions(mount.container)).toHaveLength(1);
      expect(getOptions(mount.container)[0]?.textContent).toContain('Svelte');
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
