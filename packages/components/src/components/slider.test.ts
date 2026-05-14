/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../test/happy-dom.ts';

setupHappyDom();

const { fireEvent, render } = await import('@testing-library/svelte');
const { default: Slider } = await import('./slider.svelte');
const { default: SliderFormFieldFixture } =
  await import('../test/fixtures/slider-form-field-fixture.svelte');

function getThumbs(container: Element): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>('[role="slider"]'));
}

function textForLabelledBy(container: Element, labelledBy: string): string {
  return labelledBy
    .split(/\s+/)
    .map((id) => container.ownerDocument.getElementById(id)?.textContent?.trim() ?? '')
    .filter(Boolean)
    .join(' ');
}

describe('Slider (single)', () => {
  test('renders one role=slider with min/max/now and accessible name', () => {
    const { container } = render(Slider, {
      props: { label: 'Volume', defaultValue: 30 },
    });
    const thumbs = getThumbs(container);
    expect(thumbs).toHaveLength(1);
    const thumb = thumbs[0]!;
    expect(thumb.getAttribute('aria-valuemin')).toBe('0');
    expect(thumb.getAttribute('aria-valuemax')).toBe('100');
    expect(thumb.getAttribute('aria-valuenow')).toBe('30');
    expect(thumb.getAttribute('aria-label')).toBe('Volume');
  });

  test('ArrowRight increments by step', async () => {
    const { container } = render(Slider, {
      props: { label: 'Brightness', defaultValue: 20, step: 5 },
    });
    const thumb = getThumbs(container)[0]!;
    thumb.focus();
    await fireEvent.keyDown(thumb, { key: 'ArrowRight' });
    expect(thumb.getAttribute('aria-valuenow')).toBe('25');
  });

  test('ArrowLeft decrements by step', async () => {
    const { container } = render(Slider, {
      props: { label: 'Brightness', defaultValue: 20, step: 5 },
    });
    const thumb = getThumbs(container)[0]!;
    await fireEvent.keyDown(thumb, { key: 'ArrowLeft' });
    expect(thumb.getAttribute('aria-valuenow')).toBe('15');
  });

  test('ArrowUp / ArrowDown also adjust by step', async () => {
    const { container } = render(Slider, {
      props: { label: 'Volume', defaultValue: 50, step: 2 },
    });
    const thumb = getThumbs(container)[0]!;
    await fireEvent.keyDown(thumb, { key: 'ArrowUp' });
    expect(thumb.getAttribute('aria-valuenow')).toBe('52');
    await fireEvent.keyDown(thumb, { key: 'ArrowDown' });
    expect(thumb.getAttribute('aria-valuenow')).toBe('50');
  });

  test('Page Up / Page Down jump by pageStep (default 10× step)', async () => {
    const { container } = render(Slider, {
      props: { label: 'Volume', defaultValue: 50, step: 1 },
    });
    const thumb = getThumbs(container)[0]!;
    await fireEvent.keyDown(thumb, { key: 'PageUp' });
    expect(thumb.getAttribute('aria-valuenow')).toBe('60');
    await fireEvent.keyDown(thumb, { key: 'PageDown' });
    expect(thumb.getAttribute('aria-valuenow')).toBe('50');
  });

  test('Page Up / Page Down honors custom pageStep', async () => {
    const { container } = render(Slider, {
      props: { label: 'Volume', defaultValue: 50, step: 1, pageStep: 25 },
    });
    const thumb = getThumbs(container)[0]!;
    await fireEvent.keyDown(thumb, { key: 'PageUp' });
    expect(thumb.getAttribute('aria-valuenow')).toBe('75');
  });

  test('Home and End clamp to min and max', async () => {
    const { container } = render(Slider, {
      props: { label: 'Volume', defaultValue: 50 },
    });
    const thumb = getThumbs(container)[0]!;
    await fireEvent.keyDown(thumb, { key: 'Home' });
    expect(thumb.getAttribute('aria-valuenow')).toBe('0');
    await fireEvent.keyDown(thumb, { key: 'End' });
    expect(thumb.getAttribute('aria-valuenow')).toBe('100');
  });

  test('value clamps to [min, max] when arrow key would overshoot', async () => {
    const { container } = render(Slider, {
      props: { label: 'Volume', defaultValue: 99, step: 5 },
    });
    const thumb = getThumbs(container)[0]!;
    await fireEvent.keyDown(thumb, { key: 'ArrowRight' });
    expect(thumb.getAttribute('aria-valuenow')).toBe('100');
  });

  test('aria-valuetext uses valueText formatter when provided', () => {
    const { container } = render(Slider, {
      props: {
        label: 'Volume',
        defaultValue: 30,
        valueText: (v: number) => `${v} percent`,
      },
    });
    const thumb = getThumbs(container)[0]!;
    expect(thumb.getAttribute('aria-valuetext')).toBe('30 percent');
  });

  test('onchange fires with the snapped value on each keyboard adjust', async () => {
    const calls: number[] = [];
    const { container } = render(Slider, {
      props: {
        label: 'Volume',
        defaultValue: 10,
        step: 5,
        onchange: (value: number) => calls.push(value),
      },
    });
    const thumb = getThumbs(container)[0]!;
    await fireEvent.keyDown(thumb, { key: 'ArrowRight' });
    await fireEvent.keyDown(thumb, { key: 'ArrowRight' });
    expect(calls).toEqual([15, 20]);
  });

  test('controlled value reflects the passed prop on initial render', () => {
    const { container } = render(Slider, {
      props: { label: 'Volume', value: 70 },
    });
    expect(getThumbs(container)[0]!.getAttribute('aria-valuenow')).toBe('70');
  });

  test('initial value is clamped to the configured bounds', () => {
    const { container } = render(Slider, {
      props: { label: 'Volume', defaultValue: 200, min: 0, max: 100 },
    });
    expect(getThumbs(container)[0]!.getAttribute('aria-valuenow')).toBe('100');
  });

  test('controlled value: keyboard does not mutate when no onchange echoes it back', async () => {
    const { container } = render(Slider, {
      props: { label: 'Volume', value: 30, step: 5 },
    });
    const thumb = getThumbs(container)[0]!;
    await fireEvent.keyDown(thumb, { key: 'ArrowRight' });
    // value prop is the source of truth; without onchange echoing back, the
    // controlled value stays at 30.
    expect(thumb.getAttribute('aria-valuenow')).toBe('30');
  });

  test('disabled slider does not move with keyboard', async () => {
    const { container } = render(Slider, {
      props: { label: 'Volume', defaultValue: 30, disabled: true },
    });
    const thumb = getThumbs(container)[0]!;
    await fireEvent.keyDown(thumb, { key: 'ArrowRight' });
    expect(thumb.getAttribute('aria-valuenow')).toBe('30');
    expect(thumb.getAttribute('aria-disabled')).toBe('true');
    expect(thumb.getAttribute('tabindex')).toBe('-1');
  });

  test('renders a hidden input with name for form submission', () => {
    const { container } = render(Slider, {
      props: { label: 'Volume', defaultValue: 42, name: 'volume' },
    });
    const hidden = container.querySelector<HTMLInputElement>('input[type="hidden"]');
    expect(hidden).not.toBeNull();
    expect(hidden?.name).toBe('volume');
    expect(hidden?.value).toBe('42');
  });

  test('hidden input reflects the current value after keyboard movement', async () => {
    const { container } = render(Slider, {
      props: { label: 'Volume', defaultValue: 20, name: 'volume', step: 5 },
    });
    const thumb = getThumbs(container)[0]!;
    await fireEvent.keyDown(thumb, { key: 'ArrowRight' });
    expect(thumb.getAttribute('aria-valuenow')).toBe('25');
    const hidden = container.querySelector<HTMLInputElement>('input[type="hidden"]');
    expect(hidden?.value).toBe('25');
  });

  test('PageDown clamps to min when it would overshoot', async () => {
    const { container } = render(Slider, {
      props: { label: 'Volume', defaultValue: 5, step: 1, pageStep: 50 },
    });
    const thumb = getThumbs(container)[0]!;
    await fireEvent.keyDown(thumb, { key: 'PageDown' });
    expect(thumb.getAttribute('aria-valuenow')).toBe('0');
  });

  test('aria-valuetext updates when value changes via keyboard', async () => {
    const { container } = render(Slider, {
      props: {
        label: 'Volume',
        defaultValue: 30,
        step: 10,
        valueText: (v: number) => `${v} percent`,
      },
    });
    const thumb = getThumbs(container)[0]!;
    expect(thumb.getAttribute('aria-valuetext')).toBe('30 percent');
    await fireEvent.keyDown(thumb, { key: 'ArrowRight' });
    expect(thumb.getAttribute('aria-valuetext')).toBe('40 percent');
  });
});

