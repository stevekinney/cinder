<script lang="ts" module>
  /**
   * @cinder
   * @category data-display
   * @status beta
   * @purpose Context-scoped registry for versioned, dismissible product guidance claims.
   * @useWhen Coordinating coachmarks that must respect product versions and reversible dismissal.
   * @avoidWhen Showing an isolated anchored explanation without registry lifecycle; use Popover.
   * @related popover
   * @rationale Nearest alternative: Popover displays one anchored surface; this owns guidance lifecycle and arbitration.
   */
  export type { GuidanceRegionProps } from './guidance-region.types.ts';
</script>

<script lang="ts">
  import {
    setGuidanceContext,
    isRelevant,
    createModalSlot,
    type GuidanceApi,
  } from '../../_internal/guidance-context.ts';
  import type { GuidanceRegionProps } from './guidance-region.types.ts';
  import type { GuidanceClaim } from '../../_internal/guidance-context.ts';
  import type { ModalApi } from '../../_internal/modal-context.ts';
  import { useModal } from '../../utilities/use-modal.ts';
  import Button from '@lostgradient/cinder/button';
  import Popover from '@lostgradient/cinder/popover';
  const regionId = $props.id();
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
  const modalSlot = createModalSlot();
  let anchoredOpen = $state(false);
  let modalApi: ModalApi | undefined;
  try {
    modalApi = useModal();
  } catch {
    modalApi = undefined;
  }
  function modalEntryId(claimId: string): string {
    return `cinder-guidance-${regionId}-${claimId}`;
  }
  function isDismissed(claim: GuidanceClaim): boolean {
    return dismissed.has(claim.id) || storage?.get(`${storageKey}:${claim.id}`) === true;
  }
  let activeClaims = $derived(
    initialClaims.filter((claim) => isRelevant(claim, version) && !isDismissed(claim)),
  );
  const api: GuidanceApi = {
    claim(id) {
      const claim = activeClaims.find((candidate) => candidate.id === id);
      const anchor = claim?.anchor && anchorResolver ? anchorResolver(claim.anchor) : null;
      if (
        !claim ||
        activeClaim !== null ||
        !isRelevant(claim, version) ||
        isDismissed(claim) ||
        claimed.has(claim.id) ||
        storage?.get(`${storageKey}:${claim.id}`) ||
        (claim.kind !== 'modal' && (!anchor || !anchor.isConnected)) ||
        (claim.kind === 'modal' && (!modalApi || !modalSlot.claim()))
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
        const wasModal = activeClaim.kind === 'modal';
        const anchor =
          !wasModal && activeClaim.anchor !== undefined && anchorResolver
            ? anchorResolver(activeClaim.anchor)
            : null;
        if (wasModal) modalApi?.dismiss(modalEntryId(id));
        if (anchor?.isConnected) anchor.focus();
        anchoredOpen = false;
        activeClaim = null;
        if (wasModal) modalSlot.reset();
      }
    },
    resetAll() {
      const claim = activeClaim;
      const anchor =
        claim?.kind !== 'modal' && claim?.anchor !== undefined && anchorResolver
          ? anchorResolver(claim.anchor)
          : null;
      if (anchor?.isConnected) anchor.focus();
      for (const claim of initialClaims) {
        const key = `${storageKey}:${claim.id}`;
        if (storage?.remove) storage.remove(key);
        else storage?.set(key, false);
      }
      dismissed = new Set();
      claimed = new Set();
      activeClaim = null;
      anchoredOpen = false;
      openedModalId = null;
      modalClaimGeneration += 1;
      if (modalApi) {
        for (const claim of initialClaims) {
          if (claim.kind === 'modal') modalApi.dismiss(modalEntryId(claim.id));
        }
      }
      modalSlot.reset();
    },
    claims: () => activeClaims,
  };
  setGuidanceContext(api);

  let openedModalId: string | null = null;
  let modalClaimGeneration = 0;
  $effect(() => {
    const claim = activeClaim;
    if (!claim) return;
    const remainsEligible = activeClaims.some((candidate) => candidate.id === claim.id);
    const anchor = claim.kind === 'modal' || !anchorResolver ? null : anchorResolver(claim.anchor);
    const anchorConnected = claim.kind === 'modal' || (anchor !== null && anchor.isConnected);
    if (remainsEligible && anchorConnected) return;
    if (claim.kind === 'modal') {
      modalApi?.dismiss(modalEntryId(claim.id));
      openedModalId = null;
      modalSlot.reset();
    } else if (anchor?.isConnected) {
      anchor.focus();
    }
    anchoredOpen = false;
    activeClaim = null;
  });

  $effect(() => {
    const claim = activeClaim;
    if (!claim || claim.kind !== 'modal' || openedModalId === claim.id) return;
    openedModalId = claim.id;
    const generation = ++modalClaimGeneration;
    void modalApi
      ?.confirm({
        id: modalEntryId(claim.id),
        title: 'Guidance',
        description: claim.content,
        confirmLabel: 'Got it',
        cancelLabel: 'Dismiss',
      })
      .then(() => {
        if (generation !== modalClaimGeneration || activeClaim !== claim) return;
        api.dismiss(claim.id);
        openedModalId = null;
        modalSlot.reset();
      });
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
    wireTriggerAria
  >
    <p>{activeClaim.content}</p>
    <Button size="sm" onclick={() => api.dismiss(activeClaim?.id ?? '')}>Got it</Button>
  </Popover>
{/if}
