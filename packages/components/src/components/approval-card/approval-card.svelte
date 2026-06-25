<script lang="ts" module>
  /**
   * @cinder
   * @category domain
   * @status alpha
   * @purpose Durable human-in-the-loop approval surface for reviewing risky tool operations before they execute.
   * @tag approval
   * @tag human-in-the-loop
   * @tag tool
   * @useWhen A tool call, command, file write, or patch needs explicit human approval before execution.
   * @useWhen Showing policy, sandbox, idempotency, environment-name, and argument context for an approval request.
   * @avoidWhen The action has already completed and only needs historical display — use event-stream-viewer or run-step-timeline instead.
   * @avoidWhen Collecting arbitrary form input for a workflow — compose form controls directly instead.
   * @related card, badge, status-dot, payload-inspector, secret-value-field, code-block
   * @a11yNote Uses a named region and native button controls so approval actions are discoverable by assistive technology.
   * @a11yNote Expiration changes update the visible state but do not fire approval callbacks automatically.
   */
  export type {
    ApprovalCardCallbacks,
    ApprovalCardProps,
    ApprovalCardSchemaProps,
    ApprovalOperation,
    ApprovalOperationKind,
    ApprovalSandbox,
    ApprovalState,
    ApprovalTool,
    ApprovalToolRisk,
  } from './approval-card.types.ts';
</script>

