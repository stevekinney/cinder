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
   * @related card, badge, status-dot, payload-inspector, code-block, collapsible
   * @a11yNote Renders as an article with native button controls so approval actions are discoverable without polluting the landmark list.
   * @a11yNote Expiration changes update the visible state but do not fire approval callbacks automatically.
   */
  export type {
    ApprovalCardCallbacks,
    ApprovalCardHeadingLevel,
    ApprovalCardProps,
    ApprovalCardSchemaProps,
    ApprovalOperation,
    ApprovalOperationKind,
    ApprovalResolution,
    ApprovalResolutionDecision,
    ApprovalSandbox,
    ApprovalState,
    ApprovalTool,
    ApprovalToolRisk,
  } from './approval-card.types.ts';
</script>

<script lang="ts">
  import SignalHigh from 'lucide-svelte/icons/signal-high';
  import SignalLow from 'lucide-svelte/icons/signal-low';
  import SignalMedium from 'lucide-svelte/icons/signal-medium';

  import { classNames } from '../../utilities/class-names.ts';
  import Badge from '../badge/badge.svelte';
  import Card from '../card/card.svelte';
  import CodeBlock from '../code-block/code-block.svelte';
  import Collapsible from '../collapsible/collapsible.svelte';
  import CopyButton from '../copy-button/copy-button.svelte';
  import PayloadInspector from '../payload-inspector/payload-inspector.svelte';
  import StatusDot from '../status-dot/status-dot.svelte';
  import Tooltip from '../tooltip/tooltip.svelte';
  import ApprovalCardActions from './approval-card-actions.svelte';
  import {
    RISK_LABELS,
    STATE_DOT_STATUS,
    STATE_LABELS,
    dedupeFilePaths,
    formatRemainingTime,
    isApprovalActionable,
    normalizeArgumentsPreviewValue,
    parseExpirationTimestamp,
    prepareArgumentsPreview,
    resolveEffectiveApprovalState,
    sanitizeEnvironmentNames,
  } from './approval-card-state.ts';
  import type {
    ApprovalCardProps,
    ApprovalResolution,
    ApprovalState,
  } from './approval-card.types.ts';

  // Stacked-bar signal icon in place of a text badge: the shape itself scans
  // faster than reading "Medium risk", and the tooltip/aria-label carries the
  // same word for anyone who needs it named explicitly.
  const RISK_ICONS = {
    low: SignalLow,
    medium: SignalMedium,
    high: SignalHigh,
  } as const;

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
    headingLevel = 3,
    onresolve,
    id,
    class: customClassName,
    ...rest
  }: ApprovalCardProps = $props();

  const rootId = $derived(id ?? generatedId);
  const titleId = $derived(`${rootId}-title`);

  // Coerce + clamp like Card: schema-driven callers can pass out-of-range or
  // non-numeric levels, and `h${level}` must never emit invalid markup.
  const resolvedHeadingLevel = $derived(
    Number.isFinite(Math.trunc(Number(headingLevel)))
      ? Math.min(6, Math.max(2, Math.trunc(Number(headingLevel))))
      : 3,
  );
  const titleTag = $derived(`h${resolvedHeadingLevel}`);
  const sectionTag = $derived(`h${Math.min(6, resolvedHeadingLevel + 1)}`);

  let currentTime = $state<number | undefined>();
  let expirationTimer: ReturnType<typeof setTimeout> | undefined;

  const expirationTimestamp = $derived(parseExpirationTimestamp(expiresAt));
  const effectiveState = $derived<ApprovalState>(
    resolveEffectiveApprovalState(approvalState, expirationTimestamp, currentTime),
  );
  const isActionable = $derived(
    isApprovalActionable(approvalState, expirationTimestamp, currentTime),
  );
  // Guards against a non-function truthy value reaching a JS (non-typechecked)
  // or schema-driven caller — `onresolve?.()` alone would still throw on a
  // truthy non-function.
  const hasResolutionCallback = $derived(typeof onresolve === 'function');

  const riskLabel = $derived(RISK_LABELS[tool.risk]);
  const RiskIcon = $derived(RISK_ICONS[tool.risk]);
  const stateText = $derived(STATE_LABELS[effectiveState]);
  const readonlySummary = $derived(
    `No approval actions are available because this request is ${stateText.toLowerCase()}.`,
  );
  // Only a live countdown is shown. Once the state itself reads "Expired" (via
  // StatusDot's label), a second "Expired" badge would just repeat the same word.
  const expirationText = $derived.by(() => {
    if (
      approvalState !== 'pending' ||
      effectiveState !== 'pending' ||
      expirationTimestamp === undefined ||
      currentTime === undefined
    ) {
      return undefined;
    }
    return `Expires in ${formatRemainingTime(expirationTimestamp - currentTime)}`;
  });

  const hasArgumentsPreview = $derived(operation.argsPreview !== undefined);
  const editableArgumentsValue = $derived(normalizeArgumentsPreviewValue(operation.argsPreview));
  const argumentsPreview = $derived(prepareArgumentsPreview(editableArgumentsValue));
  const canEditArguments = $derived(editableArgs && hasArgumentsPreview);
  const filesTouched = $derived(dedupeFilePaths(operation.filesTouched ?? []));
  const filesTouchedLabel = $derived(
    `${filesTouched.length} file${filesTouched.length === 1 ? '' : 's'}`,
  );
  const environmentNames = $derived(sanitizeEnvironmentNames(env));

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

  function clearExpirationTimer(): void {
    if (expirationTimer !== undefined) {
      clearTimeout(expirationTimer);
      expirationTimer = undefined;
    }
  }

  function resolveIfActionable(resolution: ApprovalResolution): void {
    // Re-check against the wall clock: the countdown timer only ticks once per
    // second, so a click can land after the deadline but before the next tick.
    const comparisonTime = expirationTimestamp === undefined ? currentTime : Date.now();
    if (!isApprovalActionable(approvalState, expirationTimestamp, comparisonTime)) {
      if (approvalState === 'pending' && expirationTimestamp !== undefined) {
        currentTime = comparisonTime;
      }
      return;
    }
    if (typeof onresolve === 'function') onresolve(resolution);
  }
