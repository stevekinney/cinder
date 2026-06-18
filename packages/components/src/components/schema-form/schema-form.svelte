<script lang="ts" module>
  /**
   * @cinder
   * @category form
   * @status beta
   * @purpose Schema-driven form that renders accessible controls from JSON Schema or Standard Schema and submits one validated value object.
   * @tag form
   * @tag schema
   * @tag validation
   * @useWhen Capturing a payload whose shape is already described by a workflow, API, or Standard Schema validator.
   * @useWhen You need callback submission and native FormData submission to expose the same validated object.
   * @avoidWhen Authoring or editing a JSON Schema document — use json-schema-editor instead.
   * @avoidWhen You need bespoke multi-step flows or custom cross-field user interface beyond schema validation.
   * @related json-schema-editor, form-field, input, select, toggle
   * @a11yPattern Native HTML form with labelled controls
   * @keyboardShortcut Enter | Submits the form from text-like controls.
   * @a11yNote Invalid submission moves focus to the first invalid field and associates each field error through aria-describedby.
   */
  export type {
    SchemaFormOutput,
    SchemaFormProps,
    SchemaFormSchema,
    SchemaFormStandardSchema,
    SchemaFormSubmitHandler,
  } from './schema-form.types.ts';
</script>

<script lang="ts" generics="Schema extends SchemaFormSchema = SchemaFormSchema">
  import { tick } from 'svelte';

  import { classNames } from '../../utilities/class-names.ts';

  import {
    arrayValueAtPath,
    collectJsonFields,
    createSchemaFormModel,
    decodeEnumValue,
    defaultValueForField,
    getValueAtPath,
    initialValueForField,
    pathId,
    pathKey,
    pruneUndefined,
    rebaseFieldPath,
    setValueAtPath,
    type SchemaFormField,
  } from './schema-form-model.ts';
  import type { SchemaFormProps, SchemaFormSchema } from './schema-form.types.ts';
  import {
    issuesByPath,
    parseJsonDraft,
    serializeValidatedValue,
    validateSchemaValue,
    type SchemaFormValidationIssue,
  } from './schema-form-validation.ts';

  let {
    schema,
    value,
    name = 'value',
    submitLabel = 'Submit',
    class: customClassName,
    onsubmit,
    novalidate,
    ...rest
  }: SchemaFormProps<Schema> = $props();

  const generatedId = $props.id();
  const model = $derived(createSchemaFormModel(schema));
  let formElement = $state<HTMLFormElement>();
  let serializedInputElement = $state<HTMLInputElement>();
  let formValue = $state<unknown>();
  let errors = $state<Record<string, string>>({});
  let rawDrafts = $state<Record<string, string>>({});
  let serializedValue = $state('');
  let submitting = $state(false);
  let allowNativeSubmit = false;
  let arrayKeyCounter = 0;
  let arrayKeys = $state<Record<string, string[]>>({});

  const formId = $derived((rest.id as string | undefined) ?? `${generatedId}-form`);
  const rootFields = $derived(model.field.kind === 'object' ? model.field.fields : [model.field]);

  $effect(() => {
    const nextValue = initialValueForField(model.field, value);
    formValue = nextValue;
    errors = {};
    setSerializedValue('');
    rawDrafts = seedRawDrafts(model.field, nextValue);
    arrayKeys = seedArrayKeys(model.field, nextValue);
  });

  function fieldDomId(field: SchemaFormField): string {
    return `${formId}-${pathId(field.path)}`;
  }

  function fieldError(field: SchemaFormField): string | undefined {
    return errors[pathKey(field.path)];
  }

  function describedBy(field: SchemaFormField): string | undefined {
    const ids: string[] = [];
    if (field.description) ids.push(`${fieldDomId(field)}-description`);
    if (fieldError(field)) ids.push(`${fieldDomId(field)}-error`);
    return ids.length > 0 ? ids.join(' ') : undefined;
  }

  function stringValue(field: SchemaFormField): string {
    const current = getValueAtPath(formValue, field.path);
    return current === undefined || current === null ? '' : String(current);
  }

  function numberValue(field: SchemaFormField): number | undefined {
    const current = getValueAtPath(formValue, field.path);
    return typeof current === 'number' ? current : undefined;
  }

  function booleanValue(field: SchemaFormField): boolean {
    return getValueAtPath(formValue, field.path) === true;
  }

  function enumValue(field: SchemaFormField): string {
    const current = getValueAtPath(formValue, field.path);
    const option = field.options.find((candidate) => Object.is(candidate.value, current));
    return option?.encodedValue ?? field.options[0]?.encodedValue ?? '';
  }

  function rawJsonValue(field: SchemaFormField): string {
    const key = pathKey(field.path);
    if (rawDrafts[key] !== undefined) return rawDrafts[key];
    return JSON.stringify(getValueAtPath(formValue, field.path) ?? null, null, 2);
  }

  function updateValue(path: readonly string[], next: unknown) {
    formValue = setValueAtPath(formValue, path, next);
    const key = pathKey(path);
    if (errors[key]) {
      const { [key]: _removed, ...remaining } = errors;
      errors = remaining;
    }
    setSerializedValue('');
  }

  function setSerializedValue(next: string) {
    serializedValue = next;
    if (serializedInputElement) serializedInputElement.value = next;
  }

  function updateString(field: SchemaFormField, event: Event) {
    updateValue(field.path, (event.currentTarget as HTMLInputElement).value);
  }

  function updateNumber(field: SchemaFormField, event: Event) {
    const raw = (event.currentTarget as HTMLInputElement).value;
    updateValue(field.path, raw === '' ? undefined : Number(raw));
  }

  function updateBoolean(field: SchemaFormField, checked: boolean) {
    updateValue(field.path, checked);
  }

  function updateEnum(field: SchemaFormField, event: Event) {
    updateValue(field.path, decodeEnumValue((event.currentTarget as HTMLSelectElement).value));
  }

  function updateRawJson(field: SchemaFormField, event: Event) {
    const key = pathKey(field.path);
    rawDrafts = { ...rawDrafts, [key]: (event.currentTarget as HTMLTextAreaElement).value };
    setSerializedValue('');
  }

  function toggleSwitch(field: SchemaFormField) {
    updateBoolean(field, !booleanValue(field));
  }

  function handleSwitchKeydown(field: SchemaFormField, event: KeyboardEvent) {
    if (event.key !== ' ' && event.key !== 'Enter') return;
    event.preventDefault();
    toggleSwitch(field);
  }

  function arrayRows(field: SchemaFormField): Array<{ key: string; index: number }> {
    const values = arrayValueAtPath(formValue, field.path);
    const keys = arrayKeys[pathKey(field.path)] ?? [];
    return values.map((_, index) => ({
      key: keys[index] ?? `${pathKey(field.path)}-${index}`,
      index,
    }));
  }

  function addArrayItem(field: SchemaFormField) {
    const values = arrayValueAtPath(formValue, field.path);
    const nextValue = field.item ? defaultValueForField(field.item) : null;
    updateValue(field.path, [...values, nextValue]);
    const key = pathKey(field.path);
    arrayKeys = {
      ...arrayKeys,
      [key]: [...(arrayKeys[key] ?? []), `${key}-${arrayKeyCounter++}`],
    };
  }

  function removeArrayItem(field: SchemaFormField, index: number) {
    const values = arrayValueAtPath(formValue, field.path);
    updateValue(
      field.path,
      values.filter((_, candidateIndex) => candidateIndex !== index),
    );
    const key = pathKey(field.path);
    arrayKeys = {
      ...arrayKeys,
      [key]: (arrayKeys[key] ?? []).filter((_, candidateIndex) => candidateIndex !== index),
    };
  }

  function seedRawDrafts(field: SchemaFormField, currentValue: unknown): Record<string, string> {
    const drafts: Record<string, string> = {};
    for (const jsonField of collectJsonFields(field)) {
      drafts[pathKey(jsonField.path)] = JSON.stringify(
        getValueAtPath(currentValue, jsonField.path) ?? null,
        null,
        2,
      );
    }
    return drafts;
  }

  function seedArrayKeys(field: SchemaFormField, currentValue: unknown): Record<string, string[]> {
    const keys: Record<string, string[]> = {};

    function visit(candidate: SchemaFormField) {
      if (candidate.kind === 'array') {
        const key = pathKey(candidate.path);
        keys[key] = arrayValueAtPath(currentValue, candidate.path).map(
          () => `${key}-${arrayKeyCounter++}`,
        );
      }
      for (const child of candidate.fields) visit(child);
      if (candidate.item) visit(candidate.item);
    }

    visit(field);
    return keys;
  }

  function rawJsonIssues(): { value: unknown; issues: SchemaFormValidationIssue[] } {
    let nextValue = formValue;
    const issues: SchemaFormValidationIssue[] = [];
    for (const field of collectJsonFields(model.field)) {
      const draft = rawDrafts[pathKey(field.path)];
      if (draft === undefined) continue;
      const parsed = parseJsonDraft(field.path, draft);
      if (parsed.ok) {
        nextValue = setValueAtPath(nextValue, field.path, parsed.value);
      } else {
        issues.push(parsed.issue);
      }
    }
    return { value: nextValue, issues };
  }

  async function focusFirstError() {
    await tick();
    formElement
      ?.querySelector<HTMLElement>(
        '[aria-invalid="true"], [data-cinder-invalid="true"], .cinder-schema-form__error',
      )
      ?.focus();
  }

  function shouldResumeNativeSubmit(): boolean {
    return onsubmit === undefined && (rest.action !== undefined || rest.method !== undefined);
  }

  async function handleSubmit(event: SubmitEvent) {
    if (allowNativeSubmit) {
      allowNativeSubmit = false;
      return;
    }

    event.preventDefault();
    if (submitting) return;

    submitting = true;
    try {
      const raw = rawJsonIssues();
      if (raw.issues.length > 0) {
        errors = issuesByPath(raw.issues);
        setSerializedValue('');
        await focusFirstError();
        return;
      }

      const candidate = pruneUndefined(raw.value);
      const result = await validateSchemaValue(schema, candidate);
      if (!result.valid) {
        errors = issuesByPath(result.issues);
        setSerializedValue('');
        await focusFirstError();
        return;
      }

      const serialized = serializeValidatedValue(result.value);
      if (!serialized.ok) {
        errors = issuesByPath([serialized.issue]);
        setSerializedValue('');
        await focusFirstError();
        return;
      }

      formValue = result.value;
      errors = {};
      setSerializedValue(serialized.value);
      await onsubmit?.(result.value as never, event);

      if (shouldResumeNativeSubmit()) {
        allowNativeSubmit = true;
        await tick();
        formElement?.requestSubmit(
          event.submitter instanceof HTMLElement ? event.submitter : undefined,
        );
      }
    } finally {
      submitting = false;
    }
  }
