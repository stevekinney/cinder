<script lang="ts" module>
  export type FrontMatterFieldsProps = {
    id: string;
    data: Record<string, unknown> | null;
    raw: string | null;
    readonly?: boolean;
    onchange: (data: Record<string, unknown> | null) => void;
  };
</script>

<script lang="ts">
  import { parseFrontMatter, validateFrontMatter } from '@cinder/markdown/pipeline';
  import Checkbox from '../checkbox.svelte';
  import Input from '../input.svelte';
  import Textarea from '../textarea/textarea.svelte';
  import { parseYamlFieldValue, serializeYamlFieldValue } from './review-editor-front-matter.ts';

  let { id, data, raw, readonly = false, onchange }: FrontMatterFieldsProps = $props();

  const entries = $derived(Object.entries(data ?? {}));
  const hasParsedFields = $derived(data !== null && entries.length > 0);
  const shouldShowRawYaml = $derived(!hasParsedFields && raw !== null);

  let rawDraft = $state(raw ?? '');
  let rawError = $state<string | undefined>();
  let lastRaw = $state<string | null>(null);
  let complexDrafts = $state<Record<string, string>>({});
  let complexErrors = $state<Record<string, string | undefined>>({});
  let lastComplexKeys = $state('');

  $effect(() => {
    if (raw !== lastRaw) {
      rawDraft = raw ?? '';
      rawError = validateFrontMatter(rawDraft).error;
      lastRaw = raw;
    }
  });

  $effect(() => {
    const complexEntries = entries.filter(([, value]) => isComplexValue(value));
    const key = complexEntries
      .map(([name, value]) => `${name}:${serializeYamlFieldValue(value)}`)
      .join('|');
    if (key === lastComplexKeys) return;

    const nextDrafts: Record<string, string> = {};
    for (const [name, value] of complexEntries) {
      nextDrafts[name] = serializeYamlFieldValue(value);
    }
    complexDrafts = nextDrafts;
    complexErrors = {};
    lastComplexKeys = key;
  });

  function patchField(name: string, value: unknown): void {
    if (readonly) return;
    onchange({ ...(data ?? {}), [name]: value });
  }

  function handleNumberInput(name: string, rawValue: string): void {
    if (rawValue.trim() === '') {
      patchField(name, null);
      return;
    }

    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed)) return;
    patchField(name, parsed);
  }

  function handleComplexInput(name: string, rawValue: string): void {
    complexDrafts = { ...complexDrafts, [name]: rawValue };
    const parsed = parseYamlFieldValue(rawValue);
    if (!parsed.valid) {
      complexErrors = { ...complexErrors, [name]: parsed.error };
      return;
    }

    const nextErrors = { ...complexErrors };
    delete nextErrors[name];
    complexErrors = nextErrors;
    patchField(name, parsed.value);
  }

  function handleRawInput(rawValue: string): void {
    rawDraft = rawValue;
    const validation = validateFrontMatter(rawValue);
    rawError = validation.error;
    if (!validation.valid || readonly) return;

    const parsed = parseFrontMatter(`---\n${rawValue}\n---\n`);
    onchange(parsed.data);
  }

  function fieldId(name: string): string {
    return `${id}-${name.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
  }

  function isComplexValue(value: unknown): boolean {
    return typeof value === 'object' && value !== null;
  }
</script>

<section class="review-editor-front-matter" aria-labelledby={`${id}-heading`}>
  <div class="review-editor-front-matter__header">
    <h3 id={`${id}-heading`} class="review-editor-front-matter__title">Front matter</h3>
  </div>

  <div class="review-editor-front-matter__body">
    {#if hasParsedFields}
      {#each entries as [name, fieldValue] (name)}
        <div class="review-editor-front-matter__field">
          {#if typeof fieldValue === 'boolean'}
            <Checkbox
              id={fieldId(name)}
              label={name}
              checked={fieldValue}
              disabled={readonly}
              onchange={(event) => patchField(name, event.currentTarget.checked)}
            />
          {:else if typeof fieldValue === 'number'}
            <Input
              id={fieldId(name)}
              label={name}
              value={String(fieldValue)}
              disabled={readonly}
              oninput={(event) => handleNumberInput(name, event.currentTarget.value)}
            />
          {:else if typeof fieldValue === 'string'}
            <Input
              id={fieldId(name)}
              label={name}
              value={fieldValue}
              disabled={readonly}
              oninput={(event) => patchField(name, event.currentTarget.value)}
            />
          {:else if isComplexValue(fieldValue)}
            <Textarea
              id={fieldId(name)}
              label={name}
              value={complexDrafts[name] ?? serializeYamlFieldValue(fieldValue)}
              error={complexErrors[name] ?? ''}
              disabled={readonly}
              rows={Math.max(
                3,
                (complexDrafts[name] ?? serializeYamlFieldValue(fieldValue)).split('\n').length,
              )}
              oninput={(event) => handleComplexInput(name, event.currentTarget.value)}
            />
          {:else}
            <Input
              id={fieldId(name)}
              label={name}
              value={fieldValue === null ? 'null' : String(fieldValue)}
              disabled={readonly}
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
        oninput={(event) => handleRawInput(event.currentTarget.value)}
      />
    {:else}
      <p class="review-editor-front-matter__empty">No front matter fields.</p>
    {/if}
  </div>
</section>
