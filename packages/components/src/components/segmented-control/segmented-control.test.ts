/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';
import { SvelteSet } from 'svelte/reactivity';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { cleanup, fireEvent, render, screen } = await import('@testing-library/svelte');
const { Check } = await import('../icons/index.ts');
const { default: SegmentedControl } = await import('./segmented-control.svelte');

afterEach(() => cleanup());

const options = [
  { value: 'source', label: 'Source' },
  { value: 'rendered', label: 'Rendered' },
  { value: 'diff', label: 'Diff', disabled: true },
] as const;

const allDisabledOptions = [
  { value: 'a', label: 'A', disabled: true },
  { value: 'b', label: 'B', disabled: true },
] as const;

// ── Single mode ─────────────────────────────────────────────────────────────

describe('SegmentedControl — single mode', () => {
  // Test 1
  test('renders role="radiogroup" with the provided accessible name', () => {
    render(SegmentedControl, {
      props: {
        id: 'document-view',
        value: 'source',
        label: 'Document view',
        options,
      },
    });

    expect(screen.getByRole('radiogroup', { name: 'Document view' })).not.toBeNull();
  });

  // Test 2
  test('renders each option as role="radio" with correct aria-checked', () => {
    render(SegmentedControl, {
      props: {
        id: 'document-view',
        value: 'source',
        label: 'Document view',
        options,
      },
    });

    expect(screen.getByRole('radio', { name: 'Source' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('radio', { name: 'Rendered' }).getAttribute('aria-checked')).toBe(
      'false',
    );
  });

  // Test 3
  test('clicking an enabled non-selected option updates bindable value', async () => {
    let selected = 'source';

    render(SegmentedControl, {
      props: {
        id: 'document-view',
        get value() {
          return selected;
        },
        set value(nextValue: string) {
          selected = nextValue;
        },
        label: 'Document view',
        options,
      },
    });

    await fireEvent.click(screen.getByRole('radio', { name: 'Rendered' }));
    expect(selected).toBe('rendered');
  });

  // Test 4
  test('clicking the already-selected option is a no-op (disallowEmptySelection default true)', async () => {
    let selected = 'source';

    render(SegmentedControl, {
      props: {
        id: 'document-view',
        get value() {
          return selected;
        },
        set value(nextValue: string) {
          selected = nextValue;
        },
        label: 'Document view',
        options,
      },
    });

    await fireEvent.click(screen.getByRole('radio', { name: 'Source' }));
    expect(selected).toBe('source');
  });

  // Test 5
  test('clicking a disabled option is a no-op', async () => {
    let selected = 'source';

    render(SegmentedControl, {
      props: {
        id: 'document-view',
        get value() {
          return selected;
        },
        set value(nextValue: string) {
          selected = nextValue;
        },
        label: 'Document view',
        options,
      },
    });

    await fireEvent.click(screen.getByRole('radio', { name: 'Diff' }));
    expect(selected).toBe('source');
  });

  // Test 6
  test('arrow navigation moves selection, skipping disabled options', async () => {
    let selected = 'source';

    render(SegmentedControl, {
      props: {
        id: 'document-view',
        get value() {
          return selected;
        },
        set value(nextValue: string) {
          selected = nextValue;
        },
        label: 'Document view',
        options,
      },
    });

    await fireEvent.keyDown(screen.getByRole('radiogroup'), { key: 'ArrowRight' });
    expect(selected).toBe('rendered');

    // ArrowRight again wraps around skipping disabled 'diff'
    await fireEvent.keyDown(screen.getByRole('radiogroup'), { key: 'ArrowRight' });
    expect(selected).toBe('source');
  });

  // Test 7
  test('with disallowEmptySelection={false}, clicking the already-selected option clears value', async () => {
    let selected: string | undefined = 'source';

    render(SegmentedControl, {
      props: {
        id: 'document-view',
        get value() {
          return selected;
        },
        set value(nextValue: string | undefined) {
          selected = nextValue;
        },
        label: 'Document view',
        options,
        disallowEmptySelection: false,
      } as any,
    });

    await fireEvent.click(screen.getByRole('radio', { name: 'Source' }));
    expect(selected).toBeUndefined();
  });

  // Test 7a — verifies handleKeydown does not preventDefault on Space
  // (jsdom doesn't auto-synthesize clicks from Space; real browsers do, so we only assert the event was not cancelled)
  test('Space keydown on a focused option does not call preventDefault', async () => {
    render(SegmentedControl, {
      props: {
        id: 'document-view',
        value: 'source',
        label: 'Document view',
        options,
      },
    });

    const sourceOption = screen.getByRole('radio', { name: 'Source' });
    // dispatchEvent returns false when preventDefault() was called; true otherwise
    const notCancelled = await fireEvent.keyDown(sourceOption, { key: ' ' });
    expect(notCancelled).toBe(true);
  });

  // Test 8
  test('with invalid value, first non-disabled option holds tabindex="0"', () => {
    render(SegmentedControl, {
      props: {
        id: 'document-view',
        value: 'nonexistent' as any,
        label: 'Document view',
        options,
      },
    });

    const source = screen.getByRole('radio', { name: 'Source' });
    const rendered = screen.getByRole('radio', { name: 'Rendered' });

    expect(source.getAttribute('tabindex')).toBe('0');
    expect(rendered.getAttribute('tabindex')).toBe('-1');
    // No option is aria-checked="true"
    expect(source.getAttribute('aria-checked')).toBe('false');
    expect(rendered.getAttribute('aria-checked')).toBe('false');
  });

  // Test 9
  test('group-level disabled: no click changes value; root has aria-disabled="true"', async () => {
    let selected = 'source';

    render(SegmentedControl, {
      props: {
        id: 'document-view',
        get value() {
          return selected;
        },
        set value(nextValue: string) {
          selected = nextValue;
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

  // Test 10
  test('value set to string not in options: no option renders aria-checked="true"', () => {
    render(SegmentedControl, {
      props: {
        id: 'document-view',
        value: 'nonexistent' as any,
        label: 'Document view',
        options,
      },
    });

    const radios = screen.getAllByRole('radio');
    for (const radio of radios) {
      expect(radio.getAttribute('aria-checked')).toBe('false');
    }
  });

  // Test 10a
  test('all options disabled: no tabindex="0", root does not carry aria-disabled', () => {
    render(SegmentedControl, {
      props: {
        id: 'document-view',
        label: 'Document view',
        options: allDisabledOptions,
      },
    });

    const group = screen.getByRole('radiogroup');
    expect(group.getAttribute('aria-disabled')).toBeNull();

    const buttons = screen.getAllByRole('radio');
    for (const button of buttons) {
      // All are disabled and should not have tabindex="0"
      expect(button.getAttribute('tabindex')).toBe('-1');
    }
  });

  // Test 10b
  test('empty options: group renders, no buttons, root has no aria-disabled', () => {
    render(SegmentedControl, {
      props: {
        id: 'document-view',
        label: 'Document view',
        options: [],
      },
    });

    const group = screen.getByRole('radiogroup');
    expect(group.getAttribute('aria-disabled')).toBeNull();
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
  });
});

// ── Multiple mode ────────────────────────────────────────────────────────────

describe('SegmentedControl — multiple mode', () => {
  const multiOptions = [
    { value: 'bold', label: 'Bold' },
    { value: 'italic', label: 'Italic' },
    { value: 'underline', label: 'Underline', disabled: true },
  ] as const;

  // Test 11
  test('renders role="group" (not radiogroup); no element has role="radio"', () => {
    const set = new SvelteSet<string>(['bold']);

    render(SegmentedControl, {
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

  // Test 12
  test('group has accessible name from label; hideLabel still provides it to AT', () => {
    const set = new SvelteSet<string>();

    render(SegmentedControl, {
      props: {
        id: 'text-format',
        label: 'Text formatting',
        options: multiOptions,
        selectionMode: 'multiple',
        value: set,
        hideLabel: true,
      },
    });

    // The group is still accessible via aria-labelledby even when label is visually hidden
    expect(screen.getByRole('group', { name: 'Text formatting' })).not.toBeNull();
  });

  // Test 13
  test('each option exposes aria-pressed reflecting membership in the SvelteSet', () => {
    const set = new SvelteSet<string>(['bold']);

    render(SegmentedControl, {
      props: {
        id: 'text-format',
        label: 'Text formatting',
        options: multiOptions,
        selectionMode: 'multiple',
        value: set,
      },
    });

    const boldBtn = screen.getByRole('button', { name: 'Bold' });
    const italicBtn = screen.getByRole('button', { name: 'Italic' });

    expect(boldBtn.getAttribute('aria-pressed')).toBe('true');
    expect(italicBtn.getAttribute('aria-pressed')).toBe('false');
  });

  // Test 14
  test('clicking an unpressed option adds it to the SvelteSet (reactivity check)', async () => {
    const set = new SvelteSet<string>();

    render(SegmentedControl, {
      props: {
        id: 'text-format',
        label: 'Text formatting',
        options: multiOptions,
        selectionMode: 'multiple',
        value: set,
      },
    });

    await fireEvent.click(screen.getByRole('button', { name: 'Bold' }));
    expect(set.has('bold')).toBe(true);
    // Prove DOM reactivity: aria-pressed must reflect the mutation
    expect(screen.getByRole('button', { name: 'Bold' }).getAttribute('aria-pressed')).toBe('true');
  });

  // Test 15
  test('clicking a pressed option removes it from the SvelteSet', async () => {
    const set = new SvelteSet<string>(['bold', 'italic']);

    render(SegmentedControl, {
      props: {
        id: 'text-format',
        label: 'Text formatting',
        options: multiOptions,
        selectionMode: 'multiple',
        value: set,
      },
    });

    await fireEvent.click(screen.getByRole('button', { name: 'Bold' }));
    expect(set.has('bold')).toBe(false);
    expect(set.has('italic')).toBe(true);
    // Prove DOM reactivity: aria-pressed must reflect the updated state
    expect(screen.getByRole('button', { name: 'Bold' }).getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByRole('button', { name: 'Italic' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
  });

  // Test 16
  test('clicking a disabled option is a no-op', async () => {
    const set = new SvelteSet<string>();

    render(SegmentedControl, {
      props: {
        id: 'text-format',
        label: 'Text formatting',
        options: multiOptions,
        selectionMode: 'multiple',
        value: set,
      },
    });

    await fireEvent.click(screen.getByRole('button', { name: 'Underline' }));
    expect(set.has('underline')).toBe(false);
  });

  // Test 17
  test('Tab order: non-disabled options have no explicit tabindex=-1 and are not disabled', () => {
    const set = new SvelteSet<string>();

    render(SegmentedControl, {
      props: {
        id: 'text-format',
        label: 'Text formatting',
        options: multiOptions,
        selectionMode: 'multiple',
        value: set,
      },
    });

    const boldBtn = screen.getByRole('button', { name: 'Bold' });
    const italicBtn = screen.getByRole('button', { name: 'Italic' });
    const underlineBtn = screen.getByRole('button', { name: 'Underline' });

    // Multi-mode buttons have no explicit tabindex — they are naturally in tab order
    expect(boldBtn.getAttribute('tabindex')).toBeNull();
    expect(italicBtn.getAttribute('tabindex')).toBeNull();
    // Disabled button has the disabled attribute
    expect(underlineBtn.hasAttribute('disabled')).toBe(true);
  });

  // Test 18
  test('ArrowRight on a multi-mode option does not change aria-pressed state', async () => {
    const set = new SvelteSet<string>();

    render(SegmentedControl, {
      props: {
        id: 'text-format',
        label: 'Text formatting',
        options: multiOptions,
        selectionMode: 'multiple',
        value: set,
      },
    });

    const boldBtn = screen.getByRole('button', { name: 'Bold' });
    await fireEvent.keyDown(boldBtn, { key: 'ArrowRight' });
    expect(set.size).toBe(0);
    expect(boldBtn.getAttribute('aria-pressed')).toBe('false');
  });

  // Test 19
  test('group-level disabled: no click changes the SvelteSet; root has aria-disabled="true"', async () => {
    const set = new SvelteSet<string>();

    render(SegmentedControl, {
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

    await fireEvent.click(screen.getByRole('button', { name: 'Bold' }));
    expect(set.has('bold')).toBe(false);
  });
});

// ── Variants (mode-agnostic) ─────────────────────────────────────────────────

describe('SegmentedControl — variants', () => {
  // Test 20
  test('size prop sets data-cinder-size on the outer element; default is "md"', () => {
    const { container } = render(SegmentedControl, {
      props: {
        id: 'v',
        label: 'View',
        options,
      },
    });

    const group = container.querySelector('[role="radiogroup"]');
    expect(group?.getAttribute('data-cinder-size')).toBe('md');
  });

  test('size="sm" sets data-cinder-size="sm"', () => {
    const { container } = render(SegmentedControl, {
      props: {
        id: 'v',
        label: 'View',
        options,
        size: 'sm',
      },
    });

    const group = container.querySelector('[role="radiogroup"]');
    expect(group?.getAttribute('data-cinder-size')).toBe('sm');
  });

  test('size="lg" sets data-cinder-size="lg"', () => {
    const { container } = render(SegmentedControl, {
      props: {
        id: 'v',
        label: 'View',
        options,
        size: 'lg',
      },
    });

    const group = container.querySelector('[role="radiogroup"]');
    expect(group?.getAttribute('data-cinder-size')).toBe('lg');
  });

  // Test 20a
  test('detached=false (default): data-cinder-detached attribute is absent (not "false")', () => {
    const { container } = render(SegmentedControl, {
      props: {
        id: 'v',
        label: 'View',
        options,
      },
    });

    const group = container.querySelector('[role="radiogroup"]');
    expect(group?.getAttribute('data-cinder-detached')).toBeNull();
  });

  // Test 21
  test('orientation="vertical" sets data-cinder-orientation="vertical" and aria-orientation in single mode', () => {
    const { container } = render(SegmentedControl, {
      props: {
        id: 'v',
        label: 'View',
        options,
        orientation: 'vertical',
      },
    });

    const group = container.querySelector('[role="radiogroup"]');
    expect(group?.getAttribute('data-cinder-orientation')).toBe('vertical');
    expect(group?.getAttribute('aria-orientation')).toBe('vertical');
  });

  test('orientation="vertical" does NOT set aria-orientation in multiple mode', () => {
    const set = new SvelteSet<string>();

    const { container } = render(SegmentedControl, {
      props: {
        id: 'v',
        label: 'View',
        options,
        selectionMode: 'multiple',
        value: set,
        orientation: 'vertical',
      },
    });

    const group = container.querySelector('[role="group"]');
    expect(group?.getAttribute('data-cinder-orientation')).toBe('vertical');
    expect(group?.getAttribute('aria-orientation')).toBeNull();
  });

  // Test 21a
  test('fullWidth=false (default): data-cinder-full-width attribute is absent', () => {
    const { container } = render(SegmentedControl, {
      props: {
        id: 'v',
        label: 'View',
        options,
      },
    });

    const group = container.querySelector('[role="radiogroup"]');
    expect(group?.getAttribute('data-cinder-full-width')).toBeNull();
  });

  test('unselected single-mode option does not have data-cinder-selected attribute', () => {
    const { container } = render(SegmentedControl, {
      props: {
        id: 'v',
        label: 'View',
        options,
        value: 'source',
      },
    });

    const renderedBtn = container.querySelector('#v-option-1');
    expect(renderedBtn?.getAttribute('data-cinder-selected')).toBeNull();
  });

  test('unpressed multi-mode option does not have data-cinder-pressed attribute', () => {
    const set = new SvelteSet<string>();
    const { container } = render(SegmentedControl, {
      props: {
        id: 'v',
        label: 'View',
        options,
        selectionMode: 'multiple',
        value: set,
      },
    });

    const firstBtn = container.querySelector('#v-option-0');
    expect(firstBtn?.getAttribute('data-cinder-pressed')).toBeNull();
  });

  // Test 22
  test('detached=true sets data-cinder-detached attribute', () => {
    const { container } = render(SegmentedControl, {
      props: {
        id: 'v',
        label: 'View',
        options,
        detached: true,
      },
    });

    const group = container.querySelector('[role="radiogroup"]');
    expect(group?.hasAttribute('data-cinder-detached')).toBe(true);
  });

  // Test 23
  test('fullWidth=true sets data-cinder-full-width attribute', () => {
    const { container } = render(SegmentedControl, {
      props: {
        id: 'v',
        label: 'View',
        options,
        fullWidth: true,
      },
    });

    const group = container.querySelector('[role="radiogroup"]');
    expect(group?.hasAttribute('data-cinder-full-width')).toBe(true);
  });

  // Test 24
  test('rest props pass through to the labelled group root', () => {
    const { container } = render(SegmentedControl, {
      props: {
        id: 'v',
        label: 'View',
        options,
        'data-test-id': 'my-control',
        'aria-describedby': 'hint-text',
      } as any,
    });

    const group = container.querySelector('[role="radiogroup"]');
    expect(group?.getAttribute('data-test-id')).toBe('my-control');
    expect(group?.getAttribute('aria-describedby')).toBe('hint-text');
  });

  // Test 25
  test('custom class merges with .cinder-segmented-control', () => {
    const { container } = render(SegmentedControl, {
      props: {
        id: 'v',
        label: 'View',
        options,
        class: 'my-custom-class',
      },
    });

    const group = container.querySelector('[role="radiogroup"]');
    expect(group?.classList.contains('cinder-segmented-control')).toBe(true);
    expect(group?.classList.contains('my-custom-class')).toBe(true);
  });

  // Test: data-cinder-selection-mode is always present
  test('data-cinder-selection-mode reflects the selection mode', () => {
    const { container: singleContainer } = render(SegmentedControl, {
      props: { id: 'v1', label: 'View', options },
    });
    const singleGroup = singleContainer.querySelector('[role="radiogroup"]');
    expect(singleGroup?.getAttribute('data-cinder-selection-mode')).toBe('single');

    cleanup();

    const set = new SvelteSet<string>();
    const { container: multiContainer } = render(SegmentedControl, {
      props: { id: 'v2', label: 'View', options, selectionMode: 'multiple', value: set },
    });
    const multiGroup = multiContainer.querySelector('[role="group"]');
    expect(multiGroup?.getAttribute('data-cinder-selection-mode')).toBe('multiple');
  });

  test('renders option icons without changing accessible names', () => {
    render(SegmentedControl, {
      props: {
        id: 'document-view',
        value: 'source',
        label: 'Document view',
        options: [{ value: 'source', label: 'Source', icon: Check }],
      },
    });

    const source = screen.getByRole('radio', { name: 'Source' });
    expect(source.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  test('can render tab semantics for panel switching', () => {
    render(SegmentedControl, {
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
    const { container } = render(SegmentedControl, {
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
    const { container } = render(SegmentedControl, {
      props: {
        id: 'view',
        label: 'View',
        options: [{ value: 'a', label: 'A' }],
      },
    });
    const control = container.querySelector('.cinder-segmented-control');
    expect(control?.hasAttribute('data-cinder-density')).toBe(false);
  });
});
