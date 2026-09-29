<script lang="ts">
  import type { Snippet } from 'svelte';
  import {
    Brain,
    CircleDot,
    Globe,
    Pencil,
    RunStepTimeline,
    Search,
    Terminal,
    type RunStep,
    type RunStepDetail,
  } from '@lostgradient/cinder';
  import { stringify } from '../../../utilities/stringify.ts';
  import type { ToolCallPair } from '../conversation-model.ts';
  import type { ToolCallPresentation } from '../utilities/types.ts';
  import { formatToolCallProse } from '../utilities/utilities.ts';

  let {
    pairs,
    messageId,
    describeToolCall,
    expanded = false,
    onToggle,
    activityActive = true,
  }: {
    pairs: ToolCallPair[];
    messageId?: string;
    describeToolCall?: ((pair: ToolCallPair) => ToolCallPresentation | undefined) | undefined;
    expanded?: boolean;
    onToggle?: (() => void) | undefined;
    activityActive?: boolean;
  } = $props();
  const navigationMessageId = $derived(messageId ?? pairs[0]?.call.id ?? 'tool-call-timeline');
  const headingId = $derived(`message-${navigationMessageId}-tool-call-summary`);

  function formatPayload(value: unknown): string {
    return value === null ? 'null' : stringify(value);
  }

  function isJsonCodeValue(value: unknown): boolean {
    return (
      value === null ||
      typeof value === 'boolean' ||
      typeof value === 'number' ||
      typeof value === 'object'
    );
  }

  function codeDetail(id: string, label: string, value: unknown): RunStepDetail {
    return {
      id,
      label,
      type: 'code',
      code: formatPayload(value),
      language: 'json',
      languageLabelVisible: false,
      open: expanded,
      onToggle: () => onToggle?.(),
    };
  }

  function textDetail(id: string, label: string, content: string): RunStepDetail {
    return { id, label, type: 'text', content, open: expanded, onToggle: () => onToggle?.() };
  }

  function payloadDetail(id: string, label: string, value: unknown): RunStepDetail {
    return isJsonCodeValue(value)
      ? codeDetail(id, label, value)
      : textDetail(id, label, String(value));
  }

  function resultDetails(pair: ToolCallPair, detailPrefix: string): RunStepDetail[] {
    if (!pair.result) return [];

    if (pair.result.outcome === 'error') {
      return [
        textDetail(
          `${detailPrefix}-error`,
          'Error',
          pair.result.error?.message ?? formatPayload(pair.result.content),
        ),
      ];
    }

    if (pair.result.outcome === 'action_required') {
      const details = [
        payloadDetail(`${detailPrefix}-result`, 'Result', pair.result.content),
        textDetail(
          `${detailPrefix}-action`,
          'Action',
          pair.result.action?.message ?? 'This tool call requires action.',
        ),
      ];
      if (pair.result.action?.type === 'input' && pair.result.action.schema !== undefined) {
        details.push(
          codeDetail(`${detailPrefix}-schema`, 'Input schema', pair.result.action.schema),
        );
      }
      return details;
    }

    return [payloadDetail(`${detailPrefix}-result`, 'Result', pair.result.content)];
  }

  function statusText(pair: ToolCallPair): string {
    if (pair.result?.outcome === 'error') return 'Failed';
    if (pair.result?.outcome === 'action_required') return 'Action required';
    if (pair.result?.outcome === 'success') return 'Complete';
    return 'Pending';
  }

  const activityPresentations = $derived(pairs.map((pair) => describeToolCall?.(pair)));

  const steps = $derived(
    pairs.map((pair, index): RunStep => {
      const presentation = activityPresentations[index];
      const detailPrefix = `${navigationMessageId}-${index}-${pair.call.id}`;
      const icon = presentation
        ? toolActivityIcon(
            presentation.kind,
            activityActive && presentation.tense === 'present' && !pair.result,
          )
        : undefined;

      return {
        id: `${index}:${pair.call.id}`,
        label: presentation ? formatToolCallProse(presentation) : pair.call.name,
        icon,
        status:
          pair.result?.outcome === 'error'
            ? 'failed'
            : pair.result?.outcome === 'action_required'
              ? 'waiting_approval'
              : pair.result
                ? 'succeeded'
                : 'pending',
        details: [
          codeDetail(`${detailPrefix}-arguments`, 'Arguments', pair.call.arguments),
          ...resultDetails(pair, detailPrefix),
        ],
      };
    }),
  );
  const completedCount = $derived(steps.filter((step) => step.status === 'succeeded').length);

  const callsLabel = $derived(
    `${pairs.length} consecutive tool ${pairs.length === 1 ? 'call' : 'calls'}`,
  );
  const announcerText = $derived(
    pairs.map((pair) => `${pair.call.name}: ${statusText(pair)}`).join('. '),
  );

  function toolActivityIcon(kind: ToolCallPresentation['kind'], active: boolean): Snippet {
    if (kind === 'search') return active ? searchActiveIcon : searchIcon;
    if (kind === 'fetch') return active ? fetchActiveIcon : fetchIcon;
    if (kind === 'write') return active ? writeActiveIcon : writeIcon;
    if (kind === 'execute') return active ? executeActiveIcon : executeIcon;
    if (kind === 'reason') return active ? reasonActiveIcon : reasonIcon;
    return active ? defaultActiveIcon : defaultIcon;
  }
