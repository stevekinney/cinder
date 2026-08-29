<script lang="ts" module>
  /** @cinder
   * @category data-display
   * @status beta
   * @purpose Edits string key/value pairs and masks values selected as secrets.
   * @tag key-value-editor
   * @useWhen Editing headers, environment variables, or configuration fields.
   * @avoidWhen Values need rich structured content; use Table.
   * @rationale Nearest alternative: SecretValueField displays one secret; this owns pair editing.
   */
  export type { KeyValueEditorProps, KeyValueEntry } from './key-value-editor.types.ts';
</script>

<script lang="ts">
  import Grid from '../grid/grid.svelte';
  import Input from '../input/input.svelte';
  import SecretValueField from '../secret-value-field/secret-value-field.svelte';
  import { classNames } from '../../utilities/class-names.ts';
  import type { KeyValueEditorProps, KeyValueEntry } from './key-value-editor.types.ts';
  let {
    entries = $bindable([]),
    onValueChange,
    secret,
    addLabel = 'Add pair',
    removeLabel = (key) => `Remove ${key || 'pair'}`,
    class: className,
    ...rest
  }: KeyValueEditorProps = $props();
  let rows = $state<KeyValueEntry[]>(entries);
  function commit(next: KeyValueEntry[]) {
    rows = next;
    entries = next;
    onValueChange?.(next);
  }
  function update(index: number, field: 'key' | 'value', value: string) {
    commit(rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  }
</script>

<div {...rest} class={classNames('cinder-key-value-editor', className)}>
  <Grid
    columns="minmax(8rem, 1fr) minmax(12rem, 2fr) auto"
    gap="var(--cinder-space-2)"
    class="cinder-key-value-editor__rows"
    role="list"
  >
    {#each rows as row, index (index)}
      <div class="cinder-key-value-editor__row" role="listitem">
        <Input
          id={`key-value-editor-key-${index}`}
          label="Key"
          labelVisible={false}
          value={row.key}
          onValueChange={(next) => update(index, 'key', next)}
        />
        {#if secret?.(row.key)}<SecretValueField
            value={row.value}
            label={`${row.key || 'Value'} secret`}
          />{:else}<Input
            id={`key-value-editor-value-${index}`}
            label="Value"
            labelVisible={false}
            value={row.value}
            onValueChange={(next) => update(index, 'value', next)}
          />{/if}
        <button
          type="button"
          aria-label={removeLabel(row.key)}
          onclick={() => commit(rows.filter((_, i) => i !== index))}>Remove</button
        >
      </div>
    {/each}
  </Grid>
  <button type="button" onclick={() => commit([...rows, { key: '', value: '' }])}>{addLabel}</button
  >
</div>
