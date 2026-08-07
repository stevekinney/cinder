<!--
  Internal component: owns all mutable form state so that the outer
  {#key schema} block in schema-form.svelte causes genuine $state recreation
  when the schema prop changes.

  This component is NOT part of the public API. Import SchemaForm instead.
-->
<script lang="ts">
  import { tick } from 'svelte';

  import { classNames } from '../../utilities/class-names.ts';
  import Checkbox from '../checkbox/checkbox.svelte';
  import Input from '../input/input.svelte';
  import NumberInput from '../number-input/number-input.svelte';
  import Select from '../select/select.svelte';
  import Textarea from '../textarea/textarea.svelte';

  import {
    createSchemaFormModel,
    getValueAtPath,
    initialValueForField,
    pathId,
    pathKey,
    rebaseFieldPath,
    type SchemaFormField,
  } from './schema-form-model.ts';
  import { createSchemaFormState } from './schema-form-state.svelte.ts';
  import type { SchemaFormOutput, SchemaFormProps } from './schema-form.types.ts';
  import {
    serializeValidatedValue,
    validateSchemaValue,
    type SchemaFormValidationIssue,
  } from './schema-form-validation.ts';

  /**
   * SchemaFormBody receives the same props as SchemaForm. The schema prop is
   * fixed at mount — the outer {#key schema} wrapper in schema-form.svelte
   * destroys and recreates this component when schema changes, causing all
   * $state below to genuinely reset.
   *
   * `value` is a SEED: the consumer owns the form state after mount. Changing
   * the `value` prop after mount with the same schema does NOT reset formValue
   * — only a schema change (which triggers a remount) resets the form.
   */
  let {
    schema,
    value,
    name = 'value',
    submitLabel = 'Submit',
    class: customClassName,
    onSubmit,
    onDraftChange,
    novalidate,
    ...rest
  }: SchemaFormProps = $props();

  const generatedId = $props.id();

  // All mutable state is declared here so it resets when the component is
  // remounted via {#key schema}. The initial values are seeded once from
  // the schema+value at mount time.
  function createInitialState() {
    const initialModel = createSchemaFormModel(schema);
    return {
      initialModel,
      initialFormValue: initialValueForField(initialModel.field, value),
    };
  }

  const { initialModel, initialFormValue } = createInitialState();
  const model = $derived(createSchemaFormModel(schema));
  let formElement = $state<HTMLFormElement>();
  let serializedInputElement = $state<HTMLInputElement>();
  let submitting = $state(false);
  let allowNativeSubmit = false;
  let activeSubmitId = 0;

  const formState = createSchemaFormState(initialModel, initialFormValue, {
    getSubmitting: () => submitting,
    onDraftChange: (draft) => onDraftChange?.(draft),
  });

  // The hidden serialized-output input is a plain DOM ref, not a Svelte
  // binding, so it needs an explicit sync whenever the state class's
  // serializedValue changes (cleared on every edit, set on a successful
  // submit).
  $effect(() => {
    if (serializedInputElement) serializedInputElement.value = formState.serializedValue;
  });

  const formId = $derived((rest.id as string | undefined) ?? `${generatedId}-form`);
  const rootFields = $derived(model.field.kind === 'object' ? model.field.fields : [model.field]);
  const rootError = $derived(
    model.field.kind === 'object' ? formState.errors[pathKey([])] : undefined,
  );
  const rootErrorId = $derived(`${formId}-${pathId([])}-error`);

  function fieldDomId(field: SchemaFormField): string {
    return `${formId}-${pathId(field.path)}`;
  }

  function fieldError(field: SchemaFormField): string | undefined {
    return formState.errors[pathKey(field.path)];
  }

  function stringValue(field: SchemaFormField): string {
    const current = getValueAtPath(formState.formValue, field.path);
    return current === undefined || current === null ? '' : String(current);
  }

  function numberValue(field: SchemaFormField): number | undefined {
    const current = getValueAtPath(formState.formValue, field.path);
    return typeof current === 'number' ? current : undefined;
  }

  function booleanValue(field: SchemaFormField): boolean {
    return getValueAtPath(formState.formValue, field.path) === true;
  }

  function enumValue(field: SchemaFormField): string {
    const current = getValueAtPath(formState.formValue, field.path);
    const option = field.options.find((candidate) => Object.is(candidate.value, current));
    return option?.encodedValue ?? field.options[0]?.encodedValue ?? '';
  }

  /** Map a field's options to Select's `{ value, label }` shape, keyed on the
   *  encoded (string) value so the native <option> values stay round-trippable. */
  function selectOptions(field: SchemaFormField): Array<{ value: string; label: string }> {
    return field.options.map((option) => ({ value: option.encodedValue, label: option.label }));
  }

  /** NumberInput binds a `number | null`; the model stores `undefined` for an
   *  empty numeric field, so translate between the two at the binding edge. */
  function numberFieldValue(field: SchemaFormField): number | null {
    return numberValue(field) ?? null;
  }

  function rawJsonValue(field: SchemaFormField): string {
    const key = pathKey(field.path);
    if (formState.rawDrafts[key] !== undefined) return formState.rawDrafts[key];
    return JSON.stringify(getValueAtPath(formState.formValue, field.path) ?? null, null, 2);
  }

  async function reportSubmitIssues(issues: SchemaFormValidationIssue[], submitId: number) {
    if (activeSubmitId !== submitId) return;
    formState.applyIssues(issues);
    submitting = false;
    await focusFirstError(submitId);
  }

  async function focusFirstError(submitId: number) {
    await tick();
    if (activeSubmitId !== submitId) return;
    formElement
      ?.querySelector<HTMLElement>(
        '[aria-invalid="true"], [data-cinder-invalid="true"], .cinder-schema-form__error',
      )
      ?.focus();
  }

  function shouldResumeNativeSubmit(): boolean {
    return onSubmit === undefined && (rest.action !== undefined || rest.method !== undefined);
  }

  function nativeSubmitter(event: SubmitEvent): HTMLButtonElement | HTMLInputElement | undefined {
    const submitter = event.submitter;
    if (
      submitter instanceof HTMLButtonElement &&
      submitter.type === 'submit' &&
      submitter.form === formElement
    ) {
      return submitter;
    }
    if (
      submitter instanceof HTMLInputElement &&
      (submitter.type === 'submit' || submitter.type === 'image') &&
      submitter.form === formElement
    ) {
      return submitter;
    }
    return undefined;
  }

  async function handleSubmit(event: SubmitEvent) {
    if (allowNativeSubmit) {
      allowNativeSubmit = false;
      return;
    }

    event.preventDefault();
    if (submitting) return;

    const submitId = activeSubmitId + 1;
    activeSubmitId = submitId;
    submitting = true;
    try {
      const draft = formState.buildSubmitCandidate();
      if (!draft.ok) {
        await reportSubmitIssues(draft.issues, submitId);
        return;
      }

      const result = await validateSchemaValue(schema, draft.value);
      if (!result.valid) {
        await reportSubmitIssues(result.issues, submitId);
        return;
      }

      const serialized = serializeValidatedValue(result.value);
      if (!serialized.ok) {
        await reportSubmitIssues([serialized.issue], submitId);
        return;
      }

      formState.commit(result.value, serialized.value);
      await onSubmit?.(result.value as SchemaFormOutput, event);

      if (shouldResumeNativeSubmit()) {
        allowNativeSubmit = true;
        await tick();
        formElement?.requestSubmit(nativeSubmitter(event));
      }
    } finally {
      if (activeSubmitId === submitId) submitting = false;
    }
  }
</script>

{#snippet groupLegend(field: SchemaFormField)}
  <legend class="cinder-schema-form__legend">
    {field.label}
    {#if field.required}
      <span class="cinder-_required-marker" aria-hidden="true">*</span>
    {/if}
  </legend>
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
  {@const labelledProps = {
    label: field.label,
    // `description`/`error` are optional `string` props (no `| undefined`), and
    // exactOptionalPropertyTypes rejects passing an explicit `undefined`. Spread
    // them only when present so the control sees the prop omitted, not undefined.
    ...(field.description !== undefined ? { description: field.description } : {}),
    ...(error !== undefined ? { error } : {}),
  }}

  {#if field.kind === 'object'}
    <fieldset class="cinder-schema-form__fieldset">
      {@render groupLegend(field)}
      <div class="cinder-schema-form__fields">
        {#each field.fields as child (pathKey(child.path))}
          {@render renderField(child)}
        {/each}
      </div>
    </fieldset>
  {:else if field.kind === 'array'}
    <fieldset class="cinder-schema-form__fieldset">
      {@render groupLegend(field)}
      <div
        class="cinder-schema-form__array"
        data-cinder-empty={formState.arrayRows(field).length === 0 || undefined}
      >
        {#each formState.arrayRows(field) as row (row.key)}
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
              aria-label={`Remove ${field.label} item ${row.index + 1}`}
              disabled={submitting}
              onclick={() => formState.removeArrayItem(field, row.index)}
            >
              Remove
            </button>
          </div>
        {/each}
      </div>
      <button
        type="button"
        class="cinder-schema-form__secondary-button"
        disabled={submitting}
        onclick={() => formState.addArrayItem(field)}
      >
        Add {field.label}
      </button>
    </fieldset>
  {:else}
    <div
      class="cinder-schema-form__field"
      oninput={(event) => formState.handleFieldInput(field, event)}
    >
      {#if field.kind === 'string'}
        <Input
          {id}
          {...labelledProps}
          required={field.required}
          disabled={submitting}
          onblur={() => formState.validateTouchedField(field)}
          bind:value={() => stringValue(field), (next) => formState.updateValue(field.path, next)}
        />
      {:else if field.kind === 'number' || field.kind === 'integer'}
        <NumberInput
          {id}
          {...labelledProps}
          required={field.required}
          disabled={submitting}
          step={field.kind === 'integer' ? 1 : undefined}
          onblur={() => formState.validateTouchedField(field)}
          value={numberFieldValue(field)}
          onValueChange={(next) => formState.updateNumberValue(field, next)}
        />
      {:else if field.kind === 'enum'}
        <Select
          {id}
          {...labelledProps}
          required={field.required}
          disabled={submitting}
          options={selectOptions(field)}
          value={enumValue(field)}
          onchange={(event) => formState.updateEnum(field, event)}
          onblur={() => formState.validateTouchedField(field)}
        />
      {:else if field.kind === 'boolean'}
        <!-- A required boolean schema property means "the value must be present",
             not "the box must be checked". Native checkbox `required` would block
             a valid `false` submission, so it is intentionally NOT forwarded here;
             presence is enforced by the schema validator on submit. -->
        <Checkbox
          {id}
          {...labelledProps}
          disabled={submitting}
          bind:checked={
            () => booleanValue(field), (next) => formState.updateValue(field.path, next)
          }
        />
      {:else}
        <Textarea
          {id}
          {...labelledProps}
          required={field.required}
          disabled={submitting}
          rows={6}
          spellcheck={false}
          class="cinder-schema-form__json-control"
          onblur={() => formState.validateTouchedField(field)}
          bind:value={
            () => rawJsonValue(field), (next) => formState.updateRawJsonValue(field, next)
          }
        />
      {/if}
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
  {#if rootError}
    <p
      id={rootErrorId}
      class="cinder-schema-form__error"
      role="alert"
      aria-live="polite"
      tabindex="-1"
    >
      {rootError}
    </p>
  {/if}

  <div class="cinder-schema-form__fields">
    {#each rootFields as field (pathKey(field.path))}
      {@render renderField(field)}
    {/each}
  </div>

  <input
    bind:this={serializedInputElement}
    type="hidden"
    {name}
    value={formState.serializedValue}
  />

  <button type="submit" class="cinder-schema-form__submit" disabled={submitting}>
    {submitting ? 'Validating...' : submitLabel}
  </button>
</form>
