/// <reference types="bun-types" />
// Tests for the recovery classifier in scripts/next.ts. The classifier is
// pure — it takes a RecoveryInputs record and returns a verdict, so every
// row of the decision table can be exercised with constructed input.

import { describe, expect, test } from 'bun:test';

import {
  classifyRecovery,
  shouldRunRecoverySweep,
  shouldRunResume,
  verdictFingerprint,
} from './next.ts';

type AnyTask = {
  id: string;
  title: string;
  status: string;
  branch?: string | null;
  createdAt?: string;
  lastModifiedAt?: string;
};

type AnyPr = {
  number: number;
  url: string;
  state: string;
  mergeable: string | null;
  mergeStateStatus: string | null;
  headRefName?: string;
  headRefOid?: string;
  baseRefName?: string;
  createdAt?: string;
  body?: string;
};

const TASK_ID = '78f71115-ad25-4eaa-9f55-81cb2f71e127';
const TASK_BRANCH = 'next/78f71115';
const NOW = Date.parse('2026-05-12T20:00:00.000Z');
const HOUR_AGO_ISO = '2026-05-12T19:00:00.000Z'; // > 10 min grace window
const RECENT_ISO = '2026-05-12T19:55:00.000Z'; // within grace window

function buildTask(overrides: Partial<AnyTask> = {}): AnyTask {
  return {
    id: TASK_ID,
    title: 'test task',
    status: 'in-progress',
    branch: TASK_BRANCH,
    createdAt: '2026-05-12T15:00:00.000Z',
    lastModifiedAt: HOUR_AGO_ISO,
    ...overrides,
  };
}

function buildPr(overrides: Partial<AnyPr> = {}): AnyPr {
  return {
    number: 42,
    url: 'https://github.com/example/repo/pull/42',
    state: 'OPEN',
    mergeable: null,
    mergeStateStatus: null,
    headRefName: TASK_BRANCH,
    headRefOid: 'abc123def456',
    baseRefName: 'main',
    createdAt: '2026-05-12T16:00:00.000Z',
    body: `## Summary\n\nDoes a thing.\n\nTask: \`${TASK_ID}\`\n`,
    ...overrides,
  };
}

function buildInputs(
  overrides: Partial<Parameters<typeof classifyRecovery>[0]> = {},
): Parameters<typeof classifyRecovery>[0] {
  const defaults = {
    task: buildTask() as Parameters<typeof classifyRecovery>[0]['task'],
    now: NOW,
    worktreePath: null,
    worktreeDirty: false,
    worktreeUnpushed: 0,
    localBranchExists: false,
    localCommitsAheadOfMain: 0,
    remoteBranchExists: false,
    remoteCommitsAheadOfMain: 0,
    candidatePrs: [],
    directBranchPrs: [],
    fallbackBranchPrs: [],
    progressPhases: ['claim'] as Array<
      'claim' | 'branch-set' | 'push' | 'pr-created' | 'in-review' | 'address-pr' | 'merge'
    >,
    liveLockHeld: false,
  };
  return { ...defaults, ...overrides } as Parameters<typeof classifyRecovery>[0];
}

describe('classifyRecovery — live lock', () => {
  test('live lock held → manual with no destructive action', () => {
    const verdict = classifyRecovery(buildInputs({ liveLockHeld: true }));
    expect(verdict.kind).toBe('manual');
    expect(verdict.kind === 'manual' && verdict.reason).toContain('live lock');
  });
});

describe('classifyRecovery — rollback-safe', () => {
  test('past grace, zero candidates, no branch artifacts, claim-only phases → rollback-safe', () => {
    const verdict = classifyRecovery(buildInputs());
    expect(verdict.kind).toBe('rollback-safe');
  });

  test('past-claim phase markers block rollback', () => {
    const verdict = classifyRecovery(buildInputs({ progressPhases: ['claim', 'branch-set'] }));
    expect(verdict.kind).toBe('manual');
    expect(verdict.kind === 'manual' && verdict.code).toBe('past-claim-with-missing-state');
  });

  test('directBranchPrs hit blocks rollback', () => {
    const verdict = classifyRecovery(
      buildInputs({ directBranchPrs: [buildPr({ body: 'no task id here' }) as never] }),
    );
    expect(verdict.kind).toBe('manual');
  });

  test('fallbackBranchPrs hit blocks rollback when task.branch is null', () => {
    const verdict = classifyRecovery(
      buildInputs({
        task: buildTask({ branch: null }) as never,
        fallbackBranchPrs: [buildPr({ body: 'no task id' }) as never],
      }),
    );
    expect(verdict.kind).toBe('manual');
  });

  test('within indexing grace window → manual (recent-search-zero)', () => {
    const verdict = classifyRecovery(
      buildInputs({ task: buildTask({ lastModifiedAt: RECENT_ISO }) as never }),
    );
    expect(verdict.kind).toBe('manual');
    expect(verdict.kind === 'manual' && verdict.code).toBe('recent-search-zero');
  });

  test('null branch with no fallback PRs and only claim marker → rollback-safe', () => {
    const verdict = classifyRecovery(buildInputs({ task: buildTask({ branch: null }) as never }));
    expect(verdict.kind).toBe('rollback-safe');
  });

  test('null branch with worktree present → manual (orphan-worktree)', () => {
    const verdict = classifyRecovery(
      buildInputs({
        task: buildTask({ branch: null }) as never,
        worktreePath: '/path/to/worktree',
      }),
    );
    expect(verdict.kind).toBe('manual');
    expect(verdict.kind === 'manual' && verdict.code).toBe('orphan-worktree');
  });
});

