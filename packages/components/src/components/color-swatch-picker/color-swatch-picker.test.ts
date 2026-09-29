/// <reference lib="dom" />
import { afterEach, describe, expect, spyOn, test } from 'bun:test';

import { requiredInstance, setupHappyDom } from '@lostgradient/testing';

setupHappyDom();

const { render, fireEvent, cleanup } = await import('@testing-library/svelte');
const { default: ColorSwatchPicker } = await import('./color-swatch-picker.svelte');

// Unmount renders between tests; shared document.body otherwise leaks activeElement/nodes.
afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

/**
 * Spread NodeList to HTMLElement[] — test files may use any[] and non-null assertions.
 * Using `any` here suppresses noUncheckedIndexedAccess on [n] access in tests.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toArray(list: NodeListOf<Element>): any[] {
  return Array.from(list);
}

const palette = [
  { color: '#ff0000', name: 'Red' },
  { color: '#00ff00', name: 'Green' },
  { color: '#0000ff', name: 'Blue' },
  { color: '#ffff00', name: 'Yellow', disabled: true },
  { color: '#ff00ff', name: 'Magenta' },
];

describe('ColorSwatchPicker structure', () => {
  test('renders a listbox with the provided label', () => {
    const { container } = render(ColorSwatchPicker, {
      colors: palette,
      label: 'Choose a color',
    });
    const listbox = container.querySelector('[role="listbox"]');
    expect(listbox).not.toBeNull();
    expect(listbox?.getAttribute('aria-label')).toBe('Choose a color');
  });

  test('renders all swatches as role=option', () => {
    const { container } = render(ColorSwatchPicker, { colors: palette, label: 'Colors' });
    const options = toArray(container.querySelectorAll('[role="option"]'));
    expect(options.length).toBe(palette.length);
  });

  test('option aria-label is "name, color" when name is provided', () => {
    const { container } = render(ColorSwatchPicker, { colors: palette, label: 'Colors' });
    const options = toArray(container.querySelectorAll('[role="option"]'));
    expect(options[0].getAttribute('aria-label')).toBe('Red, #ff0000');
    expect(options[1].getAttribute('aria-label')).toBe('Green, #00ff00');
  });

  test('option aria-label is just the color string when name is absent', () => {
    const colors = [{ color: '#aabbcc' }];
    const { container } = render(ColorSwatchPicker, { colors, label: 'Colors' });
    const option = container.querySelector('[role="option"]');
    expect(option?.getAttribute('aria-label')).toBe('#aabbcc');
  });

  test('class prop merges onto the listbox ul', () => {
    const { container } = render(ColorSwatchPicker, {
      colors: palette,
      label: 'Colors',
      class: 'my-custom-class',
    });
    const listbox = container.querySelector('[role="listbox"]');
    expect(listbox?.classList.contains('my-custom-class')).toBe(true);
    expect(listbox?.classList.contains('cinder-color-swatch-picker')).toBe(true);
  });

  test('data-cinder-size, shape, layout are set on the listbox', () => {
    const { container } = render(ColorSwatchPicker, {
      colors: palette,
      label: 'Colors',
      size: 'lg',
      shape: 'square',
      layout: 'stack',
    });
    const listbox = container.querySelector('[role="listbox"]');
    expect(listbox?.getAttribute('data-cinder-size')).toBe('lg');
    expect(listbox?.getAttribute('data-cinder-shape')).toBe('square');
    expect(listbox?.getAttribute('data-cinder-layout')).toBe('stack');
  });
});

describe('ColorSwatchPicker selection', () => {
  test('no swatch is aria-selected when no value or value', () => {
    const { container } = render(ColorSwatchPicker, { colors: palette, label: 'Colors' });
    const selected = container.querySelectorAll('[aria-selected="true"]');
    expect(selected.length).toBe(0);
  });

  test('value makes the matching swatch aria-selected', () => {
    const { container } = render(ColorSwatchPicker, {
      colors: palette,
      label: 'Colors',
      value: '#00ff00',
    });
    const options = toArray(container.querySelectorAll('[role="option"]'));
    expect(options[1].getAttribute('aria-selected')).toBe('true');
    expect(options[0].getAttribute('aria-selected')).toBe('false');
  });

  test('controlled value makes the matching swatch aria-selected', () => {
    const { container } = render(ColorSwatchPicker, {
      colors: palette,
      label: 'Colors',
      value: '#0000ff',
    });
    const options = toArray(container.querySelectorAll('[role="option"]'));
    expect(options[2].getAttribute('aria-selected')).toBe('true');
  });

  test('Enter selects the focused swatch and fires onValueChange', async () => {
    let changed = '';
    const { container } = render(ColorSwatchPicker, {
      colors: palette,
      label: 'Colors',
      onValueChange: (c: string) => {
        changed = c;
      },
    });
    const listbox = requiredInstance(container.querySelector('[role="listbox"]'), HTMLElement);
    // Focus the first option
    const firstOption = requiredInstance(
      toArray(container.querySelectorAll('[role="option"]'))[0],
      HTMLElement,
    );
    await fireEvent.focus(firstOption);
    await fireEvent.keyDown(listbox, { key: 'Enter' });
    expect(changed).toBe('#ff0000');
  });

  test('Space selects the focused swatch and fires onValueChange', async () => {
    let changed = '';
    const { container } = render(ColorSwatchPicker, {
      colors: palette,
      label: 'Colors',
      onValueChange: (c: string) => {
        changed = c;
      },
    });
    const listbox = requiredInstance(container.querySelector('[role="listbox"]'), HTMLElement);
    await fireEvent.keyDown(listbox, { key: ' ' });
    expect(changed).toBe('#ff0000');
  });

  test('click on a swatch selects it and fires onValueChange', async () => {
    let changed = '';
    const { container } = render(ColorSwatchPicker, {
      colors: palette,
      label: 'Colors',
      onValueChange: (c: string) => {
        changed = c;
      },
    });
    const thirdOption = requiredInstance(
      toArray(container.querySelectorAll('[role="option"]'))[2],
      HTMLElement,
    );
    await fireEvent.click(thirdOption);
    expect(changed).toBe('#0000ff');
  });

  test('uncontrolled: selecting updates aria-selected without prop', async () => {
    const { container } = render(ColorSwatchPicker, { colors: palette, label: 'Colors' });
    const options = toArray(container.querySelectorAll('[role="option"]'));
    await fireEvent.click(requiredInstance(options[2], HTMLElement));
    expect(options[2].getAttribute('aria-selected')).toBe('true');
    expect(options[0].getAttribute('aria-selected')).toBe('false');
  });
});

describe('ColorSwatchPicker keyboard navigation', () => {
  test('ArrowRight advances focus in grid layout', async () => {
    const { container } = render(ColorSwatchPicker, {
      colors: palette,
      label: 'Colors',
      layout: 'grid',
    });
    const listbox = requiredInstance(container.querySelector('[role="listbox"]'), HTMLElement);
    const options = toArray(container.querySelectorAll('[role="option"]'));

    // First option should start with tabindex=0
    expect(options[0].getAttribute('tabindex')).toBe('0');

    await fireEvent.keyDown(listbox, { key: 'ArrowRight' });
    expect(options[1].getAttribute('tabindex')).toBe('0');
    expect(options[0].getAttribute('tabindex')).toBe('-1');
    expect(document.activeElement).toBe(options[1]);
  });

  test('ArrowLeft retreats focus in grid layout', async () => {
    const { container } = render(ColorSwatchPicker, {
      colors: palette,
      label: 'Colors',
      layout: 'grid',
      value: '#00ff00',
    });
    const listbox = requiredInstance(container.querySelector('[role="listbox"]'), HTMLElement);
    const options = toArray(container.querySelectorAll('[role="option"]'));

    // Second option selected initially
    expect(options[1].getAttribute('tabindex')).toBe('0');
    await fireEvent.keyDown(listbox, { key: 'ArrowLeft' });
    expect(options[0].getAttribute('tabindex')).toBe('0');
    expect(document.activeElement).toBe(options[0]);
  });

  test('ArrowDown advances focus in grid layout', async () => {
    const { container } = render(ColorSwatchPicker, {
      colors: palette,
      label: 'Colors',
      layout: 'grid',
    });
    const listbox = requiredInstance(container.querySelector('[role="listbox"]'), HTMLElement);
    const options = toArray(container.querySelectorAll('[role="option"]'));

    await fireEvent.keyDown(listbox, { key: 'ArrowDown' });
    expect(options[1].getAttribute('tabindex')).toBe('0');
    expect(document.activeElement).toBe(options[1]);
  });

  test('ArrowDown advances focus in stack layout', async () => {
    const { container } = render(ColorSwatchPicker, {
      colors: palette,
      label: 'Colors',
      layout: 'stack',
    });
    const listbox = requiredInstance(container.querySelector('[role="listbox"]'), HTMLElement);
    const options = toArray(container.querySelectorAll('[role="option"]'));

    await fireEvent.keyDown(listbox, { key: 'ArrowDown' });
    expect(options[1].getAttribute('tabindex')).toBe('0');
    expect(document.activeElement).toBe(options[1]);
  });

  test('ArrowUp retreats focus in stack layout', async () => {
    const { container } = render(ColorSwatchPicker, {
      colors: palette,
      label: 'Colors',
      layout: 'stack',
      value: '#00ff00',
    });
    const listbox = requiredInstance(container.querySelector('[role="listbox"]'), HTMLElement);
    const options = toArray(container.querySelectorAll('[role="option"]'));

    await fireEvent.keyDown(listbox, { key: 'ArrowUp' });
    expect(options[0].getAttribute('tabindex')).toBe('0');
    expect(document.activeElement).toBe(options[0]);
  });

  test('ArrowLeft/Right are no-ops in stack layout', async () => {
    const { container } = render(ColorSwatchPicker, {
      colors: palette,
      label: 'Colors',
      layout: 'stack',
    });
    const listbox = requiredInstance(container.querySelector('[role="listbox"]'), HTMLElement);
    const options = toArray(container.querySelectorAll('[role="option"]'));

    await fireEvent.keyDown(listbox, { key: 'ArrowRight' });
    expect(options[0].getAttribute('tabindex')).toBe('0');
    await fireEvent.keyDown(listbox, { key: 'ArrowLeft' });
    expect(options[0].getAttribute('tabindex')).toBe('0');
  });

  test('ArrowRight wraps from last to first', async () => {
    const colors = [{ color: '#ff0000' }, { color: '#00ff00' }, { color: '#0000ff' }];
    const { container } = render(ColorSwatchPicker, {
      colors,
      label: 'Colors',
      value: '#0000ff',
    });
    const listbox = requiredInstance(container.querySelector('[role="listbox"]'), HTMLElement);
    const options = toArray(container.querySelectorAll('[role="option"]'));

    expect(options[2].getAttribute('tabindex')).toBe('0');
    await fireEvent.keyDown(listbox, { key: 'ArrowRight' });
    expect(options[0].getAttribute('tabindex')).toBe('0');
    expect(document.activeElement).toBe(options[0]);
  });

  test('Home jumps to first non-disabled swatch', async () => {
    const { container } = render(ColorSwatchPicker, {
      colors: palette,
      label: 'Colors',
      value: '#ff00ff',
    });
    const listbox = requiredInstance(container.querySelector('[role="listbox"]'), HTMLElement);
    const options = toArray(container.querySelectorAll('[role="option"]'));

    await fireEvent.keyDown(listbox, { key: 'Home' });
    expect(options[0].getAttribute('tabindex')).toBe('0');
    expect(document.activeElement).toBe(options[0]);
  });

  test('End jumps to last non-disabled swatch', async () => {
    const { container } = render(ColorSwatchPicker, {
      colors: palette,
      label: 'Colors',
    });
    const listbox = requiredInstance(container.querySelector('[role="listbox"]'), HTMLElement);
    const options = toArray(container.querySelectorAll('[role="option"]'));

    await fireEvent.keyDown(listbox, { key: 'End' });
    // Last non-disabled is index 4 (Magenta), index 3 (Yellow) is disabled
    expect(options[4].getAttribute('tabindex')).toBe('0');
    expect(document.activeElement).toBe(options[4]);
  });

  test('disabled items are skipped during arrow navigation', async () => {
    const { container } = render(ColorSwatchPicker, {
      colors: palette,
      label: 'Colors',
      value: '#00ff00',
    });
    const listbox = requiredInstance(container.querySelector('[role="listbox"]'), HTMLElement);
    const options = toArray(container.querySelectorAll('[role="option"]'));

    // index 1 → ArrowRight → should skip index 3 (disabled Yellow)
    await fireEvent.keyDown(listbox, { key: 'ArrowRight' });
    // Now at index 2 (Blue)
    expect(options[2].getAttribute('tabindex')).toBe('0');
    expect(document.activeElement).toBe(options[2]);
    await fireEvent.keyDown(listbox, { key: 'ArrowRight' });
    // Skip index 3 (Yellow, disabled) → land on index 4 (Magenta)
    expect(options[4].getAttribute('tabindex')).toBe('0');
    expect(document.activeElement).toBe(options[4]);
  });
});

describe('ColorSwatchPicker disabled handling', () => {
  test('disabled item has aria-disabled=true', () => {
    const { container } = render(ColorSwatchPicker, { colors: palette, label: 'Colors' });
    const options = toArray(container.querySelectorAll('[role="option"]'));
    expect(options[3].getAttribute('aria-disabled')).toBe('true');
  });

  test('disabled item cannot be selected by click', async () => {
    let changed = '';
    const { container } = render(ColorSwatchPicker, {
      colors: palette,
      label: 'Colors',
      onValueChange: (c: string) => {
        changed = c;
      },
    });
    const disabledOption = requiredInstance(
      toArray(container.querySelectorAll('[role="option"]'))[3],
      HTMLElement,
    );
    await fireEvent.click(disabledOption);
    expect(changed).toBe('');
  });

  test('group disabled: listbox has aria-disabled=true', () => {
    const { container } = render(ColorSwatchPicker, {
      colors: palette,
      label: 'Colors',
      disabled: true,
    });
    const listbox = container.querySelector('[role="listbox"]');
    expect(listbox?.getAttribute('aria-disabled')).toBe('true');
  });

  test('group disabled: all options have aria-disabled=true', () => {
    const { container } = render(ColorSwatchPicker, {
      colors: palette,
      label: 'Colors',
      disabled: true,
    });
    const options = toArray(container.querySelectorAll('[role="option"]'));
    options.forEach((option) => {
      expect(option.getAttribute('aria-disabled')).toBe('true');
    });
  });

  test('group disabled: focused option retains tabindex=0', () => {
    const { container } = render(ColorSwatchPicker, {
      colors: palette,
      label: 'Colors',
      disabled: true,
    });
    const options = toArray(container.querySelectorAll('[role="option"]'));
    const tabbable = Array.from(options).filter((o) => o.getAttribute('tabindex') === '0');
    expect(tabbable.length).toBe(1);
  });

  test('group disabled: Arrow keys are no-ops', async () => {
    const { container } = render(ColorSwatchPicker, {
      colors: palette,
      label: 'Colors',
      disabled: true,
    });
    const listbox = requiredInstance(container.querySelector('[role="listbox"]'), HTMLElement);
    const options = toArray(container.querySelectorAll('[role="option"]'));
    const initialTabbable = Array.from(options).findIndex(
      (o) => o.getAttribute('tabindex') === '0',
    );

    await fireEvent.keyDown(listbox, { key: 'ArrowRight' });
    const afterTabbable = Array.from(options).findIndex((o) => o.getAttribute('tabindex') === '0');
    expect(afterTabbable).toBe(initialTabbable);
  });

  test('group disabled: Enter/Space do not fire onValueChange', async () => {
    let changed = false;
    const { container } = render(ColorSwatchPicker, {
      colors: palette,
      label: 'Colors',
      disabled: true,
      onValueChange: () => {
        changed = true;
      },
    });
    const listbox = requiredInstance(container.querySelector('[role="listbox"]'), HTMLElement);
    await fireEvent.keyDown(listbox, { key: 'Enter' });
    await fireEvent.keyDown(listbox, { key: ' ' });
    expect(changed).toBe(false);
  });

  test('group disabled: clicks do not fire onValueChange', async () => {
    let changed = false;
    const { container } = render(ColorSwatchPicker, {
      colors: palette,
      label: 'Colors',
      disabled: true,
      onValueChange: () => {
        changed = true;
      },
    });
    const option = requiredInstance(
      toArray(container.querySelectorAll('[role="option"]'))[0],
      HTMLElement,
    );
    await fireEvent.click(option);
    expect(changed).toBe(false);
  });
});

describe('ColorSwatchPicker alpha detection', () => {
  test('swatch with alpha color gets data-cinder-alpha', () => {
    const colors = [{ color: '#ff000080' }, { color: '#ff0000' }];
    const { container } = render(ColorSwatchPicker, { colors, label: 'Colors' });
    const options = toArray(container.querySelectorAll('[role="option"]'));
    expect(options[0].hasAttribute('data-cinder-alpha')).toBe(true);
    expect(options[1].hasAttribute('data-cinder-alpha')).toBe(false);
  });

  test('rgba() with alpha < 1 gets data-cinder-alpha', () => {
    const colors = [{ color: 'rgba(255, 0, 0, 0.5)' }];
    const { container } = render(ColorSwatchPicker, { colors, label: 'Colors' });
    const option = container.querySelector('[role="option"]');
    expect(option?.hasAttribute('data-cinder-alpha')).toBe(true);
  });

  test('opaque rgb() does not get data-cinder-alpha', () => {
    const colors = [{ color: 'rgb(255, 0, 0)' }];
    const { container } = render(ColorSwatchPicker, { colors, label: 'Colors' });
    const option = container.querySelector('[role="option"]');
    expect(option?.hasAttribute('data-cinder-alpha')).toBe(false);
  });
});

describe('ColorSwatchPicker empty palette', () => {
  test('renders an empty listbox without crashing', () => {
    const { container } = render(ColorSwatchPicker, { colors: [], label: 'Colors' });
    const listbox = container.querySelector('[role="listbox"]');
    expect(listbox).not.toBeNull();
    const options = toArray(container.querySelectorAll('[role="option"]'));
    expect(options.length).toBe(0);
  });

  test('keyboard handlers are no-ops on empty palette', async () => {
    const { container } = render(ColorSwatchPicker, { colors: [], label: 'Colors' });
    const listbox = requiredInstance(container.querySelector('[role="listbox"]'), HTMLElement);
    // Should not throw
    await fireEvent.keyDown(listbox, { key: 'ArrowRight' });
    await fireEvent.keyDown(listbox, { key: 'Home' });
    await fireEvent.keyDown(listbox, { key: 'Enter' });
  });
});

describe('ColorSwatchPicker duplicate palette', () => {
  test('deduplicates swatches and emits a devWarn when duplicate color values are present', () => {
    // With $derived.by dedup, the component never passes duplicates to the keyed
    // {#each}, so Svelte cannot throw each_key_duplicate. The test asserts that:
    //   1. No crash occurs (no try/catch needed).
    //   2. Only the first occurrence of each color is rendered.
    //   3. The first swatch is aria-selected when its color matches value.
    //   4. The devWarn fires so the developer is notified.
    const warnSpy = spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const duplicateColors = [
        { color: '#ff0000', name: 'Red 1' },
        { color: '#ff0000', name: 'Red 2' },
        { color: '#0000ff', name: 'Blue' },
      ];
      const { container } = render(ColorSwatchPicker, {
        colors: duplicateColors,
        label: 'Colors',
        value: '#ff0000',
      });
      // Only 2 swatches render: first #ff0000 and #0000ff (duplicate dropped).
      const options = toArray(container.querySelectorAll('[role="option"]'));
      expect(options).toHaveLength(2);
      // First swatch (the first #ff0000) carries aria-selected because
      // value matches its color.
      expect(options[0]?.getAttribute('aria-selected')).toBe('true');
      expect(options[1]?.getAttribute('aria-selected')).toBe('false');
      // devWarn fires exactly once to notify the developer.
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Duplicate color values'));
    } finally {
      warnSpy.mockRestore();
    }
  });
});

describe('ColorSwatchPicker controlled value update', () => {
  test('updating value prop moves aria-selected to the new color', async () => {
    const { container, rerender } = render(ColorSwatchPicker, {
      colors: palette,
      label: 'Colors',
      value: '#ff0000',
    });
    const options = toArray(container.querySelectorAll('[role="option"]'));
    expect(options[0].getAttribute('aria-selected')).toBe('true');

    await rerender({ colors: palette, label: 'Colors', value: '#0000ff' });
    expect(options[0].getAttribute('aria-selected')).toBe('false');
    expect(options[2].getAttribute('aria-selected')).toBe('true');
  });

  test('onValueChange does not fire when controlled value prop changes', async () => {
    let changed = false;
    const { rerender } = render(ColorSwatchPicker, {
      colors: palette,
      label: 'Colors',
      value: '#ff0000',
      onValueChange: () => {
        changed = true;
      },
    });
    await rerender({ colors: palette, label: 'Colors', value: '#0000ff' });
    expect(changed).toBe(false);
  });
});

describe('ColorSwatchPicker navigate-then-select', () => {
  test('ArrowRight then Enter selects the navigated-to swatch', async () => {
    let changed = '';
    const { container } = render(ColorSwatchPicker, {
      colors: palette,
      label: 'Colors',
      onValueChange: (c: string) => {
        changed = c;
      },
    });
    const listbox = requiredInstance(container.querySelector('[role="listbox"]'), HTMLElement);
    const options = toArray(container.querySelectorAll('[role="option"]'));
    await fireEvent.keyDown(listbox, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(options[1]);
    await fireEvent.keyDown(listbox, { key: 'Enter' });
    expect(changed).toBe('#00ff00');
  });

  test('ArrowDown then Space selects the navigated-to swatch in stack layout', async () => {
    let changed = '';
    const { container } = render(ColorSwatchPicker, {
      colors: palette,
      label: 'Colors',
      layout: 'stack',
      onValueChange: (c: string) => {
        changed = c;
      },
    });
    const listbox = requiredInstance(container.querySelector('[role="listbox"]'), HTMLElement);
    const options = toArray(container.querySelectorAll('[role="option"]'));
    await fireEvent.keyDown(listbox, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(options[1]);
    await fireEvent.keyDown(listbox, { key: ' ' });
    expect(changed).toBe('#00ff00');
  });
});

describe('ColorSwatchPicker focus preservation on palette refresh', () => {
  test('an equivalent fresh array keeps the user-focused color focused, not the selected one', async () => {
    let changed = '';
    const { container, rerender } = render(ColorSwatchPicker, {
      colors: palette,
      label: 'Colors',
      value: '#ff0000',
      onValueChange: (c: string) => {
        changed = c;
      },
    });
    const listbox = requiredInstance(container.querySelector('[role="listbox"]'), HTMLElement);
    let options = toArray(container.querySelectorAll('[role="option"]'));

    // Selected is Red (index 0). Arrow-navigate focus to Blue (index 2) without selecting it.
    await fireEvent.keyDown(listbox, { key: 'ArrowRight' });
    await fireEvent.keyDown(listbox, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(options[2]);
    expect(options[2].getAttribute('tabindex')).toBe('0');

    // Pass a brand-new array instance with the same swatch values (equivalent fresh array).
    const freshPalette = palette.map((swatch) => ({ ...swatch }));
    await rerender({ colors: freshPalette, label: 'Colors', value: '#ff0000' });

    options = toArray(container.querySelectorAll('[role="option"]'));
    expect(options[2].getAttribute('tabindex')).toBe('0');
    expect(options[0].getAttribute('tabindex')).toBe('-1');

    await fireEvent.keyDown(listbox, { key: 'Enter' });
    expect(changed).toBe('#0000ff');
  });

  test('reordering the palette keeps the same logical color focused', async () => {
    // Select Red so an accidental "first enabled" or "selected" fallback would land on
    // Red (index 0), not Blue — this makes the assertion prove identity tracking rather
    // than coincide with a fallback rule.
    const { container, rerender } = render(ColorSwatchPicker, {
      colors: palette,
      label: 'Colors',
      value: '#ff0000',
    });
    const listbox = requiredInstance(container.querySelector('[role="listbox"]'), HTMLElement);
    let options = toArray(container.querySelectorAll('[role="option"]'));

    // Focus Blue (index 2) without selecting it.
    await fireEvent.keyDown(listbox, { key: 'ArrowRight' });
    await fireEvent.keyDown(listbox, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(options[2]);

    // Reorder so Blue moves to the end, well away from both the selected color and
    // "first enabled" fallback position.
    const reordered = [palette[0]!, palette[1]!, palette[3]!, palette[4]!, palette[2]!];
    await rerender({ colors: reordered, label: 'Colors', value: '#ff0000' });

    options = toArray(container.querySelectorAll('[role="option"]'));
    // Blue is now at index 4 and should still carry the roving tab stop.
    expect(options[4].getAttribute('aria-label')).toContain('#0000ff');
    expect(options[4].getAttribute('tabindex')).toBe('0');
    expect(options[0].getAttribute('tabindex')).toBe('-1');
  });

  test('removing the focused color falls back to the selected enabled color', async () => {
    const { container, rerender } = render(ColorSwatchPicker, {
      colors: palette,
      label: 'Colors',
      value: '#ff00ff',
    });
    const listbox = requiredInstance(container.querySelector('[role="listbox"]'), HTMLElement);
    let options = toArray(container.querySelectorAll('[role="option"]'));

    // Magenta (index 4) is selected initially, so the roving tab stop starts there.
    // Three ArrowRight presses wrap 4 -> 0 -> 1 -> 2, landing on Blue without selecting it.
    await fireEvent.keyDown(listbox, { key: 'ArrowRight' });
    await fireEvent.keyDown(listbox, { key: 'ArrowRight' });
    await fireEvent.keyDown(listbox, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(options[2]);

    const withoutBlue = palette.filter((swatch) => swatch.color !== '#0000ff');
    await rerender({ colors: withoutBlue, label: 'Colors', value: '#ff00ff' });

    options = toArray(container.querySelectorAll('[role="option"]'));
    const tabbable = options.filter((o) => o.getAttribute('tabindex') === '0');
    expect(tabbable).toHaveLength(1);
    expect(tabbable[0]?.getAttribute('aria-selected')).toBe('true');
  });

  test('disabling the focused color falls back to the selected enabled color', async () => {
    const { container, rerender } = render(ColorSwatchPicker, {
      colors: palette,
      label: 'Colors',
      value: '#ff00ff',
    });
    const listbox = requiredInstance(container.querySelector('[role="listbox"]'), HTMLElement);
    let options = toArray(container.querySelectorAll('[role="option"]'));

    // Magenta (index 4) is selected initially, so the roving tab stop starts there.
    // Three ArrowRight presses wrap 4 -> 0 -> 1 -> 2, landing on Blue without selecting it.
    await fireEvent.keyDown(listbox, { key: 'ArrowRight' });
    await fireEvent.keyDown(listbox, { key: 'ArrowRight' });
    await fireEvent.keyDown(listbox, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(options[2]);

    const blueDisabled = palette.map((swatch) =>
      swatch.color === '#0000ff' ? { ...swatch, disabled: true } : swatch,
    );
    await rerender({ colors: blueDisabled, label: 'Colors', value: '#ff00ff' });

    options = toArray(container.querySelectorAll('[role="option"]'));
    const tabbable = options.filter((o) => o.getAttribute('tabindex') === '0');
    expect(tabbable).toHaveLength(1);
    expect(tabbable[0]?.getAttribute('aria-selected')).toBe('true');
  });

  test('a palette refresh alone never calls onValueChange', async () => {
    let changed = false;
    const { rerender } = render(ColorSwatchPicker, {
      colors: palette,
      label: 'Colors',
      value: '#ff0000',
      onValueChange: () => {
        changed = true;
      },
    });
    const freshPalette = palette.map((swatch) => ({ ...swatch }));
    await rerender({ colors: freshPalette, label: 'Colors', value: '#ff0000' });
    expect(changed).toBe(false);
  });
});

describe('ColorSwatchPicker initial focus index', () => {
  test('selected option gets tabindex=0 when no user interaction', () => {
    const { container } = render(ColorSwatchPicker, {
      colors: palette,
      label: 'Colors',
      value: '#0000ff',
    });
    const options = toArray(container.querySelectorAll('[role="option"]'));
    expect(options[2].getAttribute('tabindex')).toBe('0');
    expect(options[0].getAttribute('tabindex')).toBe('-1');
  });

  test('first enabled option gets tabindex=0 when no selection', () => {
    const colors = [{ color: '#ff0000', disabled: true }, { color: '#00ff00' }];
    const { container } = render(ColorSwatchPicker, { colors, label: 'Colors' });
    const options = toArray(container.querySelectorAll('[role="option"]'));
    expect(options[0].getAttribute('tabindex')).toBe('-1');
    expect(options[1].getAttribute('tabindex')).toBe('0');
  });
});