describe('Slider (range)', () => {
  test('renders two thumbs with labels for min and max', () => {
    const { container } = render(Slider, {
      props: {
        label: 'Price',
        mode: 'range',
        defaultValue: [20, 80],
      },
    });
    const thumbs = getThumbs(container);
    expect(thumbs).toHaveLength(2);
    expect(thumbs[0]!.getAttribute('aria-label')).toBe('Price — minimum value');
    expect(thumbs[1]!.getAttribute('aria-label')).toBe('Price — maximum value');
    expect(thumbs[0]!.getAttribute('aria-valuenow')).toBe('20');
    expect(thumbs[1]!.getAttribute('aria-valuenow')).toBe('80');
  });

  test('low thumb cannot move past high thumb', async () => {
    const { container } = render(Slider, {
      props: {
        label: 'Price',
        mode: 'range',
        defaultValue: [20, 30],
        step: 5,
      },
    });
    const [low, high] = getThumbs(container);
    // 20 → 25 → 30 (high). Next press should clamp at 30, not exceed.
    await fireEvent.keyDown(low!, { key: 'ArrowRight' });
    await fireEvent.keyDown(low!, { key: 'ArrowRight' });
    await fireEvent.keyDown(low!, { key: 'ArrowRight' });
    expect(low!.getAttribute('aria-valuenow')).toBe('30');
    expect(high!.getAttribute('aria-valuenow')).toBe('30');
  });

  test('high thumb cannot move below low thumb', async () => {
    const { container } = render(Slider, {
      props: {
        label: 'Price',
        mode: 'range',
        defaultValue: [50, 60],
        step: 5,
      },
    });
    const [low, high] = getThumbs(container);
    await fireEvent.keyDown(high!, { key: 'ArrowLeft' });
    await fireEvent.keyDown(high!, { key: 'ArrowLeft' });
    await fireEvent.keyDown(high!, { key: 'ArrowLeft' });
    expect(high!.getAttribute('aria-valuenow')).toBe('50');
    expect(low!.getAttribute('aria-valuenow')).toBe('50');
  });

  test('aria-valuemax on the low thumb is the high value, and vice versa', () => {
    const { container } = render(Slider, {
      props: {
        label: 'Price',
        mode: 'range',
        defaultValue: [10, 40],
      },
    });
    const [low, high] = getThumbs(container);
    expect(low!.getAttribute('aria-valuemax')).toBe('40');
    expect(high!.getAttribute('aria-valuemin')).toBe('10');
  });

  test('initial range value is clamped and ordered before render', () => {
    const { container } = render(Slider, {
      props: {
        label: 'Price',
        mode: 'range',
        defaultValue: [120, -10],
        min: 0,
        max: 100,
      },
    });
    const [low, high] = getThumbs(container);
    expect(low!.getAttribute('aria-valuenow')).toBe('0');
    expect(high!.getAttribute('aria-valuenow')).toBe('100');
  });

  test('renders two hidden inputs in range mode', () => {
    const { container } = render(Slider, {
      props: {
        label: 'Price',
        mode: 'range',
        defaultValue: [10, 40],
        name: 'price',
      },
    });
    const inputs = container.querySelectorAll<HTMLInputElement>('input[type="hidden"]');
    expect(inputs).toHaveLength(2);
    expect(inputs[0]!.name).toBe('price.min');
    expect(inputs[0]!.value).toBe('10');
    expect(inputs[1]!.name).toBe('price.max');
    expect(inputs[1]!.value).toBe('40');
  });

  test('onchange fires with a tuple in range mode', async () => {
    const calls: Array<number | [number, number]> = [];
    const { container } = render(Slider, {
      props: {
        label: 'Price',
        mode: 'range',
        defaultValue: [10, 40],
        step: 5,
        onchange: (value: [number, number]) => calls.push(value),
      },
    });
    const [low] = getThumbs(container);
    await fireEvent.keyDown(low!, { key: 'ArrowRight' });
    expect(calls[0]).toEqual([15, 40]);
  });

  test('aria-valuetext is applied to both thumbs in range mode', () => {
    const { container } = render(Slider, {
      props: {
        label: 'Price',
        mode: 'range',
        defaultValue: [10, 90],
        valueText: (v: number) => `$${v}`,
      },
    });
    const [low, high] = getThumbs(container);
    expect(low!.getAttribute('aria-valuetext')).toBe('$10');
    expect(high!.getAttribute('aria-valuetext')).toBe('$90');
  });

  test('range thumbs inside FormField use the field label plus non-duplicating qualifiers', () => {
    const { container } = render(SliderFormFieldFixture);
    const [low, high] = getThumbs(container);

    const lowLabelledBy = low!.getAttribute('aria-labelledby');
    const highLabelledBy = high!.getAttribute('aria-labelledby');

    expect(low!.getAttribute('aria-label')).toBeNull();
    expect(high!.getAttribute('aria-label')).toBeNull();
    expect(lowLabelledBy).not.toBeNull();
    expect(highLabelledBy).not.toBeNull();
    expect(textForLabelledBy(container, lowLabelledBy!)).toBe('Price minimum value');
    expect(textForLabelledBy(container, highLabelledBy!)).toBe('Price maximum value');
  });

  test('range qualifier ids are unique across sliders without explicit ids', () => {
    const { container } = render(SliderFormFieldFixture, {
      props: { renderSecond: true },
    });
    const labelledByIds = getThumbs(container).flatMap(
      (thumb) => thumb.getAttribute('aria-labelledby')?.split(/\s+/) ?? [],
    );
    const qualifierIds = labelledByIds.filter(
      (id) => id.endsWith('-low-label') || id.endsWith('-high-label'),
    );

    expect(qualifierIds).toHaveLength(4);
    expect(new Set(qualifierIds).size).toBe(4);
  });
});

