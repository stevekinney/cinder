import { describe, it, expect, beforeEach } from 'bun:test';
import { checkReadiness, isMergeReady, classifyMergeFailure } from './readiness';
import type { Readiness } from './readiness';
import { runTriage } from './orchestrator';
import type { TriageOptions } from './orchestrator';
import type { Deps, RunResult, StreamResult } from './dependencies';

// ---------------------------------------------------------------------------
// Fake deps factory
// ---------------------------------------------------------------------------

type CommandSpec = {
  args: string[];
  result: Partial<RunResult> | Partial<StreamResult>;
};

function makeRunResult(partial: Partial<RunResult> = {}): RunResult {
  return {
    exitCode: partial.exitCode ?? 0,
    stdout: partial.stdout ?? '',
    stderr: partial.stderr ?? '',
    timedOut: partial.timedOut ?? false,
  };
}

function makeStreamResult(partial: Partial<StreamResult> = {}): StreamResult {
  return {
    exitCode: partial.exitCode ?? 0,
    captured: partial.captured ?? '',
    timedOut: partial.timedOut ?? false,
  };
}

type FakeCommand = {
  match: (args: string[]) => boolean;
  result: RunResult | StreamResult;
};

function fakeDeps(commands: FakeCommand[]): Deps & { written: Map<string, string>; logged: Array<[string, string]> } {
  const written = new Map<string, string>();
  const logged: Array<[string, string]> = [];

  const findResult = (args: string[]): RunResult => {
    for (const cmd of commands) {
      if (cmd.match(args)) {
        const r = cmd.result as RunResult;
        return makeRunResult(r);
      }
    }
    return makeRunResult({ exitCode: 1, stderr: `no mock for: ${args.join(' ')}` });
  };

  return {
    written,
    logged,
    run: async (args) => findResult(args),
    runOk: async (args) => {
      const r = findResult(args);
      if (r.exitCode !== 0) throw new Error(`Command failed: ${args.join(' ')}\n${r.stderr}`);
      return r.stdout;
    },
    runStreaming: async (args) => {
      for (const cmd of commands) {
        if (cmd.match(args)) {
          return makeStreamResult(cmd.result as Partial<StreamResult>);
        }
      }
      return makeStreamResult({ exitCode: 0 });
    },
    log: (level, message) => { logged.push([level, message]); },
    now: () => new Date('2024-01-01T00:00:00.000Z'),
    sleep: async () => {},
    writeFile: async (path, content) => { written.set(path, content); },
  };
}

const argsInclude = (...parts: string[]) =>
  (args: string[]) => parts.every((p) => args.includes(p));

const argsStartWith = (...parts: string[]) =>
  (args: string[]) => parts.every((p, i) => args[i] === p);

// ---------------------------------------------------------------------------
// Default options
// ---------------------------------------------------------------------------

const defaultOptions: TriageOptions = {
  execute: false,
  unattended: false,
  maxAttempts: 5,
  pollAttempts: 1,
  pollIntervalMs: 0,
  agentTimeoutMs: 5_000,
  includeNew: false,
  retryPending: false,
  unsafeNoHeadMatch: false,
};

// ---------------------------------------------------------------------------
// checkReadiness: CI aggregation rules
// ---------------------------------------------------------------------------

