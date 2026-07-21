#!/usr/bin/env bun
import { $ } from 'bun';

import {
  header,
  hookDurationWarning,
  info,
  isContinuousIntegration,
  parsePushRefs,
  readHookDurationBaseline,
  repairSymlinkedNodeModules,
  REPO_ROOT,
  success,
  warning,
  type ParsedPushRefs,
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

let parsed: ParsedPushRefs;
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
 * Heal a symlinked root `node_modules`, warning only — never blocking.
 *
 * Some worktree tooling provisions `<worktree>/node_modules` as a symlink to
 * the primary checkout to save disk. That aliases one dependency tree under two
 * path prefixes, and Bun's module cache keys on the path, so a package can be
 * loaded twice under two identities and the cache serves one module's bytes
 * under another's. It surfaces as SSR/hydration tests failing with
 * `Unseekable reading file: .../esm-env/index.js`, deterministically, in
 * worktrees only.
 *
 * This hook runs no tests, so the symlink cannot break *this* push — but it
 * silently poisons every LOCAL suite the developer or agent runs afterwards,
 * and the raw error points at a healthy file, so it reads as flakiness and
 * costs hours to trace. Detection is one `lstat` and the repair is a few
 * seconds, so healing it here is nearly free and saves the next local run.
 *
 * Consistent with this hook's fail-open contract, every outcome is a warning:
 * a failed repair restores the symlink and reports, and any unexpected error is
 * swallowed. Nothing here can fail a push.
 */
try {
  const repair = await repairSymlinkedNodeModules();
  if (repair.repaired) {
    warning('Root node_modules was a symlink (worktree provisioning); reinstalled a real tree');
    if (repair.lockfileChanged) {
      warning('That install also rewrote bun.lock — review it before committing');
    }
  } else if (repair.reason === 'install-failed') {
    warning(
      `Reinstalling node_modules failed (exit ${repair.exitCode}); the symlink was restored. ` +
        'Local test runs may fail oddly until you run `bun install` at the repository root.',
    );
  } else if (repair.reason === 'invalid') {
    warning(
      'Root node_modules is neither a directory nor a symlink. Remove it and run `bun install`.',
    );
  } else if (repair.reason === 'lockfile-dirty') {
    warning(
      'Root node_modules is a symlink, but bun.lock has uncommitted changes so it was left alone ' +
        '— reinstalling could rewrite your lockfile edits. Commit or discard bun.lock, then run ' +
        '`bun install` at the repository root.',
    );
  }
} catch (cause) {
  const reason = cause instanceof Error ? cause.message : String(cause);
  warning(`Could not check the node_modules layout (${reason}); continuing`);
}

/**
 * Best-effort, non-blocking changeset hint: warn when this push touches
 * published-package source without adding a changeset, so a developer or
 * agent can add one before opening the PR instead of forgetting entirely.
 *
 * Nothing in CI actually enforces "a changeset exists" — `changeset-guard.yaml`
 * runs `check-changeset-prerelease-bumps.ts`, which only validates the BUMP
 * LEVEL of changesets that already exist (no disallowed `major` bumps
 * pre-1.0); it has no opinion on whether a changeset was added at all. This
 * hint is the only signal for a missing changeset anywhere in the pipeline,
 * so its wording must not claim CI will catch it. Any failure reading the
 * diff here (shallow clone, missing `origin/main`, no network) is swallowed
 * rather than escalated — this must never block or slow down the push.
 *
 * Diffs against the pushed ref's `localSha`, NOT `HEAD` — the checked-out
 * working-tree HEAD is not guaranteed to be the ref actually being pushed
 * (a push can name a different local ref, or push several refs at once).
 * A multi-ref push has no single unambiguous ref to hint about, so the hint
 * is skipped entirely rather than guessing.
 */
try {
  if (parsed.updates.length === 1) {
    const localSha = parsed.updates[0]?.localSha;
    const diff = localSha
      ? await $`git diff --name-only origin/main...${localSha}`.cwd(REPO_ROOT).nothrow().quiet()
      : undefined;
    if (diff !== undefined && diff.exitCode === 0) {
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
          'No changeset detected for published-package source changes. Nothing in CI checks that ' +
            'one exists (only that existing changesets use the right bump level) — add one now if this change needs a release note.',
        );
      }
    }
  }
} catch {
  // Best-effort only — this hint must never block or slow down the push.
}

success(
  'Pre-push checks passed (fast, non-blocking — PR CI + branch protection are the real gate)',
);
process.exit(0);