</script>

{#snippet searchIcon()}
  <span class="chat-tool-call-activity-icon" data-kind="search">
    <Search aria-hidden="true" />
  </span>
{/snippet}

{#snippet searchActiveIcon()}
  <span class="chat-tool-call-activity-icon" data-kind="search" data-cinder-tool-activity-active>
    <Search aria-hidden="true" />
  </span>
{/snippet}

{#snippet fetchIcon()}
  <span class="chat-tool-call-activity-icon" data-kind="fetch">
    <Globe aria-hidden="true" />
  </span>
{/snippet}

{#snippet fetchActiveIcon()}
  <span class="chat-tool-call-activity-icon" data-kind="fetch" data-cinder-tool-activity-active>
    <Globe aria-hidden="true" />
  </span>
{/snippet}

{#snippet writeIcon()}
  <span class="chat-tool-call-activity-icon" data-kind="write">
    <Pencil aria-hidden="true" />
  </span>
{/snippet}

{#snippet writeActiveIcon()}
  <span class="chat-tool-call-activity-icon" data-kind="write" data-cinder-tool-activity-active>
    <Pencil aria-hidden="true" />
  </span>
{/snippet}

{#snippet executeIcon()}
  <span class="chat-tool-call-activity-icon" data-kind="execute">
    <Terminal aria-hidden="true" />
  </span>
{/snippet}

{#snippet executeActiveIcon()}
  <span class="chat-tool-call-activity-icon" data-kind="execute" data-cinder-tool-activity-active>
    <Terminal aria-hidden="true" />
  </span>
{/snippet}

{#snippet reasonIcon()}
  <span class="chat-tool-call-activity-icon" data-kind="reason">
    <Brain aria-hidden="true" />
  </span>
{/snippet}

{#snippet reasonActiveIcon()}
  <span class="chat-tool-call-activity-icon" data-kind="reason" data-cinder-tool-activity-active>
    <Brain aria-hidden="true" />
  </span>
{/snippet}

{#snippet defaultIcon()}
  <span class="chat-tool-call-activity-icon" data-kind="generic">
    <CircleDot aria-hidden="true" />
  </span>
{/snippet}

{#snippet defaultActiveIcon()}
  <span class="chat-tool-call-activity-icon" data-kind="generic" data-cinder-tool-activity-active>
    <CircleDot aria-hidden="true" />
  </span>
{/snippet}

<section
  id={`message-${navigationMessageId}`}
  class="chat-tool-call-timeline chat-navigation-row"
  data-cinder-tool-call-count={pairs.length}
  aria-labelledby={headingId}
  tabindex="-1"
>
  <span class="cinder-sr-only" aria-live="polite" aria-atomic="true">{announcerText}</span>
  <h3 id={headingId}>
    Called {pairs.length === 1 ? '1 tool' : `${pairs.length} tools`}{completedCount
      ? `, ${completedCount} complete`
      : ''}
  </h3>
  <RunStepTimeline {steps} label={callsLabel} />
</section>

<style>
  .chat-tool-call-timeline {
    inline-size: min(42rem, 100%);
    min-inline-size: 0;
    max-inline-size: 100%;
    padding: var(--cinder-space-3);
    border: 1px solid var(--cinder-border-muted);
    border-radius: var(--cinder-radius-md);
    background: var(--cinder-surface);
  }

  .chat-tool-call-timeline:focus-visible {
    outline: var(--cinder-ring-width) solid transparent;
    box-shadow: var(--_cinder-focus-ring-shadow);
  }

  @media (forced-colors: active) {
    .chat-tool-call-timeline:focus-visible {
      outline: var(--cinder-ring-width) solid ButtonText;
    }
  }

  @container (min-width: 22rem) {
    .chat-tool-call-timeline {
      min-inline-size: 20rem;
    }
  }

  h3 {
    margin: 0 0 var(--cinder-space-3);
    font-size: var(--_cinder-chat-text-sm, var(--cinder-text-sm));
  }
</style>
