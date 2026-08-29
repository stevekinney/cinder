<script lang="ts" module>
  /**
   * @cinder
   * @category data-display
   * @status beta
   * @purpose Context-scoped registry for versioned, dismissible product guidance claims.
   */
  export type { GuidanceRegionProps } from './guidance-region.types.ts';
</script>

<script lang="ts">
  import {
    setGuidanceContext,
    isRelevant,
    claimModalSlot,
    resetModalSlot,
    type GuidanceApi,
  } from '../../_internal/guidance-context.ts';
  import type { GuidanceRegionProps } from './guidance-region.types.ts';
  import type { GuidanceClaim } from '../../_internal/guidance-context.ts';
  import type { ModalApi } from '../../_internal/modal-context.ts';
  import { useModal } from '../../utilities/use-modal.ts';
  import Popover from '../popover/popover.svelte';
  import Button from '../button/button.svelte';
  let {
    claims: initialClaims = [],
    version,
    storage,
    storageKey = 'cinder-guidance',
    anchorResolver,
    children,
  }: GuidanceRegionProps = $props();
  let dismissed = $state(new Set<string>());
  let claimed = $state(new Set<string>());
  let activeClaim = $state<GuidanceClaim | null>(null);
  let anchoredOpen = $state(false);
  let modalApi: ModalApi | undefined;
  try {
    modalApi = useModal();
  } catch {
    modalApi = undefined;
  }
  let activeClaims = $derived(
    initialClaims.filter((claim) => isRelevant(claim, version) && !dismissed.has(claim.id)),
  );
  const api: GuidanceApi = {
    claim(id) {
      const claim = activeClaims.find((candidate) => candidate.id === id);
      if (
        !claim ||
        activeClaim !== null ||
        !isRelevant(claim, version) ||
        dismissed.has(claim.id) ||
        claimed.has(claim.id) ||
        storage?.get(`${storageKey}:${claim.id}`) ||
        (claim.kind === 'modal' && (!modalApi || !claimModalSlot()))
      )
        return false;
      claimed = new Set(claimed).add(claim.id);
      activeClaim = claim;
      anchoredOpen = claim.kind !== 'modal';
      return true;
    },
    resolveAnchor(claim: GuidanceClaim) {
      if (!claim.anchor || !anchorResolver) return null;
      return anchorResolver(claim.anchor);
    },
    dismiss(id) {
      dismissed = new Set(dismissed).add(id);
      storage?.set(`${storageKey}:${id}`, true);
      if (activeClaim?.id === id) {
        anchoredOpen = false;
        activeClaim = null;
      }
    },
    resetAll() {
      for (const claim of initialClaims) storage?.remove?.(`${storageKey}:${claim.id}`);
      dismissed = new Set();
      claimed = new Set();
      activeClaim = null;
      anchoredOpen = false;
      resetModalSlot();
    },
    claims: () => activeClaims,
  };
  setGuidanceContext(api);

  let openedModalId: string | null = null;
  $effect(() => {
    const claim = activeClaim;
    if (!claim || claim.kind !== 'modal' || openedModalId === claim.id) return;
    openedModalId = claim.id;
    void modalApi
      ?.confirm({
        id: `cinder-guidance-${claim.id}`,
        title: 'Guidance',
        description: claim.content,
        confirmLabel: 'Got it',
        cancelLabel: 'Dismiss',
      })
      .then(() => api.dismiss(claim.id));
  });

  $effect(() => {
    if (activeClaim?.kind !== 'modal' && activeClaim && !anchoredOpen) {
      api.dismiss(activeClaim.id);
    }
  });
</script>

{@render children?.()}
{#if activeClaim && activeClaim.kind !== 'modal'}
  <Popover
    bind:open={anchoredOpen}
    triggerRef={api.resolveAnchor(activeClaim)}
    label="Guidance"
    focusManagement="preserve"
    wireTriggerAria={false}
  >
    <p>{activeClaim.content}</p>
    <Button size="sm" onclick={() => api.dismiss(activeClaim?.id ?? '')}>Got it</Button>
  </Popover>
{/if}
