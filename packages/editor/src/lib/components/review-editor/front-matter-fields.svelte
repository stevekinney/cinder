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
  import { parseFrontMatter, validateFrontMatter } from '@lostgradient/markdown/pipeline';
  import Checkbox from '@lostgradient/cinder/checkbox';
  import Input from '@lostgradient/cinder/input';
  import Textarea from '@lostgradient/cinder/textarea';
  import { parseYamlFieldValue, serializeYamlFieldValue } from './review-editor-front-matter.ts';

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
              variant="code"
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
        variant="code"
        oninput={(event) => handleRawInput(event.currentTarget.value)}
      />
    {:else}
      <p class="review-editor-front-matter__empty">No front matter fields.</p>
    {/if}
  </div>
</section>