describe('classifyRecovery — complete-safe vs merged-dirty', () => {
  test('merged on main, clean worktree → complete-safe', () => {
    const verdict = classifyRecovery(
      buildInputs({ candidatePrs: [buildPr({ state: 'MERGED' }) as never] }),
    );
    expect(verdict.kind).toBe('complete-safe');
    expect(verdict.kind === 'complete-safe' && verdict.pr.number).toBe(42);
  });

  test('merged on main, no worktree → complete-safe', () => {
    const verdict = classifyRecovery(
      buildInputs({
        candidatePrs: [buildPr({ state: 'MERGED' }) as never],
        worktreePath: null,
      }),
    );
    expect(verdict.kind).toBe('complete-safe');
  });

  test('merged on main, dirty worktree → manual (merged-dirty-worktree)', () => {
    const verdict = classifyRecovery(
      buildInputs({
        candidatePrs: [buildPr({ state: 'MERGED' }) as never],
        worktreePath: '/path/to/wt',
        worktreeDirty: true,
      }),
    );
    expect(verdict.kind).toBe('manual');
    expect(verdict.kind === 'manual' && verdict.code).toBe('merged-dirty-worktree');
  });

  test('merged on main, unpushed commits → manual (merged-dirty-worktree)', () => {
    const verdict = classifyRecovery(
      buildInputs({
        candidatePrs: [buildPr({ state: 'MERGED' }) as never],
        worktreePath: '/path/to/wt',
        worktreeUnpushed: 2,
      }),
    );
    expect(verdict.kind).toBe('manual');
    expect(verdict.kind === 'manual' && verdict.code).toBe('merged-dirty-worktree');
  });

  test('merged on wrong base → manual (wrong-base)', () => {
    const verdict = classifyRecovery(
      buildInputs({
        candidatePrs: [buildPr({ state: 'MERGED', baseRefName: 'develop' }) as never],
      }),
    );
    expect(verdict.kind).toBe('manual');
    expect(verdict.kind === 'manual' && verdict.code).toBe('wrong-base');
  });
});

describe('classifyRecovery — resumable', () => {
  test('one open PR → resumable needsPr:false', () => {
    const verdict = classifyRecovery(
      buildInputs({ candidatePrs: [buildPr({ state: 'OPEN' }) as never] }),
    );
    expect(verdict.kind).toBe('resumable');
    expect(verdict.kind === 'resumable' && verdict.needsPr).toBe(false);
  });

  test('provenance-good branch ahead of main, no PR → resumable needsPr:true', () => {
    const verdict = classifyRecovery(
      buildInputs({ remoteBranchExists: true, remoteCommitsAheadOfMain: 3 }),
    );
    expect(verdict.kind).toBe('resumable');
    expect(verdict.kind === 'resumable' && verdict.needsPr).toBe(true);
  });

  test('stale branch (different from taskBranchName) with no PR → manual (stale-branch-no-pr)', () => {
    const verdict = classifyRecovery(
      buildInputs({
        task: buildTask({ branch: 'feature/wrong-name' }) as never,
        remoteBranchExists: true,
        remoteCommitsAheadOfMain: 3,
      }),
    );
    expect(verdict.kind).toBe('manual');
    expect(verdict.kind === 'manual' && verdict.code).toBe('stale-branch-no-pr');
  });

  test('remote branch with zero commits ahead → manual (empty-remote-branch)', () => {
    const verdict = classifyRecovery(
      buildInputs({ remoteBranchExists: true, remoteCommitsAheadOfMain: 0 }),
    );
    expect(verdict.kind).toBe('manual');
    expect(verdict.kind === 'manual' && verdict.code).toBe('empty-remote-branch');
  });

  test('open PR but dirty worktree → manual (dirty-worktree)', () => {
    const verdict = classifyRecovery(
      buildInputs({
        candidatePrs: [buildPr({ state: 'OPEN' }) as never],
        worktreePath: '/path/to/wt',
        worktreeDirty: true,
      }),
    );
    expect(verdict.kind).toBe('manual');
    expect(verdict.kind === 'manual' && verdict.code).toBe('dirty-worktree');
  });
});

