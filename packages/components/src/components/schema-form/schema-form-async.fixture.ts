/// <reference lib="dom" />
import { afterEach, describe, expect, mock, test } from 'bun:test';
import { tick } from 'svelte';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

function deferred<T>() {
  let deferredResolve!: (value: T) => void;
  let deferredReject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolve, reject) => {
    deferredResolve = resolve;
    deferredReject = reject;
  });
  return { promise, resolve: deferredResolve, reject: deferredReject };
}

let pendingValidation = deferred<unknown>();

void mock.module('ajv/dist/2020.js', () => ({
  default: class MockAjv2020 {
    compile() {
      return (value: unknown) => pendingValidation.promise.then(() => value);
    }
  },
}));

const { cleanup, fireEvent, render, screen } = await import('@testing-library/svelte');
const { default: SchemaForm } = await import('./schema-form.svelte');

async function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function formFrom(container: HTMLElement): HTMLFormElement {
  const form = container.querySelector('form');
  expect(form).toBeInstanceOf(HTMLFormElement);
  if (!(form instanceof HTMLFormElement)) throw new TypeError('Expected SchemaForm form.');
  return form;
}

describe('SchemaForm async JSON Schema validation fixture', () => {
  afterEach(() => {
    cleanup();
    pendingValidation = deferred<unknown>();
  });

  test('awaits async submit validation and freezes edits until it resolves', async () => {
    const submitted: unknown[] = [];
    const { container } = render(SchemaForm, {
      props: {
        schema: {
          $async: true,
          type: 'object',
          properties: { name: { type: 'string', title: 'Name' } },
          required: ['name'],
        },
        value: { name: 'Ada' },
        onsubmit: (value: unknown) => {
          submitted.push(value);
        },
      },
    });
    await flush();

    const input = screen.getByLabelText(/Name/);
    const form = formFrom(container);
    const event = new Event('submit', { bubbles: true, cancelable: true });
    form.dispatchEvent(event);
    await tick();

    const submittingButton = screen.getByRole('button', { name: 'Validating...' });
    try {
      expect(submittingButton).toBeInstanceOf(HTMLButtonElement);
      expect(input).toBeInstanceOf(HTMLInputElement);
      if (!(submittingButton instanceof HTMLButtonElement)) {
        throw new TypeError('Expected SchemaForm submit button.');
      }
      if (!(input instanceof HTMLInputElement)) throw new TypeError('Expected SchemaForm input.');

      expect(event.defaultPrevented).toBe(true);
      expect(submittingButton.disabled).toBe(true);
      expect(input.disabled).toBe(true);

      await fireEvent.input(input, { target: { value: 'Grace' } });
    } finally {
      pendingValidation.resolve({});
      await flush();
      await flush();
    }

    expect(submitted).toEqual([{ name: 'Ada' }]);
    const readyButton = screen.getByRole('button', { name: 'Submit' });
    expect(readyButton).toBeInstanceOf(HTMLButtonElement);
    if (!(readyButton instanceof HTMLButtonElement)) {
      throw new TypeError('Expected SchemaForm ready submit button.');
    }
    expect(readyButton.disabled).toBe(false);
  });
});
