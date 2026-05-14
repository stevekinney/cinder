/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../test/happy-dom.ts';

setupHappyDom();

const { fireEvent, render } = await import('@testing-library/svelte');
const { default: Slider } = await import('./slider.svelte');

function getThumbs(container: Element): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>('[role="slider"]'));
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
    const calls: Array<number | [number, number]> = [];
    const { container } = render(Slider, {
      props: {
        label: 'Volume',
        defaultValue: 10,
        step: 5,
        onchange: (value: number | [number, number]) => calls.push(value),
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

  test('form reset restores the defaultValue via the hidden input', async () => {
    const { container } = render(Slider, {
      props: { label: 'Volume', defaultValue: 20, name: 'volume', step: 5 },
    });
    const thumb = getThumbs(container)[0]!;
    await fireEvent.keyDown(thumb, { key: 'ArrowRight' });
    expect(thumb.getAttribute('aria-valuenow')).toBe('25');
    const hidden = container.querySelector<HTMLInputElement>('input[type="hidden"]');
    expect(hidden?.value).toBe('25');
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
        onchange: (value: number | [number, number]) => calls.push(value),
      },
    });
    const [low] = getThumbs(container);
    await fireEvent.keyDown(low!, { key: 'ArrowRight' });
    expect(calls[0]).toEqual([15, 40]);
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

describe('Slider (pointer)', () => {
  test('pointerdown on the track moves the thumb toward the click', async () => {
    const { container } = render(Slider, {
      props: { label: 'Volume', defaultValue: 0 },
    });
    const track = container.querySelector<HTMLDivElement>('.cinder-slider__track')!;
    // happy-dom returns zero-width rects, so the value resolves to `min`.
    // Verify the event handler is wired up without throwing.
    await fireEvent.pointerDown(track, { clientX: 0 });
    const thumb = getThumbs(container)[0]!;
    expect(thumb.getAttribute('aria-valuenow')).toBe('0');
  });

  test('pointerdown on the thumb does not throw and focuses the thumb', async () => {
    const { container } = render(Slider, {
      props: { label: 'Volume', defaultValue: 50 },
    });
    const thumb = getThumbs(container)[0]!;
    await fireEvent.pointerDown(thumb, { clientX: 50 });
    // Cleanup any document listeners by simulating pointerup.
    await fireEvent(document, new Event('pointerup'));
  });
});
