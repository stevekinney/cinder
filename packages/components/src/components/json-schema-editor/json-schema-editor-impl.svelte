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

  /**
   * Mac detection for keyboard-shortcut routing. `navigator.platform` is
   * deprecated; prefer `navigator.userAgentData?.platform` and fall back to
   * `platform` only when the modern accessor is unavailable (Firefox, Safari).
   * Hoisted out of the keydown handler so it isn't re-evaluated per keystroke.
   */
  function detectMacPlatform(): boolean {
    if (typeof navigator === 'undefined') return false;
    const navigatorWithUserAgentData = navigator as Navigator & {
      userAgentData?: { platform?: string };
    };
    const modernPlatform = navigatorWithUserAgentData.userAgentData?.platform;
    if (typeof modernPlatform === 'string' && modernPlatform.length > 0) {
      return /Mac/.test(modernPlatform);
    }
    return /Mac/.test(navigator.platform);
  }

  const isMacPlatform = detectMacPlatform();
</script>

<script lang="ts">
  import { untrack } from 'svelte';
  import { classNames } from '../../utilities/class-names.ts';
  import { useAnnouncer } from '../../utilities/use-announcer.svelte.ts';
  import Badge from '../badge/badge.svelte';
  import Tab from '../tab/tab.svelte';
  import TabList from '../tab-list/tab-list.svelte';
  import TabPanel from '../tab-panel/tab-panel.svelte';
  import Tabs from '../tabs/tabs.svelte';

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

  // Build state container once. Schema reloads happen via `schemaKey`. Other
  // mutable props (readonly, draftOverride, callback handlers) are kept in
  // sync after mount via the $effects below — without that, parents passing
  // inline lambdas would have their handlers captured stale at construction.
  // The container is built exactly once; read the seed props untracked so this
  // construction never becomes a reactive dependency. Later prop changes are
  // applied through the $effects below (readonly/draftOverride) and schemaKey.
  const stateOptions: Parameters<typeof createEditorState>[0] = untrack(() => {
    const options: Parameters<typeof createEditorState>[0] = {
      schema,
      readonly,
      onchange: (event) => onchange?.(event),
      onrevert: (event) => onrevert?.(event),
      onvalidate: (result) => onvalidate?.(result),
    };
    if (original !== undefined) options.original = original;
    if (maxHistory !== undefined) options.maxHistory = maxHistory;
    if (draftOverride !== undefined) options.draftOverride = draftOverride;
    return options;
  });

  const state = createEditorState(stateOptions);

  // Sync `readonly` into the state container whenever the prop changes.
  // `setReadonly` only assigns the flag, so re-applying the construction-seeded
  // value on the initial effect run is a harmless no-op — no sentinel needed.
  $effect(() => {
    state.setReadonly(readonly);
  });

  // Sync `draftOverride` into the state container when the *prop* changes.
  // Unlike `setReadonly`, `setDraftOverride` re-runs validation and emits an
  // `onvalidate` event, so we must skip the initial effect run (the value was
  // already seeded at construction) to avoid a spurious mount-time validation
  // emit. The sentinel detects a genuine prop transition; it is not guarding a
  // reactive loop — the setter writes closure-private state, never back to the
  // `draftOverride` prop.
  let lastDraftOverride: JsonSchemaKnownDraft | undefined = untrack(() => draftOverride);
  $effect(() => {
    if (draftOverride !== lastDraftOverride) {
      lastDraftOverride = draftOverride;
      state.setDraftOverride(draftOverride);
    }
  });

  // Tear down debounce timers on unmount so stale callbacks don't fire after
  // the parent unmounts the editor.
  $effect(() => {
    return () => state.destroy();
  });

  // schemaKey-triggered reset. Track the previous key explicitly so we don't
  // reload on initial mount (state was already seeded above) or on re-renders
  // that don't change the key. Only `schemaKey` is a tracked dependency — the
  // documented contract is "change schemaKey to reset". `schema`/`original` are
  // read untracked so a parent live-patching those props (without changing the
  // key) does not silently re-run this effect; when the key *does* change we
  // still read their current values fresh inside the untracked block.
  let lastSchemaKey: string | undefined = untrack(() => schemaKey);
  $effect(() => {
    if (schemaKey !== lastSchemaKey) {
      lastSchemaKey = schemaKey;
      untrack(() => {
        state.reload(schema, original);
      });
      announcer.announce('Schema reloaded');
    }
  });

  // Sync the bindable `view` prop into `state.view`. The flow is intentionally
  // one-directional: `view` is the single source of truth. The parent's
  // `bind:view` and the `Tabs` `bind:value={view}` both write the prop directly,
  // and `state` never changes its view autonomously (`reload()` does not touch
  // `view`), so there is no state→prop direction to mirror. A write-back effect
  // that mirrored `state.view` onto the prop would force an extra render of the
  // tab tree on every unrelated state change; if a future code path ever mutates
  // `state.view` independently, that path must also update the `view` prop (or
  // expose an onViewChange callback) rather than rely on a mirror effect here.
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
    const meta = isMacPlatform ? event.metaKey : event.ctrlKey;
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

<!--
  The keydown handler implements editor-wide undo/redo shortcuts (Cmd/Ctrl+Z,
  Shift+Z, Y). It listens on the region landmark and acts on keystrokes that
  bubble up from the focusable editor surfaces (form fields, JSON textarea,
  diff view) inside it, so the noninteractive-element-interactions rule is a
  false positive — `role="region"` is the correct landmark for the editor.
-->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
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
      <Tab value="diff">
        Diff{#if state.hasChanges}<span class="cinder-sr-only">, has changes</span>{/if}
        {#snippet trailing()}
          {#if state.hasChanges}
            <Badge variant="neutral" aria-hidden="true">●</Badge>
          {/if}
        {/snippet}
      </Tab>
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
