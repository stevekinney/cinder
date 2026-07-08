<script lang="ts">
  import Button from '../button/button.svelte';
  import { formatEditableArguments, parseJsonText } from './approval-card-state.ts';
  import type { ApprovalResolution, ApprovalResolutionDecision } from './approval-card.types.ts';

  type ApprovalCardActionsProps = {
    /** Base for the ids of the controls this region renders. */
    idBase: string;
    /** Identity of the approval request; form state resets when it changes. */
    requestKey: string;
    /** Whether the approve-with-edits flow is available. */
    canEditArguments: boolean;
    /** Normalized arguments value used to seed the JSON editor. */
    argumentsValue: unknown;
    /** Resolution sink; the parent guards actionability before forwarding. */
    resolve: (resolution: ApprovalResolution) => void;
  };

  let { idBase, requestKey, canEditArguments, argumentsValue, resolve }: ApprovalCardActionsProps =
    $props();

  const reasonId = $derived(`${idBase}-resolution-reason`);
  const editorId = $derived(`${idBase}-edited-arguments`);
  const editRegionId = $derived(`${idBase}-edit-region`);
  const editDescriptionId = $derived(`${idBase}-edit-description`);
  const editErrorId = $derived(`${idBase}-edit-error`);

  // Writable deriveds: user input overrides the value, and a change to
  // `requestKey` re-evaluates each one back to its initial state — resetting
  // the form when a different approval request arrives.
  let resolutionReason = $derived.by(() => {
    void requestKey;
    return '';
  });
  let rememberResolution = $derived.by(() => {
    void requestKey;
    return false;
  });
  let editingArguments = $derived.by(() => {
    void requestKey;
    return false;
  });
  let editedArgumentsText = $derived.by(() => {
    void requestKey;
    return '';
  });

  const editParseResult = $derived(parseJsonText(editedArgumentsText));

  function emitResolution(decision: ApprovalResolutionDecision, editedArgs?: unknown): void {
    const trimmedReason = resolutionReason.trim();
    const resolution: ApprovalResolution = {
      decision,
      remember: rememberResolution,
    };

    if (decision === 'approve_with_edits') {
      resolution.editedArgs = editedArgs;
    }
    if (trimmedReason) {
      resolution.reason = trimmedReason;
    }

    resolve(resolution);
  }

  function toggleEditingArguments(): void {
    if (!canEditArguments) return;
    if (!editingArguments) {
      editedArgumentsText = formatEditableArguments(argumentsValue);
    }
    editingArguments = !editingArguments;
  }

  function handleConfirmEditedApproval(): void {
    if (!editParseResult.ok) return;
    emitResolution('approve_with_edits', editParseResult.value);
  }
</script>

<div class="cinder-approval-card__actions">
  <div class="cinder-approval-card__resolution-controls">
    <label class="cinder-approval-card__control-label" for={reasonId}>Reason</label>
    <textarea
      id={reasonId}
      class="cinder-approval-card__textarea cinder-approval-card__textarea--reason"
      bind:value={resolutionReason}
      rows="2"
    ></textarea>
  </div>

  <div class="cinder-approval-card__action-row" role="group" aria-label="Approval actions">
    <label class="cinder-approval-card__remember-control">
      <input type="checkbox" bind:checked={rememberResolution} />
      <span>Don't ask again for operations like this</span>
    </label>

    <div class="cinder-approval-card__action-buttons">
      <Button
        type="button"
        variant="ghost"
        class="cinder-approval-card__dismiss"
        onclick={() => emitResolution('cancel')}
      >
        Dismiss
      </Button>
      <Button type="button" variant="soft-danger" onclick={() => emitResolution('deny')}>
        Deny
      </Button>
      {#if canEditArguments}
        <Button
          type="button"
          variant="secondary"
          onclick={toggleEditingArguments}
          aria-expanded={editingArguments}
          aria-controls={editingArguments ? editRegionId : undefined}
        >
          Approve with edits
        </Button>
      {/if}
      <Button type="button" variant="primary" onclick={() => emitResolution('approve')}>
        Approve
      </Button>
    </div>
  </div>

  {#if editingArguments}
    <div id={editRegionId} class="cinder-approval-card__editor">
      <label class="cinder-approval-card__control-label" for={editorId}>
        Edited arguments JSON
      </label>
      <p id={editDescriptionId} class="cinder-approval-card__muted">
        Approving sends the parsed JSON below instead of the original arguments.
      </p>
      <textarea
        id={editorId}
        class="cinder-approval-card__textarea"
        bind:value={editedArgumentsText}
        rows="8"
        spellcheck="false"
        aria-describedby={editParseResult.ok
          ? editDescriptionId
          : `${editDescriptionId} ${editErrorId}`}
        aria-invalid={editParseResult.ok ? undefined : 'true'}
        {@attach (element) => {
          element.focus();
        }}
      ></textarea>
      {#if !editParseResult.ok}
        <p id={editErrorId} class="cinder-approval-card__error" role="alert">
          {editParseResult.message}
        </p>
      {/if}
      <div class="cinder-approval-card__editor-actions">
        <Button
          type="button"
          variant="primary"
          onclick={handleConfirmEditedApproval}
          disabled={!editParseResult.ok}
        >
          Confirm edited approval
        </Button>
      </div>
    </div>
  {/if}
</div>
