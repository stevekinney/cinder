/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';
import { z } from 'zod';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { cleanup, fireEvent, render, screen, within } = await import('@testing-library/svelte');
const { default: SchemaForm } = await import('./schema-form.svelte');
const { readSchemaFormData } = await import('./schema-form-validation.ts');

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

async function submit(form: HTMLFormElement): Promise<SubmitEvent> {
  const event = new Event('submit', { bubbles: true, cancelable: true }) as SubmitEvent;
  form.dispatchEvent(event);
  await flush();
  await flush();
  return event;
}

function formFrom(container: HTMLElement): HTMLFormElement {
  const form = container.querySelector('form');
  expect(form).toBeInstanceOf(HTMLFormElement);
  return form as HTMLFormElement;
}

describe('SchemaForm', () => {
  afterEach(() => cleanup());

  test('renders Zod Standard Schema fields and submits the Standard Schema validated output once', async () => {
    const schema = z.object({
      name: z.string().min(1),
      count: z.number().int().positive(),
    });
    const submitted: unknown[] = [];

    const { container } = render(SchemaForm, {
      props: {
        schema,
        onsubmit: (value: unknown) => {
          submitted.push(value);
        },
      },
    });
    await flush();

    await fireEvent.input(screen.getByLabelText(/Name/), { target: { value: 'Ada' } });
    // NumberInput commits its parsed value on blur (it buffers while editing).
    const countInput = screen.getByRole('textbox', { name: /Count/ });
    await fireEvent.input(countInput, { target: { value: '3' } });
    await fireEvent.blur(countInput);

    const form = formFrom(container);
    await submit(form);

    const expected = await schema['~standard'].validate({ name: 'Ada', count: 3 });
    expect(submitted).toHaveLength(1);
    expect(submitted[0]).toEqual('value' in expected ? expected.value : undefined);
  });

  test('submits JSON Schema values and exposes the same object through FormData', async () => {
    const schema = {
      type: 'object',
      properties: {
        name: { type: 'string', minLength: 1 },
        count: { type: 'integer', minimum: 1 },
      },
      required: ['name', 'count'],
    };
    let viaCallback: unknown;

    const { container } = render(SchemaForm, {
      props: {
        schema,
        name: 'payload',
        value: { name: 'Ada', count: 2 },
        onsubmit: (value: unknown) => {
          viaCallback = value;
        },
      },
    });
    await flush();

    const form = formFrom(container);
    await submit(form);
    const hiddenInput = form.querySelector('input[type="hidden"][name="payload"]');
    expect(hiddenInput).toBeInstanceOf(HTMLInputElement);

    // happy-dom does not collect controls through `new FormData(form)`, so assert
    // the exact form-associated control properties that browsers serialize.
    const payloadInput = hiddenInput as HTMLInputElement;
    const formData = new FormData();
    formData.set(payloadInput.name, payloadInput.value);
    const viaNativeSubmit = readSchemaFormData(formData, 'payload');

    expect(viaCallback).toEqual({ name: 'Ada', count: 2 });
    expect(payloadInput.form).toBe(form);
    expect(viaCallback).toEqual(viaNativeSubmit);
  });

  test('renders an empty numeric input value for missing or non-number values', async () => {
    render(SchemaForm, {
      props: {
        schema: {
          type: 'object',
          properties: { count: { type: 'number', title: 'Count' } },
        },
        value: { count: 'not a number' },
      },
    });
    await flush();

    const input = screen.getByRole('textbox', { name: /Count/ });
    expect(input).toBeInstanceOf(HTMLInputElement);
    expect((input as HTMLInputElement).value).toBe('');
  });

  test('resumes native submit without forwarding non-submit submitters', async () => {
    const { container } = render(SchemaForm, {
      props: {
        schema: {
          type: 'object',
          properties: { name: { type: 'string' } },
          required: ['name'],
        },
        value: { name: 'Ada' },
        action: '/submit',
      },
    });
    await flush();

    const form = formFrom(container);
    const requestSubmitCalls: unknown[] = [];
    form.requestSubmit = ((submitter?: HTMLElement | null) => {
      requestSubmitCalls.push(submitter);
    }) as typeof form.requestSubmit;
    const invalidSubmitter = document.createElement('div');
    const event = new Event('submit', { bubbles: true, cancelable: true }) as SubmitEvent;
    Object.defineProperty(event, 'submitter', { value: invalidSubmitter });

    form.dispatchEvent(event);
    await flush();
    await flush();

    expect(event.defaultPrevented).toBe(true);
    expect(requestSubmitCalls).toEqual([undefined]);
  });

  test('blocks submit when validated Standard Schema output cannot be serialized', async () => {
    const schema = {
      '~standard': {
        version: 1,
        vendor: 'test',
        validate: () => ({ value: { count: Number.NaN } }),
      },
    } as const;
    const submitted: unknown[] = [];

    const { container } = render(SchemaForm, {
      props: {
        schema,
        value: { count: 1 },
        onsubmit: (value: unknown) => {
          submitted.push(value);
        },
      },
    });
    await flush();

    const form = formFrom(container);
    const event = await submit(form);
    const rawInput = form.querySelector('textarea');
    const error = screen.getByText(/non-finite number/i);
    const hiddenInput = form.querySelector('input[type="hidden"][name="value"]');

    expect(event.defaultPrevented).toBe(true);
    expect(submitted).toHaveLength(0);
    expect(rawInput).toBeInstanceOf(HTMLTextAreaElement);
    const rawTextarea = rawInput as HTMLTextAreaElement;
    expect(rawTextarea.getAttribute('aria-invalid')).toBe('true');
    expect(rawTextarea.getAttribute('aria-describedby')).toContain(error.id);
    expect(hiddenInput).toBeInstanceOf(HTMLInputElement);
    expect((hiddenInput as HTMLInputElement).value).toBe('');
  });

  test('renders form-level serialization errors for object schemas', async () => {
    const schema = {
      '~standard': {
        version: 1,
        vendor: 'test',
        jsonSchema: {
          input: () => ({
            type: 'object',
            properties: { count: { type: 'number', title: 'Count' } },
          }),
        },
        validate: () => ({ value: { count: Number.NaN } }),
      },
    } as const;
    const submitted: unknown[] = [];

    const { container } = render(SchemaForm, {
      props: {
        schema,
        value: { count: 1 },
        onsubmit: (value: unknown) => {
          submitted.push(value);
        },
      },
    });
    await flush();

    const event = await submit(formFrom(container));
    const error = screen.getByText(/non-finite number/i);

    expect(event.defaultPrevented).toBe(true);
    expect(submitted).toHaveLength(0);
    expect(error.id).toMatch(/-value-error$/);
    expect(error.getAttribute('tabindex')).toBe('-1');
    expect(document.activeElement).toBe(error);
  });

  test('submits edited raw JSON drafts for every array row', async () => {
    const schema = {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          title: 'Items',
          items: {
            title: 'Payload',
            oneOf: [{ type: 'string' }, { type: 'object' }],
          },
        },
      },
    };
    let submitted: unknown;

    const { container } = render(SchemaForm, {
      props: {
        schema,
        value: { items: [{ ok: 1 }, { ok: 2 }] },
        onsubmit: (value: unknown) => {
          submitted = value;
        },
      },
    });
    await flush();

    const rawInputs = within(container).getAllByRole('textbox');
    expect(rawInputs).toHaveLength(2);
    await fireEvent.input(rawInputs[1]!, { target: { value: '{"ok":42}' } });
    await submit(formFrom(container));

    expect(submitted).toEqual({ items: [{ ok: 1 }, { ok: 42 }] });
  });

  test('reindexes raw JSON drafts when removing array rows', async () => {
    const schema = {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          title: 'Items',
          items: {
            title: 'Payload',
            oneOf: [{ type: 'string' }, { type: 'object' }],
          },
        },
      },
    };
    let submitted: unknown;

    const { container } = render(SchemaForm, {
      props: {
        schema,
        value: { items: [{ ok: 1 }, { ok: 2 }] },
        onsubmit: (value: unknown) => {
          submitted = value;
        },
      },
    });
    await flush();

    const rawInputs = within(container).getAllByRole('textbox');
    expect(rawInputs).toHaveLength(2);
    await fireEvent.input(rawInputs[1]!, { target: { value: '{"ok":99}' } });
    await fireEvent.click(within(container).getByRole('button', { name: 'Remove Items item 1' }));
    await submit(formFrom(container));

    expect(submitted).toEqual({ items: [{ ok: 99 }] });
  });

  test('blocks invalid submit, renders associated field errors, and focuses the first invalid field', async () => {
    const onsubmitCalls: unknown[] = [];
    const disabledStatesAtFocus: boolean[] = [];
    const originalFocus = HTMLInputElement.prototype.focus;
    HTMLInputElement.prototype.focus = function focusWithDisabledStateCapture(
      this: HTMLInputElement,
      options?: FocusOptions,
    ) {
      disabledStatesAtFocus.push(this.disabled);
      return originalFocus.call(this, options);
    };
    const { container } = render(SchemaForm, {
      props: {
        schema: {
          type: 'object',
          properties: { name: { type: 'string', title: 'Name', minLength: 1 } },
          required: ['name'],
        },
        value: { name: '' },
        onsubmit: (value: unknown) => {
          onsubmitCalls.push(value);
        },
      },
    });
    await flush();

    try {
      const form = formFrom(container);
      const event = await submit(form);
      const input = screen.getByLabelText(/Name/);
      const error = screen.getByText(/fewer than 1 characters|required/i);

      expect(event.defaultPrevented).toBe(true);
      expect(onsubmitCalls).toHaveLength(0);
      expect(input.getAttribute('aria-invalid')).toBe('true');
      expect(input.getAttribute('aria-describedby')).toContain(error.id);
      expect(disabledStatesAtFocus).toEqual([false]);
      expect(document.activeElement).toBe(input);
    } finally {
      HTMLInputElement.prototype.focus = originalFocus;
    }
  });

  test('renders and submits string, number, integer, boolean, enum, array, nested object, and raw JSON fields', async () => {
    let submitted: unknown;
    const { container } = render(SchemaForm, {
      props: {
        schema: {
          type: 'object',
          properties: {
            name: { type: 'string', title: 'Name' },
            ratio: { type: 'number', title: 'Ratio' },
            count: { type: 'integer', title: 'Count' },
            active: { type: 'boolean', title: 'Active' },
            mode: { type: 'string', title: 'Mode', enum: ['fast', 'safe'] },
            tags: { type: 'array', title: 'Tags', items: { type: 'string', title: 'Tag' } },
            nested: {
              type: 'object',
              title: 'Nested',
              properties: { owner: { type: 'string', title: 'Owner' } },
              required: ['owner'],
            },
            raw: { title: 'Raw payload' },
          },
          required: ['name', 'ratio', 'count', 'active', 'mode', 'tags', 'nested', 'raw'],
        },
        value: {
          name: 'Initial',
          ratio: 1.5,
          count: 1,
          active: false,
          mode: 'fast',
          tags: ['one'],
          nested: { owner: 'Ada' },
          raw: { ok: false },
        },
        onsubmit: (value: unknown) => {
          submitted = value;
        },
      },
    });
    await flush();

    await fireEvent.input(screen.getByLabelText(/Name/), { target: { value: 'Updated' } });
    // NumberInput commits the parsed value on blur, so commit each before submit.
    const ratioInput = screen.getByRole('textbox', { name: /Ratio/ });
    await fireEvent.input(ratioInput, { target: { value: '2.5' } });
    await fireEvent.blur(ratioInput);
    const countField = screen.getByRole('textbox', { name: /Count/ });
    await fireEvent.input(countField, { target: { value: '4' } });
    await fireEvent.blur(countField);
    const activeCheckbox = screen.getByRole('checkbox', { name: /Active/ });
    // boolean schema fields render as a native Checkbox: `required` is the
    // native attribute and the control toggles on click.
    expect((activeCheckbox as HTMLInputElement).required).toBe(true);
    await fireEvent.click(activeCheckbox);
    await fireEvent.change(screen.getByLabelText(/Mode/), { target: { value: '"safe"' } });

    await fireEvent.click(screen.getByRole('button', { name: /Add Tags/ }));
    expect(screen.getByRole('button', { name: 'Remove Tags item 1' })).toBeTruthy();
    const tagInputs = screen.getAllByRole('textbox', { name: /Tag/ });
    expect(tagInputs).toHaveLength(2);
    await fireEvent.input(tagInputs[1]!, { target: { value: 'two' } });
    expect(screen.getByRole('button', { name: 'Remove Tags item 2' })).toBeTruthy();

    await fireEvent.input(screen.getByLabelText(/Owner/), { target: { value: 'Grace' } });
    await fireEvent.input(screen.getByLabelText(/Raw payload/), {
      target: { value: '{"ok":true,"level":2}' },
    });

    await submit(formFrom(container));

    expect(submitted).toEqual({
      name: 'Updated',
      ratio: 2.5,
      count: 4,
      active: true,
      mode: 'safe',
      tags: ['one', 'two'],
      nested: { owner: 'Grace' },
      raw: { ok: true, level: 2 },
    });
  });

  test('blocks invalid raw JSON fallback drafts before schema validation', async () => {
    const calls: unknown[] = [];
    const { container } = render(SchemaForm, {
      props: {
        schema: {
          type: 'object',
          properties: { raw: { title: 'Raw payload' } },
          required: ['raw'],
        },
        value: { raw: { ok: true } },
        onsubmit: (value: unknown) => {
          calls.push(value);
        },
      },
    });
    await flush();

    await fireEvent.input(screen.getByLabelText(/Raw payload/), { target: { value: '{' } });
    await submit(formFrom(container));

    expect(calls).toHaveLength(0);
    expect(screen.getByLabelText(/Raw payload/).getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText(/JSON|Expected|position/i)).toBeTruthy();
  });

  test('awaits async Standard Schema validation before calling onsubmit', async () => {
    let releaseValidation!: () => void;
    const validationGate = new Promise<void>((resolve) => {
      releaseValidation = resolve;
    });
    const submitted: unknown[] = [];
    const schema = {
      '~standard': {
        version: 1,
        vendor: 'async-test',
        jsonSchema: {
          input: () => ({
            type: 'object',
            properties: { name: { type: 'string', title: 'Name' } },
            required: ['name'],
          }),
          output: () => ({}),
        },
        async validate(value: unknown) {
          await validationGate;
          return { value };
        },
      },
    } as const;

    const { container } = render(SchemaForm, {
      props: {
        schema,
        value: { name: 'Ada' },
        onsubmit: (value: unknown) => {
          submitted.push(value);
        },
      },
    });
    await flush();

    const submitPromise = submit(formFrom(container));
    await flush();
    expect(submitted).toHaveLength(0);

    releaseValidation();
    await submitPromise;

    expect(submitted).toEqual([{ name: 'Ada' }]);
  });

  test('blocks submit when async Standard Schema validation returns issues', async () => {
    let releaseValidation!: () => void;
    const validationGate = new Promise<void>((resolve) => {
      releaseValidation = resolve;
    });
    const submitted: unknown[] = [];
    const schema = {
      '~standard': {
        version: 1,
        vendor: 'async-invalid-test',
        jsonSchema: {
          input: () => ({
            type: 'object',
            properties: { name: { type: 'string', title: 'Name' } },
            required: ['name'],
          }),
          output: () => ({}),
        },
        async validate() {
          await validationGate;
          return {
            issues: [{ path: ['name'], message: 'Name is unavailable.' }],
          };
        },
      },
    } as const;

    const { container } = render(SchemaForm, {
      props: {
        schema,
        value: { name: 'Ada' },
        onsubmit: (value: unknown) => {
          submitted.push(value);
        },
      },
    });
    await flush();

    const submitPromise = submit(formFrom(container));
    await flush();
    expect(screen.getByLabelText(/Name/)).toHaveProperty('disabled', true);

    releaseValidation();
    await submitPromise;
    await flush();

    expect(submitted).toEqual([]);
    expect(screen.getByLabelText(/Name/).getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText('Name is unavailable.')).toBeTruthy();
  });

  test('keeps controls frozen when a new submit starts during invalid-submit focus', async () => {
    let releaseFirstValidation!: () => void;
    let releaseSecondValidation!: () => void;
    const firstValidationGate = new Promise<void>((resolve) => {
      releaseFirstValidation = resolve;
    });
    const secondValidationGate = new Promise<void>((resolve) => {
      releaseSecondValidation = resolve;
    });
    const submitted: unknown[] = [];
    let validationCalls = 0;
    const schema = {
      '~standard': {
        version: 1,
        vendor: 'async-overlap-test',
        jsonSchema: {
          input: () => ({
            type: 'object',
            properties: { name: { type: 'string', title: 'Name' } },
            required: ['name'],
          }),
          output: () => ({}),
        },
        async validate(value: unknown) {
          validationCalls += 1;
          if (validationCalls === 1) {
            await firstValidationGate;
            return {
              issues: [{ path: ['name'], message: 'First invalid.' }],
            };
          }

          await secondValidationGate;
          return { value };
        },
      },
    } as const;

    const { container } = render(SchemaForm, {
      props: {
        schema,
        value: { name: 'Ada' },
        onsubmit: (value: unknown) => {
          submitted.push(value);
        },
      },
    });
    await flush();

    const form = formFrom(container);
    const input = screen.getByLabelText(/Name/);
    const originalFocus = HTMLInputElement.prototype.focus;
    let secondSubmitDispatched = false;
    HTMLInputElement.prototype.focus = function dispatchSecondSubmitDuringFocus(
      this: HTMLInputElement,
      options?: FocusOptions,
    ) {
      if (!secondSubmitDispatched) {
        secondSubmitDispatched = true;
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      }
      return originalFocus.call(this, options);
    };

    try {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await flush();
      expect(input).toHaveProperty('disabled', true);

      releaseFirstValidation();
      await flush();
      await flush();

      expect(secondSubmitDispatched).toBe(true);
      expect(validationCalls).toBe(2);
      expect(input).toHaveProperty('disabled', true);
      expect(screen.getByRole('button', { name: /Validating/ })).toHaveProperty('disabled', true);

      releaseSecondValidation();
      await flush();
      await flush();

      expect(submitted).toEqual([{ name: 'Ada' }]);
      expect(input).toHaveProperty('disabled', false);
    } finally {
      HTMLInputElement.prototype.focus = originalFocus;
    }
  });

  test('freezes controls during async validation so late edits cannot change the submitted payload', async () => {
    let releaseValidation!: () => void;
    const validationGate = new Promise<void>((resolve) => {
      releaseValidation = resolve;
    });
    const submitted: unknown[] = [];
    const schema = {
      '~standard': {
        version: 1,
        vendor: 'async-freeze-test',
        jsonSchema: {
          input: () => ({
            type: 'object',
            properties: { name: { type: 'string', title: 'Name' } },
            required: ['name'],
          }),
          output: () => ({}),
        },
        async validate(value: unknown) {
          await validationGate;
          return { value };
        },
      },
    } as const;

    const { container } = render(SchemaForm, {
      props: {
        schema,
        value: { name: 'Ada' },
        onsubmit: (value: unknown) => {
          submitted.push(value);
        },
      },
    });
    await flush();

    const submitPromise = submit(formFrom(container));
    await flush();

    const input = screen.getByLabelText(/Name/);
    expect(input).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: /Validating/ })).toHaveProperty('disabled', true);

    await fireEvent.input(input, { target: { value: 'Grace' } });
    releaseValidation();
    await submitPromise;
    await flush();

    expect(submitted).toEqual([{ name: 'Ada' }]);
    expect(input).toHaveProperty('value', 'Ada');
    expect(input).toHaveProperty('disabled', false);
  });

  test('removes array items without leaking removed values into the submitted payload', async () => {
    let submitted: unknown;
    const { container } = render(SchemaForm, {
      props: {
        schema: {
          type: 'object',
          properties: {
            tags: { type: 'array', title: 'Tags', items: { type: 'string', title: 'Tag' } },
          },
          required: ['tags'],
        },
        value: { tags: ['one', 'two'] },
        onsubmit: (value: unknown) => {
          submitted = value;
        },
      },
    });
    await flush();

    await fireEvent.click(within(container).getByRole('button', { name: 'Remove Tags item 1' }));
    await submit(formFrom(container));

    expect(submitted).toEqual({ tags: ['two'] });
  });
});
