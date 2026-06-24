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
    const countInput = screen.getByRole('spinbutton', { name: /Count/ });
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

    const input = screen.getByRole('spinbutton', { name: /Count/ });
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
      const error = screen.getByText(/Name is too short|Name is required/i);

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
    const ratioInput = screen.getByRole('spinbutton', { name: /Ratio/ });
    await fireEvent.input(ratioInput, { target: { value: '2.5' } });
    await fireEvent.blur(ratioInput);
    const countField = screen.getByRole('spinbutton', { name: /Count/ });
    await fireEvent.input(countField, { target: { value: '4' } });
    await fireEvent.blur(countField);
    const activeCheckbox = screen.getByRole('checkbox', { name: /Active/ });
    // boolean schema fields render as a native Checkbox and toggle on click.
    // A required boolean property is presence-required (enforced by the schema
    // validator), NOT "must be checked" — so the checkbox carries no native
    // `required` constraint that would block a valid `false`.
    expect((activeCheckbox as HTMLInputElement).required).toBe(false);
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

describe('SchemaForm — composed-control regressions', () => {
  afterEach(() => cleanup());

  // Codex committee finding: prove the function bindings do NOT revert on writeback
  // the way the enum Select did (which is why Select is one-way value+onchange).
  test('string/number/json edits commit and do not revert after input/blur', async () => {
    const submitted: unknown[] = [];
    const { container } = render(SchemaForm, {
      props: {
        schema: {
          type: 'object',
          properties: {
            name: { type: 'string', title: 'Name' },
            count: { type: 'integer', title: 'Count' },
            // No `type` → classified as a raw-JSON field (renders a Textarea).
            raw: { title: 'Raw' },
          },
          required: ['name', 'count', 'raw'],
        },
        onsubmit: (value: unknown) => {
          submitted.push(value);
        },
      },
    });
    await flush();

    const nameInput = screen.getByLabelText(/Name/);
    await fireEvent.input(nameInput, { target: { value: 'Ada' } });
    expect((nameInput as HTMLInputElement).value).toBe('Ada'); // does not revert

    const countInput = screen.getByRole('spinbutton', { name: /Count/ });
    await fireEvent.input(countInput, { target: { value: '7' } });
    await fireEvent.blur(countInput);
    expect((countInput as HTMLInputElement).value).toBe('7'); // does not revert after blur commit

    const rawTextarea = container.querySelector('textarea') as HTMLTextAreaElement;
    await fireEvent.input(rawTextarea, { target: { value: '{"ok":true}' } });
    expect(rawTextarea.value).toBe('{"ok":true}'); // draft does not revert

    await submit(formFrom(container));
    expect(submitted).toEqual([{ name: 'Ada', count: 7, raw: { ok: true } }]);
  });

  // Codex committee finding: an integer field must never yield a non-integer.
  // NumberInput is rendered with step={1} for integer fields, so it snaps a
  // typed `2.5` to the nearest integer on blur — the form never holds 2.5.
  test('integer field coerces a non-integer entry to an integer (step=1 snap)', async () => {
    const submitted: unknown[] = [];
    const { container } = render(SchemaForm, {
      props: {
        schema: {
          type: 'object',
          properties: { count: { type: 'integer', title: 'Count' } },
          required: ['count'],
        },
        onsubmit: (value: unknown) => {
          submitted.push(value);
        },
      },
    });
    await flush();

    const countInput = screen.getByRole('spinbutton', { name: /Count/ });
    await fireEvent.input(countInput, { target: { value: '2.5' } });
    await fireEvent.blur(countInput);
    expect((countInput as HTMLInputElement).value).toBe('3'); // snapped to an integer
    await submit(formFrom(container));

    expect(submitted).toHaveLength(1);
    expect(Number.isInteger((submitted[0] as { count: number }).count)).toBe(true);
  });

  // Codex committee finding: a required boolean property means "present", not
  // "must be checked". The Checkbox must NOT carry native `required`, so an
  // unchecked (false) value still submits.
  test('required boolean field submits false (no native checkbox required constraint)', async () => {
    const submitted: unknown[] = [];
    const { container } = render(SchemaForm, {
      props: {
        schema: {
          type: 'object',
          properties: { enabled: { type: 'boolean', title: 'Enabled' } },
          required: ['enabled'],
        },
        value: { enabled: false },
        onsubmit: (value: unknown) => {
          submitted.push(value);
        },
      },
    });
    await flush();

    const checkbox = screen.getByRole('checkbox', { name: /Enabled/ });
    expect((checkbox as HTMLInputElement).required).toBe(false); // not constrained
    await submit(formFrom(container));
    expect(submitted).toEqual([{ enabled: false }]);
  });
});

