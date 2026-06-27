<script lang="ts" module>
  import type { EditorState } from './json-schema-editor-state.types.ts';

  export type DiffViewProps = {
    state: EditorState;
    class?: string;
  };
</script>

<script lang="ts">
  import { classNames } from '../../utilities/class-names.ts';
  import Alert from '../alert/alert.svelte';
  import Button from '../button/button.svelte';
  import DiffViewer from '../diff-viewer/diff-viewer.svelte';
  import EmptyState from '../empty-state/empty-state.svelte';

  let { state, class: className }: DiffViewProps = $props();
</script>

<div class={classNames('cinder-jse-diff-view', className)}>
  {#if state.jsonDraftIsDirty}
    <Alert variant="warning">
      <p>The diff shows the committed state; uncommitted JSON edits are not included.</p>
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

  {#if !state.hasChanges}
    <EmptyState title="No changes yet" description="Edit the schema to see a diff here." />
  {:else}
    <DiffViewer
      original={state.diffOriginal}
      current={state.diffCurrent}
      normalizeInputs={false}
      readonly
    />
  {/if}
</div>
