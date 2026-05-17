import { join } from 'node:path';
import type { Deps } from './dependencies';
import { checkReadiness, isMergeReady, classifyMergeFailure } from './readiness';
import type { Readiness } from './readiness';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TriageOptions = {
  execute: boolean;
  unattended: boolean;
  limit?: number;
  queueLimit?: number;
  maxAttempts: number;
  pollAttempts: number;
  pollIntervalMs: number;
  agentTimeoutMs: number;
  includeNew: boolean;
  retryPending: boolean;
  unsafeNoHeadMatch: boolean;
};

type SnapshotPR = {
  number: number;
  title: string;
  headRefName: string;
  headRefOid: string;
  createdAt: string;
  isDraft: boolean;
};

type SkipReason =
  | 'draft'
  | 'cap-out'
  | 'ci-pending'
  | 'branch-protection'
  | 'required-reviews'
  | 'permissions'
  | 'merge-failed'
  | 'stale-head'
  | 'lost-readiness'
  | 'local-branch-mismatch'
  | 'local-branch-no-upstream'
  | 'unpushed-local-commits'
  | 'agent-timeout'
  | 'dirty-before-checkout'
  | 'worktree-conflict';

type SoftSkipResult = { outcome: 'soft-skip'; reason: SkipReason; detail?: string };
type HardStopResult = { outcome: 'hard-stop'; reason: string };
type ReadyResult = { outcome: 'ready'; readiness: Readiness };
type MergedResult = { outcome: 'merged'; mergeCommitSha: string };

type RunContext = {
  owner: string;
  name: string;
  runDir: string;
  supportsMatchHeadCommit: boolean;
  startedAt: Date;
};

// ---------------------------------------------------------------------------
// PR listing
// ---------------------------------------------------------------------------

async function listOpenPRs(
  owner: string,
  name: string,
  queueLimit: number | undefined,
  deps: Deps,
): Promise<SnapshotPR[]> {
  const result = await deps.run([
    'gh', 'api', '-X', 'GET',
    `repos/${owner}/${name}/pulls`,
    '-f', 'state=open',
    '-f', 'sort=created',
    '-f', 'direction=asc',
    '--paginate',
    '--jq', '.[] | {number, title, headRefName: .head.ref, headRefOid: .head.sha, createdAt: .created_at, isDraft: .draft}',
  ]);

  if (result.exitCode !== 0) {
    throw new Error(`Failed to list pull requests: ${result.stderr.trim()}`);
  }

  const lines = result.stdout.split('\n').filter((l) => l.trim() !== '');
  const prs = lines.map((l) => JSON.parse(l) as SnapshotPR);

  // Already sorted asc by createdAt from the API, but sort explicitly for safety.
  prs.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  if (queueLimit !== undefined && prs.length > queueLimit) {
    prs.splice(queueLimit);
  }

  return prs;
}

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

function buildPrompt(pr: SnapshotPR, readiness: Readiness): string {
  const parts = [`/address-pr ${pr.number}`];
  if (readiness.mergeStateStatus === 'BEHIND') {
    parts.push(
      '\nThe branch is BEHIND main. Update or rebase it onto origin/main as part of addressing this PR.',
    );
  }
  if (readiness.reviewDecision === 'CHANGES_REQUESTED') {
    parts.push('\nThere are CHANGES_REQUESTED reviews. Address them and request re-review.');
  }
  return parts.join('\n');
}

// ---------------------------------------------------------------------------
// softSkipWithRecovery — check tree and return to main, escalating to hard stop on trouble
// ---------------------------------------------------------------------------

async function softSkipWithRecovery(
  reason: SkipReason,
  deps: Deps,
  detail?: string,
): Promise<SoftSkipResult | HardStopResult> {
  const dirty = await deps.run(['git', 'status', '--porcelain']);
  if (dirty.exitCode === 0 && dirty.stdout.trim() !== '') {
    return { outcome: 'hard-stop', reason: `dirty-tree-on-skip-${reason}` };
  }
  const co = await deps.run(['git', 'checkout', 'main']);
  if (co.exitCode !== 0) {
    return { outcome: 'hard-stop', reason: `checkout-main-failed-on-skip-${reason}` };
  }
  return { outcome: 'soft-skip', reason, detail };
}

