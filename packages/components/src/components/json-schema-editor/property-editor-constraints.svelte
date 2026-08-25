<script lang="ts">
  import Collapsible from '@lostgradient/cinder/collapsible';
  import Input from '@lostgradient/cinder/input';
  import type { JsonSchemaObject } from './json-schema-editor-types.ts';

  type ConstraintPatch = (
    edits: Partial<JsonSchemaObject>,
    options?: { coalesceKey?: string; label?: string },
  ) => void;

  let {
    idPrefix,
    value,
    path,
    readonly,
    showString,
    showNumber,
    onPatch,
  }: {
    idPrefix: string;
    value: JsonSchemaObject;
    path: string;
    readonly: boolean;
    showString: boolean;
    showNumber: boolean;
    onPatch: ConstraintPatch;
  } = $props();

  const numberFields = [
    { key: 'minimum', label: 'Minimum' },
    { key: 'maximum', label: 'Maximum' },
    { key: 'exclusiveMinimum', label: 'Exclusive minimum' },
    { key: 'exclusiveMaximum', label: 'Exclusive maximum' },
    { key: 'multipleOf', label: 'Multiple of' },
  ] as const;

  function patchNumber(key: (typeof numberFields)[number]['key'], raw: string): void {
    const parsed = raw === '' ? undefined : Number(raw);
    onPatch(
      { [key]: parsed !== undefined && Number.isFinite(parsed) ? parsed : undefined },
      { coalesceKey: `${key}:${path}`, label: `edit ${key}` },
    );
  }

  function numberValue(key: (typeof numberFields)[number]['key']): string {
    const current = value[key];
    return typeof current === 'number' ? current.toString() : '';
  }
</script>

{#if showString}
  <Collapsible
    class="cinder-jse-section cinder-jse-section--collapsible"
    trigger="String constraints"
  >
    <div class="cinder-jse-section__body">
      <Input
        id={`${idPrefix}-minLength`}
        label="Min length"
        type="text"
        value={value.minLength?.toString() ?? ''}
        disabled={readonly}
        oninput={(event: Event) => {
          const raw = (event.target as HTMLInputElement).value;
          const parsed = raw === '' ? undefined : Number.parseInt(raw, 10);
          onPatch(
            { minLength: Number.isNaN(parsed) ? undefined : parsed },
            { coalesceKey: `minLength:${path}`, label: 'edit minLength' },
          );
        }}
      />
      <Input
        id={`${idPrefix}-maxLength`}
        label="Max length"
        type="text"
        value={value.maxLength?.toString() ?? ''}
        disabled={readonly}
        oninput={(event: Event) => {
          const raw = (event.target as HTMLInputElement).value;
          const parsed = raw === '' ? undefined : Number.parseInt(raw, 10);
          onPatch(
            { maxLength: Number.isNaN(parsed) ? undefined : parsed },
            { coalesceKey: `maxLength:${path}`, label: 'edit maxLength' },
          );
        }}
      />
      <Input
        id={`${idPrefix}-pattern`}
        label="Pattern (regex)"
        value={value.pattern ?? ''}
        disabled={readonly}
        variant="code"
        oninput={(event: Event) =>
          onPatch(
            { pattern: (event.target as HTMLInputElement).value || undefined },
            { coalesceKey: `pattern:${path}`, label: 'edit pattern' },
          )}
      />
      <Input
        id={`${idPrefix}-format`}
        label="Format"
        value={value.format ?? ''}
        disabled={readonly}
        oninput={(event: Event) =>
          onPatch(
            { format: (event.target as HTMLInputElement).value || undefined },
            { coalesceKey: `format:${path}`, label: 'edit format' },
          )}
      />
    </div>
  </Collapsible>
{/if}

{#if showNumber}
  <Collapsible
    class="cinder-jse-section cinder-jse-section--collapsible"
    trigger="Number constraints"
  >
    <div class="cinder-jse-section__body">
      {#each numberFields as field (field.key)}
        <Input
          id={`${idPrefix}-${field.key}`}
          label={field.label}
          value={numberValue(field.key)}
          disabled={readonly}
          oninput={(event: Event) =>
            patchNumber(field.key, (event.target as HTMLInputElement).value)}
        />
      {/each}
    </div>
  </Collapsible>
{/if}