<script lang="ts">
  import { onDestroy } from 'svelte';

  import { classNames } from '../../utilities/class-names.ts';
  import Badge from '../badge/badge.svelte';
  import Button from '../button/button.svelte';
  import ButtonGroup from '../button-group/button-group.svelte';
  import Card from '../card/card.svelte';
  import CodeBlock from '../code-block/code-block.svelte';
  import PayloadInspector from '../payload-inspector/payload-inspector.svelte';
  import SecretValueField from '../secret-value-field/secret-value-field.svelte';
  import StatusDot from '../status-dot/status-dot.svelte';
  import type { BadgeVariant } from '../badge/badge.types.ts';
  import type { StatusDotStatus } from '../status-dot/status-dot.types.ts';
  import {
    isApprovalActionable,
    isApprovalExpirationCheckPending,
    resolveEffectiveApprovalState,
  } from './approval-card-state.ts';
  import type {
    ApprovalCardProps,
    ApprovalOperationKind,
    ApprovalState,
    ApprovalToolRisk,
  } from './approval-card.types.ts';

  const ARGUMENTS_PREVIEW_MAX_CHARACTERS = 4_096;
  const FILE_PREVIEW_LIMIT = 5;

  const generatedId = $props.id();

  let {
    tool,
    sandbox,
    operation,
    env = [],
    snapshotId,
    policyVersion,
    idempotencyKey,
    expiresAt,
    state: approvalState,
    editableArgs = false,
    onApprove,
    onApproveWithEdits,
    onDeny,
    onRemember,
    onCancel,
    id,
    class: customClassName,
    ...rest
  }: ApprovalCardProps = $props();

  const rootId = $derived(id ?? generatedId);
  const titleId = $derived(`${rootId}-title`);
  const descriptionId = $derived(`${rootId}-description`);
  const editDescriptionId = $derived(`${rootId}-edit-description`);
  const editErrorId = $derived(`${rootId}-edit-error`);

  let currentTime = $state<number | undefined>();
  let editingArgumentsSeedKey = $state<string | null>(null);
  let editedArgumentsDrafts = $state<Record<string, string>>({});
  let expirationTimer: ReturnType<typeof setTimeout> | undefined;

  const expirationTimestamp = $derived(parseExpirationTimestamp(expiresAt));
  const effectiveState = $derived<ApprovalState>(
    resolveEffectiveApprovalState(approvalState, expirationTimestamp, currentTime),
  );
  const expirationCheckPending = $derived(
    isApprovalExpirationCheckPending(approvalState, expirationTimestamp, currentTime),
  );
  const isActionable = $derived(
    isApprovalActionable(approvalState, expirationTimestamp, currentTime),
  );
  const operationKindLabel = $derived(formatOperationKind(operation.kind));
  const riskLabel = $derived(formatRisk(tool.risk));
  const stateText = $derived(formatState(effectiveState));
  const stateDescription = $derived(
    isActionable
      ? `${operationKindLabel} approval is waiting for a decision.`
      : expirationCheckPending
        ? 'Approval expiration is being checked before actions are available.'
        : `No approval actions are available because this request is ${stateText.toLowerCase()}.`,
  );
  const expirationText = $derived.by(() => {
    if (effectiveState === 'expired') return 'Expired';
    if (
      approvalState !== 'pending' ||
      expirationTimestamp === undefined ||
      currentTime === undefined
    ) {
      return undefined;
    }
    return `Expires in ${formatRemainingTime(expirationTimestamp - currentTime)}`;
  });
  const editableArgumentsValue = $derived(
    operation.argsPreview === undefined ? {} : operation.argsPreview,
  );
  const argumentsPreview = $derived(prepareArgumentsPreview(editableArgumentsValue));
  const filesTouched = $derived(operation.filesTouched ?? []);
  const visibleFilesTouched = $derived(filesTouched.slice(0, FILE_PREVIEW_LIMIT));
  const remainingFileCount = $derived(
    Math.max(0, filesTouched.length - visibleFilesTouched.length),
  );
  const environmentNames = $derived(env.map(sanitizeEnvironmentName).filter(Boolean));
  const currentEditedArgumentsText = $derived(formatEditableArguments(editableArgumentsValue));
  const currentEditedArgumentsSeedKey = $derived(
    `${idempotencyKey}\u0000${currentEditedArgumentsText}`,
  );
  const editingArguments = $derived(editingArgumentsSeedKey === currentEditedArgumentsSeedKey);
  const editedArgumentsText = $derived(
    editedArgumentsDrafts[currentEditedArgumentsSeedKey] ?? currentEditedArgumentsText,
  );
  const editParseResult = $derived(parseJsonText(editedArgumentsText));
  const canConfirmEditedApproval = $derived(
    editParseResult.ok && typeof onApproveWithEdits === 'function',
  );

  $effect(() => {
    clearExpirationTimer();

    if (approvalState === 'pending' && expirationTimestamp !== undefined) {
      const updateCurrentTime = () => {
        const nextCurrentTime = Date.now();
        currentTime = nextCurrentTime;
        if (nextCurrentTime >= expirationTimestamp) {
          clearExpirationTimer();
          return;
        }

        const nextDelay = Math.min(1_000, expirationTimestamp - nextCurrentTime);
        expirationTimer = setTimeout(updateCurrentTime, nextDelay);
      };

      updateCurrentTime();
    }

    return clearExpirationTimer;
  });

  onDestroy(clearExpirationTimer);

  function clearExpirationTimer(): void {
    if (expirationTimer !== undefined) {
      clearTimeout(expirationTimer);
      expirationTimer = undefined;
    }
  }

  function parseExpirationTimestamp(value: string | undefined): number | undefined {
    if (!value) return undefined;
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) ? timestamp : undefined;
  }

  function formatRemainingTime(milliseconds: number): string {
    const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1_000));
    const hours = Math.floor(totalSeconds / 3_600);
    const minutes = Math.floor((totalSeconds % 3_600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  }

  function formatRisk(risk: ApprovalToolRisk): string {
    switch (risk) {
      case 'low':
        return 'Low risk';
      case 'medium':
        return 'Medium risk';
      case 'high':
        return 'High risk';
    }
  }

  function riskBadgeVariant(risk: ApprovalToolRisk): BadgeVariant {
    switch (risk) {
      case 'low':
        return 'success';
      case 'medium':
        return 'warning';
      case 'high':
        return 'danger';
    }
  }

  function formatOperationKind(kind: ApprovalOperationKind): string {
    switch (kind) {
      case 'command':
        return 'Command';
      case 'file-write':
        return 'File write';
      case 'patch':
        return 'Patch';
      case 'other':
        return 'Operation';
    }
  }

  function formatState(approvalState: ApprovalState): string {
    switch (approvalState) {
      case 'pending':
        return 'Pending';
      case 'approved':
        return 'Approved';
      case 'approved_with_edits':
        return 'Approved with edits';
      case 'denied':
        return 'Denied';
      case 'expired':
        return 'Expired';
      case 'cancelled':
        return 'Cancelled';
    }
  }

  function stateDotStatus(approvalState: ApprovalState): StatusDotStatus {
    switch (approvalState) {
      case 'pending':
        return 'pending';
      case 'approved':
      case 'approved_with_edits':
        return 'success';
      case 'denied':
        return 'danger';
      case 'expired':
        return 'neutral';
      case 'cancelled':
        return 'offline';
    }
  }

  function prepareArgumentsPreview(value: unknown): { value: unknown; truncated: boolean } {
    try {
      const serialized = JSON.stringify(value);
      if (typeof serialized !== 'string' || serialized.length <= ARGUMENTS_PREVIEW_MAX_CHARACTERS) {
        return { value: typeof value === 'string' ? serialized : value, truncated: false };
      }
      return {
        value: {
          notice: 'Arguments preview truncated',
          originalCharacters: serialized.length,
          displayedCharacters: ARGUMENTS_PREVIEW_MAX_CHARACTERS,
        },
        truncated: true,
      };
    } catch {
      return { value, truncated: false };
    }
  }

  function formatEditableArguments(value: unknown): string {
    try {
      const serialized = JSON.stringify(value, null, 2);
      return serialized ?? 'null';
    } catch {
      return '{}';
    }
  }

  function parseJsonText(
    text: string,
  ): { ok: true; value: unknown } | { ok: false; message: string } {
    try {
      return { ok: true, value: JSON.parse(text) };
    } catch {
      return { ok: false, message: 'Edited arguments must be valid JSON.' };
    }
  }

  function sanitizeEnvironmentName(name: string): string {
    const [firstPart] = name.split('=');
    return firstPart?.trim() ?? '';
  }

  function currentApprovalIsActionable(): boolean {
    const comparisonTime = expirationTimestamp === undefined ? currentTime : Date.now();
    return isApprovalActionable(approvalState, expirationTimestamp, comparisonTime);
  }

  function beginEditingArguments(): void {
    if (!currentApprovalIsActionable()) return;
    if (!(currentEditedArgumentsSeedKey in editedArgumentsDrafts)) {
      editedArgumentsDrafts = {
        ...editedArgumentsDrafts,
        [currentEditedArgumentsSeedKey]: currentEditedArgumentsText,
      };
    }
    editingArgumentsSeedKey = currentEditedArgumentsSeedKey;
  }

  function handleEditedArgumentsInput(event: Event): void {
    editedArgumentsDrafts = {
      ...editedArgumentsDrafts,
      [currentEditedArgumentsSeedKey]: (event.currentTarget as HTMLTextAreaElement).value,
    };
  }

  function handleApprove(): void {
    if (!currentApprovalIsActionable()) return;
    onApprove?.();
  }

  function handleApproveWithEdits(): void {
    if (!currentApprovalIsActionable()) return;
    if (!editParseResult.ok) return;
    onApproveWithEdits?.(editParseResult.value);
  }

  function handleDeny(): void {
    if (!currentApprovalIsActionable()) return;
    onDeny?.();
  }

  function handleRemember(): void {
    if (!currentApprovalIsActionable()) return;
    onRemember?.();
  }

  function handleCancel(): void {
    if (!currentApprovalIsActionable()) return;
    onCancel?.();
  }
</script>

<section
  {...rest}
  id={rootId}
  class={classNames('cinder-approval-card', customClassName)}
  aria-labelledby={titleId}
  aria-describedby={descriptionId}
  data-cinder-state={effectiveState}
  data-cinder-risk={tool.risk}
>
  <Card padding="none" class="cinder-approval-card__surface">
    {#snippet header()}
      <div class="cinder-approval-card__header">
        <div class="cinder-approval-card__title-group">
          <p class="cinder-approval-card__eyebrow">{operationKindLabel} approval</p>
          <h3 id={titleId} class="cinder-approval-card__title">
            Approval required for {tool.name}
          </h3>
          <p id={descriptionId} class="cinder-approval-card__description">
            {stateDescription}
          </p>
        </div>
        <div class="cinder-approval-card__badges" aria-label="Approval status">
          <StatusDot status={stateDotStatus(effectiveState)} label={stateText} />
          <Badge variant={riskBadgeVariant(tool.risk)} size="sm">{riskLabel}</Badge>
          {#if expirationText}
            <Badge variant={effectiveState === 'expired' ? 'neutral' : 'warning'} size="sm">
              {expirationText}
            </Badge>
          {/if}
        </div>
      </div>
    {/snippet}

    <div class="cinder-approval-card__body">
      <dl class="cinder-approval-card__metadata" aria-label="Approval metadata">
        <div class="cinder-approval-card__metadata-item">
          <dt>Policy</dt>
          <dd>{policyVersion}</dd>
        </div>
        <div class="cinder-approval-card__metadata-item">
          <dt>Idempotency key</dt>
          <dd>{idempotencyKey}</dd>
        </div>
        {#if snapshotId}
          <div class="cinder-approval-card__metadata-item">
            <dt>Snapshot</dt>
            <dd>{snapshotId}</dd>
          </div>
        {/if}
      </dl>

      {#if sandbox}
        <section class="cinder-approval-card__section" aria-label="Sandbox context">
          <h4 class="cinder-approval-card__section-title">Sandbox</h4>
          <dl class="cinder-approval-card__metadata cinder-approval-card__metadata--compact">
            <div class="cinder-approval-card__metadata-item">
              <dt>Provider</dt>
              <dd>{sandbox.provider}</dd>
            </div>
            <div class="cinder-approval-card__metadata-item">
              <dt>Name</dt>
              <dd>{sandbox.name}</dd>
            </div>
            <div class="cinder-approval-card__metadata-item">
              <dt>Working directory</dt>
              <dd>{sandbox.workingDir}</dd>
            </div>
          </dl>
        </section>
      {/if}

      <section class="cinder-approval-card__section" aria-label="Operation details">
        <div class="cinder-approval-card__section-heading">
          <h4 class="cinder-approval-card__section-title">Operation</h4>
          <Badge size="sm" mono>{operation.kind}</Badge>
        </div>

        {#if operation.kind === 'command' && operation.command}
          <CodeBlock code={operation.command} language="shell" highlight={false} />
        {:else if operation.kind === 'patch' && operation.diff}
          <CodeBlock code={operation.diff} language="diff" highlight={false} />
        {:else if operation.kind === 'file-write'}
          <p class="cinder-approval-card__muted">
            Review the touched files and arguments before approving this file write.
          </p>
        {:else}
          <p class="cinder-approval-card__muted">
            Review the arguments and metadata before approving this operation.
          </p>
        {/if}

        {#if filesTouched.length > 0}
          <div class="cinder-approval-card__files">
            <div class="cinder-approval-card__section-heading">
              <h5 class="cinder-approval-card__subsection-title">Files touched</h5>
              {#if remainingFileCount > 0}
                <Badge size="sm" variant="warning">
                  Showing {FILE_PREVIEW_LIMIT} of {filesTouched.length} files
                </Badge>
              {/if}
            </div>
            <ul class="cinder-approval-card__file-list">
              {#each visibleFilesTouched as file (file)}
                <li>{file}</li>
              {/each}
            </ul>
            {#if remainingFileCount > 0}
              <p class="cinder-approval-card__muted">{remainingFileCount} more files</p>
            {/if}
          </div>
        {/if}
      </section>

      <section class="cinder-approval-card__section" aria-label="Arguments preview">
        <PayloadInspector
          value={argumentsPreview.value}
          truncated={argumentsPreview.truncated}
          label="Arguments preview"
        />
      </section>

      {#if environmentNames.length > 0}
        <section class="cinder-approval-card__section" aria-label="Environment names">
          <h4 class="cinder-approval-card__section-title">Environment</h4>
          <div class="cinder-approval-card__environment-list">
            {#each environmentNames as environmentName (environmentName)}
              <SecretValueField value="" label={environmentName} />
            {/each}
          </div>
        </section>
      {/if}

      {#if isActionable}
        <section class="cinder-approval-card__section cinder-approval-card__actions-section">
          <ButtonGroup label="Approval actions">
            <Button type="button" variant="primary" onclick={handleApprove} disabled={!onApprove}>
              Approve
            </Button>
            {#if editableArgs}
              <Button
                type="button"
                variant="secondary"
                onclick={beginEditingArguments}
                disabled={!onApproveWithEdits}
              >
                Approve with edits
              </Button>
            {/if}
            <Button type="button" variant="soft-danger" onclick={handleDeny} disabled={!onDeny}>
              Deny
            </Button>
            <Button type="button" variant="soft" onclick={handleRemember} disabled={!onRemember}>
              Remember
            </Button>
            <Button type="button" variant="ghost" onclick={handleCancel} disabled={!onCancel}>
              Cancel
            </Button>
          </ButtonGroup>

          {#if editingArguments}
            <div class="cinder-approval-card__editor">
              <label class="cinder-approval-card__editor-label" for={`${rootId}-edited-arguments`}>
                Edited arguments JSON
              </label>
              <p id={editDescriptionId} class="cinder-approval-card__muted">
                Confirming parses this JSON and sends the parsed value to the approval callback.
              </p>
              <textarea
                id={`${rootId}-edited-arguments`}
                class="cinder-approval-card__textarea"
                value={editedArgumentsText}
                oninput={handleEditedArgumentsInput}
                rows="8"
                spellcheck="false"
                aria-describedby={editParseResult.ok
                  ? editDescriptionId
                  : `${editDescriptionId} ${editErrorId}`}
                aria-invalid={editParseResult.ok ? undefined : 'true'}
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
                  onclick={handleApproveWithEdits}
                  disabled={!canConfirmEditedApproval}
                >
                  Confirm edited approval
                </Button>
              </div>
            </div>
          {/if}
        </section>
      {:else}
        <p class="cinder-approval-card__readonly-summary">
          No approval actions are available for this request.
        </p>
      {/if}
    </div>
  </Card>
</section>
