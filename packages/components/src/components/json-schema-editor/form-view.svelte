<script lang="ts" module>
  import type { EditorState } from './json-schema-editor-state.svelte.ts';

  export type FormViewProps = {
    state: EditorState;
    idPrefix: string;
    class?: string;
  };
</script>

<script lang="ts">
  import { classNames } from '../../utilities/class-names.ts';
  import Alert from '../alert/alert.svelte';
  import Button from '../button/button.svelte';
  import EmptyState from '../empty-state/empty-state.svelte';
  import PropertyEditor from './property-editor.svelte';

  let { state, idPrefix, class: className }: FormViewProps = $props();

  // Snapshot the committed schema each render so changes propagate via the
  // value prop on PropertyEditor. We don't pass the live committed schema by
  // reference; PropertyEditor produces a brand-new object on each commit.
  const rootSchema = $derived(state.committedSchema);
</script>

<div class={classNames('cinder-jse-form-view', className)}>
  {#if state.jsonDraftIsDirty}
    <Alert variant="warning">
      <p>The JSON view has uncommitted changes. Apply or discard them to edit in the form.</p>
      <div class="cinder-jse-dirty-actions">
        <Button variant="primary" size="sm" onclick={() => state.applyJsonDraft()}>
          Apply JSON
        </Button>
        <Button variant="secondary" size="sm" onclick={() => state.discardJsonDraft()}>
          Discard JSON
        </Button>
      </div>
    </Alert>
  {/if}

  {#if rootSchema === null}
    <EmptyState
      title="Schema not loaded"
      description={state.originalLoadError ??
        'The current input could not be parsed. Edit the JSON view to set a valid schema.'}
    />
  {:else}
    <PropertyEditor
      {idPrefix}
      path=""
      depth={0}
      readonly={state.readonly || state.jsonDraftIsDirty}
      value={rootSchema}
      onchange={(next, options) => state.commitFromForm(next, options)}
    />
  {/if}
</div>
