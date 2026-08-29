import { getGuidanceContext, type GuidanceApi } from '../_internal/guidance-context.ts';
export function useGuidance(): GuidanceApi {
  return getGuidanceContext();
}
export type { GuidanceApi, GuidanceClaim, GuidanceStorage } from '../_internal/guidance-context.ts';