// ---------------------------------------------------------------------------
// Worktree conflict resolution
//
// `gh pr checkout` runs `git checkout <branch>`, which fails if that branch is
// already checked out in another worktree (e.g. a stale agent worktree under
// .claude/worktrees/). Detect the conflicting worktree and remove it so the
// checkout can proceed. The current worktree is never removed.
// ---------------------------------------------------------------------------

type WorktreeEntry = { path: string; branch: string | undefined };

function parseWorktreeList(porcelain: string): WorktreeEntry[] {
  const entries: WorktreeEntry[] = [];
  let currentPath: string | undefined;
  let currentBranch: string | undefined;
  for (const rawLine of porcelain.split('\n')) {
    const line = rawLine.trimEnd();
    if (line === '') {
      if (currentPath !== undefined) {
        entries.push({ path: currentPath, branch: currentBranch });
      }
      currentPath = undefined;
      currentBranch = undefined;
      continue;
    }
    if (line.startsWith('worktree ')) {
      currentPath = line.slice('worktree '.length);
    } else if (line.startsWith('branch ')) {
      const ref = line.slice('branch '.length);
      currentBranch = ref.startsWith('refs/heads/') ? ref.slice('refs/heads/'.length) : ref;
    }
  }
  if (currentPath !== undefined) {
    entries.push({ path: currentPath, branch: currentBranch });
  }
  return entries;
}

async function resolveWorktreeConflict(
  headRefName: string,
  deps: Deps,
): Promise<{ outcome: 'ok' } | { outcome: 'conflict-unresolved'; detail: string }> {
  const listResult = await deps.run(['git', 'worktree', 'list', '--porcelain']);
  if (listResult.exitCode !== 0) {
    return { outcome: 'ok' }; // best-effort: let checkout produce the real error
  }
  const entries = parseWorktreeList(listResult.stdout);
  const cwd = process.cwd();
  const conflicting = entries.filter(
    (entry) => entry.branch === headRefName && entry.path !== cwd,
  );
  if (conflicting.length === 0) {
    return { outcome: 'ok' };
  }
  for (const entry of conflicting) {
    deps.log(
      'WARN',
      `Removing stale worktree at ${entry.path} (holds branch ${headRefName})`,
    );
    const remove = await deps.run(['git', 'worktree', 'remove', '--force', entry.path]);
    if (remove.exitCode !== 0) {
      const detail = remove.stderr.trim() || `exit ${remove.exitCode}`;
      return { outcome: 'conflict-unresolved', detail: `${entry.path}: ${detail}` };
    }
  }
  // Drop any administrative residue from removed worktrees.
  await deps.run(['git', 'worktree', 'prune']);
  return { outcome: 'ok' };
}

// ---------------------------------------------------------------------------
// Address loop
// ---------------------------------------------------------------------------

