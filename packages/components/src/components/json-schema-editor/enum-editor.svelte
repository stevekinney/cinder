<script lang="ts" module>
  export type EnumEditorProps = {
    idPrefix: string;
    values: unknown[];
    readonly?: boolean;
    onValuesChange: (next: unknown[]) => void;
  };
</script>

<script lang="ts">
  import Button from '../button/button.svelte';
  import Input from '../input/input.svelte';

  let { idPrefix, values, readonly = false, onValuesChange }: EnumEditorProps = $props();

  let invalidValueIndexes = $state<Set<number>>(new Set());

  function jsonText(value: unknown): string {
    return JSON.stringify(value);
  }

  function setValue(index: number, text: string): void {
    try {
      const nextValue = JSON.parse(text) as unknown;
      const next = [...values];
      next[index] = nextValue;
      invalidValueIndexes = new Set([...invalidValueIndexes].filter((item) => item !== index));
      onValuesChange(next);
    } catch {
      invalidValueIndexes = new Set([...invalidValueIndexes, index]);
    }
  }

  function moveValue(index: number, direction: -1 | 1): void {
    const targetIndex = index + direction;
    if (readonly || targetIndex < 0 || targetIndex >= values.length) return;
    const next = [...values];
    [next[index], next[targetIndex]] = [next[targetIndex]!, next[index]!];
    onValuesChange(next);
  }

  function removeValue(index: number): void {
    if (readonly) return;
    onValuesChange(values.filter((_, itemIndex) => itemIndex !== index));
  }

  function addValue(): void {
    if (readonly) return;
    onValuesChange([...values, '']);
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
              value={jsonText(value)}
              disabled={readonly}
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
              variant="ghost"
              size="xs"
              disabled={readonly || index === 0}
              aria-label={`Move enum value ${index + 1} up`}
              onclick={() => moveValue(index, -1)}
            >
              Up
            </Button>
            <Button
              variant="ghost"
              size="xs"
              disabled={readonly || index === values.length - 1}
              aria-label={`Move enum value ${index + 1} down`}
              onclick={() => moveValue(index, 1)}
            >
              Down
            </Button>
            <Button
              variant="ghost"
              size="xs"
              disabled={readonly}
              aria-label={`Remove enum value ${index + 1}`}
              onclick={() => removeValue(index)}
            >
              Remove
            </Button>
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
  <Button variant="secondary" size="sm" disabled={readonly} onclick={addValue}
    >Add enum value</Button
  >
</div>
