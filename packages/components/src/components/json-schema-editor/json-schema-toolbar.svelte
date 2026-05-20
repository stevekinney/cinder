<script lang="ts" module>
  import type { EditorState } from './json-schema-editor-state.svelte.ts';

  export type JsonSchemaToolbarProps = {
    state: EditorState;
    onUndo?: () => void;
    onRedo?: () => void;
    onRevert?: () => void;
    class?: string;
  };
</script>

<script lang="ts">
  import { classNames } from '../../utilities/class-names.ts';
  import Badge from '../badge/badge.svelte';
  import Button from '../button/button.svelte';
  import CopyButton from '../copy-button/copy-button.svelte';

  let { state, onUndo, onRedo, onRevert, class: className }: JsonSchemaToolbarProps = $props();

  const validationBadgeVariant = $derived.by(() => {
    switch (state.validationStatus) {
      case 'valid':
        return 'success' as const;
      case 'invalid':
        return 'danger' as const;
      case 'pending':
        return 'neutral' as const;
    }
  });

  const validationBadgeText = $derived.by(() => {
    switch (state.validationStatus) {
      case 'valid':
        return `Valid (${state.activeDraft})`;
      case 'invalid':
        return `Invalid${state.validationResult.errors.length > 0 ? ` — ${state.validationResult.errors.length} errors` : ''}`;
      case 'pending':
        return 'Validating…';
    }
  });
</script>

<div class={classNames('cinder-jse-toolbar', className)}>
  <div class="cinder-jse-toolbar__left">
    <Badge variant={validationBadgeVariant}>{validationBadgeText}</Badge>
    {#if state.validationResult.compileError}
      <Badge variant="warning" title={state.validationResult.compileError}>Compile warning</Badge>
    {/if}
  </div>

  <div class="cinder-jse-toolbar__right">
    <Button
      variant="ghost"
      size="sm"
      disabled={!state.canUndo || state.readonly}
      onclick={() => onUndo?.()}
    >
      Undo
    </Button>
    <Button
      variant="ghost"
      size="sm"
      disabled={!state.canRedo || state.readonly}
      onclick={() => onRedo?.()}
    >
      Redo
    </Button>
    <CopyButton value={state.copyValue}>
      {#snippet children()}Copy JSON{/snippet}
      {#snippet confirmation()}Copied{/snippet}
    </CopyButton>
    <Button
      variant="secondary"
      size="sm"
      disabled={!state.hasChanges || state.readonly}
      onclick={() => onRevert?.()}
    >
      Revert
    </Button>
  </div>
</div>