async function addressLoop(
  pr: SnapshotPR,
  initialReadiness: Readiness,
  context: RunContext,
  options: TriageOptions,
  deps: Deps,
): Promise<ReadyResult | SoftSkipResult | HardStopResult> {
  let readiness = initialReadiness;

  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    // Pre-checkout cleanliness
    const dirty = await deps.run(['git', 'status', '--porcelain']);
    if (dirty.stdout.trim() !== '') {
      return { outcome: 'hard-stop', reason: 'dirty-before-checkout' };
    }

    const conflict = await resolveWorktreeConflict(pr.headRefName, deps);
    if (conflict.outcome === 'conflict-unresolved') {
      return softSkipWithRecovery('worktree-conflict', deps, conflict.detail);
    }

    await deps.runOk(['gh', 'pr', 'checkout', String(pr.number)]);

    // Local-branch sanity
    const localHead = (await deps.runOk(['git', 'rev-parse', 'HEAD'])).trim();
    if (localHead !== readiness.headRefOid) {
      return softSkipWithRecovery('local-branch-mismatch', deps);
    }

    // Invoke claude
    // Triage runs in volume across many PRs — Sonnet is the right default.
    // Opus is too expensive and too slow for the per-PR address-pr loop.
    const claudeArgs = ['claude', '-p', '--model', 'sonnet'];
    if (options.unattended) claudeArgs.push('--dangerously-skip-permissions');

    const attemptLogPath = options.execute
      ? join(context.runDir, `pr-${pr.number}-attempt-${attempt}.log`)
      : undefined;

    const result = await deps.runStreaming(claudeArgs, {
      stdin: buildPrompt(pr, readiness),
      timeoutMs: options.agentTimeoutMs,
      logPath: attemptLogPath,
    });

    // Handle timeout
    if (result.timedOut) {
      const dirtyAfterTimeout = await deps.run(['git', 'status', '--porcelain']);
      if (dirtyAfterTimeout.stdout.trim() !== '') {
        return { outcome: 'hard-stop', reason: 'agent-timeout-dirty' };
      }
      const co = await deps.run(['git', 'checkout', 'main']);
      if (co.exitCode !== 0) {
        return { outcome: 'hard-stop', reason: 'agent-timeout-checkout-failed' };
      }
      return { outcome: 'soft-skip', reason: 'agent-timeout' };
    }

    if (result.exitCode !== 0) {
      deps.log('WARN', `claude exited ${result.exitCode} on PR #${pr.number} attempt ${attempt}`);
    }

    // Post-agent cleanliness
    const dirtyAfter = await deps.run(['git', 'status', '--porcelain']);
    if (dirtyAfter.stdout.trim() !== '') {
      return { outcome: 'hard-stop', reason: 'dirty-after-agent' };
    }

    // Unpushed commit check (using explicit remote ref, not @{u})
    const remoteRef = `refs/remotes/origin/${pr.headRefName}`;
    const refCheck = await deps.run(['git', 'rev-parse', '--verify', '--quiet', remoteRef]);
    if (refCheck.exitCode !== 0) {
      return softSkipWithRecovery('local-branch-no-upstream', deps);
    }
    const unpushedResult = await deps.run([
      'git', 'rev-list', `${remoteRef}..HEAD`, '--count',
    ]);
    const unpushed = parseInt(unpushedResult.stdout.trim(), 10);
    if (unpushed > 0) {
      return softSkipWithRecovery('unpushed-local-commits', deps);
    }

    // Re-check readiness
    readiness = await checkReadiness(
      pr.number,
      context.owner,
      context.name,
      options.pollAttempts,
      options.pollIntervalMs,
      deps,
    );

    if (isMergeReady(readiness)) {
      return { outcome: 'ready', readiness };
    }

    deps.log(
      'WARN',
      `PR #${pr.number} not ready after attempt ${attempt}/${options.maxAttempts}`,
    );
  }

  return softSkipWithRecovery('cap-out', deps);
}

// ---------------------------------------------------------------------------
// Merge step
// ---------------------------------------------------------------------------

