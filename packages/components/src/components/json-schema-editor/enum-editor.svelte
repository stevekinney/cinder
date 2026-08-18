<script lang="ts" module>
  export type EnumDraft = {
    text: string;
    error: 'invalid-json' | 'duplicate';
  };

  export type EnumEditorProps = {
    idPrefix: string;
    path: string;
    values: unknown[];
    drafts?: Record<number, EnumDraft>;
    readonly?: boolean;
    onvalidationErrorcount?: ((count: number) => void) | undefined;
    onDraftsChange?: ((next: Record<number, EnumDraft>) => void) | undefined;
    onValuesChange: (next: unknown[], options?: { coalesceKey?: string; label?: string }) => void;
  };
</script>

<script lang="ts">
  import { onDestroy, tick } from 'svelte';
  import Button from '@lostgradient/cinder/button';
  import Input from '@lostgradient/cinder/input';

  let {
    idPrefix,
    path,
    values,
    drafts = {},
    readonly = false,
    onvalidationErrorcount,
    onDraftsChange,
    onValuesChange,
  }: EnumEditorProps = $props();

  let localDrafts = $state<Record<number, EnumDraft>>({});
  let previousDrafts: Record<number, EnumDraft> | null = null;
  let emittedDrafts: Record<number, EnumDraft> | null = null;
  const activeDrafts = $derived({ ...drafts, ...localDrafts });
  const invalidValueIndexes = $derived(new Set(Object.keys(activeDrafts).map(Number)));
  let actionAnnouncement = $state('');

  $effect(() => onvalidationErrorcount?.(invalidValueIndexes.size));
  onDestroy(() => onvalidationErrorcount?.(0));

  $effect(() => {
    if (drafts !== previousDrafts) {
      if (drafts !== emittedDrafts) localDrafts = {};
      previousDrafts = drafts;
      emittedDrafts = null;
    }
  });

  function jsonText(value: unknown): string {
    return JSON.stringify(value) ?? 'null';
  }

  function isJsonValue(value: unknown): boolean {
    if (typeof value === 'number') return Number.isFinite(value);
    if (Array.isArray(value)) return value.every(isJsonValue);
    if (value !== null && typeof value === 'object') return Object.values(value).every(isJsonValue);
    return value === null || typeof value === 'string' || typeof value === 'boolean';
  }

  function canonicalJson(value: unknown): string {
    if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
    if (value !== null && typeof value === 'object') {
      const object = value as Record<string, unknown>;
      return `{${Object.keys(object)
        .sort()
        .map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`)
        .join(',')}}`;
    }
    return JSON.stringify(value) ?? 'null';
  }

  function hasDuplicateValue(value: unknown, exceptIndex: number): boolean {
    const encoded = canonicalJson(value);
    return values.some((item, index) => index !== exceptIndex && canonicalJson(item) === encoded);
  }

  function setDraft(index: number, draft: EnumDraft | undefined): void {
    if (draft === undefined) {
      const { [index]: _removedLocalDraft, ...remainingLocalDrafts } = localDrafts;
      const { [index]: _removedDraft, ...remainingDrafts } = activeDrafts;
      localDrafts = remainingLocalDrafts;
      emittedDrafts = remainingDrafts;
      onDraftsChange?.(remainingDrafts);
      return;
    }
    localDrafts = { ...localDrafts, [index]: draft };
    emittedDrafts = { ...activeDrafts, [index]: draft };
    onDraftsChange?.(emittedDrafts);
  }

  function errorMessage(index: number): string {
    return activeDrafts[index]?.error === 'duplicate'
      ? 'Enum values must be unique.'
      : 'Enter a valid JSON value.';
  }

  function setValue(index: number, text: string): void {
    try {
      const nextValue = JSON.parse(text) as unknown;
      if (!isJsonValue(nextValue)) {
        setDraft(index, { text, error: 'invalid-json' });
        return;
      }
      if (hasDuplicateValue(nextValue, index)) {
        setDraft(index, { text, error: 'duplicate' });
        return;
      }
      const next = [...values];
      next[index] = nextValue;
      setDraft(index, undefined);
      onValuesChange(next, { coalesceKey: `enum:${path}:${index}`, label: 'edit enum value' });
    } catch {
      setDraft(index, { text, error: 'invalid-json' });
    }
  }

  function moveValue(index: number, direction: -1 | 1): void {
    const targetIndex = index + direction;
    if (readonly || invalidValueIndexes.size > 0 || targetIndex < 0 || targetIndex >= values.length)
      return;
    const next = [...values];
    [next[index], next[targetIndex]] = [next[targetIndex]!, next[index]!];
    onValuesChange(next);
    actionAnnouncement = `Moved enum value ${index + 1} to position ${targetIndex + 1} of ${values.length}.`;
  }

  async function removeValue(index: number): Promise<void> {
    if (readonly || invalidValueIndexes.size > 0 || values.length === 1) return;
    const focusIndex = Math.min(index, values.length - 2);
    onValuesChange(values.filter((_, itemIndex) => itemIndex !== index));
    await tick();
    document.getElementById(`${idPrefix}-remove-${focusIndex}`)?.focus();
  }

  function addValue(): void {
    if (readonly) return;
    let nextValue = '';
    let suffix = 1;
    while (hasDuplicateValue(nextValue, -1)) nextValue = `value ${suffix++}`;
    onValuesChange([...values, nextValue]);
  }
</script>

<div class="cinder-jse-enum-editor">
  <table class="cinder-jse-enum-editor__table" aria-label="Enum values">
    <thead>
      <tr>
        <th scope="col">Value</th>
        <th scope="col"><span class="cinder-sr-only">Actions</span></th>
      </tr>
    </thead>
    <tbody>
      {#each values as value, index (index)}
        {@const inputId = `${idPrefix}-value-${index}`}
        {@const errorId = `${inputId}-error`}
        <tr>
          <td>
            <Input
              id={inputId}
              label={`Enum value ${index + 1}`}
              value={activeDrafts[index]?.text ?? jsonText(value)}
              disabled={readonly}
              aria-invalid={invalidValueIndexes.has(index) || undefined}
              aria-describedby={invalidValueIndexes.has(index) ? errorId : undefined}
              oninput={(event: Event) => setValue(index, (event.target as HTMLInputElement).value)}
            />
            {#if invalidValueIndexes.has(index)}
              <p id={errorId} class="cinder-jse-enum-editor__error" role="alert">
                {errorMessage(index)}
              </p>
            {/if}
          </td>
          <td class="cinder-jse-enum-editor__actions">
            <Button
              id={`${idPrefix}-remove-${index}`}
              variant="ghost"
              size="xs"
              disabled={readonly || invalidValueIndexes.size > 0 || index === 0}
              aria-label={`Move enum value ${index + 1} up`}
              onclick={() => moveValue(index, -1)}
            >
              Up
            </Button>
            <Button
              variant="ghost"
              size="xs"
              disabled={readonly || invalidValueIndexes.size > 0 || index === values.length - 1}
              aria-label={`Move enum value ${index + 1} down`}
              onclick={() => moveValue(index, 1)}
            >
              Down
            </Button>
            <Button
              variant="ghost"
              size="xs"
              disabled={readonly || invalidValueIndexes.size > 0 || values.length === 1}
              aria-label={`Remove enum value ${index + 1}`}
              onclick={() => void removeValue(index)}
            >
              Remove
            </Button>
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
  <p class="cinder-sr-only" aria-live="polite">{actionAnnouncement}</p>
  <Button variant="secondary" size="sm" disabled={readonly} onclick={addValue}
    >Add enum value</Button
  >
</div>
