<script lang="ts" module>
  import type {
    JsonSchemaEditorChangeEvent,
    JsonSchemaEditorMode,
    JsonSchemaEditorRevertEvent,
    JsonSchemaEditorView,
    JsonSchemaKnownDraft,
    JsonSchemaValidationResult,
    JsonSchemaValue,
  } from './json-schema-editor-types.ts';

  export type JsonSchemaEditorProps = {
    /** Required for ARIA wiring. */
    id: string;
    /** The schema being edited. May be a string (JSON text) or pre-parsed value. */
    schema: JsonSchemaValue | string;
    /** Optional explicit baseline; defaults to the initial `schema`. */
    original?: JsonSchemaValue | string;
    /** Changing this triggers a full reset (history clears). */
    schemaKey?: string;
    /** Active view: form / json / diff. Bindable. */
    view?: JsonSchemaEditorView;
    /** Read-only mode disables all mutations. */
    readonly?: boolean;
    /** Maximum history entries (default 100). */
    maxHistory?: number;
    /** Force a draft override regardless of $schema. */
    draftOverride?: JsonSchemaKnownDraft;
    onchange?: (event: JsonSchemaEditorChangeEvent) => void;
    onrevert?: (event: JsonSchemaEditorRevertEvent) => void;
    onvalidate?: (result: JsonSchemaValidationResult) => void;
    class?: string;
  };

  export type { JsonSchemaEditorMode, JsonSchemaEditorView };
</script>

<script lang="ts">
  import { classNames } from '../../utilities/class-names.ts';
  import { useAnnouncer } from '../../utilities/use-announcer.svelte.ts';
  import Tab from '../tab.svelte';
  import TabList from '../tab-list.svelte';
  import TabPanel from '../tab-panel.svelte';
  import Tabs from '../tabs.svelte';

  import DiffView from './diff-view.svelte';
  import FormView from './form-view.svelte';
  import { createEditorState } from './json-schema-editor-state.svelte.ts';
  import JsonSchemaToolbar from './json-schema-toolbar.svelte';
  import JsonView from './json-view.svelte';

  let {
    id,
    schema,
    original,
    schemaKey,
    view = $bindable<JsonSchemaEditorView>('form'),
    readonly = false,
    maxHistory,
    draftOverride,
    onchange,
    onrevert,
    onvalidate,
    class: className,
  }: JsonSchemaEditorProps = $props();

  const announcer = useAnnouncer();

  // Build state container once. We deliberately pass through the snapshot of
  // initial props; further updates flow through `state.reload` when
  // `schemaKey` changes (round-3 finding #10).
  const stateOptions: Parameters<typeof createEditorState>[0] = {
    schema,
    readonly,
  };
  if (original !== undefined) stateOptions.original = original;
  if (maxHistory !== undefined) stateOptions.maxHistory = maxHistory;
  if (draftOverride !== undefined) stateOptions.draftOverride = draftOverride;
  if (onchange) stateOptions.onchange = onchange;
  if (onrevert) stateOptions.onrevert = onrevert;
  if (onvalidate) stateOptions.onvalidate = onvalidate;

  const state = createEditorState(stateOptions);

  // schemaKey-triggered reset. Track the previous key explicitly so we don't
  // reload on initial mount (state was already seeded above) or on re-renders
  // that don't change the key.
  let lastSchemaKey: string | undefined = schemaKey;
  $effect(() => {
    if (schemaKey !== lastSchemaKey) {
      lastSchemaKey = schemaKey;
      state.reload(schema, original);
      announcer.announce('Schema reloaded');
    }
  });

  // Forward bindable view <-> state.view.
  $effect(() => {
    if (state.view !== view) state.setView(view);
  });

  // Action handlers used by the toolbar.
  function handleUndo() {
    const label = state.undo();
    announcer.announce(label ? `Undid: ${label}` : 'Undid last edit');
  }

  function handleRedo() {
    const label = state.redo();
    announcer.announce(label ? `Redid: ${label}` : 'Redid edit');
  }

  function handleRevert() {
    state.revert();
    announcer.announce('Reverted to original schema');
  }

  // Editor-level keyboard shortcuts: only fire when focus isn't inside an
  // editable element so native text undo continues to work in inputs.
  function isEditableTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    return target.isContentEditable;
  }

  function onKeyDown(event: KeyboardEvent) {
    const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform);
    const meta = isMac ? event.metaKey : event.ctrlKey;
    if (!meta) return;
    if (isEditableTarget(event.target)) return;

    const key = event.key.toLowerCase();
    if (key === 'z' && !event.shiftKey) {
      event.preventDefault();
      handleUndo();
    } else if ((key === 'z' && event.shiftKey) || key === 'y') {
      event.preventDefault();
      handleRedo();
    }
  }
</script>

<div
  {id}
  class={classNames('cinder-jse', className)}
  data-cinder-jse=""
  onkeydown={onKeyDown}
  role="region"
  aria-label="JSON Schema editor"
>
  <JsonSchemaToolbar {state} onUndo={handleUndo} onRedo={handleRedo} onRevert={handleRevert} />

  <Tabs bind:value={view}>
    <TabList label="Editor view">
      <Tab value="form">Form</Tab>
      <Tab value="json">JSON</Tab>
      <Tab value="diff">Diff{state.hasChanges ? ' •' : ''}</Tab>
    </TabList>

    <TabPanel value="form">
      <FormView {state} idPrefix={`${id}-form`} />
    </TabPanel>
    <TabPanel value="json">
      <JsonView {state} idPrefix={`${id}-json`} />
    </TabPanel>
    <TabPanel value="diff">
      <DiffView {state} />
    </TabPanel>
  </Tabs>
</div>