async function mergePR(
  pr: SnapshotPR,
  readiness: Readiness,
  attempts: number,
  context: RunContext,
  options: TriageOptions,
  deps: Deps,
): Promise<MergedResult | SoftSkipResult | HardStopResult> {
  // Final readiness check in case state drifted
  const finalReadiness = await checkReadiness(
    pr.number,
    context.owner,
    context.name,
    options.pollAttempts,
    options.pollIntervalMs,
    deps,
  );

  if (!isMergeReady(finalReadiness)) {
    return softSkipWithRecovery('lost-readiness', deps);
  }

  const mergeArgs = [
    'gh', 'pr', 'merge', String(pr.number),
    '--squash', '--delete-branch',
  ];
  if (context.supportsMatchHeadCommit) {
    mergeArgs.push('--match-head-commit', finalReadiness.headRefOid);
  }

  const mergeResult = await deps.run(mergeArgs);

  if (mergeResult.exitCode !== 0) {
    const reason = classifyMergeFailure(mergeResult.stderr);

    if (reason === 'stale-head') {
      // Retry once after a fresh readiness check
      const retryReadiness = await checkReadiness(
        pr.number,
        context.owner,
        context.name,
        options.pollAttempts,
        options.pollIntervalMs,
        deps,
      );
      if (!isMergeReady(retryReadiness)) {
        return softSkipWithRecovery('lost-readiness', deps);
      }
      const retryArgs = [...mergeArgs];
      if (context.supportsMatchHeadCommit) {
        // Update the hash in the args
        const hashIndex = retryArgs.indexOf('--match-head-commit');
        if (hashIndex !== -1) retryArgs[hashIndex + 1] = retryReadiness.headRefOid;
      }
      const retryResult = await deps.run(retryArgs);
      if (retryResult.exitCode !== 0) {
        return softSkipWithRecovery('stale-head', deps, retryResult.stderr);
      }
    } else {
      const skipReason: SkipReason =
        reason === 'branch-protection'
          ? 'branch-protection'
          : reason === 'required-reviews-missing'
            ? 'required-reviews'
            : reason === 'permissions'
              ? 'permissions'
              : 'merge-failed';
      return softSkipWithRecovery(skipReason, deps, mergeResult.stderr);
    }
  }

  // Fetch merge commit SHA
  let mergeCommitSha = '';
  try {
    mergeCommitSha = (
      await deps.runOk([
        'gh', 'pr', 'view', String(pr.number),
        '--json', 'mergeCommit',
        '--jq', '.mergeCommit.oid',
      ])
    ).trim();
  } catch {
    // Non-fatal — SHA is best-effort
  }

  // Write per-PR JSON
  if (options.execute) {
    const prJson = JSON.stringify(
      {
        prNumber: pr.number,
        title: pr.title,
        headBranch: pr.headRefName,
        originalHeadSha: readiness.headRefOid,
        mergeCommitSha,
        attempts,
        finalState: 'merged',
      },
      null,
      2,
    );
    await deps.writeFile(join(context.runDir, `pr-${pr.number}.json`), prJson);
  }

  // Sync main
  await deps.runOk(['git', 'checkout', 'main']);
  const pull = await deps.run(['git', 'pull', '--ff-only', 'origin', 'main']);
  if (pull.exitCode !== 0) {
    return { outcome: 'hard-stop', reason: 'main-diverged' };
  }

  return { outcome: 'merged', mergeCommitSha };
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Walks open PRs oldest-first, calls `/address-pr` to fix issues, and merges
 * each once it passes all readiness checks. Returns a numeric exit code.
 */
export async function runTriage(options: TriageOptions, deps: Deps): Promise<number> {
  const startedAt = deps.now();

  // -------------------------------------------------------------------------
  // Preflight
  // -------------------------------------------------------------------------

  const authCheck = await deps.run(['gh', 'auth', 'status']);
  if (authCheck.exitCode !== 0) {
    deps.log('ERROR', 'gh is not authenticated. Run `gh auth login` first.');
    return 1;
  }

  const branch = (await deps.run(['git', 'rev-parse', '--abbrev-ref', 'HEAD'])).stdout.trim();
  if (branch !== 'main') {
    deps.log('ERROR', `Must be on the main branch (currently on '${branch}').`);
    return 1;
  }

  const treeStatus = await deps.run(['git', 'status', '--porcelain']);
  if (treeStatus.stdout.trim() !== '') {
    deps.log('ERROR', 'Working tree is not clean. Commit or stash changes first.');
    return 1;
  }

  const repoView = await deps.run(['gh', 'repo', 'view', '--json', 'nameWithOwner']);
  if (repoView.exitCode !== 0) {
    deps.log('ERROR', `Failed to resolve repository: ${repoView.stderr.trim()}`);
    return 1;
  }
  const { nameWithOwner } = JSON.parse(repoView.stdout) as { nameWithOwner: string };
  const [owner, name] = nameWithOwner.split('/') as [string, string];

  let supportsMatchHeadCommit = false;
  if (options.execute) {
    const helpResult = await deps.run(['gh', 'pr', 'merge', '--help']);
    supportsMatchHeadCommit =
      helpResult.stdout.includes('--match-head-commit') ||
      helpResult.stderr.includes('--match-head-commit');

    if (!supportsMatchHeadCommit && !options.unsafeNoHeadMatch) {
      deps.log(
        'ERROR',
        'gh version does not support --match-head-commit. Upgrade gh or pass --unsafe-no-head-match.',
      );
      return 1;
    }
    if (!supportsMatchHeadCommit && options.unsafeNoHeadMatch) {
      deps.log(
        'WARN',
        '--unsafe-no-head-match: merge will proceed without head-SHA verification. Race conditions possible.',
      );
    }
  }

  if (options.unattended) {
    deps.log('WARN', '⚠  --unattended: claude will run with --dangerously-skip-permissions');
  }

  await deps.runOk(['git', 'fetch', 'origin', 'main']);

  let runDir = '';
  if (options.execute) {
    await deps.runOk(['git', 'pull', '--ff-only', 'origin', 'main']);
    runDir = join('tmp', 'triage-pull-requests', startedAt.toISOString().replace(/[:.]/g, '-'));
    await deps.runOk(['mkdir', '-p', runDir]);
  } else {
    // Dry-run: report whether local main is behind
    const localSha = (await deps.run(['git', 'rev-parse', 'HEAD'])).stdout.trim();
    const remoteSha = (await deps.run(['git', 'rev-parse', 'origin/main'])).stdout.trim();
    if (localSha !== remoteSha) {
      const countResult = await deps.run([
        'git', 'rev-list', 'HEAD..origin/main', '--count',
      ]);
      const count = countResult.stdout.trim();
      deps.log('INFO', `Local main is ${count} commit(s) behind origin/main.`);
    }
  }

  const context: RunContext = {
    owner,
    name,
    runDir,
    supportsMatchHeadCommit,
    startedAt,
  };

  // -------------------------------------------------------------------------
  // Snapshot
  // -------------------------------------------------------------------------

  deps.log('PHASE', 'Fetching open pull requests…');
  let snapshot = await listOpenPRs(owner, name, options.queueLimit, deps);
  deps.log('INFO', `Found ${snapshot.length} open pull request(s).`);

  const merged: Array<{ pr: SnapshotPR; mergeCommitSha: string }> = [];
  const skipped = new Map<number, { pr: SnapshotPR; reason: SkipReason; detail?: string }>();
  const unattempted: SnapshotPR[] = [];
  let hardStopReason: string | null = null;

  // Separate drafts immediately
  const drafts = snapshot.filter((pr) => pr.isDraft);
  const nonDrafts = snapshot.filter((pr) => !pr.isDraft);
  for (const pr of drafts) {
    skipped.set(pr.number, { pr, reason: 'draft' });
  }

  // Apply --limit (counts non-drafts only)
  let workset: SnapshotPR[];
  if (options.limit !== undefined && options.limit < nonDrafts.length) {
    workset = nonDrafts.slice(0, options.limit);
    unattempted.push(...nonDrafts.slice(options.limit));
  } else {
    workset = nonDrafts;
  }

  deps.log(
    'INFO',
    `Selected workset: ${workset.length} PR(s)` +
      (unattempted.length > 0 ? ` (${unattempted.length} unattempted due to --limit)` : '') +
      (drafts.length > 0 ? `, ${drafts.length} draft(s) skipped` : ''),
  );

  // -------------------------------------------------------------------------
  // Process workset
  // -------------------------------------------------------------------------

  const processedNumbers = new Set<number>([
    ...drafts.map((p) => p.number),
    ...unattempted.map((p) => p.number),
  ]);

  const processPR = async (pr: SnapshotPR): Promise<boolean> => {
    deps.log('PHASE', `Processing PR #${pr.number}: ${pr.title}`);
    processedNumbers.add(pr.number);

    let readiness: Readiness;
    try {
      readiness = await checkReadiness(
        pr.number,
        owner,
        name,
        options.pollAttempts,
        options.pollIntervalMs,
        deps,
      );
    } catch (error) {
      deps.log('ERROR', `Failed to check readiness for PR #${pr.number}: ${String(error)}`);
      skipped.set(pr.number, { pr, reason: 'merge-failed', detail: String(error) });
      return true; // continue
    }

    if (readiness.ciPending && !readiness.ciPassing) {
      deps.log('WARN', `PR #${pr.number} has pending CI checks.`);
      skipped.set(pr.number, { pr, reason: 'ci-pending' });
      return true;
    }

    if (isMergeReady(readiness)) {
      deps.log('OK', `PR #${pr.number} is ready to merge.`);
      if (!options.execute) {
        deps.log('INFO', `Dry-run: would merge PR #${pr.number}.`);
        return true;
      }
      const result = await mergePR(pr, readiness, 0, context, options, deps);
      if (result.outcome === 'merged') {
        merged.push({ pr, mergeCommitSha: result.mergeCommitSha });
        deps.log('OK', `Merged PR #${pr.number}.`);
        return true;
      }
      if (result.outcome === 'hard-stop') {
        hardStopReason = result.reason;
        return false;
      }
      skipped.set(pr.number, { pr, reason: result.reason, detail: result.detail });
      return true;
    }

    // Needs work
    if (!options.execute) {
      deps.log('INFO', `Dry-run: PR #${pr.number} needs work (not addressing in dry-run).`);
      return true;
    }

    const loopResult = await addressLoop(pr, readiness, context, options, deps);

    if (loopResult.outcome === 'hard-stop') {
      hardStopReason = loopResult.reason;
      return false;
    }

    if (loopResult.outcome === 'soft-skip') {
      skipped.set(pr.number, {
        pr,
        reason: loopResult.reason,
        detail: loopResult.detail,
      });
      return true;
    }

    // ready — merge
    const mergeResult = await mergePR(
      pr,
      loopResult.readiness,
      options.maxAttempts,
      context,
      options,
      deps,
    );

    if (mergeResult.outcome === 'merged') {
      merged.push({ pr, mergeCommitSha: mergeResult.mergeCommitSha });
      deps.log('OK', `Merged PR #${pr.number}.`);

      // Refresh snapshot with newly-opened PRs if requested
      if (options.includeNew) {
        const fresh = await listOpenPRs(owner, name, options.queueLimit, deps);
        const newPRs = fresh.filter((p) => !processedNumbers.has(p.number) && !p.isDraft);
        workset.push(...newPRs);
      }
      return true;
    }

    if (mergeResult.outcome === 'hard-stop') {
      hardStopReason = mergeResult.reason;
      return false;
    }

    skipped.set(pr.number, {
      pr,
      reason: mergeResult.reason,
      detail: mergeResult.detail,
    });
    return true;
  };

  for (const pr of workset) {
    const continueProcessing = await processPR(pr);
    if (!continueProcessing) break;
  }

  // -------------------------------------------------------------------------
  // ci-pending retry pass
  // -------------------------------------------------------------------------

  if (options.retryPending && hardStopReason === null) {
    const pendingPRs = [...skipped.values()]
      .filter((s) => s.reason === 'ci-pending')
      .map((s) => s.pr);

    if (pendingPRs.length > 0) {
      deps.log('PHASE', `Retrying ${pendingPRs.length} CI-pending PR(s)…`);
      for (const pr of pendingPRs) {
        skipped.delete(pr.number);
        const continueProcessing = await processPR(pr);
        if (!continueProcessing) break;
      }
    }
  }

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------

  const endedAt = deps.now();

  // Group skipped by reason
  const skippedByReason = new Map<SkipReason, number[]>();
  for (const [num, { reason }] of skipped) {
    const list = skippedByReason.get(reason) ?? [];
    list.push(num);
    skippedByReason.set(reason, list);
  }

  const remainingPending = skippedByReason.get('ci-pending')?.length ?? 0;
  const hasFailures =
    hardStopReason !== null ||
    [...skippedByReason.entries()].some(
      ([reason, nums]) => reason !== 'draft' && nums.length > 0,
    );

  const exitCode = hasFailures ? 1 : 0;

  // Stderr summary table
  deps.log('PHASE', '─── Run Summary ───────────────────────────────────');
  deps.log('INFO', `MERGED              ${merged.length}`);
  for (const [reason, nums] of skippedByReason) {
    const label = `SKIPPED-${reason.toUpperCase()}`.padEnd(20);
    deps.log(nums.length > 0 && reason !== 'draft' ? 'WARN' : 'INFO', `${label} ${nums.length}`);
  }
  if (hardStopReason) {
    deps.log('ERROR', `HARD-STOP            ${hardStopReason}`);
  }
  if (unattempted.length > 0) {
    deps.log('INFO', `UNATTEMPTED          ${unattempted.length}`);
  }

  // Rollback template
  if (merged.length > 0) {
    deps.log('INFO', '─── Rollback instructions ──────────────────────────');
    for (const { pr, mergeCommitSha } of merged) {
      deps.log(
        'INFO',
        `PR #${pr.number} (${pr.title}): git revert ${mergeCommitSha || '<sha from summary.json>'}`,
      );
    }
  }

  // Write summary.json
  if (options.execute) {
    const summary = {
      selectedWorkset: workset.map((p) => p.number),
      unattempted: unattempted.map((p) => p.number),
      merged: merged.map(({ pr, mergeCommitSha }) => ({ number: pr.number, mergeCommitSha })),
      skipped: Object.fromEntries(
        [...skippedByReason.entries()].map(([reason, nums]) => [reason, nums]),
      ),
      hardStop: hardStopReason ? { reason: hardStopReason } : null,
      exitCode,
      startedAt: startedAt.toISOString(),
      endedAt: endedAt.toISOString(),
    };
    await deps.writeFile(join(runDir, 'summary.json'), JSON.stringify(summary, null, 2));
  }

  if (remainingPending > 0) {
    deps.log(
      'WARN',
      `${remainingPending} PR(s) still have pending CI after retry pass — exiting with code 1.`,
    );
  }

  return exitCode;
}
