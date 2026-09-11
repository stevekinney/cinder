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
 */

const LAB_ROOT = join(import.meta.dir, '..');

/**
 * Every filename a bare `bun test` discovers — which is the set that can pass
 * locally while being absent from CI, and therefore the set this guard has to
 * recognise.
 *
 * Verified empirically rather than assumed: nine forms were created in a
 * scratch directory and `bun test` collected all nine —
 * `.test.ts`, `.test.js`, `.test.tsx`, `.test.mts`, `.test.mjs`, `.test.cjs`,
 * `.spec.ts`, `_test.ts`, `_spec.ts`. Matching only `.test.ts` left every
 * other form able to reproduce exactly the failure this guard exists to
 * prevent.
 */
const UNIT_TEST_FILENAME = /(?:\.|_)(?:test|spec)\.(?:[cm]?[jt]sx?)$/;

function unitTestFiles(directory: string): string[] {
	const found: string[] = [];
	for (const entry of readdirSync(directory)) {
		if (entry === 'node_modules' || entry === '.svelte-kit') continue;
		const path = join(directory, entry);
		if (statSync(path).isDirectory()) {
			found.push(...unitTestFiles(path));
		} else if (UNIT_TEST_FILENAME.test(entry)) {
			// `.e2e.ts` specs belong to Playwright and do not match this
			// pattern, which is what keeps them out of the Bun runner's half.
			found.push(relative(LAB_ROOT, path));
		}
	}
	return found;
}

describe('test:unit', () => {
	it('recognises every filename a bare `bun test` would discover', () => {
		// The pattern is the load-bearing part of this guard: anything it fails
		// to match is a test that runs locally and not in CI, silently.
		for (const name of [
			'a.test.ts',
			'b.test.js',
			'c.test.tsx',
			'd.spec.ts',
			'e_test.ts',
			'f_spec.ts',
			'g.test.mts',
			'h.test.cjs',
			'i.test.mjs'
		]) {
			expect(UNIT_TEST_FILENAME.test(name)).toBe(true);
		}

		// And Playwright's specs stay out, which is why the list is explicit
		// rather than a glob in the first place.
		for (const name of ['a.e2e.ts', 'hydration.ts', 'notes.md']) {
			expect(UNIT_TEST_FILENAME.test(name)).toBe(false);
		}
	});

	it('names every unit test under src/ and scripts/', () => {
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

		const onDisk = [
			...unitTestFiles(join(LAB_ROOT, 'src')),
			...unitTestFiles(join(LAB_ROOT, 'scripts'))
		];

		// Named both ways, because the two failures need different fixes.
		const unlisted = onDisk.filter((path) => !listed.has(path));
		const missing = [...listed].filter((path) => !onDisk.includes(path));

		// A test that exists but never runs — add it to `test:unit`.
		expect(unlisted).toEqual([]);

		// A test named but gone — a rename or deletion that left the script
		// pointing at nothing, which Bun reports as a non-zero exit rather
		// than as a helpful message.
		expect(missing).toEqual([]);
	});
});
