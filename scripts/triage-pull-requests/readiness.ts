import type { Deps } from './dependencies';

export type MergeStateStatus =
  | 'DIRTY'
  | 'BEHIND'
  | 'BLOCKED'
  | 'CLEAN'
  | 'HAS_HOOKS'
  | 'UNKNOWN'
  | 'UNSTABLE';

export type ReviewDecision =
  | 'APPROVED'
  | 'CHANGES_REQUESTED'
  | 'REVIEW_REQUIRED'
  | null;

export type Readiness = {
  ciPassing: boolean;
  ciPending: boolean;
  ciFailing: boolean;
  hasConflicts: boolean;
  mergeStateStatus: MergeStateStatus;
  reviewDecision: ReviewDecision;
  unresolvedThreads: number;
  headRefOid: string;
  isDraft: boolean;
};

export type MergeFailureReason =
  | 'stale-head'
  | 'branch-protection'
  | 'required-reviews-missing'
  | 'permissions'
  | 'unknown';

// ---------------------------------------------------------------------------
// Status-check classification
// ---------------------------------------------------------------------------

type CheckEntry = {
  state?: string;
  conclusion?: string | null;
};

function classifyChecks(entries: CheckEntry[]): {
  passing: number;
  pending: number;
  failing: number;
} {
  let passing = 0;
  let pending = 0;
  let failing = 0;

  for (const entry of entries) {
    const state = entry.state?.toUpperCase() ?? '';
    const conclusion = entry.conclusion?.toUpperCase() ?? null;

    if (
      state === 'SUCCESS' ||
      conclusion === 'SUCCESS' ||
      conclusion === 'NEUTRAL' ||
      conclusion === 'SKIPPED'
    ) {
      passing++;
    } else if (
      state === 'PENDING' ||
      state === 'QUEUED' ||
      state === 'IN_PROGRESS' ||
      state === 'WAITING' ||
      conclusion === null ||
      conclusion === ''
    ) {
      pending++;
    } else {
      failing++;
    }
  }

  return { passing, pending, failing };
}

// ---------------------------------------------------------------------------
// Unresolved thread count (paginated GraphQL)
// ---------------------------------------------------------------------------

const THREAD_QUERY = `
query($owner: String!, $name: String!, $number: Int!, $cursor: String) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      reviewThreads(first: 100, after: $cursor) {
        pageInfo { hasNextPage endCursor }
        nodes { isResolved }
      }
    }
  }
}
`.trim();

async function countUnresolvedThreads(
  prNumber: number,
  owner: string,
  name: string,
  deps: Pick<Deps, 'run'>,
): Promise<number> {
  let cursor: string | null = null;
  let total = 0;

  for (;;) {
    const args = [
      'gh', 'api', 'graphql',
      '-F', `owner=${owner}`,
      '-F', `name=${name}`,
      '-F', `number=${prNumber}`,
      '-f', `query=${THREAD_QUERY}`,
    ];
    if (cursor !== null) {
      args.push('-F', `cursor=${cursor}`);
    }

    const result = await deps.run(args);
    if (result.exitCode !== 0) {
      // Non-fatal — return 0 rather than abort; the orchestrator can still make progress.
      return 0;
    }

    const data = JSON.parse(result.stdout) as {
      data: {
        repository: {
          pullRequest: {
            reviewThreads: {
              pageInfo: { hasNextPage: boolean; endCursor: string | null };
              nodes: Array<{ isResolved: boolean }>;
            };
          };
        };
      };
    };

    const threads = data.data.repository.pullRequest.reviewThreads;
    for (const node of threads.nodes) {
      if (!node.isResolved) total++;
    }

    if (!threads.pageInfo.hasNextPage) break;
    cursor = threads.pageInfo.endCursor;
  }

  return total;
}

// ---------------------------------------------------------------------------
// Mergeability via GraphQL
//
// `gh pr view` (REST) often returns mergeable=UNKNOWN / mergeStateStatus=UNKNOWN
// for many minutes after a base-branch update, even when the PR is fully ready.
// GraphQL's mergeable field forces GitHub to enqueue mergeability computation
// on first query, so a short poll typically resolves to MERGEABLE/CONFLICTING.
//
// We only invoke this fallback when REST returns UNKNOWN — the common case is
// REST returning a definite answer, and we don't want to pay for an extra
// GraphQL call per PR per readiness check.
// ---------------------------------------------------------------------------

const MERGEABILITY_QUERY = `
query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      mergeable
      mergeStateStatus
    }
  }
}
`.trim();

type MergeabilityResult = { mergeable: string; mergeStateStatus: string };

