/// <reference lib="dom" />
import { describe, expect, mock, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { render, fireEvent } = await import('@testing-library/svelte');
const { default: Rating } = await import('./rating.svelte');

function options(container: Element): HTMLButtonElement[] {
  return Array.from(
    container.querySelectorAll<HTMLButtonElement>('button[data-cinder-rating-option]'),
  );
}

describe('Rating rendering', () => {
  test('renders 5 options by default', () => {
    const { container } = render(Rating, { props: { id: 'r', label: 'Quality' } });
    expect(options(container)).toHaveLength(5);
  });

  test('honors configurable count', () => {
    const { container } = render(Rating, { props: { id: 'r', label: 'Q', count: 7 } });
    expect(options(container)).toHaveLength(7);
  });

  test('clamps count below 1 to 1', () => {
    const { container } = render(Rating, { props: { id: 'r', label: 'Q', count: 0 } });
    expect(options(container)).toHaveLength(1);
  });

  test('clamps count above 10 to 10', () => {
    const { container } = render(Rating, { props: { id: 'r', label: 'Q', count: 99 } });
    expect(options(container)).toHaveLength(10);
  });

  test('group has role="radiogroup" with accessible name', () => {
    const { container } = render(Rating, { props: { id: 'r', label: 'Quality' } });
    const group = container.querySelector('[role="radiogroup"]')!;
    expect(group).not.toBeNull();
    expect(group.getAttribute('aria-labelledby')).toBe('r-label');
  });

  test('unrated state leaves no aria-checked="true" option', () => {
    const { container } = render(Rating, { props: { id: 'r', label: 'Q', value: 0 } });
    const all = options(container);
    expect(all.every((option) => option.getAttribute('aria-checked') === 'false')).toBe(true);
  });

  test('unrated state puts focus on the first option', () => {
    const { container } = render(Rating, { props: { id: 'r', label: 'Q', value: 0 } });
    const all = options(container);
    expect(all[0]?.getAttribute('tabindex')).toBe('0');
    expect(all[1]?.getAttribute('tabindex')).toBe('-1');
  });

  test('committed value places focus on the matching option', () => {
    const { container } = render(Rating, { props: { id: 'r', label: 'Q', value: 3 } });
    const all = options(container);
    expect(all[2]?.getAttribute('tabindex')).toBe('0');
    expect(all[2]?.getAttribute('aria-checked')).toBe('true');
  });

  test('hidden input renders only when name is provided', () => {
    const { container: noName } = render(Rating, { props: { id: 'r', label: 'Q', value: 4 } });
    expect(noName.querySelector('input[type="hidden"]')).toBeNull();

    const { container: withName } = render(Rating, {
      props: { id: 'r', label: 'Q', value: 4, name: 'score' },
    });
    const hidden = withName.querySelector<HTMLInputElement>('input[type="hidden"]')!;
    expect(hidden.getAttribute('name')).toBe('score');
    expect(hidden.value).toBe('4');
  });
});

describe('Rating half-star precision', () => {
  test('renders 2*count options when precision is half', () => {
    const { container } = render(Rating, {
      props: { id: 'r', label: 'Q', precision: 'half', count: 5 },
    });
    expect(options(container)).toHaveLength(10);
  });

  test('clamps external value to nearest half step', async () => {
    const { container } = render(Rating, {
      props: { id: 'r', label: 'Q', precision: 'half', value: 2.3 },
    });
    const all = options(container);
    const checked = all.find((option) => option.getAttribute('aria-checked') === 'true');
    expect(checked?.getAttribute('data-cinder-rating-option')).toBe('2.5');
  });
});

describe('Rating interaction', () => {
  test('click commits the value and fires onchange', async () => {
    const onchange = mock((_value: number) => {});
    const { container } = render(Rating, { props: { id: 'r', label: 'Q', value: 0, onchange } });
    const all = options(container);
    await fireEvent.click(all[3]!);
    expect(onchange).toHaveBeenCalledWith(4);
  });

  test('ArrowRight from a committed value moves checked forward', async () => {
    const onchange = mock((_value: number) => {});
    const { container } = render(Rating, { props: { id: 'r', label: 'Q', value: 2, onchange } });
    const all = options(container);
    all[1]!.focus();
    await fireEvent.keyDown(all[1]!, { key: 'ArrowRight' });
    expect(onchange).toHaveBeenCalledWith(3);
  });

  test('ArrowLeft from a committed value moves checked backward', async () => {
    const onchange = mock((_value: number) => {});
    const { container } = render(Rating, { props: { id: 'r', label: 'Q', value: 3, onchange } });
    const all = options(container);
    all[2]!.focus();
    await fireEvent.keyDown(all[2]!, { key: 'ArrowLeft' });
    expect(onchange).toHaveBeenCalledWith(2);
  });

  test('Home commits the first option', async () => {
    const onchange = mock((_value: number) => {});
    const { container } = render(Rating, { props: { id: 'r', label: 'Q', value: 4, onchange } });
    const all = options(container);
    all[3]!.focus();
    await fireEvent.keyDown(all[3]!, { key: 'Home' });
    expect(onchange).toHaveBeenCalledWith(1);
  });

  test('End commits the count value', async () => {
    const onchange = mock((_value: number) => {});
    const { container } = render(Rating, {
      props: { id: 'r', label: 'Q', value: 1, count: 5, onchange },
    });
    const all = options(container);
    all[0]!.focus();
    await fireEvent.keyDown(all[0]!, { key: 'End' });
    expect(onchange).toHaveBeenCalledWith(5);
  });

  test('ArrowRight from the last option wraps to the first', async () => {
    const onchange = mock((_value: number) => {});
    const { container } = render(Rating, {
      props: { id: 'r', label: 'Q', value: 5, count: 5, onchange },
    });
    const all = options(container);
    all[4]!.focus();
    await fireEvent.keyDown(all[4]!, { key: 'ArrowRight' });
    expect(onchange).toHaveBeenCalledWith(1);
  });

  test('ArrowUp from a committed value moves checked forward', async () => {
    const onchange = mock((_value: number) => {});
    const { container } = render(Rating, { props: { id: 'r', label: 'Q', value: 2, onchange } });
    const all = options(container);
    all[1]!.focus();
    await fireEvent.keyDown(all[1]!, { key: 'ArrowUp' });
    expect(onchange).toHaveBeenCalledWith(3);
  });

  test('ArrowDown from a committed value moves checked backward', async () => {
    const onchange = mock((_value: number) => {});
    const { container } = render(Rating, { props: { id: 'r', label: 'Q', value: 3, onchange } });
    const all = options(container);
    all[2]!.focus();
    await fireEvent.keyDown(all[2]!, { key: 'ArrowDown' });
    expect(onchange).toHaveBeenCalledWith(2);
  });

  test('unrated + ArrowLeft wraps to the last option', async () => {
    const onchange = mock((_value: number) => {});
    const { container } = render(Rating, {
      props: { id: 'r', label: 'Q', value: 0, count: 5, onchange },
    });
    const all = options(container);
    all[0]!.focus();
    await fireEvent.keyDown(all[0]!, { key: 'ArrowLeft' });
    expect(onchange).toHaveBeenCalledWith(5);
  });

  test('Space commits the focused option from unrated', async () => {
    const onchange = mock((_value: number) => {});
    const { container } = render(Rating, {
      props: { id: 'r', label: 'Q', value: 0, onchange },
    });
    const all = options(container);
    all[0]!.focus();
    await fireEvent.keyDown(all[0]!, { key: ' ' });
    expect(onchange).toHaveBeenCalledWith(1);
  });

  test('onchange does NOT fire on hover preview', async () => {
    const onchange = mock((_value: number) => {});
    const { container } = render(Rating, { props: { id: 'r', label: 'Q', value: 1, onchange } });
    const all = options(container);
    await fireEvent.pointerEnter(all[3]!);
    expect(onchange).not.toHaveBeenCalled();
  });

  test('onchange does NOT fire on external prop synchronization', async () => {
    const onchange = mock((_value: number) => {});
    const { rerender } = render(Rating, { props: { id: 'r', label: 'Q', value: 1, onchange } });
    await rerender({ id: 'r', label: 'Q', value: 4, onchange });
    expect(onchange).not.toHaveBeenCalled();
  });
});

describe('Rating readonly mode', () => {
  test('does not render any focusable controls in readonly mode', () => {
    const { container } = render(Rating, {
      props: { id: 'r', label: 'Q', value: 3.5, precision: 'half', readonly: true },
    });
    expect(container.querySelectorAll('button').length).toBe(0);
    expect(container.querySelector('[role="radiogroup"]')).toBeNull();
  });

  test('readonly renders a text equivalent of the rating', () => {
    const { container } = render(Rating, {
      props: { id: 'r', label: 'Q', value: 4, readonly: true },
    });
    expect(container.textContent).toContain('4 stars out of 5');
  });

  test('readonly with a DOM label composes the label id with the value text id', () => {
    const { container } = render(Rating, {
      props: { id: 'r', label: 'Quality', value: 4, readonly: true },
    });
    const region = container.querySelector('[role="img"]')!;
    const labelledBy = region.getAttribute('aria-labelledby') ?? '';
    expect(labelledBy).toContain('r-label');
    expect(labelledBy).toContain('r-rating-value');
    // No aria-label override when aria-labelledby is in play.
    expect(region.getAttribute('aria-label')).toBeNull();
    // The referenced value-text span exists with the readable rating.
    expect(container.querySelector('#r-rating-value')?.textContent).toContain('4 stars out of 5');
  });

  test('readonly with only aria-label composes consumer label + value text', () => {
    const { container } = render(Rating, {
      props: { id: 'r', value: 4, readonly: true, 'aria-label': 'Average rating' },
    });
    const region = container.querySelector('[role="img"]')!;
    expect(region.getAttribute('aria-labelledby')).toBeNull();
    expect(region.getAttribute('aria-label')).toBe('Average rating: 4 stars out of 5');
  });
});

describe('Rating error / required / disabled', () => {
  test('error sets aria-invalid on the group and renders the message', () => {
    const { container } = render(Rating, {
      props: { id: 'r', label: 'Q', error: 'Pick a rating' },
    });
    const group = container.querySelector('[role="radiogroup"]')!;
    expect(group.getAttribute('aria-invalid')).toBe('true');
    expect(container.querySelector('#r-error')?.textContent).toContain('Pick a rating');
  });

  test('required is announced via aria-required', () => {
    const { container } = render(Rating, {
      props: { id: 'r', label: 'Q', required: true },
    });
    const group = container.querySelector('[role="radiogroup"]')!;
    expect(group.getAttribute('aria-required')).toBe('true');
  });

  test('disabled disables every option', () => {
    const { container } = render(Rating, {
      props: { id: 'r', label: 'Q', value: 2, disabled: true },
    });
    const all = options(container);
    expect(all.every((option) => option.disabled)).toBe(true);
    const group = container.querySelector('[role="radiogroup"]')!;
    expect(group.getAttribute('aria-disabled')).toBe('true');
  });

  test('label is rendered as a referenced labelling element', () => {
    const { container } = render(Rating, { props: { id: 'r', label: 'Movie rating' } });
    const labelNode = container.querySelector('#r-label');
    expect(labelNode?.textContent?.trim()).toBe('Movie rating');
  });
});