describe('Slider (ticks)', () => {
  test('renders tick marks when ticks=true', () => {
    const { container } = render(Slider, {
      props: { label: 'Volume', defaultValue: 50, step: 25, ticks: true },
    });
    const ticks = container.querySelectorAll('.cinder-slider__tick');
    // min=0, max=100, step=25 → 0, 25, 50, 75, 100 = 5 ticks.
    expect(ticks).toHaveLength(5);
  });

  test('arrow keys step between adjacent ticks when ticks is an array', async () => {
    const { container } = render(Slider, {
      props: {
        label: 'Volume',
        defaultValue: 0,
        ticks: [0, 25, 50, 75, 100],
        step: 1,
      },
    });
    const thumb = getThumbs(container)[0]!;
    await fireEvent.keyDown(thumb, { key: 'ArrowRight' });
    expect(thumb.getAttribute('aria-valuenow')).toBe('25');
    await fireEvent.keyDown(thumb, { key: 'ArrowRight' });
    expect(thumb.getAttribute('aria-valuenow')).toBe('50');
    await fireEvent.keyDown(thumb, { key: 'ArrowLeft' });
    expect(thumb.getAttribute('aria-valuenow')).toBe('25');
  });

  test('PageUp/PageDown move across ticks when tick spacing exceeds pageStep', async () => {
    // Regression: with ticks=[0,25,50,75,100] and default pageStep (10× step=10),
    // PageUp at tick 0 would compute 10, then snap back to 0 — making the keys
    // non-functional. PageUp must always advance to at least the next tick.
    const { container } = render(Slider, {
      props: {
        label: 'Volume',
        defaultValue: 0,
        ticks: [0, 25, 50, 75, 100],
        step: 1,
      },
    });
    const thumb = getThumbs(container)[0]!;
    await fireEvent.keyDown(thumb, { key: 'PageUp' });
    expect(thumb.getAttribute('aria-valuenow')).toBe('25');
    await fireEvent.keyDown(thumb, { key: 'PageDown' });
    expect(thumb.getAttribute('aria-valuenow')).toBe('0');
  });

  test('PageUp jumps multiple ticks when pageStep spans several', async () => {
    const { container } = render(Slider, {
      props: {
        label: 'Volume',
        defaultValue: 0,
        ticks: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
        step: 1,
        pageStep: 30,
      },
    });
    const thumb = getThumbs(container)[0]!;
    await fireEvent.keyDown(thumb, { key: 'PageUp' });
    // pageStep=30, ticks every 10 → should land at 30 (the last tick that
    // doesn't overshoot current+30).
    expect(thumb.getAttribute('aria-valuenow')).toBe('30');
  });

  test('pointer drag snaps to the nearest tick when ticks is an array', async () => {
    const { container } = render(Slider, {
      props: {
        label: 'Volume',
        defaultValue: 0,
        ticks: [0, 25, 50, 75, 100],
      },
    });
    const thumb = getThumbs(container)[0]!;
    // Home/End ignores ticks (clamps to min/max), then snap brings to closest tick.
    await fireEvent.keyDown(thumb, { key: 'End' });
    expect(thumb.getAttribute('aria-valuenow')).toBe('100');
  });

  test('tick marks have aria-hidden ancestor and are decorative', () => {
    const { container } = render(Slider, {
      props: { label: 'Volume', defaultValue: 50, step: 25, ticks: true },
    });
    const ticksContainer = container.querySelector('.cinder-slider__ticks');
    expect(ticksContainer?.getAttribute('aria-hidden')).toBe('true');
  });
});

