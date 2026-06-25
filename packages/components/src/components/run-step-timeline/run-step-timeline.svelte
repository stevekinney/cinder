<script lang="ts" module>
  /**
   * @cinder
   * @category data-display
   * @status stable
   * @purpose Ordered step-by-step execution rail that visualizes async run state with per-step status, durations, retries, optional progress, and expandable detail panels.
   * @tag timeline
   * @tag progress
   * @tag execution
   * @useWhen Displaying the live or completed state of a multi-step async operation: CI jobs, workflow runs, import pipelines, or deployments.
   * @useWhen Showing a sequence where one step is currently active and prior steps have streamed in over time.
   * @avoidWhen Guiding users through an interactive wizard where they choose what to do next — use steps instead.
   * @avoidWhen Showing a flat timestamp-first event log without structured step state — use timeline instead.
   * @related timeline, steps, status-dot, progress, badge, collapsible
   */
  export type {
    RunStep,
    RunStepDetail,
    RunStepLink,
    RunStepStatus,
    RunStepTimelineProps,
  } from './run-step-timeline.types.ts';
</script>

<script lang="ts">
  import { classNames } from '../../utilities/class-names.ts';
  import Badge from '../badge/badge.svelte';
  import Collapsible from '../collapsible/collapsible.svelte';
  import Link from '../link/link.svelte';
  import Progress from '../progress/progress.svelte';
  import StatusDot from '../status-dot/status-dot.svelte';
  import type { StatusDotStatus } from '../status-dot/status-dot.types.ts';
  import type { RunStep, RunStepStatus, RunStepTimelineProps } from './run-step-timeline.types.ts';

  const MAX_NESTED_STEP_DEPTH = 3;

  type RenderedRunStep = {
    step: RunStep;
    depth: number;
    pathKey: string;
    connectorAfter: 'hidden' | 'visible';
    ariaCurrent: boolean;
  };

  let {
    steps,
    label,
    class: className,
    children,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledby,
    ...rest
  }: RunStepTimelineProps = $props();

  const resolvedAriaLabel = $derived(
    ariaLabelledby === undefined && ariaLabel === undefined ? label : ariaLabel,
  );

  const renderedSteps = $derived(flattenRunSteps(steps));

  // Map generic RunStepStatus onto StatusDot status tokens.
  function statusDotStatus(status: RunStepStatus): StatusDotStatus {
    switch (status) {
      case 'succeeded':
        return 'success';
      case 'failed':
        return 'danger';
      case 'running':
        return 'online';
      case 'retrying':
        return 'warning';
      case 'waiting_approval':
        return 'accent';
      case 'cancelled':
        return 'offline';
      case 'skipped':
        return 'neutral';
      case 'pending':
        return 'pending';
    }
  }

  // Human-readable label for the StatusDot accessible name.
  function statusLabel(status: RunStepStatus): string {
    switch (status) {
      case 'pending':
        return 'Pending';
      case 'running':
        return 'Running';
      case 'succeeded':
        return 'Succeeded';
      case 'failed':
        return 'Failed';
      case 'cancelled':
        return 'Cancelled';
      case 'skipped':
        return 'Skipped';
      case 'retrying':
        return 'Retrying';
      case 'waiting_approval':
        return 'Waiting approval';
    }
  }

  // Map RunStepStatus to a Badge variant for the status chip.
  type BadgeVariant = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent';
  function badgeVariant(status: RunStepStatus): BadgeVariant {
    switch (status) {
      case 'succeeded':
        return 'success';
      case 'failed':
        return 'danger';
      case 'running':
        return 'info';
      case 'retrying':
        return 'warning';
      case 'waiting_approval':
        return 'accent';
      case 'cancelled':
        return 'neutral';
      case 'skipped':
        return 'neutral';
      case 'pending':
        return 'neutral';
    }
  }

  // Whether this status is a terminal state (no further changes expected).
  function isTerminal(status: RunStepStatus): boolean {
    return (
      status === 'succeeded' ||
      status === 'failed' ||
      status === 'cancelled' ||
      status === 'skipped'
    );
  }

  function isCurrent(status: RunStepStatus): boolean {
    return status === 'running' || status === 'retrying' || status === 'waiting_approval';
  }

  // Whether this step has a progress bar to show.
  function hasProgress(step: RunStep): boolean {
    return step.progress !== undefined && isCurrent(step.status);
  }

  // Metadata items for a step, as term/definition pairs.
  function metadataItems(step: RunStep): { term: string; definition: string }[] {
    const items: { term: string; definition: string }[] = [];
    if (step.startTime !== undefined) {
      items.push({ term: 'Started', definition: step.startTime });
    }
    if (step.endTime !== undefined) {
      items.push({ term: 'Ended', definition: step.endTime });
    }
    if (step.duration !== undefined) {
      items.push({ term: 'Duration', definition: step.duration });
    }
    if (step.attemptCount !== undefined && step.attemptCount > 1) {
      items.push({ term: 'Attempts', definition: String(step.attemptCount) });
    }
    return items;
  }

  function actionsCountLabel(actionsCount: number): string {
    return actionsCount === 1 ? '1 action' : `${actionsCount} actions`;
  }

  function safeStepLinkHref(href: string): string | undefined {
    const trimmedHref = href.trim();
    if (trimmedHref === '') return undefined;
    if (/[\u0000-\u001F\u007F]/.test(trimmedHref)) return undefined;
    if (trimmedHref.startsWith('//')) return undefined;

    if (/^[A-Za-z][A-Za-z\d+.-]*:/.test(trimmedHref)) {
      try {
        const parsedUrl = new URL(trimmedHref);
        return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:'
          ? trimmedHref
          : undefined;
      } catch {
        return undefined;
      }
    }

    return trimmedHref;
  }

  function flattenRunSteps(steps: RunStep[]): RenderedRunStep[] {
    const rows: Omit<RenderedRunStep, 'connectorAfter' | 'ariaCurrent'>[] = [];
    appendRunStepRows(rows, steps, 0, '');
    const currentRowIndex = rows.findIndex((row) => isCurrent(row.step.status));
    return rows.map((row, index) => ({
      ...row,
      connectorAfter:
        rows[index + 1] === undefined || (rows[index + 1]?.depth ?? 0) < row.depth
          ? 'hidden'
          : 'visible',
      ariaCurrent: index === currentRowIndex,
    }));
  }

  function appendRunStepRows(
    rows: Omit<RenderedRunStep, 'connectorAfter' | 'ariaCurrent'>[],
    steps: RunStep[],
    depth: number,
    pathPrefix: string,
  ): void {
    for (const step of steps) {
      const pathKey = pathPrefix === '' ? step.id : `${pathPrefix}/${step.id}`;
      rows.push({ step, depth, pathKey });
      if (depth < MAX_NESTED_STEP_DEPTH && step.children && step.children.length > 0) {
        appendRunStepRows(rows, step.children, depth + 1, pathKey);
      }
    }
  }