</script>

<article
  {...rest}
  id={rootId}
  class={classNames('cinder-approval-card', customClassName)}
  aria-labelledby={titleId}
  data-cinder-state={effectiveState}
  data-cinder-risk={tool.risk}
>
  <Card padding="none" class="cinder-approval-card__surface">
    {#snippet header()}
      <div class="cinder-approval-card__header">
        <div class="cinder-approval-card__title-group">
          <svelte:element this={titleTag} id={titleId} class="cinder-approval-card__title">
            Approval required for
            <span class="cinder-approval-card__title-tool">{tool.name}</span>
          </svelte:element>
        </div>
        <div class="cinder-approval-card__badges" role="group" aria-label="Approval status">
          <StatusDot status={STATE_DOT_STATUS[effectiveState]} label={stateText} size="sm" />
          <Tooltip text={riskLabel} describe={false}>
            <span
              class="cinder-approval-card__risk-icon"
              role="img"
              tabindex="0"
              aria-label={riskLabel}
              data-cinder-risk={tool.risk}
            >
              <RiskIcon size={16} strokeWidth={2.25} aria-hidden="true" />
            </span>
          </Tooltip>
          {#if expirationText}
            <Badge variant="warning" size="sm">
              {expirationText}
            </Badge>
          {/if}
        </div>
      </div>
    {/snippet}

    <div class="cinder-approval-card__body">
      {#if operation.kind === 'command' && operation.command}
        <div class="cinder-approval-card__section">
          <CodeBlock code={operation.command} language="shell" showLanguageLabel={false} />
        </div>
      {:else if operation.kind === 'patch' && operation.diff}
        <div class="cinder-approval-card__section">
          <CodeBlock code={operation.diff} language="diff" showLanguageLabel={false} />
        </div>
      {/if}

      {#if filesTouched.length > 0}
        <div class="cinder-approval-card__section">
          <div class="cinder-approval-card__section-heading">
            <svelte:element this={sectionTag} class="cinder-approval-card__section-title">
              Files touched
            </svelte:element>
            <Badge size="sm">{filesTouchedLabel}</Badge>
          </div>
          <ul class="cinder-approval-card__file-list">
            {#each filesTouched as file (file)}
              <li class="cinder-approval-card__file">
                <span class="cinder-approval-card__file-path">{file}</span>
                <CopyButton
                  value={file}
                  label={`Copy path ${file}`}
                  copiedLabel="Path copied"
                  class="cinder-approval-card__file-copy"
                  iconOnly
                />
              </li>
            {/each}
          </ul>
        </div>
      {/if}

      {#if hasArgumentsPreview}
        <div class="cinder-approval-card__section">
          <PayloadInspector
            value={argumentsPreview.value}
            truncated={argumentsPreview.truncated}
            label={`${tool.name} arguments`}
          />
        </div>
      {/if}

      <Collapsible trigger="Details" class="cinder-approval-card__details">
        <div class="cinder-approval-card__details-content">
          {#if sandbox}
            <div class="cinder-approval-card__details-group">
              <p class="cinder-approval-card__details-label">Sandbox</p>
              <dl class="cinder-approval-card__metadata cinder-approval-card__metadata--compact">
                <div class="cinder-approval-card__metadata-item">
                  <dt>Provider</dt>
                  <dd>{sandbox.provider}</dd>
                </div>
                <div class="cinder-approval-card__metadata-item">
                  <dt>Profile</dt>
                  <dd>{sandbox.name}</dd>
                </div>
                <div class="cinder-approval-card__metadata-item">
                  <dt>Working directory</dt>
                  <dd>{sandbox.workingDir}</dd>
                </div>
              </dl>
            </div>
          {/if}

          {#if environmentNames.length > 0}
            <div class="cinder-approval-card__details-group">
              <p class="cinder-approval-card__details-label">Environment</p>
              <ul
                class="cinder-approval-card__environment-list"
                aria-label="Environment variable names only; values are never shown"
              >
                {#each environmentNames as environmentName (environmentName)}
                  <li>
                    <Badge size="sm" mono>{environmentName}</Badge>
                  </li>
                {/each}
              </ul>
            </div>
          {/if}

          <dl class="cinder-approval-card__metadata">
            <div class="cinder-approval-card__metadata-item">
              <dt>Policy version</dt>
              <dd>
                {policyVersion}
                <span class="cinder-approval-card__metadata-help">
                  Approval policy that produced this request.
                </span>
              </dd>
            </div>
            <div class="cinder-approval-card__metadata-item">
              <dt>Idempotency key</dt>
              <dd>
                {idempotencyKey}
                <span class="cinder-approval-card__metadata-help">
                  Keeps this decision durable if it is submitted more than once.
                </span>
              </dd>
            </div>
            {#if snapshotId}
              <div class="cinder-approval-card__metadata-item">
                <dt>Snapshot</dt>
                <dd>
                  {snapshotId}
                  <span class="cinder-approval-card__metadata-help">
                    Workspace snapshot this request was captured against.
                  </span>
                </dd>
              </div>
            {/if}
          </dl>
        </div>
      </Collapsible>

      {#if isActionable && hasResolutionCallback}
        <ApprovalCardActions
          idBase={rootId}
          requestKey={idempotencyKey}
          {canEditArguments}
          argumentsValue={editableArgumentsValue}
          resolve={resolveIfActionable}
        />
      {/if}
      {#if !isActionable}
        <p class="cinder-approval-card__readonly-summary" data-cinder-state={effectiveState}>
          {readonlySummary}
        </p>
      {/if}
    </div>
  </Card>
</article>
