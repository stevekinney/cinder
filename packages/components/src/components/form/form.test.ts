import { describe, expect, test } from 'bun:test';
import { createRawSnippet } from 'svelte';
import { setupHappyDom } from '../../test/happy-dom.ts';
setupHappyDom();
const { render, fireEvent } = await import('@testing-library/svelte');
const { default: Form } = await import('./form.svelte');

const content = createRawSnippet<[{ submitting: boolean }]>(() => ({
  render: () => '<button type="submit">Save</button>',
}));

describe('Form', () => {
  test('prevents duplicate submissions while async submit is pending', async () => {
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    let calls = 0;
    const { container } = render(Form, {
      props: {
        onSubmit: async () => {
          calls += 1;
          await pending;
        },
        children: content,
      },
    });
    const form = container.querySelector('form')!;
    await fireEvent.submit(form);
    await fireEvent.submit(form);
    expect(calls).toBe(1);
    expect(form.hasAttribute('data-cinder-submitting')).toBe(true);
    release();
    await pending;
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(form.hasAttribute('data-cinder-submitting')).toBe(false);
  });
});
