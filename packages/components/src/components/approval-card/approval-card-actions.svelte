<script lang="ts">
  import Button from '../button/button.svelte';
  import JsonEditor from '../json-editor/json-editor.svelte';
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
  const editRegionId = $derived(`${idBase}-edit-region`);

  let resolutionReason = $state('');
  let rememberResolution = $state(false);
  let editingArguments = $state(false);
  let editedArgumentsText = $state('');

  // A writable `$derived` that reads `requestKey` looked like the simpler
  // reset mechanism, but a $derived re-runs whenever ANY parent prop update
  // touches its host — not only when the tracked value actually changes —
  // so it silently wiped in-progress reason text / edits on every unrelated
  // host re-render. `{#key requestKey}` has the same intent but was
  // unreliable in practice here (a fresh DOM node with a stale value).
  // Comparing the previous value explicitly, inside the effect, is the
  // one thing that's actually gated on requestKey CHANGING, not merely
  // being re-touched.
  let previousRequestKey = requestKey;
  $effect(() => {
    if (requestKey === previousRequestKey) return;
    previousRequestKey = requestKey;
    resolutionReason = '';
    rememberResolution = false;
    // A new request must never leave a stale editor open, even if its
    // arguments happen to serialize identically to the previous request's
    // (the separate snapshot effect below wouldn't see a change in that
    // case) — an edit must never be confirmed against the wrong request.
    editingArguments = false;
    editedArgumentsText = '';
  });

  // Separate from the identity reset above: a host can revise
  // `operation.argsPreview` for the SAME request (e.g. a live update) while
  // the edit panel is open. Comparing the formatted snapshot — not object
  // identity, which changes on unrelated re-renders too — closes a stale
  // editor whenever the underlying arguments actually change, so a confirmed
  // edit can never be based on arguments older than what PayloadInspector is
  // currently showing. Re-opening reseeds from the current value.
  let previousArgumentsSnapshot = formatEditableArguments(argumentsValue);
  $effect(() => {
    const snapshot = formatEditableArguments(argumentsValue);
    if (snapshot === previousArgumentsSnapshot) return;
    previousArgumentsSnapshot = snapshot;
    editingArguments = false;
    editedArgumentsText = '';
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
    if (!canEditArguments || !editParseResult.ok) return;
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

  {#if editingArguments && canEditArguments}
    <div id={editRegionId} class="cinder-approval-card__editor">
      <JsonEditor
        id={`${idBase}-edited-arguments`}
        label="Edited arguments JSON"
        description="Approving sends the parsed JSON below instead of the original arguments."
        value={editedArgumentsText}
        onchange={(value) => (editedArgumentsText = value)}
        {...!editParseResult.ok ? { error: editParseResult.message } : {}}
        rows={8}
        showValidFeedback={false}
        autofocus
      />
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
