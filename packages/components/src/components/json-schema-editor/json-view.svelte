<script lang="ts" module>
  import type { EditorState } from './json-schema-editor-state.types.ts';

  export type JsonViewProps = {
    state: EditorState;
    idPrefix: string;
    class?: string;
  };
</script>

<script lang="ts">
  import { classNames } from '../../utilities/class-names.ts';
  import Alert from '../alert/alert.svelte';
  import Badge from '../badge/badge.svelte';
  import Button from '../button/button.svelte';
  import Textarea from '../textarea/textarea.svelte';

  import type { JsonSchemaValidationError } from './json-schema-editor-types.ts';
  import { tryParseJson, validateMetaSchema } from './json-schema-validator.ts';

  // Aliased to `editorState`, not `state` — a local variable literally named
  // `state` shadows the `$state` rune identifier, so `$state(...)` below
  // would compile as a legacy store auto-subscription to that variable
  // instead of the rune call. json-schema-toolbar.svelte uses the same
  // alias for the same reason.
  let { state: editorState, idPrefix, class: className }: JsonViewProps = $props();

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

  const canApply = $derived(
    !editorState.readonly &&
      editorState.jsonDraftIsDirty &&
      draftParse.ok &&
      draftMeta?.valid === true,
  );

  const canDiscard = $derived(editorState.jsonDraftIsDirty && !editorState.readonly);
</script>

<div class={classNames('cinder-jse-json-view', className)}>
  <div class="cinder-jse-json-view__toolbar">
    {#if editorState.jsonDraftIsDirty}
      <Badge variant="warning">Draft modified — Apply to commit</Badge>
    {/if}
    <Button
      variant="primary"
      size="sm"
      disabled={!canApply}
      onclick={() => void editorState.applyJsonDraft()}
    >
      Apply
    </Button>
    <Button
      variant="secondary"
      size="sm"
      disabled={!canDiscard}
      onclick={() => editorState.discardJsonDraft()}
    >
      Discard
    </Button>
  </div>

  <Textarea
    id={`${idPrefix}-textarea`}
    label="JSON"
    value={editorState.jsonDraftText}
    disabled={editorState.readonly}
    rows={20}
    class="cinder-jse-json-view__textarea"
    oninput={(event: Event) =>
      editorState.setJsonDraftText((event.target as HTMLTextAreaElement).value)}
  />

  {#if draftErrorMessage}
    <Alert variant="danger">
      <pre class="cinder-jse-json-view__errors">{draftErrorMessage}</pre>
    </Alert>
  {/if}
</div>
