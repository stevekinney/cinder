/// <reference lib="dom" />
import { afterEach, describe, expect, spyOn, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

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
  test('no swatch is aria-selected when no value or defaultValue', () => {
    const { container } = render(ColorSwatchPicker, { colors: palette, label: 'Colors' });
    const selected = container.querySelectorAll('[aria-selected="true"]');
    expect(selected.length).toBe(0);
  });

  test('defaultValue makes the matching swatch aria-selected', () => {
    const { container } = render(ColorSwatchPicker, {
      colors: palette,
      label: 'Colors',
      defaultValue: '#00ff00',
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

  test('Enter selects the focused swatch and fires onchange', async () => {
    let changed = '';
    const { container } = render(ColorSwatchPicker, {
      colors: palette,
      label: 'Colors',
      onchange: (c: string) => {
        changed = c;
      },
    });
    const listbox = container.querySelector('[role="listbox"]') as HTMLElement;
    // Focus the first option
    const firstOption = toArray(container.querySelectorAll('[role="option"]'))[0] as HTMLElement;
    await fireEvent.focus(firstOption);
    await fireEvent.keyDown(listbox, { key: 'Enter' });
    expect(changed).toBe('#ff0000');
  });

  test('Space selects the focused swatch and fires onchange', async () => {
    let changed = '';
    const { container } = render(ColorSwatchPicker, {
      colors: palette,
      label: 'Colors',
      onchange: (c: string) => {
        changed = c;
      },
    });
    const listbox = container.querySelector('[role="listbox"]') as HTMLElement;
    await fireEvent.keyDown(listbox, { key: ' ' });
    expect(changed).toBe('#ff0000');
  });

  test('click on a swatch selects it and fires onchange', async () => {
    let changed = '';
    const { container } = render(ColorSwatchPicker, {
      colors: palette,
      label: 'Colors',
      onchange: (c: string) => {
        changed = c;
      },
    });
    const thirdOption = toArray(container.querySelectorAll('[role="option"]'))[2] as HTMLElement;
    await fireEvent.click(thirdOption);
    expect(changed).toBe('#0000ff');
  });

  test('uncontrolled: selecting updates aria-selected without prop', async () => {
    const { container } = render(ColorSwatchPicker, { colors: palette, label: 'Colors' });
    const options = toArray(container.querySelectorAll('[role="option"]'));
    await fireEvent.click(options[2] as HTMLElement);
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
    const listbox = container.querySelector('[role="listbox"]') as HTMLElement;
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
      defaultValue: '#00ff00',
    });
    const listbox = container.querySelector('[role="listbox"]') as HTMLElement;
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
    const listbox = container.querySelector('[role="listbox"]') as HTMLElement;
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
    const listbox = container.querySelector('[role="listbox"]') as HTMLElement;
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
      defaultValue: '#00ff00',
    });
    const listbox = container.querySelector('[role="listbox"]') as HTMLElement;
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
    const listbox = container.querySelector('[role="listbox"]') as HTMLElement;
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
      defaultValue: '#0000ff',
    });
    const listbox = container.querySelector('[role="listbox"]') as HTMLElement;
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
      defaultValue: '#ff00ff',
    });
    const listbox = container.querySelector('[role="listbox"]') as HTMLElement;
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
    const listbox = container.querySelector('[role="listbox"]') as HTMLElement;
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
      defaultValue: '#00ff00',
    });
    const listbox = container.querySelector('[role="listbox"]') as HTMLElement;
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
      onchange: (c: string) => {
        changed = c;
      },
    });
    const disabledOption = toArray(container.querySelectorAll('[role="option"]'))[3] as HTMLElement;
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
    const listbox = container.querySelector('[role="listbox"]') as HTMLElement;
    const options = toArray(container.querySelectorAll('[role="option"]'));
    const initialTabbable = Array.from(options).findIndex(
      (o) => o.getAttribute('tabindex') === '0',
    );

    await fireEvent.keyDown(listbox, { key: 'ArrowRight' });
    const afterTabbable = Array.from(options).findIndex((o) => o.getAttribute('tabindex') === '0');
    expect(afterTabbable).toBe(initialTabbable);
  });

  test('group disabled: Enter/Space do not fire onchange', async () => {
    let changed = false;
    const { container } = render(ColorSwatchPicker, {
      colors: palette,
      label: 'Colors',
      disabled: true,
      onchange: () => {
        changed = true;
      },
    });
    const listbox = container.querySelector('[role="listbox"]') as HTMLElement;
    await fireEvent.keyDown(listbox, { key: 'Enter' });
    await fireEvent.keyDown(listbox, { key: ' ' });
    expect(changed).toBe(false);
  });

  test('group disabled: clicks do not fire onchange', async () => {
    let changed = false;
    const { container } = render(ColorSwatchPicker, {
      colors: palette,
      label: 'Colors',
      disabled: true,
      onchange: () => {
        changed = true;
      },
    });
    const option = toArray(container.querySelectorAll('[role="option"]'))[0] as HTMLElement;
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
    const listbox = container.querySelector('[role="listbox"]') as HTMLElement;
    // Should not throw
    await fireEvent.keyDown(listbox, { key: 'ArrowRight' });
    await fireEvent.keyDown(listbox, { key: 'Home' });
    await fireEvent.keyDown(listbox, { key: 'Enter' });
  });
});

describe('ColorSwatchPicker duplicate palette', () => {
  test('emits a devWarn when the palette is updated to contain duplicate color values', async () => {
    // The $effect.pre duplicate check runs before DOM mutations, so the warning
    // fires before Svelte processes the keyed each block. Start with unique colors,
    // then rerender with duplicates to trigger the reactive update path.
    const warnSpy = spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const uniqueColors = [
        { color: '#ff0000', name: 'Red' },
        { color: '#00ff00', name: 'Green' },
        { color: '#0000ff', name: 'Blue' },
      ];
      const { rerender } = render(ColorSwatchPicker, {
        colors: uniqueColors,
        label: 'Colors',
      });
      expect(warnSpy).not.toHaveBeenCalled();

      // Rerender with duplicates — $effect.pre fires the devWarn before Svelte
      // processes the keyed each. Swallow any subsequent Svelte throw.
      const duplicateColors = [
        { color: '#ff0000', name: 'Red 1' },
        { color: '#ff0000', name: 'Red 2' },
        { color: '#0000ff', name: 'Blue' },
      ];
      try {
        await rerender({ colors: duplicateColors, label: 'Colors' });
      } catch {
        // Svelte may throw each_key_duplicate after our warning has already fired.
      }
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

  test('onchange does not fire when controlled value prop changes', async () => {
    let changed = false;
    const { rerender } = render(ColorSwatchPicker, {
      colors: palette,
      label: 'Colors',
      value: '#ff0000',
      onchange: () => {
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
      onchange: (c: string) => {
        changed = c;
      },
    });
    const listbox = container.querySelector('[role="listbox"]') as HTMLElement;
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
      onchange: (c: string) => {
        changed = c;
      },
    });
    const listbox = container.querySelector('[role="listbox"]') as HTMLElement;
    const options = toArray(container.querySelectorAll('[role="option"]'));
    await fireEvent.keyDown(listbox, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(options[1]);
    await fireEvent.keyDown(listbox, { key: ' ' });
    expect(changed).toBe('#00ff00');
  });
});

describe('ColorSwatchPicker initial focus index', () => {
  test('selected option gets tabindex=0 when no user interaction', () => {
    const { container } = render(ColorSwatchPicker, {
      colors: palette,
      label: 'Colors',
      defaultValue: '#0000ff',
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
