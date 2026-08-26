import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// ROADMAP RE-2. `exportUnifiedDiff` is documented as producing a git patch, and
// this repo has already watched a diff-SHAPED string survive review: the
// front-matter corruption fixed in `@lostgradient/editor` emitted correct
// `---`/`+++` headers and a plausible `@@` line over content that existed in
// neither document. Structural assertions — "the header counts match the lines
// under it" — were what let it through, so the only assertion worth making
// about appliability is git's own.
//
// This module is deliberately NOT named `*.e2e.ts`: `playwright.config.ts`
// matches `**/*.e2e.{ts,js}`, and a helper picked up as a spec file would be a
// suite with no tests. It sits beside `hydration.ts` and `keyboard.ts` for the
// same reason — shared by two specs, owned by neither.
//
// Nothing here touches a browser. Playwright specs run in Node, so a spec can
// import `node:child_process` directly; this is the first place in the repo
// that does.

/**
 * The filename the patch's own headers dictate.
 *
 * `generateUnifiedDiff` defaults to `originalPath: 'a/document.md'` /
 * `currentPath: 'b/document.md'`, and `git apply` defaults to `-p1`, which
 * strips exactly one leading path component. So the file on disk has to be
 * `document.md` — a different name silently turns every apply into
 * "No such file or directory" rather than a diff failure, which is a much more
 * confusing way to fail.
 */
export const DIFF_FILENAME = 'document.md';

// Git reads three config layers, and two of them belong to whoever is running
// the suite. A global `core.autocrlf`, `apply.whitespace = fix`, a `core.hooksPath`
// pointing at a repo that is not this one, or commit signing would all change
// what `git apply` does here — turning a green run on one machine into a red one
// on another, for reasons having nothing to do with the component. Pointing both
// layers at /dev/null makes the temp repo answer only to the flags below.
const ISOLATED_GIT_ENV = {
	...process.env,
	GIT_CONFIG_GLOBAL: '/dev/null',
	GIT_CONFIG_SYSTEM: '/dev/null',
	GIT_CONFIG_NOSYSTEM: '1'
};

/**
 * Run one git command in `dir`, surfacing its stderr on failure.
 *
 * `execFileSync` throws an Error whose message is only `Command failed: git …`;
 * git's actual complaint (`corrupt patch at …:11`, `patch failed: document.md:1`)
 * lives on `error.stderr`, and that sentence is the entire diagnostic value of
 * this helper. Losing it would leave a failing appliability assertion saying
 * nothing about WHY the patch was rejected.
 *
 * A missing `git` binary lands here too, as `spawnSync git ENOENT`. That is
 * deliberately a thrown error rather than a skip: a silently-skipped appliability
 * check reads as coverage in the report and proves nothing.
 */
function git(dir: string, ...args: string[]): string {
	try {
		return execFileSync('git', ['-C', dir, ...args], {
			encoding: 'utf8',
			env: ISOLATED_GIT_ENV,
			// stderr piped rather than inherited, so git's own chatter stays out of
			// the Playwright reporter until something actually fails.
			stdio: ['ignore', 'pipe', 'pipe']
		});
	} catch (error) {
		const stderr = (error as { stderr?: string }).stderr ?? '';
		// `cause` keeps the original `execFileSync` error — exit status, signal,
		// the spawned argv — reachable, while the message carries the one line a
		// failing assertion needs to read.
		throw new Error(`git ${args.join(' ')} failed: ${stderr.trim() || String(error)}`, {
			cause: error
		});
	}
}

/**
 * Seed a throwaway git repo with `original`, apply `patch` to it, and return the
 * resulting file contents. Throws — with git's own stderr — if git will not take
 * the patch.
 *
 * Two things about the way this is written are load-bearing:
 *
 * **The seeded file is newline-terminated even when `original` is not.** Under
 * the default `normalizeInputs: true`, `splitIntoLines` forces
 * `hasTrailingNewline = true` on BOTH sides, so the patch never carries a
 * `\ No newline at end of file` marker. A file written to disk without a
 * trailing newline would therefore be rejected for a reason that has nothing to
 * do with the diff's correctness. The `+ '\n'` here is that adjustment, and the
 * caller should assert against `expected + '\n'` rather than wonder where the
 * byte came from.
 *
 * **It applies for real and returns the bytes, rather than stopping at
 * `--check`.** Measured while building this: `git apply` accepts a hunk header
 * whose START LINE is wrong (`@@ -4,6` against a hunk that begins at line 1) —
 * it searches for the context rather than trusting the number. So `--check`
 * alone cannot pin what a patch actually says; comparing the applied result to
 * the document the component claims to be holding can. `--check` still runs
 * first, because it is the assertion the ROADMAP criterion names and because it
 * fails before mutating anything.
 *
 * The patch is written VERBATIM — no trimming, no appended newline. Its trailing
 * newline is part of `generateUnifiedDiff`'s output contract
 * (`diffLines.join('\n') + '\n'`), and "fixing" it here would hide a regression
 * that dropped it.
 */
export function applyPatchInTempRepo(
	original: string,
	patch: string,
	filename: string = DIFF_FILENAME
): string {
	// `generateUnifiedDiff` returns '' — not a zero-hunk patch — when both sides
	// normalize to the same document, and `git apply` rejects empty input with
	// "No valid patches in input". Caught here so that case fails as the fixture
	// error it is, rather than as an inscrutable git message.
	if (patch === '') {
		throw new Error(
			'refusing to apply an empty patch: generateUnifiedDiff returns "" when the two ' +
				'documents normalize identically, and `git apply` rejects empty input. Assert the ' +
				'diff is non-empty before calling this.'
		);
	}

	const dir = mkdtempSync(join(tmpdir(), 'review-editor-diff-'));
	try {
		git(dir, 'init', '--quiet', '--initial-branch=main');
		git(dir, 'config', 'user.email', 'review-editor@example.invalid');
		git(dir, 'config', 'user.name', 'RE-2');

		writeFileSync(join(dir, filename), original.endsWith('\n') ? original : `${original}\n`);
		git(dir, 'add', filename);
		git(dir, 'commit', '--quiet', '-m', 'seed');

		const patchPath = join(dir, 'change.patch');
		writeFileSync(patchPath, patch);

		// `--index` checks the patch against the recorded blob as well as the
		// working tree, which is the state a consumer applying this patch to a
		// clean checkout would actually be in.
		git(dir, 'apply', '--check', '--index', '--verbose', patchPath);
		git(dir, 'apply', '--index', patchPath);

		return readFileSync(join(dir, filename), 'utf8');
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
}
