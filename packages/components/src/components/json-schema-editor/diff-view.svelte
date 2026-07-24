<script lang="ts" module>
  import type { EditorState } from './json-schema-editor-state.types.ts';

  export type DiffViewProps = {
    state: EditorState;
    class?: string;
  };
</script>

<script lang="ts">
  import type { LineDiff } from '@lostgradient/markdown/diff/line-diff';
  import { computeLineDiff } from '@lostgradient/markdown/diff/line-diff';

  import { classNames } from '../../utilities/class-names.ts';
  import Alert from '../alert/alert.svelte';
  import Button from '../button/button.svelte';
  import EmptyState from '../empty-state/empty-state.svelte';

  let { state, class: className }: DiffViewProps = $props();

  const lineDiffs = $derived(computeLineDiff(state.diffOriginal, state.diffCurrent));

  function lineKindClass(line: LineDiff): string {
    switch (line.type) {
      case 'added':
        return 'cinder-jse-diff-line--added';
      case 'removed':
        return 'cinder-jse-diff-line--removed';
      case 'modified':
        return 'cinder-jse-diff-line--modified';
      default:
        return 'cinder-jse-diff-line--same';
    }
  }
</script>

<div class={classNames('cinder-jse-diff-view', className)}>
  {#if state.jsonDraftIsDirty}
    <Alert variant="warning">
      <p>The diff shows the committed state; uncommitted JSON edits are not included.</p>
      <div class="cinder-jse-dirty-actions">
        <Button variant="primary" size="sm" onclick={() => void state.applyJsonDraft()}>
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
    <div class="cinder-jse-diff-lines" role="group" aria-label="JSON diff">
      {#each lineDiffs as line, index (index)}<div
          class={classNames('cinder-jse-diff-line', lineKindClass(line))}
        >
          {#if line.type === 'modified'}<span class="cinder-jse-diff-line__marker">~</span
            >{line.oldText}<span class="cinder-jse-diff-line__marker">→</span
            >{line.newText}{:else}<span class="cinder-jse-diff-line__marker"
              >{line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}</span
            >{line.text}{/if}
        </div>{/each}
    </div>
  {/if}
</div>
