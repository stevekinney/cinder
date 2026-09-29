<script lang="ts" module>
  export type FrontMatterFieldsProps = {
    id: string;
    data: Record<string, unknown> | null;
    raw: string | null;
    readonly?: boolean;
    /**
     * `raw` is the literal text `data` was parsed from (or `null` when
     * there's genuinely nothing between the fences). Callers that only look
     * at `data` can't tell "recognized front matter with no data" (a
     * comment-only YAML block -- `raw` non-null) apart from "genuinely
     * empty, safe to collapse" (`raw` null): both produce `data: null`.
     * `replaceFrontMatterData` (`review-editor-front-matter.ts`) uses this
     * distinction to avoid discarding comment-only text (cinder#1330
     * round-6 finding).
     */
    onchange: (data: Record<string, unknown> | null, raw?: string | null) => void;
  };
</script>

<script lang="ts">
  import { untrack } from 'svelte';
  import { parseFrontMatter, validateFrontMatter } from '@lostgradient/markdown';
  import {
    Checkbox,
    FormField,
    Input,
    JsonEditor,
    NumberInput,
    PayloadInspector,
    TagInput,
    Textarea,
  } from '@lostgradient/cinder';

  let { id, data, raw, readonly = false, onchange }: FrontMatterFieldsProps = $props();

  const entries = $derived(Object.entries(data ?? {}));
  const hasParsedFields = $derived(data !== null && entries.length > 0);
  const shouldShowRawYaml = $derived(!hasParsedFields && raw !== null);

  let rawDraft = $state(untrack(() => raw) ?? '');
  let rawError = $state<string | undefined>();
  let lastRaw = $state<string | null>(null);
  let complexDrafts = $state<Record<string, string>>({});
  let complexErrors = $state<Record<string, string | undefined>>({});
  let lastComplexKeys = $state('');
  let expanded = $state(true);
  let lastId = $state(untrack(() => id));

  const bodyId = $derived(`${id}-body`);

  $effect(() => {
    if (id !== lastId) {
      expanded = true;
      lastId = id;
    }
  });

  $effect(() => {
    if (raw !== lastRaw) {
      rawDraft = raw ?? '';
      rawError = validateFrontMatter(rawDraft).error;
      lastRaw = raw;
    }
  });

  $effect(() => {
    const complexEntries = entries.filter(([, value]) => isJsonEditableValue(value));
    const key = complexEntries
      .map(([name, value]) => `${name}:${serializeJsonFieldValue(value)}`)
      .join('|');
    if (key === lastComplexKeys) return;

    const nextDrafts: Record<string, string> = {};
    for (const [name, value] of complexEntries) {
      nextDrafts[name] = serializeJsonFieldValue(value);
    }
    complexDrafts = nextDrafts;
    complexErrors = {};
    lastComplexKeys = key;
  });

  function patchField(name: string, value: unknown): void {
    if (readonly) return;
    onchange({ ...data, [name]: value });
  }

  function handleComplexInput(name: string, rawValue: string): void {
    complexDrafts = { ...complexDrafts, [name]: rawValue };
    try {
      const parsed = JSON.parse(rawValue);
      const nextErrors = { ...complexErrors };
      delete nextErrors[name];
      complexErrors = nextErrors;
      patchField(name, parsed);
    } catch {
      complexErrors = { ...complexErrors, [name]: 'Enter valid JSON.' };
      return;
    }
  }

  function handleStringInput(name: string, previousValue: string | null, nextValue: string): void {
    if (previousValue === null && nextValue === '') return;
    patchField(name, nextValue);
  }

  function handleRawInput(rawValue: string): void {
    rawDraft = rawValue;
    const validation = validateFrontMatter(rawValue);
    if (!validation.valid) {
      rawError = validation.error;
      return;
    }
    if (readonly) return;

    // validateFrontMatter only checks that `rawValue` parses as YAML *at
    // all* -- it says "valid" for a bare scalar or a sequence (e.g. `- one`)
    // just as readily as for a real key/value mapping. parseFrontMatter is
    // the source of truth for whether that's actually front-matter data
    // (cinder#1325): confirm hasFrontMatter here too, or a value that
    // "passes validation" but isn't object-shaped commits as `null`, which
    // the parent round-trips back through `preserveEmptyFrontMatter` to the
    // document's *previous* front matter -- silently discarding the input
    // while the textarea shows no error and keeps displaying what the user
    // typed, making the discard invisible.
    const parsed = parseFrontMatter(`---\n${rawValue}\n---\n`);
    if (!parsed.hasFrontMatter) {
      rawError = 'Front matter must be a YAML mapping (key: value pairs), not a list or a value.';
      return;
    }

    rawError = undefined;
    // `parsed.data` alone is `null` for two different cases this component
    // can't otherwise distinguish: a comment-only block (`# TODO: fill this
    // in` -- recognized front matter, `parsed.raw` holds the actual text)
    // and a genuinely blank one (`parsed.raw` is `null`). Passing
    // `parsed.raw` through lets `replaceFrontMatterData` preserve the
    // former instead of collapsing it to an empty fence, while still
    // collapsing the latter correctly (cinder#1330 round-6 finding).
    onchange(parsed.data, parsed.raw);
  }

  function fieldId(name: string): string {
    return `${id}-${name.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
  }

  function isComplexValue(value: unknown): boolean {
    return typeof value === 'object' && value !== null;
  }

  function isStringArray(value: unknown): value is string[] {
    return Array.isArray(value) && value.every((item) => typeof item === 'string');
  }

  function isJsonEditableValue(value: unknown): boolean {
    return isComplexValue(value) && !isStringArray(value);
  }

  function serializeJsonFieldValue(value: unknown): string {
    return JSON.stringify(value, null, 2);
  }
</script>

<section class="review-editor-front-matter" aria-labelledby={`${id}-heading`}>
  <div class="review-editor-front-matter__header">
    <h3 id={`${id}-heading`} class="review-editor-front-matter__title">
      <button
        type="button"
        class="review-editor-front-matter__toggle"
        aria-expanded={expanded}
        aria-controls={bodyId}
        onclick={() => {
          expanded = !expanded;
        }}
      >
        Front matter
      </button>
    </h3>
  </div>

  <div id={bodyId} class="review-editor-front-matter__body" hidden={!expanded}>
    {#if hasParsedFields}
      {#each entries as [name, fieldValue] (name)}
        <div class="review-editor-front-matter__field">
          {#if readonly}
            {#if isStringArray(fieldValue)}
              <FormField id={fieldId(name)} label={name}>
                <TagInput id={fieldId(name)} value={fieldValue} delimiter="," readonly />
              </FormField>
            {:else if isJsonEditableValue(fieldValue)}
              <PayloadInspector value={fieldValue} label={name} />
            {:else}
              <div class="review-editor-front-matter__readonly-field">
                <span class="review-editor-front-matter__readonly-label">{name}</span>
                <span class="review-editor-front-matter__readonly-value">
                  {fieldValue === null ? '' : String(fieldValue)}
                </span>
              </div>
            {/if}
          {:else if typeof fieldValue === 'boolean'}
            <Checkbox
              id={fieldId(name)}
              label={name}
              checked={fieldValue}
              onchange={(event) => patchField(name, event.currentTarget.checked)}
            />
          {:else if typeof fieldValue === 'number'}
            <NumberInput
              id={fieldId(name)}
              label={name}
              value={fieldValue}
              onValueChange={(nextValue) => patchField(name, nextValue)}
            />
          {:else if typeof fieldValue === 'string' || fieldValue === null}
            <Input
              id={fieldId(name)}
              label={name}
              value={fieldValue === null ? '' : fieldValue}
              oninput={(event) => handleStringInput(name, fieldValue, event.currentTarget.value)}
            />
          {:else if isStringArray(fieldValue)}
            <FormField id={fieldId(name)} label={name}>
              <TagInput
                id={fieldId(name)}
                value={fieldValue}
                delimiter=","
                onValueChange={(nextValue) => patchField(name, nextValue)}
              />
            </FormField>
          {:else if isJsonEditableValue(fieldValue)}
            <JsonEditor
              id={fieldId(name)}
              label={name}
              value={complexDrafts[name] ?? serializeJsonFieldValue(fieldValue)}
              error={complexErrors[name] ?? ''}
              rows={Math.max(
                3,
                (complexDrafts[name] ?? serializeJsonFieldValue(fieldValue)).split('\n').length,
              )}
              highlight
              onValueChange={(nextValue) => handleComplexInput(name, nextValue)}
            />
          {:else}
            <Input
              id={fieldId(name)}
              label={name}
              value={fieldValue === null ? 'null' : String(fieldValue)}
              oninput={(event) => patchField(name, event.currentTarget.value)}
            />
          {/if}
        </div>
      {/each}
    {:else if shouldShowRawYaml}
      <Textarea
        id={`${id}-raw`}
        label="YAML"
        value={rawDraft}
        error={rawError ?? ''}
        disabled={readonly}
        rows={Math.max(3, rawDraft.split('\n').length)}
        variant="code"
        oninput={(event) => handleRawInput(event.currentTarget.value)}
      />
    {:else}
      <p class="review-editor-front-matter__empty">No front matter fields.</p>
    {/if}
  </div>
</section>
