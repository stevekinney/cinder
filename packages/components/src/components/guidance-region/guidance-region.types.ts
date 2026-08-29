import type { Snippet } from 'svelte';
import type { GuidanceClaim, GuidanceStorage } from '../../_internal/guidance-context.ts';
export type GuidanceRegionProps = {
  claims?: GuidanceClaim[];
  version?: string;
  storage?: GuidanceStorage;
  storageKey?: string;
  children?: Snippet;
};
