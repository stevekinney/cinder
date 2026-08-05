/**
 * Asserts `main`'s live branch protection matches the expectation checked in at
 * `.github/branch-protection.json`.
 *
 * Every other guard in this repository validates the source tree. This one
 * validates the repository *settings*, which no amount of workflow-YAML parsing
 * can reach — and which drifted from their own documentation twice on
 * 2026-08-05: `docs/validation-topology.md` claimed `strict: true` and named a
 * merge queue as the stale-base mitigation, while the live API returned
 * `strict: false` and merge queues are unavailable on user-owned repositories
 * at all (#1140).
 *
 * `strict` is the entry that matters. With no merge queue available, requiring
 * branches to be up to date is the only thing that forces a pull request to be
 * re-validated against current `main`. The bulk-drain protocol lifts it
 * deliberately and restores it by hand; the manual restore is the step that
 * already failed, so this runs daily to catch a lift that was never undone.
 *
 * Run with `bun run check:branch-protection`. Reads `GITHUB_TOKEN` (or
 * `GH_TOKEN`), falling back to `gh auth token` for local use. Exits non-zero
 * with a named diff on drift.
 */

import { join } from 'node:path';

import { readJsonFile } from './lib/read-json-file.ts';

const packageRoot = join(import.meta.dir, '..');
const workspaceRoot = join(packageRoot, '..', '..');

export const EXPECTATION_PATH = join(workspaceRoot, '.github', 'branch-protection.json');

/** The checked-in expectation. `$comment` carries the rationale and is ignored here. */
export type ProtectionExpectation = {
  branch: string;
  requiredStatusChecks: {
    strict: boolean;
    contexts: string[];
  };
};

/** The subset of GitHub's branch-protection response this guard reads. */
export type LiveProtection = {
  required_status_checks?: {
    strict?: boolean;
    checks?: Array<{ context: string }>;
  };
};

/**
 * Compare expectation against live protection, returning one human-readable
 * line per mismatch and an empty array when they agree.
 *
 * Pure and exported so the comparison is tested directly, rather than through a
 * network call that a test would have to mock into meaninglessness.
 */
export function protectionDrift(expected: ProtectionExpectation, live: LiveProtection): string[] {
  const drift: string[] = [];
  const liveChecks = live.required_status_checks;

  if (!liveChecks) {
    drift.push('required status checks are not configured at all on `main`');
    return drift;
  }

  if (liveChecks.strict !== expected.requiredStatusChecks.strict) {
    drift.push(
      `required_status_checks.strict is ${liveChecks.strict}, expected ` +
        `${expected.requiredStatusChecks.strict}. With no merge queue available on a ` +
        'user-owned repository, this is the only mechanism re-validating a pull request ' +
        'against current `main`. If a bulk drain lifted it, restore it when the drain ends.',
    );
  }

  const liveContexts = new Set((liveChecks.checks ?? []).map((check) => check.context));
  const expectedContexts = new Set(expected.requiredStatusChecks.contexts);

  const missing = [...expectedContexts].filter((context) => !liveContexts.has(context));
  const unexpected = [...liveContexts].filter((context) => !expectedContexts.has(context));

  for (const context of missing) {
    drift.push(`required status check "${context}" is expected but not enforced`);
  }

  for (const context of unexpected) {
    drift.push(
      `required status check "${context}" is enforced but not in the expectation — ` +
        'add it to .github/branch-protection.json if it is intentional',
    );
  }

  return drift;
}

/** Resolve a token from the environment, falling back to the `gh` CLI locally. */
async function resolveToken(): Promise<string> {
  const fromEnvironment = process.env['GITHUB_TOKEN'] ?? process.env['GH_TOKEN'];
  if (fromEnvironment) return fromEnvironment;

  const cli = Bun.spawn(['gh', 'auth', 'token'], { stdout: 'pipe', stderr: 'ignore' });
  const token = (await new Response(cli.stdout).text()).trim();
  await cli.exited;

  if (token) return token;

  throw new Error(
    'No GitHub token available. Set GITHUB_TOKEN, or run `gh auth login` for local use.',
  );
}

async function main(): Promise<void> {
  const expected = await readJsonFile<ProtectionExpectation>(EXPECTATION_PATH);
  const token = await resolveToken();

  const response = await fetch(
    `https://api.github.com/repos/stevekinney/cinder/branches/${expected.branch}/protection`,
    {
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${token}`,
        'x-github-api-version': '2022-11-28',
      },
    },
  );

  if (!response.ok) {
    // A 403 here is almost always a token scope problem, not real drift, and
    // reporting it as drift would send someone to change settings that are fine.
    throw new Error(
      `GitHub returned ${response.status} ${response.statusText} for ${expected.branch} ` +
        'branch protection. Reading protection needs admin rights — in Actions that is ' +
        '`permissions: administration: read`.',
    );
  }

  const drift = protectionDrift(expected, (await response.json()) as LiveProtection);

  if (drift.length === 0) {
    process.stdout.write(
      `check-branch-protection — OK (${expected.branch} matches .github/branch-protection.json).\n`,
    );
    return;
  }

  process.stderr.write(
    `check-branch-protection — ${drift.length} drift(s) between the live settings for ` +
      `\`${expected.branch}\` and .github/branch-protection.json:\n` +
      drift.map((entry) => `  - ${entry}\n`).join(''),
  );
  process.exit(1);
}

if (import.meta.main) {
  await main();
}