async function fetchMergeabilityFromGraphQL(
  prNumber: number,
  owner: string,
  name: string,
  deps: Pick<Deps, 'run' | 'sleep'>,
  pollAttempts: number,
  pollIntervalMs: number,
): Promise<MergeabilityResult | null> {
  for (let attempt = 0; attempt < Math.max(1, pollAttempts); attempt++) {
    const result = await deps.run([
      'gh', 'api', 'graphql',
      '-F', `owner=${owner}`,
      '-F', `name=${name}`,
      '-F', `number=${prNumber}`,
      '-f', `query=${MERGEABILITY_QUERY}`,
    ]);
    if (result.exitCode !== 0) return null;
    try {
      const parsed = JSON.parse(result.stdout) as {
        data: { repository: { pullRequest: MergeabilityResult } };
      };
      const pr = parsed.data.repository.pullRequest;
      if (pr.mergeable !== 'UNKNOWN' && pr.mergeStateStatus !== 'UNKNOWN') {
        return pr;
      }
    } catch {
      return null;
    }
    if (attempt < pollAttempts - 1) await deps.sleep(pollIntervalMs);
  }
  return null;
}

// ---------------------------------------------------------------------------
// checkReadiness
// ---------------------------------------------------------------------------

/**
 * Fetches all readiness signals for a pull request. Polls CI up to
 * `pollAttempts` times if checks are still pending.
 */
export async function checkReadiness(
  prNumber: number,
  owner: string,
  name: string,
  pollAttempts: number,
  pollIntervalMs: number,
  deps: Pick<Deps, 'run' | 'runOk' | 'sleep'>,
): Promise<Readiness> {
  const fetchState = async () => {
    const raw = await deps.runOk([
      'gh', 'pr', 'view', String(prNumber),
      '--json', 'statusCheckRollup,mergeable,mergeStateStatus,reviewDecision,headRefOid,isDraft',
    ]);
    return JSON.parse(raw) as {
      statusCheckRollup: CheckEntry[];
      mergeable: string;
      mergeStateStatus: string;
      reviewDecision: string | null;
      headRefOid: string;
      isDraft: boolean;
    };
  };

  let state = await fetchState();
  let { passing, pending, failing } = classifyChecks(state.statusCheckRollup ?? []);

  for (let attempt = 0; attempt < pollAttempts && pending > 0; attempt++) {
    await deps.sleep(pollIntervalMs);
    state = await fetchState();
    ({ passing, pending, failing } = classifyChecks(state.statusCheckRollup ?? []));
  }

  // If REST returns UNKNOWN mergeability (stale post-merge cache), query
  // GraphQL — it forces GitHub to compute mergeability and usually resolves.
  let mergeable = state.mergeable;
  let mergeStateStatus = state.mergeStateStatus;
  if (mergeable === 'UNKNOWN' || mergeStateStatus === 'UNKNOWN') {
    const fallback = await fetchMergeabilityFromGraphQL(
      prNumber, owner, name, deps,
      Math.max(2, pollAttempts), Math.max(2_000, pollIntervalMs),
    );
    if (fallback !== null) {
      mergeable = fallback.mergeable;
      mergeStateStatus = fallback.mergeStateStatus;
    }
  }

  const hasConflicts =
    mergeable === 'CONFLICTING' || mergeStateStatus === 'DIRTY';

  const unresolvedThreads = await countUnresolvedThreads(prNumber, owner, name, deps);

  // `gh pr view` returns "" (not null) when no review decision exists.
  // Normalize so isMergeReady's `=== null` branch matches reality.
  const reviewDecisionRaw = state.reviewDecision;
  const reviewDecision: ReviewDecision =
    reviewDecisionRaw === null || reviewDecisionRaw === ''
      ? null
      : (reviewDecisionRaw as ReviewDecision);

  return {
    ciPassing: failing === 0 && pending === 0,
    ciPending: pending > 0,
    ciFailing: failing > 0,
    hasConflicts,
    mergeStateStatus: mergeStateStatus as MergeStateStatus,
    reviewDecision,
    unresolvedThreads,
    headRefOid: state.headRefOid,
    isDraft: state.isDraft,
  };
}

// ---------------------------------------------------------------------------
// isMergeReady
// ---------------------------------------------------------------------------

/** Returns true when a PR is fully ready to merge without further intervention. */
export function isMergeReady(r: Readiness): boolean {
  return (
    !r.isDraft &&
    r.ciPassing &&
    !r.ciPending &&
    !r.ciFailing &&
    !r.hasConflicts &&
    r.unresolvedThreads === 0 &&
    (r.reviewDecision === 'APPROVED' || r.reviewDecision === null) &&
    (r.mergeStateStatus === 'CLEAN' ||
      r.mergeStateStatus === 'HAS_HOOKS' ||
      r.mergeStateStatus === 'UNSTABLE')
  );
}

// ---------------------------------------------------------------------------
// classifyMergeFailure
// ---------------------------------------------------------------------------

/** Classifies a `gh pr merge` error message into an actionable reason. */
export function classifyMergeFailure(stderr: string): MergeFailureReason {
  const lower = stderr.toLowerCase();
  if (lower.includes('stale') || lower.includes('head sha') || lower.includes('head commit')) {
    return 'stale-head';
  }
  if (lower.includes('branch protection') || lower.includes('protected branch')) {
    return 'branch-protection';
  }
  if (lower.includes('review') && (lower.includes('required') || lower.includes('approved'))) {
    return 'required-reviews-missing';
  }
  if (lower.includes('permission') || lower.includes('forbidden') || lower.includes('403')) {
    return 'permissions';
  }
  return 'unknown';
}
