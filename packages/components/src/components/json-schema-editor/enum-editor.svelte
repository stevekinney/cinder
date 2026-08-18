<script lang="ts" module>
  export type EnumEditorProps = {
    idPrefix: string;
    path: string;
    values: unknown[];
    readonly?: boolean;
    onvalidationErrorcount?: ((count: number) => void) | undefined;
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
    readonly = false,
    onvalidationErrorcount,
    onValuesChange,
  }: EnumEditorProps = $props();

  let invalidValueIndexes = $state<Set<number>>(new Set());
  let draftTextByIndex = $state<Record<number, string>>({});
  let actionAnnouncement = $state('');
  let previousValues: unknown[] | null = null;
  let pendingLocalValues: unknown[] | null = null;

  $effect(() => onvalidationErrorcount?.(invalidValueIndexes.size));
  onDestroy(() => onvalidationErrorcount?.(0));

  $effect(() => {
    if (previousValues === null) {
      previousValues = values;
    } else if (values !== previousValues) {
      previousValues = values;
      const receivedLocalUpdate = values === pendingLocalValues;
      pendingLocalValues = null;
      if (!receivedLocalUpdate) {
        invalidValueIndexes = new Set();
        draftTextByIndex = {};
      }
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

  function commitValues(
    next: unknown[],
    options: { coalesceKey?: string; label?: string } | undefined = undefined,
  ): void {
    pendingLocalValues = next;
    onValuesChange(next, options);
  }

  $effect(() => {
    const validIndexes = [...invalidValueIndexes].filter((index) => index < values.length);
    if (validIndexes.length !== invalidValueIndexes.size)
      invalidValueIndexes = new Set(validIndexes);
  });

  function setValue(index: number, text: string): void {
    draftTextByIndex = { ...draftTextByIndex, [index]: text };
    try {
      const nextValue = JSON.parse(text) as unknown;
      if (!isJsonValue(nextValue) || hasDuplicateValue(nextValue, index)) {
        throw new Error('Enum values must be unique finite JSON values.');
      }
      const next = [...values];
      next[index] = nextValue;
      invalidValueIndexes = new Set([...invalidValueIndexes].filter((item) => item !== index));
      const { [index]: _committedDraft, ...remainingDrafts } = draftTextByIndex;
      draftTextByIndex = remainingDrafts;
      commitValues(next, { coalesceKey: `enum:${path}:${index}`, label: 'edit enum value' });
    } catch {
      invalidValueIndexes = new Set([...invalidValueIndexes, index]);
    }
  }

  function moveValue(index: number, direction: -1 | 1): void {
    const targetIndex = index + direction;
    if (readonly || invalidValueIndexes.size > 0 || targetIndex < 0 || targetIndex >= values.length)
      return;
    const next = [...values];
    [next[index], next[targetIndex]] = [next[targetIndex]!, next[index]!];
    invalidValueIndexes = new Set(
      [...invalidValueIndexes].map((item) =>
        item === index ? targetIndex : item === targetIndex ? index : item,
      ),
    );
    commitValues(next);
    actionAnnouncement = `Moved enum value ${index + 1} to position ${targetIndex + 1} of ${values.length}.`;
  }

  async function removeValue(index: number): Promise<void> {
    if (readonly || invalidValueIndexes.size > 0 || values.length === 1) return;
    invalidValueIndexes = new Set(
      [...invalidValueIndexes]
        .filter((item) => item !== index)
        .map((item) => (item > index ? item - 1 : item)),
    );
    const focusIndex = Math.min(index, values.length - 2);
    commitValues(values.filter((_, itemIndex) => itemIndex !== index));
    await tick();
    document.getElementById(`${idPrefix}-remove-${focusIndex}`)?.focus();
  }

  function addValue(): void {
    if (readonly) return;
    let nextValue = '';
    let suffix = 1;
    while (hasDuplicateValue(nextValue, -1)) nextValue = `value ${suffix++}`;
    commitValues([...values, nextValue]);
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
              value={draftTextByIndex[index] ?? jsonText(value)}
              disabled={readonly}
              aria-invalid={invalidValueIndexes.has(index) || undefined}
              aria-describedby={invalidValueIndexes.has(index) ? errorId : undefined}
              oninput={(event: Event) => setValue(index, (event.target as HTMLInputElement).value)}
            />
            {#if invalidValueIndexes.has(index)}
              <p id={errorId} class="cinder-jse-enum-editor__error" role="alert">
                Enter a valid JSON value.
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
