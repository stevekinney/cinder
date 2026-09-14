/// <reference lib="dom" />
import { afterEach, describe, expect, spyOn, test } from 'bun:test';
import { tick } from 'svelte';

import Ajv2020 from 'ajv/dist/2020.js';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { cleanup, fireEvent, render, screen } = await import('@testing-library/svelte');
const { default: SchemaForm } = await import('./schema-form.svelte');
const { validateSchemaValue } = await import('./schema-form-validation.ts');

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

async function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function formFrom(container: HTMLElement): HTMLFormElement {
  const form = container.querySelector('form');
  expect(form).toBeInstanceOf(HTMLFormElement);
  if (!(form instanceof HTMLFormElement)) throw new TypeError('Expected SchemaForm form.');
  return form;
}

describe('SchemaForm async JSON Schema validation', () => {
  afterEach(() => cleanup());

  test('awaits async submit validation and freezes edits until it resolves', async () => {
    const pendingValidation = deferred<unknown>();
    const validationStarted = deferred<void>();
    const schema = {
      $id: 'schema-form-async-submit-validation',
      $async: true,
      type: 'object',
      properties: { name: { type: 'string', title: 'Name' } },
      required: ['name'],
    };
    const validator = new Ajv2020().compile(schema);
    const delayedValidator = new Proxy(validator, {
      apply(target, thisArgument, argumentsList) {
        validationStarted.resolve();
        return pendingValidation.promise.then(() =>
          Reflect.apply(target, thisArgument, argumentsList),
        );
      },
    });
    const compileSpy = spyOn(Ajv2020.prototype, 'compile').mockReturnValue(delayedValidator);
    const submitted: unknown[] = [];

    try {
      const { container } = render(SchemaForm, {
        props: {
          schema,
          value: { name: 'Ada' },
          onSubmit: (value: unknown) => {
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
      await validationStarted.promise;

      const submittingButton = screen.getByRole('button', { name: 'Validating...' });
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
      expect(submitted).toEqual([]);
    } finally {
      pendingValidation.resolve({});
      const compileCallCount = compileSpy.mock.calls.length;
      compileSpy.mockRestore();
      expect(compileCallCount).toBe(1);
      await flush();
      await flush();
    }

    await expect(
      validateSchemaValue(
        {
          $id: 'schema-form-async-real-validation',
          type: 'object',
          properties: { name: { type: 'string' } },
          required: ['name'],
        },
        { name: 123 },
      ),
    ).resolves.toMatchObject({ valid: false });

    expect(submitted).toEqual([{ name: 'Ada' }]);
    const readyButton = screen.getByRole('button', { name: 'Submit' });
    expect(readyButton).toBeInstanceOf(HTMLButtonElement);
    if (!(readyButton instanceof HTMLButtonElement)) {
      throw new TypeError('Expected SchemaForm ready submit button.');
    }
    expect(readyButton.disabled).toBe(false);
  });
});