describe('SchemaForm — schema-change resets form state; value is seed-only', () => {
  afterEach(() => cleanup());

  test('changing schema resets formValue, errors, and rendered fields', async () => {
    // Regression: {#key schema} in the OLD code only reconciled the DOM — it did
    // NOT reset the $state variables (formValue, errors, rawDrafts, arrayKeys)
    // because they lived in the component script scope, which persists across
    // key-block remounts. The fix extracts those into a child component so the
    // key-block genuinely recreates $state.

    const schema1 = {
      type: 'object',
      properties: { name: { type: 'string', title: 'Name' } },
      required: ['name'],
    };
    const schema2 = {
      type: 'object',
      properties: {
        email: { type: 'string', title: 'Email' },
        age: { type: 'integer', title: 'Age' },
      },
      required: ['email'],
    };

    const { rerender, container } = render(SchemaForm, {
      props: {
        schema: schema1 as never,
        value: { name: 'Ada' },
      },
    });
    await flush();

    // Scope queries to THIS render's container, not the global `screen`
    // (which searches all of document.body and can see prior leaked renders).
    const view = within(container);

    // Schema 1 renders a Name field seeded with 'Ada'.
    const nameField = view.getByLabelText(/Name/);
    expect(nameField).toBeInstanceOf(HTMLInputElement);
    const nameInput = nameField as HTMLInputElement;
    expect(nameInput.value).toBe('Ada');

    // Simulate user editing.
    await fireEvent.input(nameInput, { target: { value: 'Grace' } });
    expect(nameInput.value).toBe('Grace');

    // Switch to schema2. The form should reset: Name field gone, Email + Age appear,
    // and form state (formValue, errors) reset to the new schema's initial state.
    await rerender({ schema: schema2 as never });
    await flush();

    // Old field is gone. SchemaForm labels fields via <label for>, so query by
    // the accessible label (queryByLabelText returns null when absent) rather
    // than an aria-label selector that would never match regardless.
    expect(view.queryByLabelText(/Name/)).toBeNull();

    // New fields appear.
    const emailField = view.getByLabelText(/Email/);
    const ageInput = view.getByRole('spinbutton', { name: /Age/ });
    expect(emailField).toBeInstanceOf(HTMLInputElement);
    expect(ageInput).toBeTruthy();
    const emailInput = emailField as HTMLInputElement;

    // formValue reset: new fields start empty (or schema-seeded), not carrying
    // stale values from schema1.
    expect(emailInput.value).toBe('');
  });

  test('changing value with same schema does NOT reset form state (seed-only contract)', async () => {
    // The value prop is a seed: the consumer owns form state after mount.
    // Changing value externally must NOT reset in-progress user edits — that
    // would silently discard work-in-progress, which is worse than a stale binding.

    const schema = {
      type: 'object',
      properties: { name: { type: 'string', title: 'Name' } },
      required: ['name'],
    };

    const { rerender } = render(SchemaForm, {
      props: {
        schema: schema as never,
        value: { name: 'Initial' },
      },
    });
    await flush();

    const nameField = screen.getByLabelText(/Name/);
    expect(nameField).toBeInstanceOf(HTMLInputElement);
    const nameInput = nameField as HTMLInputElement;
    expect(nameInput.value).toBe('Initial');

    // User edits the field.
    await fireEvent.input(nameInput, { target: { value: 'User edit' } });
    expect(nameInput.value).toBe('User edit');

    // Consumer changes the value prop externally (same schema) — e.g. the parent
    // refetches data. The form should NOT reset to the new value because the user
    // has in-progress edits.
    await rerender({ schema: schema as never, value: { name: 'Server update' } });
    await flush();

    // User edit is preserved — value prop change did not reset formValue.
    expect(nameInput.value).toBe('User edit');
  });
});

describe('SchemaForm — initialization without write-back $effect', () => {
  afterEach(() => cleanup());

  test('initial value populates the form without triggering onsubmit via $effect', async () => {
    // Regression: the old code ran a $effect on schema change that set formValue,
    // errors, rawDrafts, and arrayKeys, which could cause reactive-loop risk.
    // The replacement computes initial state once at script time and uses {#key schema}
    // for schema changes, so no $effect write-back occurs.
    const submitted: unknown[] = [];
    const { container } = render(SchemaForm, {
      props: {
        schema: {
          type: 'object',
          properties: { label: { type: 'string', title: 'Label' } },
          required: ['label'],
        },
        value: { label: 'hello' },
        onsubmit: (value: unknown) => {
          submitted.push(value);
        },
      },
    });
    await flush();

    // The initial value is present in the form — initialization worked.
    const labelInput = screen.getByRole('textbox', { name: /Label/ });
    expect(labelInput).toBeInstanceOf(HTMLInputElement);
    expect((labelInput as HTMLInputElement).value).toBe('hello');
    // onsubmit was NOT called during initialization.
    expect(submitted).toHaveLength(0);

    // Submitting yields the initialized value.
    await submit(formFrom(container));
    expect(submitted).toEqual([{ label: 'hello' }]);
  });

  test('schema-form source does not use a broad $effect to reinitialize formValue on schema change', async () => {
    // Regression: detect if the removed initialization $effect is re-introduced.
    const { resolve } = await import('node:path');
    const source = await Bun.file(resolve(import.meta.dir, 'schema-form.svelte')).text();

    // The old pattern initialized by writing to formValue, rawDrafts, and
    // arrayKeys inside a single $effect that tracked schema (via model.field).
    // Ensure none of the removed write-back assignments appear in an $effect context.
    // Specifically: the old $effect body set all four state vars unconditionally.
    // We test for the removal of the combined write-back pattern.
    expect(source).not.toContain('formValue = nextValue');
    expect(source).not.toContain('rawDrafts = seedRawDrafts(model.field, nextValue)');
    expect(source).not.toContain('arrayKeys = seedArrayKeys(model.field, nextValue)');

    // The replacement: {#key schema} should be present in the template to handle remount.
    expect(source).toContain('{#key schema}');
  });
});