</script>

<ol
  {...rest}
  class={classNames('cinder-run-step-timeline', className)}
  aria-label={resolvedAriaLabel}
  aria-labelledby={ariaLabelledby}
>
  {#each renderedSteps as row (row.pathKey)}
    {@const step = row.step}
    {@const terminal = isTerminal(step.status)}
    {@const metadata = metadataItems(step)}
    <li
      class="cinder-run-step-timeline__item"
      data-cinder-status={step.status}
      data-cinder-depth={row.depth}
      data-cinder-path={row.pathKey}
      data-cinder-terminal={terminal ? '' : undefined}
      data-cinder-connector-after={row.connectorAfter}
      aria-current={row.ariaCurrent ? 'step' : undefined}
      style:--_cinder-rst-depth={row.depth}
    >
      <div class="cinder-run-step-timeline__event">
        <!-- Marker: StatusDot on the rail -->
        <span class="cinder-run-step-timeline__marker" aria-hidden="true" inert>
          <StatusDot
            status={statusDotStatus(step.status)}
            label={statusLabel(step.status)}
            showLabel={false}
            size="md"
          />
        </span>

        <!-- Step content -->
        <div class="cinder-run-step-timeline__content">
          <!-- Header row: label + status badge -->
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
            {#if step.attemptCount !== undefined && step.attemptCount > 1}
              <Badge variant="neutral" size="xs" mono>attempt {step.attemptCount}</Badge>
            {/if}
            {#if step.actionsCount !== undefined && step.actionsCount > 0}
              <Badge variant="neutral" size="xs" mono>{actionsCountLabel(step.actionsCount)}</Badge>
            {/if}
          </div>

          <!-- Progress bar (only shown for current statuses with explicit progress) -->
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

          <!-- Metadata: start/end/duration/attempts -->
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

          <!-- Expandable details (logs, payloads, errors) -->
          {#if step.details && step.details.length > 0}
            <div class="cinder-run-step-timeline__details">
              <!-- No idBase: let each Collapsible mint its own collision-free
                   id via $props.id(). Passing detail.id here would reuse a
                   consumer-supplied value that is only unique within a step, so
                   two steps with a detail id like "logs" would produce duplicate
                   DOM ids and cross-wired aria-controls. -->
              {#each step.details as detail (detail.id)}
                <Collapsible trigger={detail.label}>
                  <pre class="cinder-run-step-timeline__detail-content">{detail.content}</pre>
                </Collapsible>
              {/each}
            </div>
          {/if}

          <!-- Optional per-step body slot -->
          {#if children}
            <div class="cinder-run-step-timeline__body">
              {@render children(step)}
            </div>
          {/if}
        </div>
      </div>
    </li>
  {/each}
</ol>