</script>

{#snippet fieldLabel(field: SchemaFormField)}
  <span>{field.label}</span>
  {#if field.required}
    <span class="cinder-schema-form__required" aria-hidden="true">*</span>
  {/if}
{/snippet}

{#snippet fieldMessages(field: SchemaFormField)}
  {#if field.description}
    <p id="{fieldDomId(field)}-description" class="cinder-schema-form__description">
      {field.description}
    </p>
  {/if}
  {#if fieldError(field)}
    <p
      id="{fieldDomId(field)}-error"
      class="cinder-schema-form__error"
      aria-live="polite"
      tabindex="-1"
    >
      {fieldError(field)}
    </p>
  {/if}
{/snippet}

{#snippet renderField(field: SchemaFormField)}
  {@const id = fieldDomId(field)}
  {@const error = fieldError(field)}
  {@const ariaDescribedBy = describedBy(field)}

  {#if field.kind === 'object'}
    <fieldset class="cinder-schema-form__fieldset">
      <legend class="cinder-schema-form__legend">{@render fieldLabel(field)}</legend>
      {@render fieldMessages(field)}
      <div class="cinder-schema-form__fields">
        {#each field.fields as child (pathKey(child.path))}
          {@render renderField(child)}
        {/each}
      </div>
    </fieldset>
  {:else if field.kind === 'array'}
    <fieldset class="cinder-schema-form__fieldset">
      <legend class="cinder-schema-form__legend">{@render fieldLabel(field)}</legend>
      {@render fieldMessages(field)}
      <div
        class="cinder-schema-form__array"
        data-cinder-empty={arrayRows(field).length === 0 || undefined}
      >
        {#each arrayRows(field) as row (row.key)}
          {@const itemField = field.item
            ? rebaseFieldPath(field.item, [...field.path, String(row.index)])
            : undefined}
          <div class="cinder-schema-form__array-item">
            {#if itemField}
              {@render renderField(itemField)}
            {/if}
            <button
              type="button"
              class="cinder-schema-form__secondary-button"
              onclick={() => removeArrayItem(field, row.index)}
            >
              Remove
            </button>
          </div>
        {/each}
      </div>
      <button
        type="button"
        class="cinder-schema-form__secondary-button"
        onclick={() => addArrayItem(field)}
      >
        Add {field.label}
      </button>
    </fieldset>
  {:else if field.kind === 'boolean'}
    <div class="cinder-schema-form__field">
      <button
        {id}
        type="button"
        role="switch"
        aria-checked={booleanValue(field)}
        aria-describedby={ariaDescribedBy}
        aria-invalid={error ? 'true' : undefined}
        class="cinder-schema-form__switch"
        data-cinder-checked={booleanValue(field) || undefined}
        data-cinder-invalid={error ? 'true' : undefined}
        onclick={() => toggleSwitch(field)}
        onkeydown={(event) => handleSwitchKeydown(field, event)}
      >
        <span class="cinder-schema-form__switch-thumb" aria-hidden="true"></span>
        <span class="cinder-schema-form__switch-label">{@render fieldLabel(field)}</span>
      </button>
      {@render fieldMessages(field)}
    </div>
  {:else}
    <div class="cinder-schema-form__field">
      <label class="cinder-schema-form__label" for={id}>{@render fieldLabel(field)}</label>
      {#if field.kind === 'string'}
        <input
          {id}
          class="cinder-_input-frame cinder-schema-form__control"
          value={stringValue(field)}
          required={field.required}
          aria-describedby={ariaDescribedBy}
          aria-invalid={error ? 'true' : undefined}
          oninput={(event) => updateString(field, event)}
        />
      {:else if field.kind === 'number' || field.kind === 'integer'}
        <input
          {id}
          class="cinder-_input-frame cinder-schema-form__control"
          type="number"
          step={field.kind === 'integer' ? '1' : 'any'}
          value={numberValue(field)}
          required={field.required}
          aria-describedby={ariaDescribedBy}
          aria-invalid={error ? 'true' : undefined}
          oninput={(event) => updateNumber(field, event)}
        />
      {:else if field.kind === 'enum'}
        <select
          {id}
          class="cinder-_input-frame cinder-schema-form__control"
          value={enumValue(field)}
          required={field.required}
          aria-describedby={ariaDescribedBy}
          aria-invalid={error ? 'true' : undefined}
          onchange={(event) => updateEnum(field, event)}
        >
          {#each field.options as option (option.encodedValue)}
            <option value={option.encodedValue}>{option.label}</option>
          {/each}
        </select>
      {:else}
        <textarea
          {id}
          class="cinder-_input-frame cinder-schema-form__control cinder-schema-form__json-control"
          rows="6"
          spellcheck="false"
          value={rawJsonValue(field)}
          required={field.required}
          aria-describedby={ariaDescribedBy}
          aria-invalid={error ? 'true' : undefined}
          oninput={(event) => updateRawJson(field, event)}
        ></textarea>
      {/if}
      {@render fieldMessages(field)}
    </div>
  {/if}
{/snippet}

<form
  {...rest}
  id={formId}
  bind:this={formElement}
  class={classNames('cinder-schema-form', customClassName)}
  novalidate={novalidate ?? true}
  onsubmit={handleSubmit}
>
  <div class="cinder-schema-form__fields">
    {#each rootFields as field (pathKey(field.path))}
      {@render renderField(field)}
    {/each}
  </div>

  <input bind:this={serializedInputElement} type="hidden" {name} value={serializedValue} />

  <button type="submit" class="cinder-schema-form__submit" disabled={submitting}>
    {submitting ? 'Validating...' : submitLabel}
  </button>
</form>
