<script lang="ts">
  /**
   * Inline fault banner for a TanStack `createQuery` error (plan §10.4).
   * `query.ts`'s own doc is explicit that query failures do NOT throw (they
   * degrade to last-known cached data instead), so `<FaultBoundary>`
   * (`src/app/fault-boundary.svelte`) never sees them — route components
   * read `query.error` directly and render the same six-treatment banner
   * inline themselves. Mirrors the Workflows list track's identical
   * component (`src/routes/workflows/list/query-fault-banner.svelte`) —
   * shared by `reviews-inbox.svelte`'s list pane and `reviews-archive.svelte`
   * so a non-403 query failure (401, 500, network) never renders as a false
   * "all caught up" / "no decisions yet" empty state.
   */
  import { Badge, Button } from '@lostgradient/cinder';
  import {
    CircleSlash,
    CircleX,
    GitPullRequestClosed,
    Lock,
    SearchX,
    ServerCrash,
  } from 'lucide-svelte';

  import {
    FAULT_TREATMENT_TITLE,
    faultTreatment,
    type FaultTreatmentKind,
  } from '../../lib/faults.ts';

  interface QueryFaultBannerProps {
    error: unknown;
    onRetry: () => void;
  }

  let { error, onRetry }: QueryFaultBannerProps = $props();

  const treatment = $derived(faultTreatment(error));

  const FAULT_ICON = {
    'not-found': SearchX,
    conflict: GitPullRequestClosed,
    invalid: CircleX,
    unauthorized: Lock,
    'not-supported': CircleSlash,
    internal: ServerCrash,
  } as const satisfies Record<FaultTreatmentKind, unknown>;

  const FAULT_TONE = {
    'not-found': 'neutral',
    conflict: 'warning',
    invalid: 'danger',
    unauthorized: 'danger',
    'not-supported': 'neutral',
    internal: 'danger',
  } as const satisfies Record<FaultTreatmentKind, 'neutral' | 'warning' | 'danger'>;

  const Icon = $derived(FAULT_ICON[treatment.kind]);
  const tone = $derived(FAULT_TONE[treatment.kind]);
</script>

<div class="weft-query-fault" data-tone={tone} role="alert">
  <Icon aria-hidden="true" size={16} class="weft-query-fault__icon" />
  <Badge variant={tone}>{FAULT_TREATMENT_TITLE[treatment.kind]}</Badge>
  <p class="weft-query-fault__message">{treatment.message}</p>
  <Button size="sm" variant="secondary" label="Retry" onclick={onRetry} />
</div>
