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
 * `GH_TOKEN`) — falling back to `gh auth token` for local use — since reading
 * branch protection needs Administration: Read, which is not a grantable
 * GitHub Actions `permissions` scope; `main-red-watch.yaml` supplies a
 * `REPO_ADMIN_TOKEN` secret for that reason. Exits `EXIT_OK` (0) when live
 * settings match, `EXIT_DRIFT` (1) with a named diff when they don't, and
 * `EXIT_SETUP_FAILURE` (2) when the check itself couldn't run (a missing or
 * under-scoped token, a network or API failure) — a setup failure is not
 * evidence `main`'s protection changed, and the workflow that reads this exit
 * code does not report it as drift.
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
    /**
     * Legacy shape. GitHub's branch-protection API can report required status
     * checks as this flat list of context names instead of, or alongside,
     * `checks` — repositories configured before `checks` existed (or through
     * certain API/UI paths) still report through `contexts`.
     */
    contexts?: string[];
  };
};

/**
 * Exit codes this script produces. `main-red-watch.yaml` reads the numeric
 * value — not just success/failure — to route `EXIT_DRIFT` to the
 * branch-protection-drift issue and `EXIT_SETUP_FAILURE` to a failed-run
 * annotation instead. A setup problem (missing token scope, a non-2xx that
 * isn't "protection absent") is not evidence that `main`'s protection
 * actually changed, and must not file an incident claiming it did.
 */
export const EXIT_OK = 0;
export const EXIT_DRIFT = 1;
export const EXIT_SETUP_FAILURE = 2;

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

  // GitHub reports required checks through `checks` ([{context}]), the legacy
  // flat `contexts` (string[]), or both at once — union them so a repository
  // configured through either shape compares correctly instead of reading as
  // if nothing were enforced.
  const liveContexts = new Set([
    ...(liveChecks.checks ?? []).map((check) => check.context),
    ...(liveChecks.contexts ?? []),
  ]);
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

function isMessageBody(value: unknown): value is { message: string } {
  if (typeof value !== 'object' || value === null) return false;
  if (!('message' in value)) return false;

  return typeof (value as Record<string, unknown>)['message'] === 'string';
}

/**
 * Classify a branch-protection API response before deciding whether to treat
 * it as drift or a setup problem.
 *
 * GitHub returns 404 for two different situations on this endpoint: branch
 * protection genuinely disabled (body `message: "Branch not protected"`) and
 * a token without Administration: Read access, which this endpoint can report
 * as though the resource does not exist at all rather than as 403 — the same
 * evasive 404 an unprivileged token gets from any resource it can't see. Only
 * the first is real drift, and the largest possible kind: no protection at
 * all. Trusting a bare 404 status without checking the message would let an
 * under-scoped token (exactly the state before `REPO_ADMIN_TOKEN` is
 * provisioned) file "protection is off" against a `main` that is actually
 * fully configured, every day, until someone "fixes" working settings.
 */
export function classifyProtectionResponse(
  status: number,
  body: unknown,
): 'ok' | 'protection-absent' | 'setup-failure' {
  if (status >= 200 && status < 300) return 'ok';

  const message = isMessageBody(body) ? body.message : undefined;
  if (status === 404 && message === 'Branch not protected') return 'protection-absent';

  return 'setup-failure';
}

/**
 * Build the message for a response `classifyProtectionResponse` called a
 * setup failure. 403 and 404 both surface the same underlying problem on this
 * endpoint — the token lacks Administration: Read — and GitHub is
 * inconsistent about which of the two it returns for that case, so both point
 * at the same fix.
 */
function buildSetupFailureMessage(response: Response, branch: string): string {
  if (response.status === 403 || response.status === 404) {
    return (
      `check-branch-protection — setup failure: GitHub returned ${response.status} reading ` +
      `branch protection for \`${branch}\`.\n` +
      'Reading branch protection needs Administration: Read access, which GITHUB_TOKEN cannot ' +
      'be granted (it is not a valid workflow `permissions` scope). Create a fine-grained ' +
      'personal access token with Administration: Read access on this repository, then save ' +
      'it as the REPO_ADMIN_TOKEN repository secret.\n'
    );
  }

  return (
    `check-branch-protection — setup failure: GitHub returned ${response.status} ` +
    `${response.statusText} for ${branch} branch protection.\n`
  );
}

/** Resolve a token from the environment, falling back to the `gh` CLI locally. */
async function resolveToken(): Promise<string> {
  const fromEnvironment = process.env['GITHUB_TOKEN'] ?? process.env['GH_TOKEN'];
  if (fromEnvironment) return fromEnvironment;

  const cli = Bun.spawn(['gh', 'auth', 'token'], { stdout: 'pipe', stderr: 'ignore' });
  const rawToken = await new Response(cli.stdout).text();
  const token = rawToken.trim();
  await cli.exited;

  if (token) return token;

  throw new Error(
    'No GitHub token available. Set GITHUB_TOKEN, or run `gh auth login` for local use.',
  );
}

function asLiveProtection(payload: unknown): LiveProtection {
  if (typeof payload !== 'object' || payload === null) {
    throw new Error('GitHub branch-protection response was not an object.');
  }

  return payload as LiveProtection;
}

/** Report drift (or its absence) and exit with the matching code. */
function reportAndExit(expected: ProtectionExpectation, drift: string[]): never {
  if (drift.length === 0) {
    process.stdout.write(
      `check-branch-protection — OK (${expected.branch} matches .github/branch-protection.json).\n`,
    );
    process.exit(EXIT_OK);
  }

  process.stderr.write(
    `check-branch-protection — ${drift.length} drift(s) between the live settings for ` +
      `\`${expected.branch}\` and .github/branch-protection.json:\n` +
      drift.map((entry) => `  - ${entry}\n`).join(''),
  );
  process.exit(EXIT_DRIFT);
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

  const body: unknown = await response.json();
  const classification = classifyProtectionResponse(response.status, body);

  if (classification === 'protection-absent') {
    // The largest possible drift: `main` has no branch protection at all, not
    // just one missing setting within it — distinct wording from
    // `protectionDrift`'s "required status checks aren't configured", which
    // describes a protected branch missing one setting.
    reportAndExit(expected, ['branch protection is not enabled on `main` at all']);
  }

  if (classification === 'setup-failure') {
    process.stderr.write(buildSetupFailureMessage(response, expected.branch));
    process.exit(EXIT_SETUP_FAILURE);
  }

  reportAndExit(expected, protectionDrift(expected, asLiveProtection(body)));
}

if (import.meta.main) {
  try {
    await main();
  } catch (error) {
    // Anything that reaches here — a missing token, a malformed expectation
    // file, a network failure, an unparseable payload — is a setup problem,
    // not evidence that main's protection changed. Route it to the same exit
    // code as the explicit setup-failure paths above so the workflow never
    // mistakes it for drift.
    process.stderr.write(
      `check-branch-protection — setup failure: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exit(EXIT_SETUP_FAILURE);
  }
}
