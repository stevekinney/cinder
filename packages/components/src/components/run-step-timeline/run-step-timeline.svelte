<script lang="ts" module>
  /**
   * @cinder
   * @category data-display
   * @status stable
   * @purpose Ordered execution rail for async run state: per-step status, durations, retries, plus parallel branch groups, rewound speculation, and saga compensation.
   * @tag timeline
   * @tag progress
   * @tag execution
   * @useWhen Displaying the live or completed state of a multi-step async operation: CI jobs, workflow runs, import pipelines, or deployments.
   * @useWhen Showing a sequence where one step is currently active and prior steps have streamed in over time.
   * @useWhen Visualizing speculative parallel work (race N lanes, keep the winner) or saga-style compensation of a forward step.
   * @avoidWhen Guiding users through an interactive wizard where they choose what to do next — use steps instead.
   * @avoidWhen Showing a flat timestamp-first event log without structured step state — use timeline instead.
   * @related timeline, steps, status-dot, progress, badge, collapsible
   */
  import type { RunStep, RunStepBranchGroup } from './run-step-timeline.types.ts';

  export type {
    RunStep,
    RunStepBranchGroup,
    RunStepBranchLane,
    RunStepBranchLaneOutcome,
    RunStepDetail,
    RunStepLink,
    RunStepStatus,
    RunStepTimelineEntry,
    RunStepTimelineProps,
  } from './run-step-timeline.types.ts';

  // View-model row types for the render pipeline. Defined in the module script
  // so snippet parameter annotations below can resolve them (svelte-check does
  // not reliably see instance-<script> local types from snippet signatures).
  type RenderedStepRow = {
    kind: 'step';
    step: RunStep;
    depth: number;
    pathKey: string;
    connectorAfter: 'hidden' | 'visible';
    ariaCurrent: boolean;
    /** Forward step label when this step compensates a resolvable sibling id. */
    compensatesLabel: string | undefined;
  };

  type RenderedDepthLimitRow = {
    kind: 'depth-limit';
    depth: number;
    pathKey: string;
    connectorAfter: 'hidden' | 'visible';
    ariaCurrent: boolean;
    hiddenStepCount: number;
    hiddenCurrent: boolean;
  };

  type RenderedBranchRow = {
    kind: 'branch';
    group: RunStepBranchGroup;
    pathKey: string;
    connectorAfter: 'hidden' | 'visible';
  };

  type RenderedStepLike = RenderedStepRow | RenderedDepthLimitRow;
  type RenderedEntry = RenderedStepLike | RenderedBranchRow;

  type PendingStepRow =
    | { kind: 'step'; step: RunStep; depth: number; pathKey: string }
    | {
        kind: 'depth-limit';
        depth: number;
        pathKey: string;
        hiddenStepCount: number;
        hiddenCurrent: boolean;
      };
</script>

