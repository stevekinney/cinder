import { createContext } from 'svelte';

export type GuidanceClaim = {
  id: string;
  anchor?: string;
  content: string;
  kind?: 'anchored' | 'modal';
  relevantFrom?: string;
  relevantUntil?: string;
};
export type GuidanceStorage = {
  get: (key: string) => boolean;
  set: (key: string, value: boolean) => void;
  remove?: (key: string) => void;
};
export type GuidanceApi = {
  claim: (claim: GuidanceClaim) => boolean;
  dismiss: (id: string) => void;
  resetAll: () => void;
  claims: () => GuidanceClaim[];
};
const [getGuidanceContext, setGuidanceContext] = createContext<GuidanceApi>();
export { getGuidanceContext, setGuidanceContext };

export function isRelevant(claim: GuidanceClaim, version?: string): boolean {
  if (!version) return true;
  return (
    (!claim.relevantFrom || version >= claim.relevantFrom) &&
    (!claim.relevantUntil || version <= claim.relevantUntil)
  );
}
