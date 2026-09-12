import { describe, expect, it } from 'bun:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * `test:unit` must name every unit test, or the test does not run in CI.
 *
 * The script enumerates its files explicitly rather than globbing. That is a
 * deliberate choice — it keeps the Playwright `*.e2e.ts` specs out of the Bun
 * runner — but it has a silent failure mode: a new `*.test.ts` runs locally
 * under a bare `bun test`, which globs, and never runs in CI, which does not.
 * The file passes in front of whoever wrote it and enforces nothing afterwards.
 *
 * That is not hypothetical. `operative-is-the-only-engine.test.ts` shipped that
 * way — written to enforce an architectural constraint, green locally, absent
 * from `test:unit`, and therefore inert on every pull request until review
 * caught it. The constraint it claimed to enforce was unguarded the whole time.
 *
 * So the list is checked against the filesystem rather than trusted.
 *
 * INVOKED INDEPENDENTLY, via its own `test:unit-inventory` script that
 * `validate` runs — not only through the `test:unit` list it audits. A guard
 * reachable only through the thing it checks is self-defeating: deleting its
 * entry from `test:unit` would silently disable the check that exists to
 * report exactly that deletion, while every other named test kept running and
 * the suite stayed green. It is still listed in `test:unit` as well, so a
 * plain `bun run test` covers it; the separate script is what makes the
 * invariant hold when someone edits that list.
 */

const LAB_ROOT = join(import.meta.dir, '..');

/**
 * Every filename a bare `bun test` discovers — which is the set that can pass
 * locally while being absent from CI, and therefore the set this guard has to
 * recognise.
 *
 * Verified empirically rather than assumed, twice. The runnable extensions are
 * `js`, `jsx`, `ts`, `tsx`, `mjs`, `cjs`, `mts`, `cts`, each with `.test.`,
 * `.spec.`, `_test.`, or `_spec.` — all confirmed collected by a bare
 * `bun test`.
 *
 * CASE-INSENSITIVE, because Bun is: it runs `Component.TEST.ts` and
 * `example.test.CTS`. On macOS, where the filesystem is case-insensitive by
 * default, a mixed-case marker is not even a deliberate act — and a
 * case-sensitive guard would have left such a test able to run locally and
 * never in CI, which is the whole failure this exists to prevent.
 *
 * Enumerated rather than written compactly, and that is the point of the second
 * check: `[cm]?[jt]sx?` also generates `.mtsx`, `.ctsx`, `.mjsx`, and `.cjsx`,
 * which Bun does NOT run. A file with one of those names would satisfy both
 * assertions below while Bun silently skipped it — an inert test that looks
 * registered, which is precisely the failure this guard exists to prevent, so
 * a too-WIDE pattern here is as bad as a too-narrow one.
 */
/**
 * Vendored code and VCS, excluded at ANY depth — a nested `node_modules` is
 * still vendored, and nobody writes the lab's tests inside one.
 */
const IGNORED_ANYWHERE = new Set(['node_modules', '.svelte-kit', '.git']);

/**
 * Build artifacts, excluded only at the LAB ROOT.
 *
 * Matching these by basename at every depth was too broad: `build`, `dist`, and
 * `coverage` are ordinary words, so a route or module directory named
 * `src/build/` would have been skipped and a test inside it would run under a
 * bare `bun test` while staying invisible to CI — recreating the exact gap this
 * guard exists to close, one directory deeper.
 */
const IGNORED_AT_ROOT = new Set(['build', 'dist', 'coverage', 'test-results', 'playwright-report']);

const UNIT_TEST_FILENAME = /(?:\.|_)(?:test|spec)\.(?:jsx?|tsx?|[cm][jt]s)$/i;