<script lang="ts">
  import { classNames } from '../../utilities/class-names.ts';
  import Badge from '../badge/badge.svelte';
  import Collapsible from '../collapsible/collapsible.svelte';
  import RunStepBranchDisclosure from './run-step-branch-disclosure.svelte';
  import Link from '../link/link.svelte';
  import Progress from '../progress/progress.svelte';
  import StatusDot from '../status-dot/status-dot.svelte';
  import type { Attachment } from 'svelte/attachments';
  import type {
    RunStepBranchLane,
    RunStepTimelineEntry,
    RunStepTimelineProps,
  } from './run-step-timeline.types.ts';
  import {
    actionsCountLabel,
    badgeVariant,
    branchGroupHasCurrentStep,
    branchOutcomeSummary,
    branchStartsCollapsed,
    hasProgress,
    hiddenNestedStepLabel,
    isCurrent,
    isTerminal,
    laneOutcomeBadgeVariant,
    laneOutcomeLabel,
    metadataItems,
    relocateCompensationEntries,
    relocateCompensationSteps,
    safeStepLinkHref,
    statusDotStatus,
    statusLabel,
  } from './run-step-timeline.utilities.ts';

  const MAX_NESTED_STEP_DEPTH = 3;

  let {
    steps,
    label,
    selectedStepId,
    onStepSelect,
    class: className,
    children,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledby,
    ...rest
  }: RunStepTimelineProps = $props();

  const resolvedAriaLabel = $derived(
    ariaLabelledby === undefined && ariaLabel === undefined ? label : ariaLabel,
  );

  const renderedEntries = $derived(flattenEntries(relocateCompensationEntries(steps)));

  function isBranchGroup(entry: RunStepTimelineEntry): entry is RunStepBranchGroup {
    return 'kind' in entry && entry.kind === 'branch';
  }

  // Flatten the top-level entries, keeping contiguous runs of steps together so
  // the connector rail spans them, and emitting a standalone row for each
  // branch group (which renders its own parallel sub-lanes).
  function flattenEntries(entries: RunStepTimelineEntry[]): RenderedEntry[] {
    const result: RenderedEntry[] = [];
    let stepRun: RunStep[] = [];

    const flushRun = (): void => {
      if (stepRun.length === 0) return;
      result.push(...flattenSteps(stepRun, ''));
      stepRun = [];
    };

    for (const entry of entries) {
      if (isBranchGroup(entry)) {
        flushRun();
        result.push({
          kind: 'branch',
          group: entry,
          // A raw `%` can never appear in an escaped step-path segment
          // (escapeStepPathSegment turns `%` into `%25`), so this branch key
          // cannot collide with any step's path key.
          pathKey: `%branch/${escapeStepPathSegment(entry.id)}`,
          connectorAfter: 'hidden',
        });
      } else {
        stepRun.push(entry);
      }
    }
    flushRun();

    // `flattenSteps` computes `aria-current` within each contiguous run; on the
    // outer rail, keep a SINGLE deepest current row across the whole timeline so
    // a branch group between two active runs doesn't produce two current rows.
    // `applyGlobalRailConnectors` then reconnects the rail across run/branch
    // boundaries — each run is flattened in isolation, so its last row and the
    // branch rows would otherwise both hide their connector and split one
    // ordered run (step → branch → step) into disconnected rails.
    // `applyGlobalTopLevelCompensates` likewise resolves `compensates` for
    // top-level steps across the whole rail, since a compensating step can be
    // separated from its forward sibling by a branch group (different run).
    return applyGlobalRailConnectors(
      applyGlobalTopLevelCompensates(applyGlobalRailAriaCurrent(result)),
    );
  }

  // Resolve `compensates` for TOP-LEVEL steps across the entire outer rail. Each
  // contiguous run is flattened in isolation, so a compensating top-level step
  // separated from its forward sibling by a branch group (e.g. `charge → branch
  // → refund` where refund compensates charge) would never find it in its own
  // run's label map. Nested steps are unaffected: a branch group never nests
  // inside a step's children, so nested siblings always share a run and are
  // already resolved correctly by `flattenSteps`.
  function applyGlobalTopLevelCompensates(rows: RenderedEntry[]): RenderedEntry[] {
    const topLevelLabelByPathKey = new Map<string, string>();
    for (const row of rows) {
      if (row.kind === 'step' && row.depth === 0) {
        topLevelLabelByPathKey.set(row.pathKey, row.step.label);
      }
    }
    return rows.map((row) => {
      if (row.kind !== 'step' || row.depth !== 0 || row.step.compensates === undefined) return row;
      return {
        ...row,
        compensatesLabel: resolveSiblingCompensatesLabel(row, topLevelLabelByPathKey),
      };
    });
  }

  // A rail row's effective depth for connector purposes. Branch groups always
  // render at the top level, so they sit at depth 0.
  function railRowDepth(row: RenderedEntry): number {
    return row.kind === 'branch' ? 0 : row.depth;
  }

  // Recompute each top-level row's downward connector against the ACTUAL next
  // rendered row (including branch rows), rather than the per-run view that
  // `flattenSteps` sees. A connector shows unless the row is last or the next
  // row dedents to a shallower level — so a depth-0 step followed by a branch,
  // and a branch followed by another run, both stay linked.
  function applyGlobalRailConnectors(rows: RenderedEntry[]): RenderedEntry[] {
    return rows.map((row, index) => {
      const next = rows[index + 1];
      const connectorAfter: 'hidden' | 'visible' =
        next === undefined || railRowDepth(next) < railRowDepth(row) ? 'hidden' : 'visible';
      return { ...row, connectorAfter };
    });
  }

  // The "current depth" of a rail row: deeper is more current. A depth-limit row
  // that hides a current descendant counts one level below its own depth.
  function rowCurrentDepth(row: RenderedEntry): number {
    if (row.kind === 'depth-limit') return row.hiddenCurrent ? row.depth + 1 : -1;
    if (row.kind === 'step') return isCurrent(row.step.status) ? row.depth : -1;
    return -1;
  }

  // Reduce the rail to a single `aria-current="step"` row: the deepest current
  // step across all top-level runs. Branch groups do not participate.
  function applyGlobalRailAriaCurrent(rows: RenderedEntry[]): RenderedEntry[] {
    let deepestRow: RenderedEntry | undefined;
    let deepestDepth = -1;
    for (const row of rows) {
      const depth = rowCurrentDepth(row);
      if (depth > deepestDepth) {
        deepestDepth = depth;
        deepestRow = row;
      }
    }
    return rows.map((row) =>
      row.kind === 'branch' ? row : { ...row, ariaCurrent: row === deepestRow },
    );
  }

  // Flatten a RunStep[] (with nested children) into rendered rows, computing the
  // connector rail, the single deepest `aria-current` row, and resolved
  // compensation labels. Reused for the main rail and for each branch lane.
  function flattenSteps(list: RunStep[], pathPrefix: string): RenderedStepLike[] {
    const rows: PendingStepRow[] = [];
    appendRunStepRows(rows, relocateCompensationSteps(list), 0, pathPrefix);
    const currentRowIndex = deepestCurrentStepIndex(rows);

    // Index every step row by its unique path key (built from the escaped id
    // chain). A `compensates` id then resolves to a true SIBLING — a step under
    // the same parent — rather than any same-id descendant elsewhere in the run
    // or lane. Iterating the already-bounded, depth-capped rows also avoids
    // recursing the full step tree, which could overflow the stack.
    const labelByPathKey = new Map<string, string>();
    for (const row of rows) {
      if (row.kind === 'step') labelByPathKey.set(row.pathKey, row.step.label);
    }

    return rows.map((row, index) => {
      const next = rows[index + 1];
      const connectorAfter: 'hidden' | 'visible' =
        next === undefined || next.depth < row.depth ? 'hidden' : 'visible';
      const ariaCurrent = index === currentRowIndex;
      if (row.kind === 'depth-limit') {
        return { ...row, connectorAfter, ariaCurrent };
      }
      return {
        ...row,
        connectorAfter,
        ariaCurrent,
        compensatesLabel: resolveSiblingCompensatesLabel(row, labelByPathKey),
      };
    });
  }

  // Resolve a step's `compensates` id to the label of a sibling step (one under
  // the same parent), or `undefined` when there is no such sibling. Never
  // resolves to the step itself.
  function resolveSiblingCompensatesLabel(
    row: { step: RunStep; pathKey: string },
    labelByPathKey: Map<string, string>,
  ): string | undefined {
    if (row.step.compensates === undefined) return undefined;
    const lastSeparator = row.pathKey.lastIndexOf('/');
    const parentPrefix = lastSeparator === -1 ? '' : row.pathKey.slice(0, lastSeparator);
    const siblingPathKey = nestedStepPathKey(parentPrefix, row.step.compensates);
    if (siblingPathKey === row.pathKey) return undefined;
    return labelByPathKey.get(siblingPathKey);
  }

  function appendRunStepRows(
    rows: PendingStepRow[],
    list: RunStep[],
    depth: number,
    pathPrefix: string,
  ): void {
    for (const step of list) {
      const pathKey = nestedStepPathKey(pathPrefix, step.id);
      rows.push({ kind: 'step', step, depth, pathKey });
      if (step.children && step.children.length > 0) {
        if (depth < MAX_NESTED_STEP_DEPTH) {
          appendRunStepRows(rows, relocateCompensationSteps(step.children), depth + 1, pathKey);
        } else {
          const hiddenSummary = summarizeNestedRunSteps(step.children);
          rows.push({
            kind: 'depth-limit',
            depth,
            pathKey: `${pathKey}/__cinder-depth-limit`,
            hiddenStepCount: hiddenSummary.count,
            hiddenCurrent: hiddenSummary.hasCurrent,
          });
        }
      }
    }
  }

  function nestedStepPathKey(pathPrefix: string, stepId: string): string {
    const encodedStepId = escapeStepPathSegment(stepId);
    return pathPrefix === '' ? encodedStepId : `${pathPrefix}/${encodedStepId}`;
  }

  function escapeStepPathSegment(stepId: string): string {
    return stepId.replaceAll('%', '%25').replaceAll('/', '%2F');
  }

  function summarizeNestedRunSteps(list: RunStep[]): { count: number; hasCurrent: boolean } {
    let count = 0;
    let hasCurrent = false;
    const stack = [...list];

    while (stack.length > 0) {
      const step = stack.pop();
      if (step === undefined) continue;

      count += 1;
      if (isCurrent(step.status)) hasCurrent = true;

      const stepChildren = step.children;
      if (stepChildren) {
        for (let index = stepChildren.length - 1; index >= 0; index -= 1) {
          const child = stepChildren[index];
          if (child) stack.push(child);
        }
      }
    }

    return { count, hasCurrent };
  }

  function deepestCurrentStepIndex(rows: PendingStepRow[]): number {
    let currentIndex = -1;
    let currentDepth = -1;

    rows.forEach((row, index) => {
      const rowCurrentDepth =
        row.kind === 'depth-limit' && row.hiddenCurrent
          ? row.depth + 1
          : row.kind === 'step' && isCurrent(row.step.status)
            ? row.depth
            : -1;

      if (rowCurrentDepth > currentDepth) {
        currentIndex = index;
        currentDepth = rowCurrentDepth;
      }
    });

    return currentIndex;
  }

  function laneRows(groupPathKey: string, lane: RunStepBranchLane): RenderedStepLike[] {
    return flattenSteps(lane.steps, `${groupPathKey}/%lane/${escapeStepPathSegment(lane.id)}`);
  }

  function laneStateLabel(lane: RunStepBranchLane): string {
    return lane.outcome === undefined ? 'racing' : laneOutcomeLabel(lane.outcome).toLowerCase();
  }

  function handleStepSelect(stepPathKey: string): void {
    onStepSelect?.(stepPathKey);
  }

  function isInteractiveDescendant(node: HTMLLIElement, eventTarget: EventTarget | null): boolean {
    if (!(eventTarget instanceof Element)) return false;
    const interactiveTarget = eventTarget.closest(
      'a[href], button, input, label, select, textarea, summary, [contenteditable]:not([contenteditable="false"]), [role="button"], [role="link"], [tabindex]:not([tabindex="-1"])',
    );
    return (
      interactiveTarget !== null && interactiveTarget !== node && node.contains(interactiveTarget)
    );
  }

  function createStepSelectionAttachment(stepPathKey: string): Attachment<HTMLLIElement> {
    return (node) => {
      if (onStepSelect === undefined) return;

      const handleClick = (event: MouseEvent): void => {
        if (isInteractiveDescendant(node, event.target)) return;
        handleStepSelect(stepPathKey);
      };
      const handleKeydown = (event: KeyboardEvent): void => {
        if (event.target !== node) return;
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        handleStepSelect(stepPathKey);
      };

      node.addEventListener('click', handleClick);
      node.addEventListener('keydown', handleKeydown);
      return () => {
        node.removeEventListener('click', handleClick);
        node.removeEventListener('keydown', handleKeydown);
      };
    };
  }
