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

function unitTestFiles(directory: string): string[] {
	const found: string[] = [];
	for (const entry of readdirSync(directory)) {
		if (entry === 'node_modules' || entry === '.svelte-kit') continue;
		const path = join(directory, entry);
		if (statSync(path).isDirectory()) {
			found.push(...unitTestFiles(path));
		} else if (entry.endsWith('.test.ts')) {
			// `.e2e.ts` specs belong to Playwright and are excluded by this
			// suffix already; `.test.ts` is the Bun runner's half.
			found.push(relative(LAB_ROOT, path));
		}
	}
	return found;
}

describe('test:unit', () => {
	it('names every *.test.ts under src/ and scripts/', () => {
		const manifest = JSON.parse(readFileSync(join(LAB_ROOT, 'package.json'), 'utf8')) as {
			scripts: Record<string, string>;
		};

		// `bun test ./a.test.ts ./b.test.ts …` — everything after the runner.
		const listed = new Set(
			manifest.scripts['test:unit']
				.split(/\s+/)
				.filter((token) => token.endsWith('.test.ts'))
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
