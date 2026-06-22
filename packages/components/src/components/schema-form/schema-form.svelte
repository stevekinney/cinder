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
  import Checkbox from '../checkbox/checkbox.svelte';
  import Input from '../input/input.svelte';
  import NumberInput from '../number-input/number-input.svelte';
  import Select from '../select/select.svelte';
  import Textarea from '../textarea/textarea.svelte';

  import {
    arrayValueAtPath,
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
  import type { SchemaFormOutput, SchemaFormProps, SchemaFormSchema } from './schema-form.types.ts';
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
  // Compute the initial model once for state initialization, then keep a
  // reactive $derived for template rendering. When `schema` changes, the
  // {#key schema} block in the template causes a full remount of the form
  // body, resetting DOM-bound refs — without needing a broad $effect.
  // The mutable state is initialized once from the initial schema+value.
  const initialModel = createSchemaFormModel(schema);
  const initialFormValue = initialValueForField(initialModel.field, value);
  const model = $derived(createSchemaFormModel(schema));
  let formElement = $state<HTMLFormElement>();
  let serializedInputElement = $state<HTMLInputElement>();
  let formValue = $state<unknown>(initialFormValue);
  let errors = $state<Record<string, string>>({});
  let rawDrafts = $state<Record<string, string>>(
    seedRawDrafts(initialModel.field, initialFormValue),
  );
  let serializedValue = $state('');
  let submitting = $state(false);
  let allowNativeSubmit = false;
  let activeSubmitId = 0;
  let arrayKeyCounter = 0;
  let arrayKeys = $state<Record<string, string[]>>(
    seedArrayKeys(initialModel.field, initialFormValue),
  );

  const formId = $derived((rest.id as string | undefined) ?? `${generatedId}-form`);
  const rootFields = $derived(model.field.kind === 'object' ? model.field.fields : [model.field]);
  const rootError = $derived(model.field.kind === 'object' ? errors[pathKey([])] : undefined);
  const rootErrorId = $derived(`${formId}-${pathId([])}-error`);

  function fieldDomId(field: SchemaFormField): string {
    return `${formId}-${pathId(field.path)}`;
  }

  function fieldError(field: SchemaFormField): string | undefined {
    return errors[pathKey(field.path)];
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
    if (rawDrafts[key] !== undefined) return rawDrafts[key];
    return JSON.stringify(getValueAtPath(formValue, field.path) ?? null, null, 2);
  }

  function updateValue(path: readonly string[], next: unknown) {
    if (submitting) return;
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

  /** Enum Select is one-way (value + onchange) rather than a function binding:
   *  the encode/decode round-trip is unstable inside Svelte's <select> binding
   *  writeback, which reverts the selection. Decode the chosen option here. */
  function updateEnum(field: SchemaFormField, event: Event) {
    if (submitting) return;
    const select = event.currentTarget as HTMLSelectElement;
    updateValue(field.path, decodeEnumValue(select.value));
  }

  /** JSON fields hold a raw text draft (validated/parsed on submit), so the
   *  textarea's value flows into `rawDrafts` rather than the typed value tree. */
  function updateRawJsonValue(field: SchemaFormField, next: string) {
    if (submitting) return;
    rawDrafts = { ...rawDrafts, [pathKey(field.path)]: next };
    setSerializedValue('');
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
    if (submitting) return;
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
    if (submitting) return;
    const values = arrayValueAtPath(formValue, field.path);
    updateValue(
      field.path,
      values.filter((_, candidateIndex) => candidateIndex !== index),
    );
    rawDrafts = reindexArrayPathState(rawDrafts, field.path, index);
    errors = reindexArrayPathState(errors, field.path, index);
    const key = pathKey(field.path);
    arrayKeys = {
      ...arrayKeys,
      [key]: (arrayKeys[key] ?? []).filter((_, candidateIndex) => candidateIndex !== index),
    };
  }

  function reindexArrayPathState<T>(
    state: Record<string, T>,
    arrayPath: readonly string[],
    removedIndex: number,
  ): Record<string, T> {
    const prefix = pathKey(arrayPath);
    const pathPrefix = prefix === '' ? '' : `${prefix}/`;
    const next: Record<string, T> = {};

    for (const [key, stateValue] of Object.entries(state)) {
      if (!key.startsWith(pathPrefix)) {
        next[key] = stateValue;
        continue;
      }

      const relativeKey = key.slice(pathPrefix.length);
      if (relativeKey === '') {
        next[key] = stateValue;
        continue;
      }

      const [indexSegment = '', ...remainingSegments] = relativeKey.split('/');
      const index = Number(indexSegment);
      if (!Number.isInteger(index) || index < 0) {
        next[key] = stateValue;
        continue;
      }

      if (index < removedIndex) {
        next[key] = stateValue;
        continue;
      }

      if (index === removedIndex) continue;

      const shiftedKey = [String(index - 1), ...remainingSegments].join('/');
      next[`${pathPrefix}${shiftedKey}`] = stateValue;
    }

    return next;
  }

  function seedRawDrafts(field: SchemaFormField, currentValue: unknown): Record<string, string> {
    const drafts: Record<string, string> = {};
    for (const jsonField of currentJsonFields(field, currentValue)) {
      drafts[pathKey(jsonField.path)] = JSON.stringify(
        getValueAtPath(currentValue, jsonField.path) ?? null,
        null,
        2,
      );
    }
    return drafts;
  }

  function currentJsonFields(field: SchemaFormField, currentValue: unknown): SchemaFormField[] {
    const fields: SchemaFormField[] = [];

    function visit(candidate: SchemaFormField) {
      if (candidate.kind === 'json') fields.push(candidate);
      for (const child of candidate.fields) visit(child);
      if (candidate.kind === 'array' && candidate.item) {
        for (const [index] of arrayValueAtPath(currentValue, candidate.path).entries()) {
          visit(rebaseFieldPath(candidate.item, [...candidate.path, String(index)]));
        }
      }
    }

    visit(field);
    return fields;
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
    for (const field of currentJsonFields(model.field, formValue)) {
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

  async function reportSubmitIssues(issues: SchemaFormValidationIssue[], submitId: number) {
    if (activeSubmitId !== submitId) return;
    errors = issuesByPath(issues);
    setSerializedValue('');
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
    return onsubmit === undefined && (rest.action !== undefined || rest.method !== undefined);
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
      const raw = rawJsonIssues();
      if (raw.issues.length > 0) {
        await reportSubmitIssues(raw.issues, submitId);
        return;
      }

      const candidate = pruneUndefined(raw.value);
      const result = await validateSchemaValue(schema, candidate);
      if (!result.valid) {
        await reportSubmitIssues(result.issues, submitId);
        return;
      }

      const serialized = serializeValidatedValue(result.value);
      if (!serialized.ok) {
        await reportSubmitIssues([serialized.issue], submitId);
        return;
      }

      formValue = result.value;
      errors = {};
      setSerializedValue(serialized.value);
      await onsubmit?.(result.value as SchemaFormOutput<Schema>, event);

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
              aria-label={`Remove ${field.label} item ${row.index + 1}`}
              disabled={submitting}
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
        disabled={submitting}
        onclick={() => addArrayItem(field)}
      >
        Add {field.label}
      </button>
    </fieldset>
  {:else}
    <div class="cinder-schema-form__field">
      {#if field.kind === 'string'}
        <Input
          {id}
          label={field.label}
          description={field.description}
          {error}
          required={field.required}
          disabled={submitting}
          bind:value={() => stringValue(field), (next) => updateValue(field.path, next)}
        />
      {:else if field.kind === 'number' || field.kind === 'integer'}
        <NumberInput
          {id}
          label={field.label}
          description={field.description}
          {error}
          required={field.required}
          disabled={submitting}
          step={field.kind === 'integer' ? 1 : undefined}
          bind:value={
            () => numberFieldValue(field), (next) => updateValue(field.path, next ?? undefined)
          }
        />
      {:else if field.kind === 'enum'}
        <Select
          {id}
          label={field.label}
          description={field.description}
          {error}
          required={field.required}
          disabled={submitting}
          options={selectOptions(field)}
          value={enumValue(field)}
          onchange={(event) => updateEnum(field, event)}
        />
      {:else if field.kind === 'boolean'}
        <!-- A required boolean schema property means "the value must be present",
             not "the box must be checked". Native checkbox `required` would block
             a valid `false` submission, so it is intentionally NOT forwarded here;
             presence is enforced by the schema validator on submit. -->
        <Checkbox
          {id}
          label={field.label}
          description={field.description}
          {error}
          disabled={submitting}
          bind:checked={() => booleanValue(field), (next) => updateValue(field.path, next)}
        />
      {:else}
        <Textarea
          {id}
          label={field.label}
          description={field.description}
          {error}
          required={field.required}
          disabled={submitting}
          rows={6}
          spellcheck={false}
          class="cinder-schema-form__json-control"
          bind:value={() => rawJsonValue(field), (next) => updateRawJsonValue(field, next)}
        />
      {/if}
    </div>
  {/if}
{/snippet}

{#key schema}
  <form
    {...rest}
    id={formId}
    bind:this={formElement}
    class={classNames('cinder-schema-form', customClassName)}
    novalidate={novalidate ?? true}
    onsubmit={handleSubmit}
  >
    {#if rootError}
      <p id={rootErrorId} class="cinder-schema-form__error" aria-live="polite" tabindex="-1">
        {rootError}
      </p>
    {/if}

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
{/key}
