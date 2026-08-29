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
  /** Pull a registered claim by id from the nearest GuidanceRegion. */
  claim: (id: string) => boolean;
  resolveAnchor: (claim: GuidanceClaim) => HTMLElement | null;
  dismiss: (id: string) => void;
  resetAll: () => void;
  claims: () => GuidanceClaim[];
};
const [getGuidanceContext, setGuidanceContext] = createContext<GuidanceApi>();
export { getGuidanceContext, setGuidanceContext };
export function createModalSlot() {
  let claimed = false;
  return {
    claim(): boolean {
      if (claimed) return false;
      claimed = true;
      return true;
    },
    reset(): void {
      claimed = false;
    },
  };
}

type ParsedVersion = {
  major: number;
  minor: number;
  patch: number;
  prerelease: Array<string | number>;
};

function parseVersion(value: string): ParsedVersion | null {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(
    value.trim(),
  );
  if (!match) return null;
  const [major, minor, patch] = [match[1], match[2], match[3]];
  if (!major || !minor || !patch) return null;
  if ([major, minor, patch].some((part) => part.length > 1 && part.startsWith('0'))) return null;
  const prerelease = match[4]
    ? match[4].split('.').map((part) => (/^\d+$/.test(part) ? Number(part) : part))
    : [];
  if (match[4]?.split('.').some((part) => /^0\d/.test(part))) return null;
  return { major: Number(major), minor: Number(minor), patch: Number(patch), prerelease };
}

function compareVersions(left: ParsedVersion, right: ParsedVersion): number {
  for (const key of ['major', 'minor', 'patch'] as const) {
    if (left[key] !== right[key]) return left[key] < right[key] ? -1 : 1;
  }
  if (left.prerelease.length === 0 && right.prerelease.length === 0) return 0;
  if (left.prerelease.length === 0) return 1;
  if (right.prerelease.length === 0) return -1;
  for (
    let index = 0;
    index < Math.max(left.prerelease.length, right.prerelease.length);
    index += 1
  ) {
    const a = left.prerelease[index];
    const b = right.prerelease[index];
    if (a === undefined) return -1;
    if (b === undefined) return 1;
    if (a === b) continue;
    if (typeof a === 'number' && typeof b === 'string') return -1;
    if (typeof a === 'string' && typeof b === 'number') return 1;
    return a < b ? -1 : 1;
  }
  return 0;
}

export function isRelevant(claim: GuidanceClaim, version?: string): boolean {
  if (!version) return true;
  const current = parseVersion(version);
  if (!current) return false;
  const from = claim.relevantFrom ? parseVersion(claim.relevantFrom) : null;
  const until = claim.relevantUntil ? parseVersion(claim.relevantUntil) : null;
  if ((claim.relevantFrom && !from) || (claim.relevantUntil && !until)) return false;
  return (
    (!from || compareVersions(current, from) >= 0) &&
    (!until || compareVersions(current, until) <= 0)
  );
}
