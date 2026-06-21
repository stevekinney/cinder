<script lang="ts" module>
  import type { EditorState } from './json-schema-editor-state.svelte.ts';

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

  import { tryParseJson, validateMetaSchema } from './json-schema-validator.ts';

  let { state, idPrefix, class: className }: JsonViewProps = $props();

  // Live (synchronous) parse + meta-schema status for the current draft.
  // The state container only debounces validation against the *committed*
  // schema; the JSON view runs an immediate cheap check on the *draft* so
  // the user gets instant feedback while typing.
  const draftParse = $derived(tryParseJson(state.jsonDraftText));
  const draftMeta = $derived.by(() => {
    if (!draftParse.ok) return null;
    return validateMetaSchema(draftParse.value, state.activeDraft);
  });

  const draftErrorMessage = $derived.by(() => {
    if (!draftParse.ok) return draftParse.error.message;
    if (draftMeta && !draftMeta.valid) {
      return draftMeta.errors.map((e) => `${e.path || '(root)'}: ${e.message}`).join('\n');
    }
    return null;
  });

  const canApply = $derived(
    !state.readonly && state.jsonDraftIsDirty && draftParse.ok && draftMeta?.valid === true,
  );

  const canDiscard = $derived(state.jsonDraftIsDirty && !state.readonly);
</script>

<div class={classNames('cinder-jse-json-view', className)}>
  <div class="cinder-jse-json-view__toolbar">
    {#if state.jsonDraftIsDirty}
      <Badge variant="warning">Draft modified — Apply to commit</Badge>
    {/if}
    <Button variant="primary" size="sm" disabled={!canApply} onclick={() => state.applyJsonDraft()}>
      Apply
    </Button>
    <Button
      variant="secondary"
      size="sm"
      disabled={!canDiscard}
      onclick={() => state.discardJsonDraft()}
    >
      Discard
    </Button>
  </div>

  <Textarea
    id={`${idPrefix}-textarea`}
    label="JSON"
    value={state.jsonDraftText}
    disabled={state.readonly}
    rows={20}
    class="cinder-jse-json-view__textarea"
    oninput={(event: Event) => state.setJsonDraftText((event.target as HTMLTextAreaElement).value)}
  />

  {#if draftErrorMessage}
    <Alert variant="danger">
      <pre class="cinder-jse-json-view__errors">{draftErrorMessage}</pre>
    </Alert>
  {/if}
</div>
