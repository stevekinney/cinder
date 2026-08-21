<script lang="ts" module>
  import type { EditorState } from './json-schema-editor-state.types.ts';

  export type JsonViewProps = {
    state: EditorState;
    idPrefix: string;
    editorId: string;
    readonly: boolean;
    onApply?: (() => void) | undefined;
    class?: string;
  };
</script>

<script lang="ts">
  import { tick } from 'svelte';
  import { classNames } from '../../utilities/class-names.ts';
  import Alert from '../alert/alert.svelte';
  import Badge from '../badge/badge.svelte';
  import Button from '../button/button.svelte';
  import CodeBlock from '@lostgradient/cinder/code-block';
  import Textarea from '../textarea/textarea.svelte';

  import type { JsonSchemaValidationError } from './json-schema-editor-types.ts';
  import { tryParseJson, validateMetaSchema } from './json-schema-validator.ts';

  // Aliased to `editorState`, not `state` — a local variable literally named
  // `state` shadows the `$state` rune identifier, so `$state(...)` below
  // would compile as a legacy store auto-subscription to that variable
  // instead of the rune call. json-schema-toolbar.svelte uses the same
  // alias for the same reason.
  let {
    state: editorState,
    idPrefix,
    editorId,
    readonly,
    onApply,
    class: className,
  }: JsonViewProps = $props();

  async function applyDraft(): Promise<void> {
    if (isReadonly) return;
    if (await editorState.applyJsonDraft()) {
      await finishEditing();
      onApply?.();
    }
  }

  // Parse is synchronous; the meta-schema check is not (validateMetaSchema
  // dynamically imports Ajv), so it's tracked as state updated from an
  // effect rather than a $derived. The state container only debounces
  // validation against the *committed* schema; this runs an immediate check
  // on the *draft* so the user gets feedback on the current text without
  // waiting for the debounce window.
  const draftParse = $derived(tryParseJson(editorState.jsonDraftText));

  let draftMeta = $state<{ valid: boolean; errors: JsonSchemaValidationError[] } | null>(null);

  $effect(() => {
    const parse = draftParse;
    const activeDraft = editorState.activeDraft;

    if (!parse.ok) {
      draftMeta = null;
      return;
    }

    // Reset before validating the new draft — otherwise a previously-valid
    // result lingers until this resolves, which can briefly enable Apply
    // and hide errors for content that hasn't actually been checked yet.
    draftMeta = null;

    // Guard against out-of-order resolution: if the draft changes again
    // before this validation call resolves, ignore the stale result.
    let cancelled = false;
    void validateMetaSchema(parse.value, activeDraft).then((result) => {
      if (!cancelled) draftMeta = result;
    });
    return () => {
      cancelled = true;
    };
  });

  const draftErrorMessage = $derived.by(() => {
    if (!draftParse.ok) return draftParse.error.message;
    if (draftMeta && !draftMeta.valid) {
      return draftMeta.errors.map((e) => `${e.path || '(root)'}: ${e.message}`).join('\n');
    }
    return null;
  });

  // The parent prop is the immediate rendering authority. `editorState`
  // mirrors it in an effect to protect commits, but combining both avoids a
  // transient editable control during a parent-driven readonly transition.
  const isReadonly = $derived(readonly || editorState.readonly);

  const canApply = $derived(
    !isReadonly && editorState.jsonDraftIsDirty && draftParse.ok && draftMeta?.valid === true,
  );

  const canDiscard = $derived(editorState.jsonDraftIsDirty);
  let jsonEditing = $state(false);
  const editable = $derived(
    jsonEditing || editorState.jsonDraftIsDirty || editorState.committedSchema === null,
  );
  const displayedJson = $derived(
    editorState.committedSchema === null
      ? editorState.jsonDraftText
      : editorState.committedCanonicalText,
  );
  const syntaxHighlightingEnabled = $derived(displayedJson.length <= 100_000);
  let previouslyEditable = false;
  let shouldRestoreEditFocus = $state(false);
  let shouldFocusTextarea = $state(false);
  let discardWasFocused = $state(false);
  let previouslyReadonly = false;

  function focusEditingExitTarget(): void {
    const doneButton = document.getElementById(`${idPrefix}-done-json`);
    if (doneButton instanceof HTMLElement) {
      doneButton.focus({ preventScroll: true });
      return;
    }

    if (!isReadonly) {
      const editButton = document.getElementById(`${idPrefix}-edit-json`);
      if (editButton instanceof HTMLElement) {
        editButton.focus({ preventScroll: true });
        return;
      }
    }

    document
      .getElementById(editorId)
      ?.querySelector<HTMLButtonElement>('[role="tab"][data-cinder-value="json"]')
      ?.focus({ preventScroll: true });
  }

  // A parent schema update can discard a dirty draft while this view is
  // remounted with `jsonEditing` false. In that case the textarea disappears,
  // so transfer focus to the stable edit control after the DOM updates.
  $effect.pre(() => {
    const isEditable = editable;
    const focusMovedFromTextarea =
      previouslyEditable && !isEditable && document.activeElement?.id === `${idPrefix}-textarea`;
    const focusMovedFromCodeBlock =
      !previouslyEditable &&
      isEditable &&
      document.getElementById(`${idPrefix}-code-json`)?.contains(document.activeElement);
    const focusMovedFromJsonActions =
      previouslyEditable &&
      !isEditable &&
      document.getElementById(`${idPrefix}-actions`)?.contains(document.activeElement);
    const focusMovedFromDoneToMalformed =
      isEditable &&
      editorState.committedSchema === null &&
      document.activeElement?.id === `${idPrefix}-done-json`;
    const focusMovedFromEditToReadonly =
      !previouslyReadonly && isReadonly && document.activeElement?.id === `${idPrefix}-edit-json`;
    previouslyEditable = isEditable;
    previouslyReadonly = isReadonly;

    if (focusMovedFromTextarea || focusMovedFromJsonActions) shouldRestoreEditFocus = true;
    if (focusMovedFromCodeBlock || focusMovedFromDoneToMalformed) shouldFocusTextarea = true;
    if (focusMovedFromEditToReadonly) shouldRestoreEditFocus = true;
  });

  $effect(() => {
    if (shouldRestoreEditFocus) {
      shouldRestoreEditFocus = false;
      focusEditingExitTarget();
    }
  });

  $effect(() => {
    if (shouldFocusTextarea) {
      shouldFocusTextarea = false;
      document.getElementById(`${idPrefix}-textarea`)?.focus({ preventScroll: true });
    }
  });

  // Controlled synchronization is initiated by the parent in a post-render
  // effect, after this view's pre-update hook has already run. Keep the
  // focus intent on Discard itself so a dirty-to-clean replacement can land
  // on Done rather than leaving focus on a removed element or the document.
  $effect(() => {
    if (discardWasFocused && !editorState.jsonDraftIsDirty) {
      discardWasFocused = false;
      focusEditingExitTarget();
    }
  });

  async function discardDraft(): Promise<void> {
    editorState.discardJsonDraft();
    if (editorState.committedSchema === null) {
      await tick();
      document.getElementById(`${idPrefix}-textarea`)?.focus({ preventScroll: true });
      return;
    }
    await finishEditing();
  }

  async function finishEditing(): Promise<void> {
    jsonEditing = false;
    await tick();
    focusEditingExitTarget();
  }

  async function startEditing(): Promise<void> {
    jsonEditing = true;
    await tick();
    document.getElementById(`${idPrefix}-textarea`)?.focus({ preventScroll: true });
  }
