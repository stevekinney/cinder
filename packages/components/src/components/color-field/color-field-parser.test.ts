import { requiredInstance, setupHappyDom } from '@lostgradient/testing';
import { afterEach, expect, mock, test } from 'bun:test';

setupHappyDom();
const { cleanup, fireEvent, render } = await import('@testing-library/svelte/pure');
const { tick } = await import('svelte');
const { default: ColorField } = await import('./color-field.svelte');

afterEach(cleanup);

test.each(['rgb(0.3foo 0 -180)', 'oklch(0.4foo 0.1 120)'])(
  'malformed numeric dimensions remain an accessible invalid draft: %s',
  async (draft) => {
    const onValueChange = mock<(value: string) => void>(() => {});
    const { container } = render(ColorField, {
      id: 'color-parser',
      value: '#336699',
      formats: ['hex', 'rgb', 'hsl', 'hwb', 'oklch'],
      onValueChange,
    });
    const input = requiredInstance(container.querySelector('#color-parser'), HTMLInputElement);
    await fireEvent.input(input, { target: { value: draft } });
    await fireEvent.blur(input);
    await tick();

    expect(onValueChange).not.toHaveBeenCalled();
    expect(input.value).toBe(draft);
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(container.querySelector('.cinder-input-field__error')?.textContent).toContain('valid');

    await fireEvent.input(input, { target: { value: '#ff0000' } });
    await fireEvent.blur(input);
    await tick();
    expect(onValueChange).toHaveBeenCalledWith('#ff0000');
    expect(input.getAttribute('aria-invalid')).not.toBe('true');
  },
);