</script>

{#snippet stepItem(row: RenderedStepRow)}
  {@const step = row.step}
  {@const terminal = isTerminal(step.status)}
  {@const metadata = metadataItems(step)}
  {@const selected = selectedStepId === row.pathKey}
  <li
    {@attach createStepSelectionAttachment(row.pathKey)}
    class="cinder-run-step-timeline__item"
    data-cinder-status={step.status}
    data-cinder-depth={row.depth}
    data-cinder-path={row.pathKey}
    data-cinder-terminal={terminal ? '' : undefined}
    data-cinder-rewound={step.rewound ? '' : undefined}
    data-cinder-compensation={row.compensatesLabel !== undefined ? '' : undefined}
    data-cinder-selected={selected ? '' : undefined}
    data-cinder-selectable={onStepSelect === undefined ? undefined : ''}
    data-cinder-connector-after={row.connectorAfter}
    aria-current={row.ariaCurrent ? 'step' : undefined}
    style:--_cinder-rst-depth={row.depth}
    tabindex={onStepSelect === undefined ? undefined : 0}
  >
    <div class="cinder-run-step-timeline__event">
      <span class="cinder-run-step-timeline__marker" aria-hidden="true" inert>
        <StatusDot
          status={statusDotStatus(step.status)}
          label={statusLabel(step.status)}
          showLabel={false}
          size="md"
        />
      </span>

      <div class="cinder-run-step-timeline__content">
        <div class="cinder-run-step-timeline__header">
          <span class="cinder-run-step-timeline__label">{step.label}</span>
          {#if step.link}
            {@const safeLinkHref = safeStepLinkHref(step.link.href)}
            {#if safeLinkHref}
              <Link href={safeLinkHref} class="cinder-run-step-timeline__link">
                {step.link.label}
              </Link>
            {:else}
              <span class="cinder-run-step-timeline__link cinder-run-step-timeline__link--unsafe">
                {step.link.label}
              </span>
            {/if}
          {/if}
          <Badge
            class="cinder-run-step-timeline__status"
            variant={badgeVariant(step.status)}
            size="xs"
            aria-label={`Status: ${statusLabel(step.status)}`}
          >
            {statusLabel(step.status)}
          </Badge>
          {#if step.rewound}
            <Badge
              class="cinder-run-step-timeline__flag"
              variant="neutral"
              size="xs"
              aria-label="State: rewound — speculatively executed, then unwound"
            >
              Rewound
            </Badge>
          {/if}
          {#if row.compensatesLabel !== undefined}
            <Badge
              class="cinder-run-step-timeline__flag"
              variant="warning"
              size="xs"
              aria-label={`Compensates ${row.compensatesLabel} — reverses the forward step`}
            >
              Compensates {row.compensatesLabel}
            </Badge>
          {/if}
          {#if step.attemptCount !== undefined && step.attemptCount > 1}
            <Badge variant="neutral" size="xs" mono>attempt {step.attemptCount}</Badge>
          {/if}
          {#if step.actionsCount !== undefined && step.actionsCount > 0}
            <Badge variant="neutral" size="xs" mono>{actionsCountLabel(step.actionsCount)}</Badge>
          {/if}
        </div>

        {#if hasProgress(step)}
          <div class="cinder-run-step-timeline__progress">
            <Progress
              value={step.progress ?? 0}
              max={step.progressMax ?? 100}
              size="sm"
              ariaLabel={`${step.label} progress`}
            />
          </div>
        {/if}

        {#if metadata.length > 0}
          <dl class="cinder-run-step-timeline__meta">
            {#each metadata as item (item.term)}
              <div class="cinder-run-step-timeline__meta-row">
                <dt class="cinder-run-step-timeline__meta-term">{item.term}</dt>
                <dd class="cinder-run-step-timeline__meta-definition">{item.definition}</dd>
              </div>
            {/each}
          </dl>
        {/if}

        {#if step.details && step.details.length > 0}
          <div class="cinder-run-step-timeline__details">
            {#each step.details as detail (detail.id)}
              <Collapsible trigger={detail.label}>
                <pre class="cinder-run-step-timeline__detail-content">{detail.content}</pre>
              </Collapsible>
            {/each}
          </div>
        {/if}

        {#if children}
          <div class="cinder-run-step-timeline__body">
            {@render children(step)}
          </div>
        {/if}
      </div>
    </div>
  </li>
{/snippet}

{#snippet depthLimitItem(row: RenderedDepthLimitRow)}
  <li
    class="cinder-run-step-timeline__item"
    data-cinder-status="depth-limit"
    data-cinder-depth={row.depth}
    data-cinder-path={row.pathKey}
    data-cinder-connector-after={row.connectorAfter}
    data-cinder-depth-limit
    aria-current={row.ariaCurrent ? 'step' : undefined}
    style:--_cinder-rst-depth={row.depth}
  >
    <div class="cinder-run-step-timeline__event">
      <span class="cinder-run-step-timeline__marker" aria-hidden="true" inert>
        <StatusDot status="neutral" label="Nested steps hidden" showLabel={false} size="md" />
      </span>

      <div class="cinder-run-step-timeline__content">
        <div class="cinder-run-step-timeline__header">
          <span class="cinder-run-step-timeline__label">
            {hiddenNestedStepLabel(row.hiddenStepCount)}
          </span>
          <Badge
            class="cinder-run-step-timeline__status"
            variant="neutral"
            size="xs"
            aria-label="Status: Nested child steps hidden"
          >
            Depth cap
          </Badge>
        </div>
        <p class="cinder-run-step-timeline__body">
          Additional child-workflow steps are hidden because the timeline depth cap was reached.
        </p>
      </div>
    </div>
  </li>
{/snippet}

{#snippet stepRail(rows: RenderedStepLike[])}
  {#each rows as row (row.pathKey)}
    {#if row.kind === 'depth-limit'}
      {@render depthLimitItem(row)}
    {:else}
      {@render stepItem(row)}
    {/if}
  {/each}
{/snippet}

<ol
  {...rest}
  class={classNames('cinder-run-step-timeline', className)}
  aria-label={resolvedAriaLabel}
  aria-labelledby={ariaLabelledby}
>
  {#each renderedEntries as entry (entry.pathKey)}
    {#if entry.kind === 'branch'}
      {@const group = entry.group}
      {@const summary = branchOutcomeSummary(group.lanes)}
      {@const initialOpen =
        !branchStartsCollapsed(group.lanes.length, group.collapseThreshold, group.collapsed) ||
        (group.collapsed === undefined && branchGroupHasCurrentStep(group))}
      <li
        class="cinder-run-step-timeline__item cinder-run-step-timeline__item--branch"
        data-cinder-status="branch"
        data-cinder-depth="0"
        data-cinder-path={entry.pathKey}
        data-cinder-connector-after={entry.connectorAfter}
      >
        <div class="cinder-run-step-timeline__event">
          <span class="cinder-run-step-timeline__marker" aria-hidden="true" inert>
            <StatusDot status="accent" label="Branch group" showLabel={false} size="md" />
          </span>

          <div class="cinder-run-step-timeline__content cinder-run-step-timeline__branch">
            <RunStepBranchDisclosure
              {initialOpen}
              class="cinder-run-step-timeline__branch-disclosure"
              triggerAriaLabel={`Branch group: ${group.label}. ${summary}.`}
            >
              {#snippet trigger()}
                <span class="cinder-run-step-timeline__branch-heading">
                  <span class="cinder-run-step-timeline__label">{group.label}</span>
                  <Badge variant="accent" size="xs" aria-label={`Branch group outcome: ${summary}`}>
                    {summary}
                  </Badge>
                </span>
              {/snippet}

              <ul class="cinder-run-step-timeline__lanes" aria-label={`${group.label} branches`}>
                {#each group.lanes as lane (lane.id)}
                  <li
                    class="cinder-run-step-timeline__lane"
                    data-cinder-outcome={lane.outcome ?? 'racing'}
                    aria-label={`Branch ${lane.label ?? lane.id}: ${laneStateLabel(lane)}`}
                  >
                    <div class="cinder-run-step-timeline__lane-header">
                      <span class="cinder-run-step-timeline__lane-label">
                        {lane.label ?? lane.id}
                      </span>
                      {#if lane.outcome !== undefined}
                        <Badge
                          variant={laneOutcomeBadgeVariant(lane.outcome)}
                          size="xs"
                          aria-label={`Outcome: ${laneOutcomeLabel(lane.outcome)}`}
                        >
                          {laneOutcomeLabel(lane.outcome)}
                        </Badge>
                      {:else}
                        <Badge variant="info" size="xs" aria-label="Outcome: still racing">
                          Racing
                        </Badge>
                      {/if}
                    </div>
                    <ol
                      class="cinder-run-step-timeline cinder-run-step-timeline__lane-steps"
                      aria-label={`${lane.label ?? lane.id} steps`}
                    >
                      {@render stepRail(laneRows(entry.pathKey, lane))}
                    </ol>
                  </li>
                {/each}
              </ul>
            </RunStepBranchDisclosure>
          </div>
        </div>
      </li>
    {:else if entry.kind === 'depth-limit'}
      {@render depthLimitItem(entry)}
    {:else}
      {@render stepItem(entry)}
    {/if}
  {/each}
</ol>