</script>

<div class={classNames('cinder-jse-json-view', className)}>
  <div id={`${idPrefix}-actions`} class="cinder-jse-json-view__toolbar">
    {#if editable && editorState.jsonDraftIsDirty}
      <Badge variant="warning">Draft modified — Apply to commit</Badge>
    {/if}
    {#if editable}
      <Button variant="primary" size="sm" disabled={!canApply} onclick={() => void applyDraft()}>
        Apply
      </Button>
      {#if editorState.jsonDraftIsDirty}
        <Button
          id={`${idPrefix}-discard-json`}
          variant="secondary"
          size="sm"
          disabled={!canDiscard}
          onfocus={() => {
            discardWasFocused = true;
          }}
          onblur={() => {
            discardWasFocused = false;
          }}
          onclick={() => void discardDraft()}
        >
          Discard
        </Button>
      {:else if editorState.committedSchema !== null}
        <Button
          id={`${idPrefix}-done-json`}
          variant="secondary"
          size="sm"
          onclick={() => void finishEditing()}
        >
          Done
        </Button>
      {/if}
    {:else if !isReadonly}
      <Button
        id={`${idPrefix}-edit-json`}
        variant="secondary"
        size="sm"
        onclick={() => void startEditing()}
      >
        Edit JSON
      </Button>
    {/if}
  </div>

  {#if editable}
    <Textarea
      id={`${idPrefix}-textarea`}
      label="JSON"
      value={editorState.jsonDraftText}
      readonly={isReadonly}
      rows={20}
      class="cinder-jse-json-view__textarea"
      oninput={(event: Event) =>
        editorState.setJsonDraftText((event.target as HTMLTextAreaElement).value)}
    />
  {:else}
    <div id={`${idPrefix}-code-json`}>
      <CodeBlock
        code={displayedJson}
        language="json"
        highlight={syntaxHighlightingEnabled}
        languageLabelVisible={false}
        class="cinder-jse-json-view__code-block"
      />
    </div>
  {/if}

  {#if draftErrorMessage}
    <Alert variant="danger">
      <pre class="cinder-jse-json-view__errors">{draftErrorMessage}</pre>
    </Alert>
  {/if}
</div>
