<script lang="ts" module>
  import type {
    JsonSchemaEditorChangeEvent,
    JsonSchemaEditorMode,
    JsonSchemaEditorView,
    JsonSchemaKnownDraft,
    JsonSchemaValue,
  } from './json-schema-editor-types.ts';

  export type { JsonSchemaEditorMode, JsonSchemaEditorView };
  export type { JsonSchemaEditorProps } from './json-schema-editor.types.ts';

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
  import type { EnumDraft } from './enum-editor.svelte';
  import FormView from './form-view.svelte';
  import { createEditorState } from './json-schema-editor-state.svelte.ts';
  import JsonSchemaToolbar from './json-schema-toolbar.svelte';
  import type { JsonSchemaEditorProps } from './json-schema-editor.types.ts';
  import { normaliseSchemaInput } from './json-schema-validator.ts';
  import JsonView from './json-view.svelte';

  let {
    id,
    schema,
    defaultSchema,
    original,
    schemaKey,
    view = $bindable<JsonSchemaEditorView>('form'),
    readonly = false,
    maxHistory,
    draftOverride,
    onSchemaChange,
    onValueChangeRequest,
    onRevert,
    onValidate,
    class: className,
  }: JsonSchemaEditorProps = $props();

  const announcer = useAnnouncer();

  const initialSchema = untrack<JsonSchemaValue | string>(() => schema ?? defaultSchema ?? {});
  const controlled = $derived(schema !== undefined && onValueChangeRequest !== undefined);

  // Build state container once. Schema reloads happen via `schemaKey`. Other
  // mutable props (readonly, draftOverride, callback handlers) are kept in
  // sync after mount via the $effects below — without that, parents passing
  // inline lambdas would have their handlers captured stale at construction.
  // The container is built exactly once; read the seed props untracked so this
  // construction never becomes a reactive dependency. Later prop changes are
  // applied through the $effects below (readonly/draftOverride) and schemaKey.
  const stateOptions: Parameters<typeof createEditorState>[0] = untrack(() => {
    const options: Parameters<typeof createEditorState>[0] = {
      schema: initialSchema,
      readonly,
      controlled,
      onSchemaChange: handleSchemaChange,
      onRevert: (event) => onRevert?.(event),
      onValidate: (result) => onValidate?.(result),
    };
    if (original !== undefined) options.original = original;
    if (maxHistory !== undefined) options.maxHistory = maxHistory;
    if (draftOverride !== undefined) options.draftOverride = draftOverride;
    return options;
  });

  let localValidationErrorCount = $state(0);
  let enumDrafts = $state<Record<string, Record<number, EnumDraft>>>({});
  let enumDraftHistoryRevision = $state(0);
  const editorState = createEditorState(stateOptions);
  const toolbarValidationErrorCount = $derived(view === 'form' ? localValidationErrorCount : 0);

  function schemaMatchesCommitted(input: JsonSchemaValue | string): boolean {
    const normalised = normaliseSchemaInput(input);
    return normalised.ok && normalised.canonicalText === editorState.committedCanonicalText;
  }

  function synchroniseControlledSchema(
    input: JsonSchemaValue | string,
    rejectedAction?: 'commit' | 'undo' | 'redo' | 'revert',
  ) {
    if (schemaMatchesCommitted(input)) return;
    if (rejectedAction !== undefined) {
      const reconciledHistory =
        (rejectedAction === 'commit' &&
          (editorState.restorePendingControlledHistoryWhenMatches(input) ||
            editorState.discardCurrentCommitWhenPreviousMatches(input))) ||
        (rejectedAction === 'undo' && editorState.restoreNextCommitWhenMatches(input)) ||
        (rejectedAction === 'redo' && editorState.restorePreviousCommitWhenMatches(input)) ||
        (rejectedAction === 'revert' &&
          editorState.restoreControlledRevertWhenCommittedMatches(input));
      if (reconciledHistory) {
        enumDrafts = {};
        return;
      }
    }
    editorState.synchronise(input);
    enumDrafts = {};
  }

  function controlledSchemaText(input: JsonSchemaValue | string): string {
    const normalised = normaliseSchemaInput(input);
    return normalised.ok ? normalised.canonicalText : normalised.rawText;
  }

  function schemaMatchesChangeEvent(
    input: JsonSchemaValue | string,
    event: JsonSchemaEditorChangeEvent,
  ): boolean {
    return controlledSchemaText(input) === event.jsonString;
  }

  function isSchemaInput(input: unknown): input is JsonSchemaValue | string {
    const hasSchemaShape =
      typeof input === 'string' ||
      typeof input === 'boolean' ||
      (typeof input === 'object' && input !== null && !Array.isArray(input));
    return hasSchemaShape && normaliseSchemaInput(input as JsonSchemaValue | string).ok;
  }

  type PendingControlledChange = JsonSchemaEditorChangeEvent & {
    action: 'commit' | 'undo' | 'redo' | 'revert' | undefined;
  };
  let pendingControlledChange = $state<PendingControlledChange | undefined>();
  let pendingControlledChangeVersion = 0;
  let lastSchemaKey: string | undefined = untrack(() => schemaKey);
  let controlledSchemaAuthority = untrack<JsonSchemaValue | string | undefined>(() =>
    controlled && schema !== undefined ? controlledSchemaText(schema) : undefined,
  );

  function discardPendingControlledChange() {
    pendingControlledChange = undefined;
    pendingControlledChangeVersion += 1;
  }

  function settleControlledChange(input: JsonSchemaValue | string) {
    const pendingChange = pendingControlledChange;
    const accepted = pendingChange !== undefined && schemaMatchesChangeEvent(input, pendingChange);
    const previousAuthority = controlledSchemaAuthority ?? schema;
    const unchangedAuthority =
      previousAuthority !== undefined &&
      controlledSchemaText(previousAuthority) === controlledSchemaText(input);

    controlledSchemaAuthority = controlledSchemaText(input);
    synchroniseControlledSchema(
      controlledSchemaAuthority,
      pendingChange !== undefined && unchangedAuthority ? pendingChange.action : undefined,
    );
    discardPendingControlledChange();

    if (accepted) {
      editorState.acceptPendingControlledCommit();
      if (pendingChange.action === 'revert') editorState.finaliseControlledRevert();
      onSchemaChange?.(pendingChange);
      if (pendingChange.action === 'undo') announcer.announce('Undid last edit');
      if (pendingChange.action === 'redo') announcer.announce('Redid last edit');
      if (pendingChange.action === 'revert') announcer.announce('Reverted to original schema');
      return;
    }

    const normalised = normaliseSchemaInput(input);
    if (pendingChange !== undefined && !unchangedAuthority && normalised.ok) {
      editorState.replacePendingControlledCommit(input);
      // Parse canonical text a second time so a mutable replacement supplied by
      // the parent cannot become an observer-owned reference.
      const snapshot = normaliseSchemaInput(normalised.canonicalText);
      if (snapshot.ok) {
        onSchemaChange?.({ schema: snapshot.schema, jsonString: snapshot.canonicalText });
      }
    }
  }

  function rejectControlledChange(changeVersion: number) {
    if (pendingControlledChangeVersion !== changeVersion) return;
    const pendingChange = pendingControlledChange;
    discardPendingControlledChange();
    const authoritativeSchema = controlledSchemaAuthority ?? schema;
    if (authoritativeSchema !== undefined) {
      synchroniseControlledSchema(authoritativeSchema, pendingChange?.action);
    }
  }

  function handleSchemaChange(event: JsonSchemaEditorChangeEvent) {
    if (!controlled || schema === undefined) {
      onSchemaChange?.(event);
      return;
    }

    // A schemaKey transition owns a full document reset. Let its dedicated
    // effect cancel any pending request before this effect can settle an old
    // request against the new document's schema.
    if (schemaKey !== lastSchemaKey) return;

    if (pendingControlledChange !== undefined) {
      editorState.restorePendingControlledCommit(pendingControlledChange.jsonString);
      return;
    }

    const eventSnapshot = normaliseSchemaInput(event.jsonString);
    if (!eventSnapshot.ok) return;
    pendingControlledChange = {
      schema: eventSnapshot.schema,
      jsonString: eventSnapshot.canonicalText,
      action: editorState.lastChangeAction,
    };
    const changeVersion = ++pendingControlledChangeVersion;
    let settlement: unknown;
    try {
      settlement = onValueChangeRequest?.({
        schema: eventSnapshot.schema,
        jsonString: eventSnapshot.canonicalText,
      });
    } catch (error) {
      rejectControlledChange(changeVersion);
      throw error;
    }
    if (settlement !== undefined) {
      void Promise.resolve(settlement)
        .then((input) => {
          if (pendingControlledChangeVersion !== changeVersion) return;
          if (isSchemaInput(input)) settleControlledChange(input);
          else rejectControlledChange(changeVersion);
        })
        .catch(() => {
          rejectControlledChange(changeVersion);
        });
    }

    // The parent can validate a request asynchronously. Keep the optimistic
    // state and its history until it supplies the authoritative next value;
    // reject any later local commit so it cannot overwrite that request.
  }

  // Leave the sentinel empty until the editor is actually controlled. A
  // schema-only editor owns its local state; if a parent later supplies the
  // request handler, the first controlled effect must reconcile that state to
  // the parent's schema even when the schema prop itself did not change.
  let lastObservedControlledSchemaText = untrack(() =>
    controlled && schema !== undefined ? controlledSchemaText(schema) : undefined,
  );
  let lastObservedControlledSchema = untrack(() => schema);
  $effect(() => {
    if (!controlled || schema === undefined) {
      discardPendingControlledChange();
      lastObservedControlledSchemaText = undefined;
      lastObservedControlledSchema = undefined;
      controlledSchemaAuthority = undefined;
      return;
    }

    const nextControlledSchemaText = controlledSchemaText(schema);
    if (
      nextControlledSchemaText === lastObservedControlledSchemaText &&
      schema === lastObservedControlledSchema
    ) {
      return;
    }
    lastObservedControlledSchemaText = nextControlledSchemaText;
    lastObservedControlledSchema = schema;
    untrack(() => settleControlledChange(schema));
  });

  // Keep the externally controlled readonly prop in sync after mount.
  $effect(() => {
    editorState.setReadonly(readonly);
  });

  $effect(() => {
    editorState.setControlled(controlled);
  });

  // Sync `draftOverride` into the state container when the *prop* changes.
  // Unlike `setReadonly`, `setDraftOverride` re-runs validation and emits an
  // `onValidate` event, so we must skip the initial effect run (the value was
  // already seeded at construction) to avoid a spurious mount-time validation
  // emit. The sentinel detects a genuine prop transition; it is not guarding a
  // reactive loop — the setter writes closure-private state, never back to the
  // `draftOverride` prop.
  let lastDraftOverride: JsonSchemaKnownDraft | undefined = untrack(() => draftOverride);
  $effect(() => {
    if (draftOverride !== lastDraftOverride) {
      lastDraftOverride = draftOverride;
      editorState.setDraftOverride(draftOverride);
    }
  });

  // Tear down debounce timers on unmount so stale callbacks don't fire after
  // the parent unmounts the editor.
  $effect(() => {
    return () => {
      discardPendingControlledChange();
      editorState.destroy();
    };
  });

  // schemaKey-triggered reset. Track the previous key explicitly so we don't
  // reload on initial mount (state was already seeded above) or on re-renders
  // that don't change the key. Only `schemaKey` is a tracked dependency — the
  // documented contract is "change schemaKey to reset". `schema`/`original` are
  // read untracked so a parent live-patching those props (without changing the
  // key) does not silently re-run this effect; when the key *does* change we
  // still read their current values fresh inside the untracked block.
  $effect(() => {
    if (schemaKey !== lastSchemaKey) {
      lastSchemaKey = schemaKey;
      untrack(() => {
        discardPendingControlledChange();
        const reloadSchema = schema;
        controlledSchemaAuthority = controlled ? schema : undefined;
        lastObservedControlledSchemaText =
          controlled && schema !== undefined ? controlledSchemaText(schema) : undefined;
        lastObservedControlledSchema = schema;
        editorState.reload(reloadSchema ?? defaultSchema ?? {}, original);
        enumDrafts = {};
      });
      announcer.announce('Schema reloaded');
    }
  });

  // Sync the bindable `view` prop into `editorState.view`. The flow is intentionally
  // one-directional: `view` is the single source of truth. The parent's
  // `bind:view` and the `Tabs` `bind:value={view}` both write the prop directly,
  // and `state` never changes its view autonomously (`reload()` does not touch
  // `view`), so there is no state→prop direction to mirror. A write-back effect
  // that mirrored `editorState.view` onto the prop would force an extra render of the
  // tab tree on every unrelated state change; if a future code path ever mutates
  // `editorState.view` independently, that path must also update the `view` prop (or
  // expose an onViewChange callback) rather than rely on a mirror effect here.
  $effect(() => {
    if (editorState.view !== view) editorState.setView(view);
  });

  // Action handlers used by the toolbar.
  function handleUndo() {
    if (editorState.readonly || !editorState.canUndo) return;
    enumDraftHistoryRevision += 1;
    const label = editorState.undo();
    if (!controlled) announcer.announce(label ? `Undid: ${label}` : 'Undid last edit');
  }

  function handleRedo() {
    if (editorState.readonly || !editorState.canRedo) return;
    enumDraftHistoryRevision += 1;
    const label = editorState.redo();
    if (!controlled) announcer.announce(label ? `Redid: ${label}` : 'Redid edit');
  }

  function handleRevert() {
    if (controlled && editorState.originalSchema === null) return;
    enumDrafts = {};
    if (controlled) editorState.beginControlledRevert();
    else editorState.revert();
    if (!controlled) announcer.announce('Reverted to original schema');
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
  <JsonSchemaToolbar
    state={editorState}
    localValidationErrorCount={toolbarValidationErrorCount}
    canRevert={!(controlled && editorState.originalSchema === null)}
    onUndo={handleUndo}
    onRedo={handleRedo}
    onRevert={handleRevert}
  />

  <Tabs bind:value={view}>
    <TabList label="Editor view">
      <Tab value="form">Form</Tab>
      <Tab value="json">JSON</Tab>
      <Tab value="diff">
        Diff{#if editorState.hasDiffChanges}<span class="cinder-sr-only">, has changes</span>{/if}
        {#snippet trailing()}
          {#if editorState.hasDiffChanges}
            <Badge variant="neutral" aria-hidden="true">●</Badge>
          {/if}
        {/snippet}
      </Tab>
    </TabList>

    <TabPanel value="form">
      <FormView
        state={editorState}
        idPrefix={`${id}-form`}
        {enumDrafts}
        historyRevision={enumDraftHistoryRevision}
        onvalidationErrorcount={(count) => (localValidationErrorCount = count)}
        onEnumDraftsChange={(next) => (enumDrafts = next)}
        onApplyJsonDraft={async () => {
          if (await editorState.applyJsonDraft()) enumDrafts = {};
        }}
      />
    </TabPanel>
    <TabPanel value="json">
      <JsonView
        state={editorState}
        idPrefix={`${id}-json`}
        editorId={id}
        {readonly}
        onApply={() => (enumDrafts = {})}
      />
    </TabPanel>
    <TabPanel value="diff">
      <DiffView state={editorState} />
    </TabPanel>
  </Tabs>
</div>
