<script lang="ts" module>
  /** @cinder
   * @category data-display
   * @status beta
   * @purpose Edits string key/value pairs and masks values selected as secrets.
   * @tag key-value-editor
   * @useWhen Editing headers, environment variables, or configuration fields.
   * @avoidWhen Values need rich structured content; use Table.
   * @related secret-value-field, table
   * @rationale Nearest alternative: SecretValueField displays one secret; this owns pair editing.
   */
  export type { KeyValueEditorProps, KeyValueEntry } from './key-value-editor.types.ts';
</script>

<script lang="ts">
  import { tick } from 'svelte';
  import { default as Button } from '../button/index.ts';
  import { default as Grid } from '../grid/index.ts';
  import { default as Input } from '../input/index.ts';
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
  const instanceId = $props.id();
  let rows = $state<KeyValueEntry[]>(entries);
  let editorElement = $state<HTMLDivElement>();
  let lastExternalEntries = entries;
  // The id of the row whose key input, value input, or remove control held
  // focus immediately before the current `entries` update patches the DOM —
  // captured in `$effect.pre` below, since a parent-removed row's DOM node
  // may have already lost focus by the time the regular `$effect` runs.
  let focusedRowIdBeforePatch: string | null = null;
  function commit(next: KeyValueEntry[]) {
    rows = next;
    lastExternalEntries = next;
    entries = next;
    onValueChange?.(next);
  }
  function update(id: string, field: 'key' | 'value', value: string) {
    commit(rows.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
  }
  function focusedRowId(): string | null {
    const active = document.activeElement;
    if (!active || !editorElement?.contains(active)) return null;
    return active.closest<HTMLElement>('[data-cinder-row-id]')?.dataset['cinderRowId'] ?? null;
  }
  async function focusRemoveFallback(removedIndex: number): Promise<void> {
    await tick();
    const target =
      rows.length === 0
        ? editorElement?.querySelector<HTMLButtonElement>('.cinder-key-value-editor__add')
        : editorElement?.querySelectorAll<HTMLButtonElement>(
            '.cinder-key-value-editor__row button',
          )[Math.min(removedIndex - 1 >= 0 ? removedIndex - 1 : removedIndex, rows.length - 1)];
    target?.focus();
  }
  async function addRow(): Promise<void> {
    const newIndex = rows.length;
    commit([...rows, { id: crypto.randomUUID(), key: '', value: '' }]);
    await tick();
    const inputElements = editorElement?.querySelectorAll<HTMLInputElement>('input');
    inputElements?.[newIndex * 2]?.focus({ preventScroll: true });
  }
  async function removeRow(index: number): Promise<void> {
    commit(rows.filter((_, i) => i !== index));
    await focusRemoveFallback(index);
  }
  $effect.pre(() => {
    void entries;
    focusedRowIdBeforePatch = focusedRowId();
  });
  $effect(() => {
    if (entries === lastExternalEntries) return;
    const previousRows = rows;
    rows = entries;
    lastExternalEntries = entries;

    const focusedId = focusedRowIdBeforePatch;
    if (focusedId === null || rows.some((row) => row.id === focusedId)) return;

    // The parent removed the row that held focus: fall back to the previous
    // row's Remove control, else the next row's, else Add pair — the same
    // policy user-triggered removal already uses.
    const formerIndex = previousRows.findIndex((row) => row.id === focusedId);
    if (formerIndex !== -1) void focusRemoveFallback(formerIndex);
  });
</script>

<div bind:this={editorElement} {...rest} class={classNames('cinder-key-value-editor', className)}>
  <Grid columns={1} gap="var(--cinder-space-2)" class="cinder-key-value-editor__rows" role="list">
    {#each rows as row, index (row.id)}
      <Grid
        columns="minmax(8rem, 1fr) minmax(12rem, 2fr) auto"
        gap="var(--cinder-space-2)"
        narrowCollapseEnabled
        class="cinder-key-value-editor__row"
        role="listitem"
        data-cinder-row-id={row.id}
      >
        <Input
          id={`${instanceId}-key-${row.id}`}
          label="Key"
          labelVisible={false}
          value={row.key}
          onValueChange={(next) => update(row.id, 'key', next)}
        />
        <Input
          id={`${instanceId}-value-${row.id}`}
          label="Value"
          labelVisible={false}
          type={secret?.(row.key) ? 'password' : 'text'}
          value={row.value}
          onValueChange={(next) => update(row.id, 'value', next)}
        />
        <Button
          size="sm"
          variant="ghost"
          aria-label={removeLabel(row.key)}
          onclick={() => removeRow(index)}>Remove</Button
        >
      </Grid>
    {/each}
  </Grid>
  <Button
    type="button"
    variant="secondary"
    size="sm"
    class="cinder-key-value-editor__add"
    onclick={addRow}>{addLabel}</Button
  >
</div>