describe('classifyRecovery — multiple PRs always manual', () => {
  test('two identity-verified PRs (merged + open) → manual (multiple-prs)', () => {
    const verdict = classifyRecovery(
      buildInputs({
        candidatePrs: [
          buildPr({ number: 42, state: 'MERGED' }) as never,
          buildPr({ number: 43, state: 'OPEN', url: 'https://example.com/43' }) as never,
        ],
      }),
    );
    expect(verdict.kind).toBe('manual');
    expect(verdict.kind === 'manual' && verdict.code).toBe('multiple-prs');
    expect(verdict.kind === 'manual' && verdict.evidence.length).toBe(2);
  });

  test('two open PRs → manual (multiple-prs)', () => {
    const verdict = classifyRecovery(
      buildInputs({
        candidatePrs: [
          buildPr({ number: 42 }) as never,
          buildPr({ number: 43, url: 'https://example.com/43' }) as never,
        ],
      }),
    );
    expect(verdict.kind).toBe('manual');
    expect(verdict.kind === 'manual' && verdict.code).toBe('multiple-prs');
  });
});

describe('classifyRecovery — closed-unmerged', () => {
  test('one closed (unmerged) PR → manual (closed-unmerged-pr)', () => {
    const verdict = classifyRecovery(
      buildInputs({ candidatePrs: [buildPr({ state: 'CLOSED' }) as never] }),
    );
    expect(verdict.kind).toBe('manual');
    expect(verdict.kind === 'manual' && verdict.code).toBe('closed-unmerged-pr');
  });
});

describe('classifyRecovery — identity filtering (defense in depth)', () => {
  test('candidate PR whose body lacks task id is dropped', () => {
    const verdict = classifyRecovery(
      buildInputs({
        candidatePrs: [buildPr({ body: 'no task id here' }) as never],
      }),
    );
    // With the candidate dropped, this matches the empty-state rollback case.
    expect(verdict.kind).toBe('rollback-safe');
  });

  test('candidate PR created before task is dropped', () => {
    const verdict = classifyRecovery(
      buildInputs({
        candidatePrs: [buildPr({ createdAt: '2026-05-12T14:00:00.000Z' }) as never],
      }),
    );
    expect(verdict.kind).toBe('rollback-safe');
  });
});

describe('verdictFingerprint', () => {
  test('two equivalent rollback-safe verdicts hash to the same fingerprint', () => {
    const a = verdictFingerprint({ kind: 'rollback-safe', reason: 'one' });
    const b = verdictFingerprint({ kind: 'rollback-safe', reason: 'two' });
    // Reason is not part of the fingerprint.
    expect(a).toBe(b);
  });

  test('different PR numbers produce different fingerprints', () => {
    const pr1 = buildPr({ number: 42 }) as never;
    const pr2 = buildPr({ number: 43 }) as never;
    const a = verdictFingerprint({ kind: 'resumable', reason: 'x', pr: pr1, needsPr: false });
    const b = verdictFingerprint({ kind: 'resumable', reason: 'x', pr: pr2, needsPr: false });
    expect(a).not.toBe(b);
  });

  test('manual verdicts with different evidence produce different fingerprints', () => {
    const a = verdictFingerprint({ kind: 'manual', reason: 'x', code: 'other', evidence: ['a'] });
    const b = verdictFingerprint({ kind: 'manual', reason: 'x', code: 'other', evidence: ['b'] });
    expect(a).not.toBe(b);
  });

  test('manual verdicts with same evidence in different order produce the same fingerprint', () => {
    const a = verdictFingerprint({
      kind: 'manual',
      reason: 'x',
      code: 'other',
      evidence: ['a', 'b'],
    });
    const b = verdictFingerprint({
      kind: 'manual',
      reason: 'x',
      code: 'other',
      evidence: ['b', 'a'],
    });
    expect(a).toBe(b);
  });
});

describe('shouldRunRecoverySweep predicate', () => {
  test('worker children never sweep', () => {
    expect(shouldRunRecoverySweep({ __worker: true, recover: true })).toBe(false);
    expect(shouldRunRecoverySweep({ __worker: true, 'recover-then-run': true })).toBe(false);
  });

  test('--recover triggers sweep', () => {
    expect(shouldRunRecoverySweep({ recover: true })).toBe(true);
  });

  test('--recover-then-run triggers sweep', () => {
    expect(shouldRunRecoverySweep({ 'recover-then-run': true })).toBe(true);
  });

  test('default (no flags) does not sweep', () => {
    expect(shouldRunRecoverySweep({})).toBe(false);
  });

  test('--concurrency alone does not sweep', () => {
    expect(shouldRunRecoverySweep({ concurrency: '3' })).toBe(false);
  });
});

describe('shouldRunResume predicate', () => {
  test('worker children never resume', () => {
    expect(shouldRunResume({ __worker: true, resume: 'abc' })).toBe(false);
  });

  test('--resume <id> triggers resume', () => {
    expect(shouldRunResume({ resume: 'abc' })).toBe(true);
  });

  test('--resume empty string does not trigger', () => {
    expect(shouldRunResume({ resume: '' })).toBe(false);
  });

  test('default does not resume', () => {
    expect(shouldRunResume({})).toBe(false);
  });
});