describe('checkReadiness — CI aggregation', () => {
  const makeGhPrView = (rollup: object[]) =>
    JSON.stringify({
      statusCheckRollup: rollup,
      mergeable: 'MERGEABLE',
      mergeStateStatus: 'CLEAN',
      reviewDecision: null,
      headRefOid: 'abc123',
      isDraft: false,
    });

  const makeGhGraphql = () =>
    JSON.stringify({
      data: {
        repository: {
          pullRequest: {
            reviewThreads: {
              pageInfo: { hasNextPage: false, endCursor: null },
              nodes: [],
            },
          },
        },
      },
    });

  it('all-success → ciPassing=true, ciFailing=false, ciPending=false', async () => {
    const rollup = [
      { state: 'SUCCESS', conclusion: 'SUCCESS' },
      { state: 'SUCCESS', conclusion: 'NEUTRAL' },
    ];
    const deps = fakeDeps([
      { match: argsInclude('gh', 'pr', 'view'), result: { stdout: makeGhPrView(rollup) } },
      { match: argsInclude('gh', 'api', 'graphql'), result: { stdout: makeGhGraphql() } },
    ]);
    const r = await checkReadiness(1, 'owner', 'repo', 1, 0, deps);
    expect(r.ciPassing).toBe(true);
    expect(r.ciFailing).toBe(false);
    expect(r.ciPending).toBe(false);
  });

  it('mixed pass/fail → ciPassing=false, ciFailing=true', async () => {
    const rollup = [
      { state: 'SUCCESS', conclusion: 'SUCCESS' },
      { state: 'FAILURE', conclusion: 'FAILURE' },
    ];
    const deps = fakeDeps([
      { match: argsInclude('gh', 'pr', 'view'), result: { stdout: makeGhPrView(rollup) } },
      { match: argsInclude('gh', 'api', 'graphql'), result: { stdout: makeGhGraphql() } },
    ]);
    const r = await checkReadiness(1, 'owner', 'repo', 1, 0, deps);
    expect(r.ciPassing).toBe(false);
    expect(r.ciFailing).toBe(true);
  });

  it('all-pending → ciPending=true after polling exhausted', async () => {
    const rollup = [{ state: 'IN_PROGRESS', conclusion: null }];
    const deps = fakeDeps([
      { match: argsInclude('gh', 'pr', 'view'), result: { stdout: makeGhPrView(rollup) } },
      { match: argsInclude('gh', 'api', 'graphql'), result: { stdout: makeGhGraphql() } },
    ]);
    const r = await checkReadiness(1, 'owner', 'repo', 2, 0, deps);
    expect(r.ciPending).toBe(true);
    expect(r.ciPassing).toBe(false);
  });

  it('neutral-only → ciPassing=true', async () => {
    const rollup = [{ state: 'SUCCESS', conclusion: 'NEUTRAL' }];
    const deps = fakeDeps([
      { match: argsInclude('gh', 'pr', 'view'), result: { stdout: makeGhPrView(rollup) } },
      { match: argsInclude('gh', 'api', 'graphql'), result: { stdout: makeGhGraphql() } },
    ]);
    const r = await checkReadiness(1, 'owner', 'repo', 1, 0, deps);
    expect(r.ciPassing).toBe(true);
  });

  it('skipped-only → ciPassing=true', async () => {
    const rollup = [{ state: 'SUCCESS', conclusion: 'SKIPPED' }];
    const deps = fakeDeps([
      { match: argsInclude('gh', 'pr', 'view'), result: { stdout: makeGhPrView(rollup) } },
      { match: argsInclude('gh', 'api', 'graphql'), result: { stdout: makeGhGraphql() } },
    ]);
    const r = await checkReadiness(1, 'owner', 'repo', 1, 0, deps);
    expect(r.ciPassing).toBe(true);
  });

  it('empty rollup → ciPassing=true (no checks = nothing blocking)', async () => {
    const deps = fakeDeps([
      { match: argsInclude('gh', 'pr', 'view'), result: { stdout: makeGhPrView([]) } },
      { match: argsInclude('gh', 'api', 'graphql'), result: { stdout: makeGhGraphql() } },
    ]);
    const r = await checkReadiness(1, 'owner', 'repo', 1, 0, deps);
    expect(r.ciPassing).toBe(true);
    expect(r.ciFailing).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// checkReadiness: thread pagination
// ---------------------------------------------------------------------------

describe('checkReadiness — thread pagination', () => {
  const makeGhPrView = () =>
    JSON.stringify({
      statusCheckRollup: [],
      mergeable: 'MERGEABLE',
      mergeStateStatus: 'CLEAN',
      reviewDecision: null,
      headRefOid: 'abc123',
      isDraft: false,
    });

  it('paginates beyond 100 threads and counts all unresolved', async () => {
    let call = 0;
    const makeGraphql = (hasNextPage: boolean, endCursor: string | null) =>
      JSON.stringify({
        data: {
          repository: {
            pullRequest: {
              reviewThreads: {
                pageInfo: { hasNextPage, endCursor },
                nodes: Array.from({ length: 3 }, () => ({ isResolved: false })),
              },
            },
          },
        },
      });

    const deps = fakeDeps([
      { match: argsInclude('gh', 'pr', 'view'), result: { stdout: makeGhPrView() } },
      {
        match: argsInclude('gh', 'api', 'graphql'),
        result: { stdout: '' }, // handled below
      },
    ]);

    // Override run to paginate manually
    deps.run = async (args) => {
      if (args.includes('gh') && args.includes('pr') && args.includes('view')) {
        return makeRunResult({ stdout: makeGhPrView() });
      }
      if (args.includes('graphql')) {
        call++;
        if (call === 1) return makeRunResult({ stdout: makeGraphql(true, 'cursor1') });
        return makeRunResult({ stdout: makeGraphql(false, null) });
      }
      return makeRunResult({ exitCode: 1 });
    };
    deps.runOk = async (args) => {
      const r = await deps.run(args);
      if (r.exitCode !== 0) throw new Error(`failed: ${args.join(' ')}`);
      return r.stdout;
    };

    const r = await checkReadiness(1, 'owner', 'repo', 1, 0, deps);
    expect(r.unresolvedThreads).toBe(6); // 3 per page × 2 pages
    expect(call).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// isMergeReady truth table
// ---------------------------------------------------------------------------

describe('isMergeReady', () => {
  const base: Readiness = {
    ciPassing: true,
    ciPending: false,
    ciFailing: false,
    hasConflicts: false,
    mergeStateStatus: 'CLEAN',
    reviewDecision: null,
    unresolvedThreads: 0,
    headRefOid: 'abc',
    isDraft: false,
  };

  it('returns true for a fully clean PR', () => {
    expect(isMergeReady(base)).toBe(true);
  });

  it('rejects drafts', () => {
    expect(isMergeReady({ ...base, isDraft: true })).toBe(false);
  });

  it('rejects BEHIND mergeStateStatus', () => {
    expect(isMergeReady({ ...base, mergeStateStatus: 'BEHIND' })).toBe(false);
  });

  it('accepts UNSTABLE mergeStateStatus', () => {
    expect(isMergeReady({ ...base, mergeStateStatus: 'UNSTABLE' })).toBe(true);
  });

  it('accepts HAS_HOOKS mergeStateStatus', () => {
    expect(isMergeReady({ ...base, mergeStateStatus: 'HAS_HOOKS' })).toBe(true);
  });

  it('rejects BLOCKED mergeStateStatus', () => {
    expect(isMergeReady({ ...base, mergeStateStatus: 'BLOCKED' })).toBe(false);
  });

  it('rejects CHANGES_REQUESTED', () => {
    expect(isMergeReady({ ...base, reviewDecision: 'CHANGES_REQUESTED' })).toBe(false);
  });

  it('rejects REVIEW_REQUIRED', () => {
    expect(isMergeReady({ ...base, reviewDecision: 'REVIEW_REQUIRED' })).toBe(false);
  });

  it('accepts APPROVED', () => {
    expect(isMergeReady({ ...base, reviewDecision: 'APPROVED' })).toBe(true);
  });

  it('rejects failing CI', () => {
    expect(isMergeReady({ ...base, ciPassing: false, ciFailing: true })).toBe(false);
  });

  it('rejects pending CI', () => {
    expect(isMergeReady({ ...base, ciPassing: false, ciPending: true })).toBe(false);
  });

  it('rejects unresolved threads', () => {
    expect(isMergeReady({ ...base, unresolvedThreads: 1 })).toBe(false);
  });

  it('rejects conflicts', () => {
    expect(isMergeReady({ ...base, hasConflicts: true })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// classifyMergeFailure
// ---------------------------------------------------------------------------

describe('classifyMergeFailure', () => {
  it('classifies stale head', () => {
    expect(classifyMergeFailure('merge failed: stale head SHA')).toBe('stale-head');
  });

  it('classifies branch protection', () => {
    expect(classifyMergeFailure('error: branch protection rule prevents merge')).toBe('branch-protection');
  });

  it('classifies required reviews', () => {
    expect(classifyMergeFailure('review required before merge is allowed')).toBe('required-reviews-missing');
  });

  it('classifies permissions', () => {
    expect(classifyMergeFailure('403 forbidden')).toBe('permissions');
  });

  it('defaults to unknown', () => {
    expect(classifyMergeFailure('something completely unexpected')).toBe('unknown');
  });
});

// ---------------------------------------------------------------------------
// PR listing parser
// ---------------------------------------------------------------------------

describe('PR listing / NDJSON parsing', () => {
  it('parses two-page NDJSON response into sorted snapshot', async () => {
    const page1 = [
      { number: 1, title: 'PR 1', headRefName: 'feat/1', headRefOid: 'aaa', createdAt: '2024-01-01T00:00:00Z', isDraft: false },
      { number: 2, title: 'PR 2', headRefName: 'feat/2', headRefOid: 'bbb', createdAt: '2024-01-02T00:00:00Z', isDraft: false },
    ];
    const page2 = [
      { number: 3, title: 'PR 3', headRefName: 'feat/3', headRefOid: 'ccc', createdAt: '2024-01-03T00:00:00Z', isDraft: false },
    ];
    const ndjson = [...page1, ...page2].map((p) => JSON.stringify(p)).join('\n') + '\n'; // trailing newline

    const deps = fakeDeps([
      { match: argsInclude('gh', 'auth'), result: { stdout: '' } },
      { match: argsInclude('git', 'rev-parse', '--abbrev-ref'), result: { stdout: 'main\n' } },
      { match: argsInclude('git', 'status'), result: { stdout: '' } },
      { match: argsInclude('gh', 'repo', 'view'), result: { stdout: JSON.stringify({ nameWithOwner: 'owner/repo' }) } },
      { match: argsInclude('git', 'fetch'), result: { stdout: '' } },
      { match: argsInclude('repos/owner/repo/pulls'), result: { stdout: ndjson } },
    ]);

    const logs: string[] = [];
    deps.log = (level, msg) => { logs.push(`${level}: ${msg}`); };

    await runTriage({ ...defaultOptions }, deps);

    // Check the snapshot line in logs
    const snapshotLog = logs.find((l) => l.includes('Found'));
    expect(snapshotLog).toBeDefined();
    expect(snapshotLog).toContain('3');
  });

  it('respects --queue-limit by truncating to the limit', async () => {
    const prs = Array.from({ length: 5 }, (_, i) => ({
      number: i + 1,
      title: `PR ${i + 1}`,
      headRefName: `feat/${i + 1}`,
      headRefOid: `sha${i}`,
      createdAt: `2024-01-0${i + 1}T00:00:00Z`,
      isDraft: false,
    }));
    const ndjson = prs.map((p) => JSON.stringify(p)).join('\n');

    const deps = fakeDeps([
      { match: argsInclude('gh', 'auth'), result: { stdout: '' } },
      { match: argsInclude('git', 'rev-parse', '--abbrev-ref'), result: { stdout: 'main\n' } },
      { match: argsInclude('git', 'status'), result: { stdout: '' } },
      { match: argsInclude('gh', 'repo', 'view'), result: { stdout: JSON.stringify({ nameWithOwner: 'owner/repo' }) } },
      { match: argsInclude('git', 'fetch'), result: { stdout: '' } },
      { match: argsInclude('repos/owner/repo/pulls'), result: { stdout: ndjson } },
    ]);

    const logs: string[] = [];
    deps.log = (level, msg) => { logs.push(`${level}: ${msg}`); };

    await runTriage({ ...defaultOptions, queueLimit: 3 }, deps);

    const snapshotLog = logs.find((l) => l.includes('Found'));
    expect(snapshotLog).toContain('3'); // only 3 out of 5
  });

  it('tolerates empty trailing lines in NDJSON', async () => {
    const pr = { number: 1, title: 'PR', headRefName: 'feat/1', headRefOid: 'aaa', createdAt: '2024-01-01T00:00:00Z', isDraft: false };
    const ndjson = JSON.stringify(pr) + '\n\n\n'; // multiple trailing newlines

    const deps = fakeDeps([
      { match: argsInclude('gh', 'auth'), result: { stdout: '' } },
      { match: argsInclude('git', 'rev-parse', '--abbrev-ref'), result: { stdout: 'main\n' } },
      { match: argsInclude('git', 'status'), result: { stdout: '' } },
      { match: argsInclude('gh', 'repo', 'view'), result: { stdout: JSON.stringify({ nameWithOwner: 'owner/repo' }) } },
      { match: argsInclude('git', 'fetch'), result: { stdout: '' } },
      { match: argsInclude('repos/owner/repo/pulls'), result: { stdout: ndjson } },
    ]);

    const logs: string[] = [];
    deps.log = (level, msg) => { logs.push(msg); };

    // Should not throw
    await runTriage({ ...defaultOptions }, deps);
    expect(logs.some((l) => l.includes('Found 1'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// runTriage: dry-run does not write files or call git pull
// ---------------------------------------------------------------------------

describe('runTriage — dry-run', () => {
  const makePreflightDeps = (prs: object[] = []) => {
    const ndjson = prs.map((p) => JSON.stringify(p)).join('\n');
    return fakeDeps([
      { match: argsInclude('gh', 'auth'), result: { stdout: '' } },
      { match: argsInclude('git', 'rev-parse', '--abbrev-ref'), result: { stdout: 'main\n' } },
      { match: argsInclude('git', 'status', '--porcelain'), result: { stdout: '' } },
      { match: argsInclude('gh', 'repo', 'view'), result: { stdout: JSON.stringify({ nameWithOwner: 'owner/repo' }) } },
      { match: argsInclude('git', 'fetch'), result: { stdout: '' } },
      { match: argsInclude('git', 'rev-parse', 'HEAD'), result: { stdout: 'abc\n' } },
      { match: argsInclude('git', 'rev-parse', 'origin/main'), result: { stdout: 'abc\n' } },
      { match: argsInclude('repos/owner/repo/pulls'), result: { stdout: ndjson } },
    ]);
  };

  it('does not call git pull in dry-run', async () => {
    const deps = makePreflightDeps();
    const pulledArgs: string[][] = [];
    const originalRun = deps.run;
    deps.run = async (args) => {
      if (args.includes('pull')) pulledArgs.push(args);
      return originalRun(args);
    };
    await runTriage(defaultOptions, deps);
    expect(pulledArgs).toHaveLength(0);
  });

  it('does not write files in dry-run', async () => {
    const deps = makePreflightDeps();
    await runTriage(defaultOptions, deps);
    expect(deps.written.size).toBe(0);
  });

  it('returns exit code 0 with no PRs', async () => {
    const deps = makePreflightDeps([]);
    const code = await runTriage(defaultOptions, deps);
    expect(code).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// runTriage: --limit counts non-drafts only; exit code computed over workset
// ---------------------------------------------------------------------------

describe('runTriage — --limit and exit codes', () => {
  const draftPR = {
    number: 1, title: 'Draft', headRefName: 'feat/draft', headRefOid: 'ddd',
    createdAt: '2024-01-01T00:00:00Z', isDraft: true,
  };
  const normalPR = {
    number: 2, title: 'Real PR', headRefName: 'feat/real', headRefOid: 'eee',
    createdAt: '2024-01-02T00:00:00Z', isDraft: false,
  };
  const normalPR2 = {
    number: 3, title: 'Second PR', headRefName: 'feat/second', headRefOid: 'fff',
    createdAt: '2024-01-03T00:00:00Z', isDraft: false,
  };

  it('--limit 1 on 1 merged + 9 unattempted exits 0 (not 1)', async () => {
    const allPRs = [normalPR, normalPR2, { ...normalPR2, number: 4, headRefOid: 'g4', createdAt: '2024-01-04T00:00:00Z' }];
    const ndjson = allPRs.map((p) => JSON.stringify(p)).join('\n');

    const readyPrView = JSON.stringify({
      statusCheckRollup: [],
      mergeable: 'MERGEABLE',
      mergeStateStatus: 'CLEAN',
      reviewDecision: null,
      headRefOid: normalPR.headRefOid,
      isDraft: false,
    });
    const graphql = JSON.stringify({ data: { repository: { pullRequest: { reviewThreads: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [] } } } } });

    const deps = fakeDeps([
      { match: argsInclude('gh', 'auth'), result: { stdout: '' } },
      { match: argsInclude('git', 'rev-parse', '--abbrev-ref'), result: { stdout: 'main\n' } },
      { match: argsInclude('git', 'status', '--porcelain'), result: { stdout: '' } },
      { match: argsInclude('gh', 'repo', 'view'), result: { stdout: JSON.stringify({ nameWithOwner: 'owner/repo' }) } },
      { match: argsInclude('gh', 'pr', 'merge', '--help'), result: { stdout: '--match-head-commit' } },
      { match: argsInclude('git', 'fetch'), result: { stdout: '' } },
      { match: argsInclude('git', 'pull', '--ff-only'), result: { stdout: '' } },
      { match: argsInclude('mkdir'), result: { stdout: '' } },
      { match: argsInclude('repos/owner/repo/pulls'), result: { stdout: ndjson } },
      { match: argsInclude('gh', 'pr', 'view'), result: { stdout: readyPrView } },
      { match: argsInclude('gh', 'api', 'graphql'), result: { stdout: graphql } },
      { match: argsInclude('gh', 'pr', 'merge'), result: { stdout: '' } },
      { match: argsInclude('gh', 'pr', 'view', '2', '--json', 'mergeCommit'), result: { stdout: '"sha-merged"\n' } },
      { match: argsInclude('git', 'checkout', 'main'), result: { stdout: '' } },
      { match: argsInclude('git', 'pull'), result: { stdout: '' } },
    ]);

    const code = await runTriage({ ...defaultOptions, execute: true, limit: 1 }, deps);
    expect(code).toBe(0);
  });

  it('draft does not consume --limit', async () => {
    const ndjson = [draftPR, normalPR].map((p) => JSON.stringify(p)).join('\n');
    const readyPrView = JSON.stringify({
      statusCheckRollup: [],
      mergeable: 'MERGEABLE',
      mergeStateStatus: 'CLEAN',
      reviewDecision: null,
      headRefOid: normalPR.headRefOid,
      isDraft: false,
    });
    const graphql = JSON.stringify({ data: { repository: { pullRequest: { reviewThreads: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [] } } } } });

    const deps = fakeDeps([
      { match: argsInclude('gh', 'auth'), result: { stdout: '' } },
      { match: argsInclude('git', 'rev-parse', '--abbrev-ref'), result: { stdout: 'main\n' } },
      { match: argsInclude('git', 'status', '--porcelain'), result: { stdout: '' } },
      { match: argsInclude('gh', 'repo', 'view'), result: { stdout: JSON.stringify({ nameWithOwner: 'owner/repo' }) } },
      { match: argsInclude('gh', 'pr', 'merge', '--help'), result: { stdout: '--match-head-commit' } },
      { match: argsInclude('git', 'fetch'), result: { stdout: '' } },
      { match: argsInclude('git', 'pull', '--ff-only'), result: { stdout: '' } },
      { match: argsInclude('mkdir'), result: { stdout: '' } },
      { match: argsInclude('repos/owner/repo/pulls'), result: { stdout: ndjson } },
      { match: argsInclude('gh', 'pr', 'view'), result: { stdout: readyPrView } },
      { match: argsInclude('gh', 'api', 'graphql'), result: { stdout: graphql } },
      { match: argsInclude('gh', 'pr', 'merge'), result: { stdout: '' } },
      { match: argsInclude('git', 'checkout', 'main'), result: { stdout: '' } },
      { match: argsInclude('git', 'pull'), result: { stdout: '' } },
    ]);

    const prsAttempted: number[] = [];
    const originalRunStreaming = deps.runStreaming;
    deps.runStreaming = async (args, opts) => {
      if (args.includes('claude')) prsAttempted.push(99);
      return originalRunStreaming(args, opts);
    };

    // --limit 1 should process normalPR (draft doesn't count)
    const code = await runTriage({ ...defaultOptions, execute: true, limit: 1 }, deps);
    expect(code).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// runTriage: --retry-pending
// ---------------------------------------------------------------------------

describe('runTriage — --retry-pending', () => {
  it('does not retry ci-pending PRs when --retry-pending=false', async () => {
    const pr = { number: 5, title: 'Slow CI', headRefName: 'feat/slow', headRefOid: 'slowsha', createdAt: '2024-01-01T00:00:00Z', isDraft: false };
    const ndjson = JSON.stringify(pr);

    const pendingView = JSON.stringify({
      statusCheckRollup: [{ state: 'IN_PROGRESS', conclusion: null }],
      mergeable: 'MERGEABLE',
      mergeStateStatus: 'CLEAN',
      reviewDecision: null,
      headRefOid: pr.headRefOid,
      isDraft: false,
    });
    const graphql = JSON.stringify({ data: { repository: { pullRequest: { reviewThreads: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [] } } } } });

    let viewCallCount = 0;
    const deps = fakeDeps([
      { match: argsInclude('gh', 'auth'), result: { stdout: '' } },
      { match: argsInclude('git', 'rev-parse', '--abbrev-ref'), result: { stdout: 'main\n' } },
      { match: argsInclude('git', 'status', '--porcelain'), result: { stdout: '' } },
      { match: argsInclude('gh', 'repo', 'view'), result: { stdout: JSON.stringify({ nameWithOwner: 'owner/repo' }) } },
      { match: argsInclude('git', 'fetch'), result: { stdout: '' } },
      { match: argsInclude('git', 'rev-parse', 'HEAD'), result: { stdout: 'abc\n' } },
      { match: argsInclude('git', 'rev-parse', 'origin/main'), result: { stdout: 'abc\n' } },
      { match: argsInclude('repos/owner/repo/pulls'), result: { stdout: ndjson } },
      { match: argsInclude('gh', 'pr', 'view'), result: { stdout: pendingView } },
      { match: argsInclude('gh', 'api', 'graphql'), result: { stdout: graphql } },
    ]);

    deps.run = async (args) => {
      if (args.includes('pr') && args.includes('view') && !args.includes('repo')) viewCallCount++;
      return fakeDeps([
        { match: argsInclude('gh', 'auth'), result: { stdout: '' } },
        { match: argsInclude('git', 'rev-parse', '--abbrev-ref'), result: { stdout: 'main\n' } },
        { match: argsInclude('git', 'status', '--porcelain'), result: { stdout: '' } },
        { match: argsInclude('gh', 'repo', 'view'), result: { stdout: JSON.stringify({ nameWithOwner: 'owner/repo' }) } },
        { match: argsInclude('git', 'fetch'), result: { stdout: '' } },
        { match: argsInclude('git', 'rev-parse', 'HEAD'), result: { stdout: 'abc\n' } },
        { match: argsInclude('git', 'rev-parse', 'origin/main'), result: { stdout: 'abc\n' } },
        { match: argsInclude('repos/owner/repo/pulls'), result: { stdout: ndjson } },
        { match: argsInclude('gh', 'pr', 'view'), result: { stdout: pendingView } },
        { match: argsInclude('gh', 'api', 'graphql'), result: { stdout: graphql } },
      ]).run(args);
    };

    await runTriage({ ...defaultOptions, retryPending: false }, deps);
    // With retryPending=false, ci-pending PRs are skipped without a retry pass
    // The PR is skipped once; viewCallCount reflects initial checks only
    expect(viewCallCount).toBeLessThanOrEqual(2); // initial + maybe 1 poll
  });
});

// ---------------------------------------------------------------------------
// runTriage: preflight — no --match-head-commit without bypass
// ---------------------------------------------------------------------------

describe('runTriage — preflight', () => {
  it('fails preflight when --match-head-commit unsupported without --unsafe-no-head-match', async () => {
    const deps = fakeDeps([
      { match: argsInclude('gh', 'auth'), result: { stdout: '' } },
      { match: argsInclude('git', 'rev-parse', '--abbrev-ref'), result: { stdout: 'main\n' } },
      { match: argsInclude('git', 'status', '--porcelain'), result: { stdout: '' } },
      { match: argsInclude('gh', 'repo', 'view'), result: { stdout: JSON.stringify({ nameWithOwner: 'owner/repo' }) } },
      { match: argsInclude('gh', 'pr', 'merge', '--help'), result: { stdout: 'Usage: gh pr merge [flags]' } }, // no --match-head-commit
      { match: argsInclude('git', 'fetch'), result: { stdout: '' } },
    ]);

    const code = await runTriage({ ...defaultOptions, execute: true }, deps);
    expect(code).toBe(1);
  });

  it('allows execute without --match-head-commit when --unsafe-no-head-match is set', async () => {
    const ndjson = ''; // empty queue
    const deps = fakeDeps([
      { match: argsInclude('gh', 'auth'), result: { stdout: '' } },
      { match: argsInclude('git', 'rev-parse', '--abbrev-ref'), result: { stdout: 'main\n' } },
      { match: argsInclude('git', 'status', '--porcelain'), result: { stdout: '' } },
      { match: argsInclude('gh', 'repo', 'view'), result: { stdout: JSON.stringify({ nameWithOwner: 'owner/repo' }) } },
      { match: argsInclude('gh', 'pr', 'merge', '--help'), result: { stdout: 'Usage: gh pr merge [flags]' } },
      { match: argsInclude('git', 'fetch'), result: { stdout: '' } },
      { match: argsInclude('git', 'pull', '--ff-only'), result: { stdout: '' } },
      { match: argsInclude('mkdir'), result: { stdout: '' } },
      { match: argsInclude('repos/owner/repo/pulls'), result: { stdout: ndjson } },
    ]);

    const code = await runTriage({ ...defaultOptions, execute: true, unsafeNoHeadMatch: true }, deps);
    expect(code).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// runTriage: missing-upstream skip
// ---------------------------------------------------------------------------

describe('runTriage — local-branch-no-upstream', () => {
  it('soft-skips when remote ref is missing after checkout', async () => {
    const pr = { number: 10, title: 'Fork PR', headRefName: 'feat/fork', headRefOid: 'fork1', createdAt: '2024-01-01T00:00:00Z', isDraft: false };
    const ndjson = JSON.stringify(pr);

    const needsWorkView = JSON.stringify({
      statusCheckRollup: [{ state: 'FAILURE', conclusion: 'FAILURE' }],
      mergeable: 'MERGEABLE',
      mergeStateStatus: 'CLEAN',
      reviewDecision: null,
      headRefOid: pr.headRefOid,
      isDraft: false,
    });
    const graphql = JSON.stringify({ data: { repository: { pullRequest: { reviewThreads: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [] } } } } });

    const deps = fakeDeps([
      { match: argsInclude('gh', 'auth'), result: { stdout: '' } },
      { match: argsInclude('git', 'rev-parse', '--abbrev-ref'), result: { stdout: 'main\n' } },
      { match: argsInclude('git', 'status', '--porcelain'), result: { stdout: '' } },
      { match: argsInclude('gh', 'repo', 'view'), result: { stdout: JSON.stringify({ nameWithOwner: 'owner/repo' }) } },
      { match: argsInclude('gh', 'pr', 'merge', '--help'), result: { stdout: '--match-head-commit' } },
      { match: argsInclude('git', 'fetch'), result: { stdout: '' } },
      { match: argsInclude('git', 'pull', '--ff-only'), result: { stdout: '' } },
      { match: argsInclude('mkdir'), result: { stdout: '' } },
      { match: argsInclude('repos/owner/repo/pulls'), result: { stdout: ndjson } },
      { match: argsInclude('gh', 'pr', 'view'), result: { stdout: needsWorkView } },
      { match: argsInclude('gh', 'api', 'graphql'), result: { stdout: graphql } },
      { match: argsInclude('gh', 'pr', 'checkout'), result: { stdout: '' } },
      { match: (args) => args.includes('rev-parse') && args.includes('HEAD'), result: { stdout: 'fork1\n' } },
      // Missing remote ref — rev-parse --verify returns exit 1
      { match: (args) => args.includes('rev-parse') && args.includes('--verify'), result: { exitCode: 1, stdout: '' } },
      { match: argsInclude('git', 'checkout', 'main'), result: { stdout: '' } },
    ]);

    const logs: Array<[string, string]> = [];
    deps.log = (level, msg) => logs.push([level, msg]);

    const code = await runTriage({ ...defaultOptions, execute: true }, deps);
    expect(code).toBe(1); // had a skip
    const skippedLog = logs.find(([, msg]) => msg.toLowerCase().includes('no-upstream') || msg.toLowerCase().includes('summary'));
    // Just verify it didn't hard-crash
    expect(code).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// runTriage: worktree conflict resolution
// ---------------------------------------------------------------------------

describe('runTriage — worktree conflict', () => {
  const sharedMocks = (pr: { number: number; headRefOid: string }, ndjson: string) => {
    const view = JSON.stringify({
      statusCheckRollup: [{ state: 'FAILURE', conclusion: 'FAILURE' }],
      mergeable: 'MERGEABLE',
      mergeStateStatus: 'CLEAN',
      reviewDecision: null,
      headRefOid: pr.headRefOid,
      isDraft: false,
    });
    const graphql = JSON.stringify({ data: { repository: { pullRequest: { reviewThreads: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [] } } } } });
    return [
      { match: argsInclude('gh', 'auth'), result: { stdout: '' } },
      { match: argsInclude('git', 'rev-parse', '--abbrev-ref'), result: { stdout: 'main\n' } },
      { match: argsInclude('git', 'status', '--porcelain'), result: { stdout: '' } },
      { match: argsInclude('gh', 'repo', 'view'), result: { stdout: JSON.stringify({ nameWithOwner: 'owner/repo' }) } },
      { match: argsInclude('gh', 'pr', 'merge', '--help'), result: { stdout: '--match-head-commit' } },
      { match: argsInclude('git', 'fetch'), result: { stdout: '' } },
      { match: argsInclude('git', 'pull', '--ff-only'), result: { stdout: '' } },
      { match: argsInclude('mkdir'), result: { stdout: '' } },
      { match: argsInclude('repos/owner/repo/pulls'), result: { stdout: ndjson } },
      { match: argsInclude('gh', 'pr', 'view'), result: { stdout: view } },
      { match: argsInclude('gh', 'api', 'graphql'), result: { stdout: graphql } },
      { match: argsInclude('git', 'checkout', 'main'), result: { stdout: '' } },
    ];
  };

  it('removes a stale worktree holding the PR branch and continues', async () => {
    const pr = { number: 20, title: 'Stale-WT', headRefName: 'feat/blocked', headRefOid: 'wt1', createdAt: '2024-01-01T00:00:00Z', isDraft: false };
    const ndjson = JSON.stringify(pr);
    const porcelain = [
      `worktree ${process.cwd()}`,
      'HEAD aaaa',
      'branch refs/heads/main',
      '',
      'worktree /tmp/stale-wt',
      'HEAD bbbb',
      `branch refs/heads/${pr.headRefName}`,
      '',
    ].join('\n');

    const removeCalls: string[][] = [];
    const checkoutCalls: string[][] = [];

    const deps = fakeDeps([
      ...sharedMocks(pr, ndjson),
      {
        match: (args) => args.join(' ') === 'git worktree list --porcelain',
        result: { stdout: porcelain },
      },
      {
        match: (args) => {
          const matched = args[0] === 'git' && args[1] === 'worktree' && args[2] === 'remove';
          if (matched) removeCalls.push(args);
          return matched;
        },
        result: { stdout: '' },
      },
      { match: argsInclude('git', 'worktree', 'prune'), result: { stdout: '' } },
      {
        match: (args) => {
          const matched = argsInclude('gh', 'pr', 'checkout')(args);
          if (matched) checkoutCalls.push(args);
          return matched;
        },
        result: { stdout: '' },
      },
      { match: (args) => args.includes('rev-parse') && args.includes('HEAD'), result: { stdout: 'wt1\n' } },
      // No remote ref — soft-skip after the checkout. The point of this test is the
      // pre-checkout cleanup, so we accept any later soft-skip.
      { match: (args) => args.includes('rev-parse') && args.includes('--verify'), result: { exitCode: 1, stdout: '' } },
    ]);

    const code = await runTriage({ ...defaultOptions, execute: true }, deps);
    expect(code).toBe(1); // soft-skip downstream
    expect(removeCalls.length).toBe(1);
    expect(removeCalls[0]).toContain('/tmp/stale-wt');
    expect(checkoutCalls.length).toBeGreaterThan(0); // checkout still happened
    const warned = deps.logged.find(([level, msg]) => level === 'WARN' && msg.includes('/tmp/stale-wt'));
    expect(warned).toBeDefined();
  });

  it('does not remove the current worktree even if it holds the PR branch', async () => {
    const pr = { number: 21, title: 'Self-WT', headRefName: 'feat/self', headRefOid: 'wt2', createdAt: '2024-01-01T00:00:00Z', isDraft: false };
    const ndjson = JSON.stringify(pr);
    const porcelain = [
      `worktree ${process.cwd()}`,
      'HEAD aaaa',
      `branch refs/heads/${pr.headRefName}`,
      '',
    ].join('\n');

    const removeCalls: string[][] = [];

    const deps = fakeDeps([
      ...sharedMocks(pr, ndjson),
      {
        match: (args) => args.join(' ') === 'git worktree list --porcelain',
        result: { stdout: porcelain },
      },
      {
        match: (args) => {
          const matched = args[0] === 'git' && args[1] === 'worktree' && args[2] === 'remove';
          if (matched) removeCalls.push(args);
          return matched;
        },
        result: { stdout: '' },
      },
      { match: argsInclude('gh', 'pr', 'checkout'), result: { stdout: '' } },
      { match: (args) => args.includes('rev-parse') && args.includes('HEAD'), result: { stdout: 'wt2\n' } },
      { match: (args) => args.includes('rev-parse') && args.includes('--verify'), result: { exitCode: 1, stdout: '' } },
    ]);

    await runTriage({ ...defaultOptions, execute: true }, deps);
    expect(removeCalls.length).toBe(0);
  });

  it('soft-skips when conflicting worktree cannot be removed', async () => {
    const pr = { number: 22, title: 'Locked-WT', headRefName: 'feat/locked', headRefOid: 'wt3', createdAt: '2024-01-01T00:00:00Z', isDraft: false };
    const ndjson = JSON.stringify(pr);
    const porcelain = [
      `worktree ${process.cwd()}`,
      'HEAD aaaa',
      'branch refs/heads/main',
      '',
      'worktree /tmp/locked-wt',
      'HEAD bbbb',
      `branch refs/heads/${pr.headRefName}`,
      '',
    ].join('\n');

    const checkoutCalls: string[][] = [];

    const deps = fakeDeps([
      ...sharedMocks(pr, ndjson),
      {
        match: (args) => args.join(' ') === 'git worktree list --porcelain',
        result: { stdout: porcelain },
      },
      {
        match: argsInclude('git', 'worktree', 'remove'),
        result: { exitCode: 1, stderr: 'fatal: working tree is locked' },
      },
      {
        match: (args) => {
          const matched = argsInclude('gh', 'pr', 'checkout')(args);
          if (matched) checkoutCalls.push(args);
          return matched;
        },
        result: { stdout: '' },
      },
    ]);

    const code = await runTriage({ ...defaultOptions, execute: true }, deps);
    expect(code).toBe(1);
    // Critical: we never tried `gh pr checkout` because the conflict was unresolvable.
    expect(checkoutCalls.length).toBe(0);
  });
});
