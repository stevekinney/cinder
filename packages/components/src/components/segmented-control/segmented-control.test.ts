/// <reference lib="dom" />
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { tick } from 'svelte';
import { SvelteSet } from 'svelte/reactivity';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { cleanup, fireEvent, render, screen } = await import('@testing-library/svelte');
const { default: Fixture } = await import('../../test/fixtures/segmented-control-fixture.svelte');

beforeEach(() => document.body.replaceChildren());
afterEach(() => cleanup());

type Option = { value: string; label: string; disabled?: boolean; controls?: string };

const options: readonly Option[] = [
  { value: 'source', label: 'Source' },
  { value: 'rendered', label: 'Rendered' },
  { value: 'diff', label: 'Diff', disabled: true },
];

const allDisabledOptions: readonly Option[] = [
  { value: 'a', label: 'A', disabled: true },
  { value: 'b', label: 'B', disabled: true },
];

// ── Single mode ─────────────────────────────────────────────────────────────

describe('SegmentedControl — single mode', () => {
  test('renders role="radiogroup" with the provided accessible name', () => {
    render(Fixture, {
      props: { id: 'document-view', value: 'source', label: 'Document view', options },
    });
    expect(screen.getByRole('radiogroup', { name: 'Document view' })).not.toBeNull();
  });

  test('renders each option as role="radio" with correct aria-checked', () => {
    render(Fixture, {
      props: { id: 'document-view', value: 'source', label: 'Document view', options },
    });
    expect(screen.getByRole('radio', { name: 'Source' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('radio', { name: 'Rendered' }).getAttribute('aria-checked')).toBe(
      'false',
    );
  });

  test('clicking an enabled non-selected option updates bindable value', async () => {
    let selected: string | undefined = 'source';
    render(Fixture, {
      props: {
        id: 'document-view',
        get value() {
          return selected;
        },
        set value(next: string | undefined) {
          selected = next;
        },
        label: 'Document view',
        options,
      },
    });

    await fireEvent.click(screen.getByRole('radio', { name: 'Rendered' }));
    expect(selected).toBe('rendered');
  });

  test('clicking the already-selected option is a no-op (disallowEmptySelection default true)', async () => {
    let selected: string | undefined = 'source';
    render(Fixture, {
      props: {
        id: 'document-view',
        get value() {
          return selected;
        },
        set value(next: string | undefined) {
          selected = next;
        },
        label: 'Document view',
        options,
      },
    });

    await fireEvent.click(screen.getByRole('radio', { name: 'Source' }));
    expect(selected).toBe('source');
  });

  test('clicking a disabled option is a no-op', async () => {
    let selected: string | undefined = 'source';
    render(Fixture, {
      props: {
        id: 'document-view',
        get value() {
          return selected;
        },
        set value(next: string | undefined) {
          selected = next;
        },
        label: 'Document view',
        options,
      },
    });

    await fireEvent.click(screen.getByRole('radio', { name: 'Diff' }));
    expect(selected).toBe('source');
  });

  test('arrow navigation moves selection, skipping disabled options', async () => {
    let selected: string | undefined = 'source';
    render(Fixture, {
      props: {
        id: 'document-view',
        get value() {
          return selected;
        },
        set value(next: string | undefined) {
          selected = next;
        },
        label: 'Document view',
        options,
      },
    });

    const radiogroup = screen.getByRole('radiogroup');
    await fireEvent.keyDown(radiogroup, { key: 'ArrowRight' });
    expect(selected).toBe('rendered');
    // Further ArrowRight skips disabled 'diff' and wraps to 'source'
    await fireEvent.keyDown(radiogroup, { key: 'ArrowRight' });
    expect(selected).toBe('source');
  });

  test('with disallowEmptySelection={false}, clicking the already-selected option clears value', async () => {
    let selected: string | undefined = 'source';
    render(Fixture, {
      props: {
        id: 'document-view',
        get value() {
          return selected;
        },
        set value(next: string | undefined) {
          selected = next;
        },
        label: 'Document view',
        options,
        disallowEmptySelection: false,
      },
    });

    await fireEvent.click(screen.getByRole('radio', { name: 'Source' }));
    expect(selected).toBeUndefined();
  });

  test('with invalid value, first non-disabled option holds tabindex="0"', () => {
    render(Fixture, {
      props: {
        id: 'document-view',
        value: 'nonexistent',
        label: 'Document view',
        options,
      },
    });

    const source = screen.getByRole('radio', { name: 'Source' });
    const rendered = screen.getByRole('radio', { name: 'Rendered' });
    expect(source.getAttribute('tabindex')).toBe('0');
    expect(rendered.getAttribute('tabindex')).toBe('-1');
    expect(source.getAttribute('aria-checked')).toBe('false');
    expect(rendered.getAttribute('aria-checked')).toBe('false');
  });

  test('group-level disabled: clicks are no-ops; root has aria-disabled="true"', async () => {
    let selected: string | undefined = 'source';
    render(Fixture, {
      props: {
        id: 'document-view',
        get value() {
          return selected;
        },
        set value(next: string | undefined) {
          selected = next;
        },
        label: 'Document view',
        options,
        disabled: true,
      },
    });

    const group = screen.getByRole('radiogroup');
    expect(group.getAttribute('aria-disabled')).toBe('true');
    await fireEvent.click(screen.getByRole('radio', { name: 'Rendered' }));
    expect(selected).toBe('source');
  });

  test('value set to string not in options: no option renders aria-checked="true"', () => {
    render(Fixture, {
      props: { id: 'document-view', value: 'nonexistent', label: 'Document view', options },
    });
    for (const radio of screen.getAllByRole('radio')) {
      expect(radio.getAttribute('aria-checked')).toBe('false');
    }
  });

  test('renders a single hidden input for native form submission when name is provided', () => {
    const { container } = render(Fixture, {
      props: {
        id: 'document-view',
        name: 'view',
        value: 'source',
        label: 'Document view',
        options,
      },
    });
    const hidden = container.querySelector<HTMLInputElement>('input[type="hidden"][name="view"]');
    expect(hidden).not.toBeNull();
    expect(hidden?.name).toBe('view');
    expect(hidden?.value).toBe('source');
  });

  test('form reset restores the initial single selection', async () => {
    const form = document.createElement('form');
    document.body.append(form);
    let selected: string | undefined = 'source';
    render(Fixture, {
      target: form,
      props: {
        id: 'document-view',
        name: 'view',
        get value() {
          return selected;
        },
        set value(next: string | undefined) {
          selected = next;
        },
        label: 'Document view',
        options,
      },
    });

    await fireEvent.click(screen.getByRole('radio', { name: 'Rendered' }));
    expect(selected).toBe('rendered');

    form.dispatchEvent(new Event('reset', { bubbles: true, cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    await tick();

    expect(selected).toBe('source');
    expect(screen.getByRole('radio', { name: 'Source' }).getAttribute('aria-checked')).toBe('true');
  });

  test('all options disabled: no tabindex="0"', () => {
    render(Fixture, {
      props: { id: 'document-view', label: 'Document view', options: allDisabledOptions },
    });

    const group = screen.getByRole('radiogroup');
    expect(group.getAttribute('aria-disabled')).toBeNull();

    for (const button of screen.getAllByRole('radio')) {
      expect(button.getAttribute('tabindex')).toBe('-1');
    }
  });

  test('empty options: group renders with no radio buttons', () => {
    render(Fixture, { props: { id: 'document-view', label: 'Document view', options: [] } });
    const group = screen.getByRole('radiogroup');
    expect(group.getAttribute('aria-disabled')).toBeNull();
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
  });

  test('selected-but-disabled segment: tabindex="0" moves to first enabled segment', () => {
    // Per C6: if value is on a disabled segment, that segment shows aria-checked=true
    // but tabindex="0" moves to the first enabled segment so keyboard nav has an entry.
    const optionsWithDisabledSelected: readonly Option[] = [
      { value: 'a', label: 'Alpha', disabled: true },
      { value: 'b', label: 'Bravo' },
      { value: 'c', label: 'Charlie' },
    ];

    render(Fixture, {
      props: {
        id: 'sel-disabled',
        value: 'a',
        label: 'Selection',
        options: optionsWithDisabledSelected,
      },
    });

    const alpha = screen.getByRole('radio', { name: 'Alpha' });
    const bravo = screen.getByRole('radio', { name: 'Bravo' });
    expect(alpha.getAttribute('aria-checked')).toBe('true');
    expect(alpha.getAttribute('aria-disabled')).toBe('true');
    expect(alpha.getAttribute('tabindex')).toBe('-1');
    expect(bravo.getAttribute('tabindex')).toBe('0');
  });
});

// ── Multiple mode ────────────────────────────────────────────────────────────

describe('SegmentedControl — multiple mode', () => {
  const multiOptions: readonly Option[] = [
    { value: 'bold', label: 'Bold' },
    { value: 'italic', label: 'Italic' },
    { value: 'underline', label: 'Underline', disabled: true },
  ];

  test('renders role="group" (not radiogroup); no element has role="radio"', () => {
    const set = new SvelteSet<string>(['bold']);
    render(Fixture, {
      props: {
        id: 'text-format',
        label: 'Text formatting',
        options: multiOptions,
        selectionMode: 'multiple',
        value: set,
      },
    });

    expect(screen.getByRole('group', { name: 'Text formatting' })).not.toBeNull();
    expect(screen.queryByRole('radio')).toBeNull();
    expect(screen.queryByRole('radiogroup')).toBeNull();
  });

  test('group has accessible name from label; hideLabel still provides it to AT', () => {
    const set = new SvelteSet<string>();
    render(Fixture, {
      props: {
        id: 'text-format',
        label: 'Text formatting',
        options: multiOptions,
        selectionMode: 'multiple',
        value: set,
        hideLabel: true,
      },
    });

    expect(screen.getByRole('group', { name: 'Text formatting' })).not.toBeNull();
  });

  test('each option exposes aria-pressed reflecting membership in the SvelteSet', () => {
    const set = new SvelteSet<string>(['bold']);
    render(Fixture, {
      props: {
        id: 'text-format',
        label: 'Text formatting',
        options: multiOptions,
        selectionMode: 'multiple',
        value: set,
      },
    });

    const buttons = screen.getAllByRole('button');
    const bold = buttons.find((button) => button.textContent?.trim() === 'Bold');
    const italic = buttons.find((button) => button.textContent?.trim() === 'Italic');
    expect(bold?.getAttribute('aria-pressed')).toBe('true');
    expect(italic?.getAttribute('aria-pressed')).toBe('false');
  });

  test('renders one hidden input per selected value for native form submission', () => {
    const selected = new SvelteSet(['bold', 'italic']);
    const { container } = render(Fixture, {
      props: {
        id: 'text-format',
        name: 'format',
        label: 'Text formatting',
        options: multiOptions,
        selectionMode: 'multiple',
        value: selected,
      },
    });
    const hiddenInputs = Array.from(
      container.querySelectorAll<HTMLInputElement>('input[type="hidden"][name="format"]'),
    );
    expect(hiddenInputs.map((input) => [input.name, input.value, input.disabled])).toEqual([
      ['format', 'bold', false],
      ['format', 'italic', false],
    ]);
  });

  test('multiple mode ignores stale string values when rendering hidden inputs', () => {
    const { container } = render(Fixture, {
      props: {
        id: 'text-format',
        name: 'format',
        label: 'Text formatting',
        options: multiOptions,
        selectionMode: 'multiple',
        value: 'bold' as never,
      },
    });

    expect(
      container.querySelectorAll<HTMLInputElement>('input[type="hidden"][name="format"]'),
    ).toHaveLength(0);
  });

  test('disabled hidden inputs are disabled for native FormData omission', () => {
    const selected = new SvelteSet(['bold']);
    const { container } = render(Fixture, {
      props: {
        id: 'text-format',
        name: 'format',
        label: 'Text formatting',
        options: multiOptions,
        selectionMode: 'multiple',
        value: selected,
        disabled: true,
      },
    });
    const hidden = container.querySelector<HTMLInputElement>('input[type="hidden"][name="format"]');
    expect(hidden?.name).toBe('format');
    expect(hidden?.disabled).toBe(true);
  });

  test('form reset restores the initial multiple selection', async () => {
    const form = document.createElement('form');
    document.body.append(form);
    const selected = new SvelteSet<string>(['bold']);
    const { container } = render(Fixture, {
      target: form,
      props: {
        id: 'text-format',
        name: 'format',
        label: 'Text formatting',
        options: multiOptions,
        selectionMode: 'multiple',
        value: selected,
      },
    });

    selected.add('italic');
    await tick();
    expect(Array.from(selected)).toEqual(['bold', 'italic']);

    form.dispatchEvent(new Event('reset', { bubbles: true, cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    await tick();

    const hiddenInputs = Array.from(
      container.querySelectorAll<HTMLInputElement>('input[type="hidden"][name="format"]'),
    );
    expect(hiddenInputs.map((input) => input.value)).toEqual(['bold']);
  });

  test('canceled form reset leaves the current multiple selection unchanged', async () => {
    const form = document.createElement('form');
    document.body.append(form);
    const selected = new SvelteSet<string>(['bold']);
    const { container } = render(Fixture, {
      target: form,
      props: {
        id: 'text-format',
        name: 'format',
        label: 'Text formatting',
        options: multiOptions,
        selectionMode: 'multiple',
        value: selected,
      },
    });

    selected.add('italic');
    await tick();
    form.addEventListener('reset', (event) => event.preventDefault());
    form.dispatchEvent(new Event('reset', { bubbles: true, cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    await tick();

    const hiddenInputs = Array.from(
      container.querySelectorAll<HTMLInputElement>('input[type="hidden"][name="format"]'),
    );
    expect(hiddenInputs.map((input) => input.value)).toEqual(['bold', 'italic']);
  });

  test('clicking an unpressed option adds it to the SvelteSet (reactivity check)', async () => {
    const set = new SvelteSet<string>();
    render(Fixture, {
      props: {
        id: 'text-format',
        label: 'Text formatting',
        options: multiOptions,
        selectionMode: 'multiple',
        value: set,
      },
    });

    const buttons = screen.getAllByRole('button');
    const italic = buttons.find((button) => button.textContent?.trim() === 'Italic');
    expect(italic).toBeDefined();
    await fireEvent.click(italic!);
    expect(set.has('italic')).toBe(true);
    expect(italic?.getAttribute('aria-pressed')).toBe('true');
  });

  test('clicking a pressed option removes it from the SvelteSet', async () => {
    const set = new SvelteSet<string>(['bold']);
    render(Fixture, {
      props: {
        id: 'text-format',
        label: 'Text formatting',
        options: multiOptions,
        selectionMode: 'multiple',
        value: set,
      },
    });

    const buttons = screen.getAllByRole('button');
    const bold = buttons.find((button) => button.textContent?.trim() === 'Bold');
    await fireEvent.click(bold!);
    expect(set.has('bold')).toBe(false);
  });

  test('clicking a disabled option is a no-op', async () => {
    const set = new SvelteSet<string>();
    render(Fixture, {
      props: {
        id: 'text-format',
        label: 'Text formatting',
        options: multiOptions,
        selectionMode: 'multiple',
        value: set,
      },
    });

    const buttons = screen.getAllByRole('button');
    const underline = buttons.find((button) => button.textContent?.trim() === 'Underline');
    await fireEvent.click(underline!);
    expect(set.has('underline')).toBe(false);
  });

  test('group-level disabled: no click changes the SvelteSet; root has aria-disabled="true"', async () => {
    const set = new SvelteSet<string>();
    render(Fixture, {
      props: {
        id: 'text-format',
        label: 'Text formatting',
        options: multiOptions,
        selectionMode: 'multiple',
        value: set,
        disabled: true,
      },
    });

    const group = screen.getByRole('group');
    expect(group.getAttribute('aria-disabled')).toBe('true');

    const buttons = screen.getAllByRole('button');
    const italic = buttons.find((button) => button.textContent?.trim() === 'Italic');
    await fireEvent.click(italic!);
    expect(set.has('italic')).toBe(false);
  });
});

// ── Variants ─────────────────────────────────────────────────────────────────

describe('SegmentedControl — variants', () => {
  test('size prop sets data-cinder-size on the outer element; default is "md"', () => {
    const { container } = render(Fixture, {
      props: { id: 'view', label: 'View', options: [{ value: 'a', label: 'A' }] },
    });
    const control = container.querySelector('.cinder-segmented-control');
    expect(control?.getAttribute('data-cinder-size')).toBe('md');
  });

  test('size="sm" sets data-cinder-size="sm"', () => {
    const { container } = render(Fixture, {
      props: { id: 'view', label: 'View', options: [{ value: 'a', label: 'A' }], size: 'sm' },
    });
    const control = container.querySelector('.cinder-segmented-control');
    expect(control?.getAttribute('data-cinder-size')).toBe('sm');
  });

  test('size="lg" sets data-cinder-size="lg"', () => {
    const { container } = render(Fixture, {
      props: { id: 'view', label: 'View', options: [{ value: 'a', label: 'A' }], size: 'lg' },
    });
    const control = container.querySelector('.cinder-segmented-control');
    expect(control?.getAttribute('data-cinder-size')).toBe('lg');
  });

  test('detached=false (default): data-cinder-detached attribute is absent', () => {
    const { container } = render(Fixture, {
      props: { id: 'view', label: 'View', options: [{ value: 'a', label: 'A' }] },
    });
    const control = container.querySelector('.cinder-segmented-control');
    expect(control?.hasAttribute('data-cinder-detached')).toBe(false);
  });

  test('detached=true sets data-cinder-detached attribute', () => {
    const { container } = render(Fixture, {
      props: {
        id: 'view',
        label: 'View',
        options: [{ value: 'a', label: 'A' }],
        detached: true,
      },
    });
    const control = container.querySelector('.cinder-segmented-control');
    expect(control?.getAttribute('data-cinder-detached')).toBe('');
  });

  test('orientation="vertical" sets data-cinder-orientation and aria-orientation in single mode', () => {
    const { container } = render(Fixture, {
      props: {
        id: 'view',
        label: 'View',
        options: [{ value: 'a', label: 'A' }],
        orientation: 'vertical',
      },
    });
    const control = container.querySelector('.cinder-segmented-control');
    expect(control?.getAttribute('data-cinder-orientation')).toBe('vertical');
    expect(control?.getAttribute('aria-orientation')).toBe('vertical');
  });

  test('orientation="vertical" does NOT set aria-orientation in multiple mode', () => {
    const set = new SvelteSet<string>();
    const { container } = render(Fixture, {
      props: {
        id: 'view',
        label: 'View',
        options: [{ value: 'a', label: 'A' }],
        orientation: 'vertical',
        selectionMode: 'multiple',
        value: set,
      },
    });
    const control = container.querySelector('.cinder-segmented-control');
    expect(control?.getAttribute('data-cinder-orientation')).toBe('vertical');
    expect(control?.getAttribute('aria-orientation')).toBeNull();
  });

  test('fullWidth=false (default): data-cinder-full-width attribute is absent', () => {
    const { container } = render(Fixture, {
      props: { id: 'view', label: 'View', options: [{ value: 'a', label: 'A' }] },
    });
    const control = container.querySelector('.cinder-segmented-control');
    expect(control?.hasAttribute('data-cinder-full-width')).toBe(false);
  });

  test('fullWidth=true sets data-cinder-full-width attribute', () => {
    const { container } = render(Fixture, {
      props: {
        id: 'view',
        label: 'View',
        options: [{ value: 'a', label: 'A' }],
        fullWidth: true,
      },
    });
    const control = container.querySelector('.cinder-segmented-control');
    expect(control?.getAttribute('data-cinder-full-width')).toBe('');
  });

  test('unselected single-mode option does not have data-cinder-selected attribute', () => {
    render(Fixture, {
      props: {
        id: 'view',
        value: 'a',
        label: 'View',
        options: [
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B' },
        ],
      },
    });
    const b = screen.getByRole('radio', { name: 'B' });
    expect(b.hasAttribute('data-cinder-selected')).toBe(false);
  });

  test('unpressed multi-mode option does not have data-cinder-pressed attribute', () => {
    const set = new SvelteSet<string>();
    render(Fixture, {
      props: {
        id: 'view',
        label: 'View',
        options: [{ value: 'a', label: 'A' }],
        selectionMode: 'multiple',
        value: set,
      },
    });
    const buttons = screen.getAllByRole('button');
    expect(buttons[0]?.hasAttribute('data-cinder-pressed')).toBe(false);
  });

  test('rest props pass through to the labelled group root', () => {
    const { container } = render(Fixture, {
      props: {
        id: 'view',
        label: 'View',
        options: [{ value: 'a', label: 'A' }],
        rest: { 'aria-describedby': 'hint-text' },
      },
    });
    const group = container.querySelector('[role="radiogroup"]');
    expect(group?.getAttribute('aria-describedby')).toBe('hint-text');
  });

  test('custom class merges with .cinder-segmented-control', () => {
    const { container } = render(Fixture, {
      props: {
        id: 'view',
        label: 'View',
        options: [{ value: 'a', label: 'A' }],
        className: 'extra',
      },
    });
    const control = container.querySelector('.cinder-segmented-control');
    expect(control?.classList.contains('extra')).toBe(true);
    expect(control?.classList.contains('cinder-segmented-control')).toBe(true);
  });

  test('single mode sets data-cinder-selection-mode="single"', () => {
    const { container } = render(Fixture, {
      props: { id: 'v1', label: 'View', options: [{ value: 'a', label: 'A' }] },
    });
    const group = container.querySelector('[role="radiogroup"]');
    expect(group?.getAttribute('data-cinder-selection-mode')).toBe('single');
  });

  test('multiple mode sets data-cinder-selection-mode="multiple"', () => {
    const set = new SvelteSet<string>();
    const { container } = render(Fixture, {
      props: {
        id: 'v2',
        label: 'View',
        options: [{ value: 'a', label: 'A' }],
        selectionMode: 'multiple',
        value: set,
      },
    });
    const group = container.querySelector('[role="group"]');
    expect(group?.getAttribute('data-cinder-selection-mode')).toBe('multiple');
  });

  test('renders option leading content inside aria-hidden wrapper', () => {
    render(Fixture, {
      props: {
        id: 'document-view',
        value: 'source',
        label: 'Document view',
        options: [{ value: 'source', label: 'Source' }],
        showLeadingIcon: true,
      },
    });

    const source = screen.getByRole('radio', { name: 'Source' });
    const iconWrapper = source.querySelector('.cinder-segmented-control-option-icon');
    expect(iconWrapper?.getAttribute('aria-hidden')).toBe('true');
  });

  test('can render tab semantics for panel switching', () => {
    render(Fixture, {
      props: {
        id: 'review-view',
        value: 'editor',
        label: 'Review view',
        variant: 'tablist',
        options: [
          { value: 'editor', label: 'Editor', controls: 'editor-panel' },
          { value: 'diff', label: 'Diff', controls: 'diff-panel' },
        ],
      },
    });

    const tablist = screen.getByRole('tablist', { name: 'Review view' });
    const editor = screen.getByRole('tab', { name: 'Editor' });
    const diff = screen.getByRole('tab', { name: 'Diff' });

    expect(tablist).not.toBeNull();
    expect(editor.getAttribute('aria-selected')).toBe('true');
    expect(editor.getAttribute('aria-controls')).toBe('editor-panel');
    expect(diff.getAttribute('aria-selected')).toBe('false');
    expect(diff.getAttribute('aria-controls')).toBe('diff-panel');
  });

  test('density="toolbar" sets data-cinder-density="toolbar" on the root', () => {
    const { container } = render(Fixture, {
      props: {
        id: 'view',
        label: 'View',
        options: [{ value: 'a', label: 'A' }],
        density: 'toolbar',
      },
    });
    const control = container.querySelector('.cinder-segmented-control');
    expect(control?.getAttribute('data-cinder-density')).toBe('toolbar');
  });

  test('omitting density does not set data-cinder-density', () => {
    const { container } = render(Fixture, {
      props: { id: 'view', label: 'View', options: [{ value: 'a', label: 'A' }] },
    });
    const control = container.querySelector('.cinder-segmented-control');
    expect(control?.hasAttribute('data-cinder-density')).toBe(false);
  });

  test('density="toolbar" with no explicit size resolves data-cinder-size="sm"', () => {
    const { container } = render(Fixture, {
      props: {
        id: 'view',
        label: 'View',
        options: [{ value: 'a', label: 'A' }],
        density: 'toolbar',
      },
    });
    const control = container.querySelector('.cinder-segmented-control');
    expect(control?.getAttribute('data-cinder-size')).toBe('sm');
    expect(control?.getAttribute('data-cinder-density')).toBe('toolbar');
  });

  test('density="toolbar" overrides size="md" to data-cinder-size="sm"', () => {
    const { container } = render(Fixture, {
      props: {
        id: 'view',
        label: 'View',
        options: [{ value: 'a', label: 'A' }],
        size: 'md',
        density: 'toolbar',
      },
    });
    const control = container.querySelector('.cinder-segmented-control');
    expect(control?.getAttribute('data-cinder-size')).toBe('sm');
    expect(control?.getAttribute('data-cinder-density')).toBe('toolbar');
  });

  test('density="toolbar" overrides size="lg" to data-cinder-size="sm"', () => {
    const { container } = render(Fixture, {
      props: {
        id: 'view',
        label: 'View',
        options: [{ value: 'a', label: 'A' }],
        size: 'lg',
        density: 'toolbar',
      },
    });
    const control = container.querySelector('.cinder-segmented-control');
    expect(control?.getAttribute('data-cinder-size')).toBe('sm');
    expect(control?.getAttribute('data-cinder-density')).toBe('toolbar');
  });
});

// ── Tablist variant ──────────────────────────────────────────────────────────

describe('SegmentedControl — tablist variant', () => {
  // These tests pin the accessibility guardrails from
  // docs/decisions/segmented-control-tablist-variant.md. They assert the
  // existing semantics are correct so the visual CSS does not advertise tab
  // behavior the interaction model fails to satisfy.
  //
  // `SegmentedControlController.handleKeydown` intentionally moves focus AND
  // updates value together in single mode (the C6 roving contract), so each
  // arrow press fires `onchange` exactly once. "Exactly once" is asserted as a
  // post-setup callback-count delta: snapshot the count after render, press one
  // key, assert the delta is 1, then assert the resulting selected tab.

  const tablistOptions: readonly Option[] = [
    { value: 'editor', label: 'Editor', controls: 'editor-panel' },
    { value: 'diff', label: 'Diff', controls: 'diff-panel' },
    { value: 'summary', label: 'Summary', controls: 'summary-panel' },
  ];

  test('horizontal tablist exposes role="tablist" and aria-orientation="horizontal"', () => {
    const { container } = render(Fixture, {
      props: {
        id: 'review-view',
        value: 'editor',
        label: 'Review view',
        variant: 'tablist',
        options: tablistOptions,
      },
    });

    const tablist = screen.getByRole('tablist', { name: 'Review view' });
    expect(tablist).not.toBeNull();
    expect(tablist.getAttribute('aria-orientation')).toBe('horizontal');
    const root = container.querySelector('.cinder-segmented-control');
    expect(root?.getAttribute('data-cinder-variant')).toBe('tablist');
    expect(root?.getAttribute('data-cinder-selection-mode')).toBe('single');
  });

  test('preserves aria-selected and aria-controls on each tab', () => {
    render(Fixture, {
      props: {
        id: 'review-view',
        value: 'editor',
        label: 'Review view',
        variant: 'tablist',
        options: tablistOptions,
      },
    });

    const editor = screen.getByRole('tab', { name: 'Editor' });
    const diff = screen.getByRole('tab', { name: 'Diff' });
    const summary = screen.getByRole('tab', { name: 'Summary' });
    expect(editor.getAttribute('aria-selected')).toBe('true');
    expect(editor.getAttribute('aria-controls')).toBe('editor-panel');
    expect(diff.getAttribute('aria-selected')).toBe('false');
    expect(diff.getAttribute('aria-controls')).toBe('diff-panel');
    // Cover the last tab too, so a dropped/last-only aria-controls regression is caught.
    expect(summary.getAttribute('aria-controls')).toBe('summary-panel');
  });

  test('horizontal tablist moves the active tab with ArrowRight / ArrowLeft (exactly once per press)', async () => {
    let selected: string | undefined = 'editor';
    let changeCount = 0;
    render(Fixture, {
      props: {
        id: 'review-view',
        get value() {
          return selected;
        },
        set value(next: string | undefined) {
          selected = next;
        },
        label: 'Review view',
        variant: 'tablist',
        options: tablistOptions,
        onchange: () => {
          changeCount += 1;
        },
      },
    });

    // Assert on the bound value (the controller's output), matching the
    // existing single-mode arrow-navigation tests. The fixture drives the DOM
    // from its own $bindable, so the externally controlled getter/setter used
    // here observes the controller's selection without re-rendering the DOM;
    // initial-render aria-selected wiring is covered by a separate test.
    const tablist = screen.getByRole('tablist');
    const countBeforeRight = changeCount;
    await fireEvent.keyDown(tablist, { key: 'ArrowRight' });
    expect(changeCount - countBeforeRight).toBe(1);
    expect(selected).toBe('diff');

    const countBeforeLeft = changeCount;
    await fireEvent.keyDown(tablist, { key: 'ArrowLeft' });
    expect(changeCount - countBeforeLeft).toBe(1);
    expect(selected).toBe('editor');

    // Wrap-around: ArrowLeft from the first tab wraps to the last, and
    // ArrowRight from the last wraps back to the first — each firing onchange
    // exactly once.
    const countBeforeWrapStart = changeCount;
    await fireEvent.keyDown(tablist, { key: 'ArrowLeft' });
    expect(changeCount - countBeforeWrapStart).toBe(1);
    expect(selected).toBe('summary');

    const countBeforeWrapEnd = changeCount;
    await fireEvent.keyDown(tablist, { key: 'ArrowRight' });
    expect(changeCount - countBeforeWrapEnd).toBe(1);
    expect(selected).toBe('editor');
  });

  test('vertical tablist exposes aria-orientation="vertical" and moves with ArrowDown / ArrowUp (exactly once per press)', async () => {
    let selected: string | undefined = 'editor';
    let changeCount = 0;
    render(Fixture, {
      props: {
        id: 'review-view',
        get value() {
          return selected;
        },
        set value(next: string | undefined) {
          selected = next;
        },
        label: 'Review view',
        variant: 'tablist',
        orientation: 'vertical',
        options: tablistOptions,
        onchange: () => {
          changeCount += 1;
        },
      },
    });

    const tablist = screen.getByRole('tablist');
    expect(tablist.getAttribute('aria-orientation')).toBe('vertical');

    const countBeforeDown = changeCount;
    await fireEvent.keyDown(tablist, { key: 'ArrowDown' });
    expect(changeCount - countBeforeDown).toBe(1);
    expect(selected).toBe('diff');

    const countBeforeUp = changeCount;
    await fireEvent.keyDown(tablist, { key: 'ArrowUp' });
    expect(changeCount - countBeforeUp).toBe(1);
    expect(selected).toBe('editor');

    // Wrap-around on the vertical axis: ArrowUp from the first tab wraps to the
    // last, ArrowDown from the last wraps back to the first.
    const countBeforeWrapStart = changeCount;
    await fireEvent.keyDown(tablist, { key: 'ArrowUp' });
    expect(changeCount - countBeforeWrapStart).toBe(1);
    expect(selected).toBe('summary');

    const countBeforeWrapEnd = changeCount;
    await fireEvent.keyDown(tablist, { key: 'ArrowDown' });
    expect(changeCount - countBeforeWrapEnd).toBe(1);
    expect(selected).toBe('editor');
  });

  test('invalid selectionMode="multiple" + variant="tablist" falls back to role="group" with pressed semantics', () => {
    const set = new SvelteSet<string>(['editor']);
    const { container } = render(Fixture, {
      props: {
        id: 'review-view',
        label: 'Review view',
        variant: 'tablist',
        selectionMode: 'multiple',
        value: set,
        options: tablistOptions,
      },
    });

    // Multiple-selection mode wins the role derivation regardless of variant:
    // the control renders role="group" with aria-pressed children, never
    // role="tab". Visual isolation of the raw
    // data-cinder-variant="tablist" + data-cinder-selection-mode="multiple"
    // attribute combination is proven in the Playwright regression, because the
    // tablist CSS is scoped to single-selection roots.
    expect(screen.getByRole('group', { name: 'Review view' })).not.toBeNull();
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(screen.queryByRole('tab')).toBeNull();

    const root = container.querySelector('.cinder-segmented-control');
    expect(root?.getAttribute('data-cinder-selection-mode')).toBe('multiple');

    const editor = screen.getByRole('button', { name: 'Editor' });
    expect(editor.getAttribute('aria-pressed')).toBe('true');
    expect(editor.getAttribute('aria-selected')).toBeNull();
  });

  test('detached tablist reflects data-cinder-detached so separator suppression stays scoped', () => {
    // The tablist separator-suppression CSS is scoped to
    // `:not([data-cinder-detached])`, so a detached tablist keeps the base
    // detached treatment (per-option borders, no connected-bar separators to
    // suppress). Pin the DOM contract that the suppression selector keys off:
    // a detached tablist still exposes both data attributes, so the
    // `:not([data-cinder-detached])` guard correctly excludes it.
    const { container } = render(Fixture, {
      props: {
        id: 'review-view',
        value: 'editor',
        label: 'Review view',
        variant: 'tablist',
        detached: true,
        options: tablistOptions,
      },
    });

    const root = container.querySelector('.cinder-segmented-control');
    expect(root?.getAttribute('data-cinder-variant')).toBe('tablist');
    expect(root?.getAttribute('data-cinder-detached')).toBe('');
    // Still a real tablist semantically.
    expect(screen.getByRole('tablist', { name: 'Review view' })).not.toBeNull();
  });
});

// ── Child-API regression (DOM order, dynamic add/remove) ─────────────────────

describe('SegmentedControl — child API regression', () => {
  test('segments register in DOM order regardless of registration order', async () => {
    let selected: string | undefined = 'middle';
    render(Fixture, {
      props: {
        id: 'order-test',
        get value() {
          return selected;
        },
        set value(next: string | undefined) {
          selected = next;
        },
        label: 'Order test',
        options: [
          { value: 'first', label: 'First' },
          { value: 'middle', label: 'Middle' },
          { value: 'last', label: 'Last' },
        ],
      },
    });

    const radiogroup = screen.getByRole('radiogroup');
    await fireEvent.keyDown(radiogroup, { key: 'ArrowRight' });
    expect(selected).toBe('last');
    await fireEvent.keyDown(radiogroup, { key: 'ArrowLeft' });
    await fireEvent.keyDown(radiogroup, { key: 'ArrowLeft' });
    expect(selected).toBe('first');
  });
});
