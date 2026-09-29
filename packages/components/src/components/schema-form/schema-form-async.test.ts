/// <reference lib="dom" />
import { afterEach, describe, expect, mock, test } from 'bun:test';
import { tick } from 'svelte';

import { setupHappyDom } from '@lostgradient/testing';

setupHappyDom();

// The real interpreter module: captured before `mock.module` replaces it,
// so the mock factory below can delegate to genuine compilation/validation
// and only add an artificial delay — the same "spy on the thing that does
// the actual compiling" approach the Ajv-backed version of this test used
// (there, spying on `Ajv2020.prototype.compile`). SchemaForm compiles a
// schema lazily on first validation (see schema-form-validation.ts's
// `validatorForSchema` cache), so delaying `compileInterpreted`'s
// resolution delays the *first* submit's validation — exactly the moment
// this test needs to observe "Validating..." before it resolves.
const realInterpreter = await import('../../utilities/json-schema-interpreter.ts');
// `mock.module` rebinds the module's live exports, including on this
// already-imported namespace object — calling `realInterpreter.
// compileInterpreted` from inside the mock factory below would recurse
// into the mock itself. Capturing the function reference in a plain local
// first sidesteps that: this variable, unlike the namespace property,
// isn't rebound.
const originalCompileInterpreted = realInterpreter.compileInterpreted;

const pendingValidation = Promise.withResolvers<void>();
const validationStarted = Promise.withResolvers<void>();
let compileCallCount = 0;

mock.module('../../utilities/json-schema-interpreter.ts', () => ({
  ...realInterpreter,
  compileInterpreted: async (
    ...args: Parameters<typeof realInterpreter.compileInterpreted>
  ): ReturnType<typeof realInterpreter.compileInterpreted> => {
    compileCallCount += 1;
    validationStarted.resolve();
    await pendingValidation.promise;
    return originalCompileInterpreted(...args);
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

describe('SchemaForm async JSON Schema validation', () => {
  afterEach(() => cleanup());

  test('awaits submit validation and freezes edits until it resolves', async () => {
    const schema = {
      $id: 'schema-form-async-submit-validation',
      type: 'object',
      properties: { name: { type: 'string', title: 'Name' } },
      required: ['name'],
    };
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
      pendingValidation.resolve();
      expect(compileCallCount).toBe(1);
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
