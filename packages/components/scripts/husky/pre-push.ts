#!/usr/bin/env bun
import { $ } from 'bun';

import {
  header,
  hookDurationWarning,
  info,
  isContinuousIntegration,
  parsePushRefs,
  readHookDurationBaseline,
  REPO_ROOT,
  success,
  warning,
} from './utilities.ts';

if (isContinuousIntegration()) {
  info('Skipping hook in CI');
  process.exit(0);
}

// Soft duration budget: warns (never fails) when the hook runs slower than the
// committed baseline. Started here, before any work, so the total elapsed
// time on every exit path is captured.
const hookStartedAt = Date.now();
const durationBaseline = await readHookDurationBaseline();
if (durationBaseline !== undefined) {
  process.on('exit', () => {
    const message = hookDurationWarning(
      Date.now() - hookStartedAt,
      durationBaseline.prePushWarnMilliseconds,
      'pre-push',
    );
    if (message !== null) warning(message);
  });
}

header('Pre-push: fast sanity checks (fails open)');

/**
 * The philosophical inversion from the old pre-push, in one place.
 *
 * The old hook ran a scoped (or, on any scope-derivation ambiguity, full)
 * lint+typecheck+test pass before every push, and serialized that work across
 * every worktree on the machine behind a shared gate lock — "fail safe to
 * full on any ambiguity", so a missed edge could never let an untested change
 * slip past the LOCAL gate. That correctness story was bought with a latency
 * tax that grows linearly with the number of concurrent worktrees: a fleet of
 * agents pushing at once queued behind one gate lock, each potentially paying
 * for a full workspace validation.
 *
 * This hook inverts that trade. It FAILS OPEN: every check below only warns
 * and always exits 0 — there is no scoped or full lint/typecheck/test
 * dispatch, no package build, and no gate lock left to serialize on. The
 * backstop moved to PR CI (`unit-tests.yaml` + `browser-tests.yaml`, both
 * required status checks on `main`) and `main-green` (the authoritative
 * post-merge source gate): breakage on a PR branch is cheap to catch and fix
 * there, in parallel, without blocking every other worktree's push. See
 * `docs/validation-topology.md`'s Push-layer row for the full rationale and
 * the removed-check → CI-owner mapping.
 */

const stdinText = await Bun.stdin.text();

let parsed;
try {
  parsed = parsePushRefs(stdinText);
} catch (cause) {
  const reason = cause instanceof Error ? cause.message : String(cause);
  warning(`Could not parse push refs (${reason}); skipping local checks — CI is the real gate.`);
  process.exit(0);
}

if (parsed.updates.length === 0) {
  if (parsed.deletionCount > 0) {
    success('Only branch deletions pushed; nothing to check');
  } else {
    warning(
      'No push refs on stdin (or hook run by hand without piped refs); skipping local checks',
    );
  }
  process.exit(0);
}

/**
 * Best-effort, non-blocking changeset hint: warn when this push touches
 * published-package source without adding a changeset, so a developer or
 * agent can add one before opening the PR instead of learning about it from
 * CI. `changeset-guard.yaml` is the real enforcement point — this is purely a
 * heads-up, so any failure here (shallow clone, missing `origin/main`, no
 * network) is swallowed rather than escalated.
 */
try {
  const diff = await $`git diff --name-only origin/main...HEAD`.cwd(REPO_ROOT).nothrow().quiet();
  if (diff.exitCode === 0) {
    const files = diff.stdout.toString().split('\n').filter(Boolean);
    const touchesPublishedSource = files.some(
      (file) =>
        (file.startsWith('packages/components/src/') || file.startsWith('packages/chat/src/')) &&
        !file.endsWith('.test.ts'),
    );
    const hasChangeset = files.some(
      (file) => file.startsWith('.changeset/') && file.endsWith('.md'),
    );
    if (touchesPublishedSource && !hasChangeset) {
      warning(
        'No changeset detected for published-package source changes; changeset-guard in CI will check this before merge.',
      );
    }
  }
} catch {
  // Best-effort only — this hint must never block or slow down the push.
}

success(
  'Pre-push checks passed (fast, non-blocking — PR CI + branch protection are the real gate)',
);
process.exit(0);