function mockTrackRect(track: HTMLElement, width: number) {
  track.getBoundingClientRect = () =>
    ({
      left: 0,
      top: 0,
      right: width,
      bottom: 20,
      width,
      height: 20,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect;
}

describe('Slider (pointer)', () => {
  test('pointerdown on the track sets the value based on click position', async () => {
    const { container } = render(Slider, {
      props: { label: 'Volume', defaultValue: 0, min: 0, max: 100 },
    });
    const track = container.querySelector<HTMLDivElement>('.cinder-slider__track')!;
    mockTrackRect(track, 200);
    await fireEvent.pointerDown(track, { clientX: 100 });
    const thumb = getThumbs(container)[0]!;
    expect(thumb.getAttribute('aria-valuenow')).toBe('50');
  });

  test('pointermove on document updates the value while dragging', async () => {
    const { container } = render(Slider, {
      props: { label: 'Volume', defaultValue: 0, min: 0, max: 100 },
    });
    const track = container.querySelector<HTMLDivElement>('.cinder-slider__track')!;
    const thumb = getThumbs(container)[0]!;
    mockTrackRect(track, 200);

    await fireEvent.pointerDown(thumb, { clientX: 0 });
    await fireEvent(document, new PointerEvent('pointermove', { clientX: 150, bubbles: true }));
    expect(thumb.getAttribute('aria-valuenow')).toBe('75');
    await fireEvent(document, new PointerEvent('pointerup', { bubbles: true }));
  });

  test('pointerup ends the drag — further pointermove no longer mutates value', async () => {
    const { container } = render(Slider, {
      props: { label: 'Volume', defaultValue: 50, min: 0, max: 100 },
    });
    const track = container.querySelector<HTMLDivElement>('.cinder-slider__track')!;
    const thumb = getThumbs(container)[0]!;
    mockTrackRect(track, 200);

    await fireEvent.pointerDown(thumb, { clientX: 100 });
    await fireEvent(document, new PointerEvent('pointerup', { bubbles: true }));
    await fireEvent(document, new PointerEvent('pointermove', { clientX: 20, bubbles: true }));
    // The slider value should remain wherever the last drag commit left it
    // (here, the thumb pointerdown did not move it since it landed at the
    // existing 50 position with clientX=100 / 200px = 50%).
    expect(thumb.getAttribute('aria-valuenow')).toBe('50');
  });

  test('pointercancel ends the drag like pointerup', async () => {
    const { container } = render(Slider, {
      props: { label: 'Volume', defaultValue: 30 },
    });
    const thumb = getThumbs(container)[0]!;
    await fireEvent.pointerDown(thumb, { clientX: 0 });
    await fireEvent(document, new PointerEvent('pointercancel', { bubbles: true }));
    // No throw and subsequent pointermove no longer updates.
    await fireEvent(document, new PointerEvent('pointermove', { clientX: 999, bubbles: true }));
    expect(thumb.getAttribute('aria-valuenow')).toBe('30');
  });

  test('track click focuses the activated thumb so keyboard refinement works', async () => {
    // Regression: clicking the track activated a thumb but did not move
    // focus to it, so the user could not immediately press ArrowRight to
    // refine the value.
    const { container } = render(Slider, {
      props: { label: 'Volume', defaultValue: 0, min: 0, max: 100 },
    });
    const track = container.querySelector<HTMLDivElement>('.cinder-slider__track')!;
    mockTrackRect(track, 200);
    const thumb = getThumbs(container)[0]!;
    expect(document.activeElement).not.toBe(thumb);
    await fireEvent.pointerDown(track, { clientX: 100 });
    expect(document.activeElement).toBe(thumb);
  });

  test('range-mode track click focuses the nearer thumb', async () => {
    const { container } = render(Slider, {
      props: {
        label: 'Price',
        mode: 'range',
        defaultValue: [20, 80],
        min: 0,
        max: 100,
      },
    });
    const track = container.querySelector<HTMLDivElement>('.cinder-slider__track')!;
    mockTrackRect(track, 200);
    const [low, high] = getThumbs(container);
    // Click near the high thumb (clientX=160 → value 80).
    await fireEvent.pointerDown(track, { clientX: 160 });
    expect(document.activeElement).toBe(high!);
    expect(document.activeElement).not.toBe(low!);
  });

  test('track click in range mode moves the nearer thumb', async () => {
    const { container } = render(Slider, {
      props: {
        label: 'Price',
        mode: 'range',
        defaultValue: [20, 80],
        min: 0,
        max: 100,
      },
    });
    const track = container.querySelector<HTMLDivElement>('.cinder-slider__track')!;
    mockTrackRect(track, 200);
    // clientX=20/200 → value 10, closer to low thumb (20) than high (80).
    await fireEvent.pointerDown(track, { clientX: 20 });
    await fireEvent(document, new PointerEvent('pointerup', { bubbles: true }));
    const [low, high] = getThumbs(container);
    expect(low!.getAttribute('aria-valuenow')).toBe('10');
    expect(high!.getAttribute('aria-valuenow')).toBe('80');
  });

  test('document listeners are cleaned up on unmount during drag', async () => {
    const { container, unmount } = render(Slider, {
      props: { label: 'Volume', defaultValue: 50 },
    });
    const thumb = getThumbs(container)[0]!;
    await fireEvent.pointerDown(thumb, { clientX: 50 });
    unmount();
    // No throw firing pointermove on document after unmount means Svelte
    // tore down the <svelte:document> listeners correctly.
    await fireEvent(document, new PointerEvent('pointermove', { clientX: 60, bubbles: true }));
  });
});
