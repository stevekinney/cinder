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
    type GuidanceApi,
  } from '../../_internal/guidance-context.ts';
  import type { GuidanceRegionProps } from './guidance-region.types.ts';
  let {
    claims: initialClaims = [],
    version,
    storage,
    storageKey = 'cinder-guidance',
    children,
  }: GuidanceRegionProps = $props();
  let dismissed = $state(new Set<string>());
  let claimed = $state(new Set<string>());
  let activeClaims = $derived(
    initialClaims.filter((claim) => isRelevant(claim, version) && !dismissed.has(claim.id)),
  );
  const api: GuidanceApi = {
    claim(claim) {
      if (
        !isRelevant(claim, version) ||
        dismissed.has(claim.id) ||
        claimed.has(claim.id) ||
        storage?.get(`${storageKey}:${claim.id}`)
      )
        return false;
      claimed = new Set(claimed).add(claim.id);
      return true;
    },
    dismiss(id) {
      dismissed = new Set(dismissed).add(id);
      storage?.set(`${storageKey}:${id}`, true);
    },
    resetAll() {
      for (const claim of initialClaims) storage?.remove?.(`${storageKey}:${claim.id}`);
      dismissed = new Set();
      claimed = new Set();
    },
    claims: () => activeClaims,
  };
  setGuidanceContext(api);
</script>

{@render children?.()}