function unitTestFiles(directory: string): string[] {
	const found: string[] = [];
	for (const entry of readdirSync(directory)) {
		// Artifacts and vendored code only. Everything else is walked, so a new
		// directory is covered the day it appears rather than the day someone
		// remembers to add it here.
		if (IGNORED_ANYWHERE.has(entry)) continue;
		if (directory === LAB_ROOT && IGNORED_AT_ROOT.has(entry)) continue;
		const path = join(directory, entry);
		if (statSync(path).isDirectory()) {
			found.push(...unitTestFiles(path));
		} else if (UNIT_TEST_FILENAME.test(entry)) {
			// `.e2e.ts` specs belong to Playwright and do not match this
			// pattern, which is what keeps them out of the Bun runner's half.
			// Separator-normalized, matching `toolbox-ownership.test.ts`: the
			// `test:unit` list uses forward slashes, so a Windows walk would
			// otherwise produce backslashes and fail the comparison even when
			// the two sets agree.
			found.push(relative(LAB_ROOT, path).replaceAll('\\', '/'));
		}
	}
	return found;
}

describe('test:unit', () => {
	it('recognises every filename a bare `bun test` would discover', () => {
		// The pattern is the load-bearing part of this guard: anything it fails
		// to match is a test that runs locally and not in CI, silently.
		for (const extension of ['js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs', 'mts', 'cts']) {
			for (const separator of ['.test.', '.spec.', '_test.', '_spec.']) {
				expect(UNIT_TEST_FILENAME.test(`a${separator}${extension}`)).toBe(true);
			}
		}

		// And Playwright's specs stay out, which is why the list is explicit
		// rather than a glob in the first place.
		for (const name of ['a.e2e.ts', 'hydration.ts', 'notes.md']) {
			expect(UNIT_TEST_FILENAME.test(name)).toBe(false);
		}

		// Extensions Bun does NOT run must not match either. A file named this
		// way would satisfy both assertions in the test below while Bun skipped
		// it silently — registered, inert, and invisible.
		for (const name of ['a.test.mtsx', 'a.test.ctsx', 'a.test.mjsx', 'a.test.cjsx']) {
			expect(UNIT_TEST_FILENAME.test(name)).toBe(false);
		}

		// Case-insensitive, matching Bun — and matching a macOS filesystem,
		// where the distinction may not survive being written down at all.
		for (const name of ['a.TEST.ts', 'b.Spec.TS', 'c_Test.CTS']) {
			expect(UNIT_TEST_FILENAME.test(name)).toBe(true);
		}
	});

	it('names every unit test in the lab', () => {
		const manifest = JSON.parse(readFileSync(join(LAB_ROOT, 'package.json'), 'utf8')) as {
			scripts: Record<string, string>;
		};

		// `bun test ./a.test.ts ./b.test.ts …` — everything after the runner.
		const listed = new Set(
			manifest.scripts['test:unit']
				.split(/\s+/)
				.filter((token) => UNIT_TEST_FILENAME.test(token))
				.map((token) => token.replace(/^\.\//, ''))
		);

		// The WHOLE lab, not two hand-picked roots. Restricting the walk to
		// `src/` and `scripts/` left the same silent gap one directory over — a
		// `tests/` folder, or a test at the lab root, would run under a bare
		// `bun test` and never in CI. An allowlist of directories fails the same
		// way an allowlist of extensions does: quietly.
		const onDisk = unitTestFiles(LAB_ROOT);

		// Named both ways, because the two failures need different fixes.
		const unlisted = onDisk.filter((path) => !listed.has(path));
		const missing = [...listed].filter((path) => !onDisk.includes(path));

		// A test that exists but never runs — add it to `test:unit`.
		expect(unlisted).toEqual([]);

		// A test named but gone — a rename or deletion that left the script
		// pointing at nothing.
		//
		// THIS assertion is the only thing that catches it. Bun treats the
		// positional arguments as patterns and silently ignores ones that match
		// nothing: `bun test ./real.test.ts ./gone.test.ts` exits 0 with one
		// pass. So a stale entry does not fail the suite, it just quietly stops
		// running whatever used to be there — verified rather than assumed,
		// because an earlier version of this comment claimed the opposite.
		expect(missing).toEqual([]);
	});
});
