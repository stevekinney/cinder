<script lang="ts">
  /**
   * Inline six-treatment fault banner for `createQuery` errors (plan §10.4;
   * design `Weft Patterns.dc.html` "Fault / error banner"). `query.ts`'s own
   * module doc is explicit that query errors never reach `<FaultBoundary>`
   * (it only catches render-phase exceptions) and that route components
   * "render the SAME six-treatment FaultDisplay banner inline" themselves —
   * this component is that banner for the System tabs, sharing
   * `fault-boundary.svelte`'s classes (`.weft-fault-boundary*`, already
   * global via `src/styles/foundation.css`) rather than duplicating the CSS.
   */
  import { Badge, Button } from '@lostgradient/cinder';
  import {
    CircleSlash,
    CircleX,
    GitPullRequestClosed,
    Lock,
    SearchX,
    ServerCrash,
    type IconProps,
  } from 'lucide-svelte';
  import type { ComponentType, SvelteComponent } from 'svelte';

  import {
    FAULT_TREATMENT_TITLE,
    faultTreatment,
    type FaultTreatmentKind,
  } from '../../lib/faults.ts';

  interface Props {
    error: unknown;
    onRetry?: (() => void) | undefined;
  }

  let { error, onRetry }: Props = $props();

  const FAULT_ICON: Readonly<
    Record<FaultTreatmentKind, ComponentType<SvelteComponent<IconProps>>>
  > = {
    'not-found': SearchX,
    conflict: GitPullRequestClosed,
    invalid: CircleX,
    unauthorized: Lock,
    'not-supported': CircleSlash,
    internal: ServerCrash,
  };

  const FAULT_TONE: Readonly<Record<FaultTreatmentKind, 'neutral' | 'warning' | 'danger'>> = {
    'not-found': 'neutral',
    conflict: 'warning',
    invalid: 'danger',
    unauthorized: 'danger',
    'not-supported': 'neutral',
    internal: 'danger',
  };

  const treatment = $derived(faultTreatment(error));
  const Icon = $derived(FAULT_ICON[treatment.kind]);
  const tone = $derived(FAULT_TONE[treatment.kind]);
</script>

<div class="weft-fault-boundary" data-tone={tone} role="alert">
  <div class="weft-fault-boundary__banner">
    <Icon aria-hidden="true" size={16} class="weft-fault-boundary__icon" />
    <Badge variant={tone}>{FAULT_TREATMENT_TITLE[treatment.kind]}</Badge>
    <p class="weft-fault-boundary__message">{treatment.message}</p>
    {#if onRetry}
      <Button size="sm" variant="secondary" label="Retry" onclick={onRetry} />
    {/if}
  </div>

  {#if treatment.kind === 'internal' && treatment.tryViaJsonRpc}
    <p class="weft-fault-boundary__note">
      The REST API hides internal error detail on this response — the same request over JSON-RPC
      returns the full fault.
    </p>
  {/if}
</div>
