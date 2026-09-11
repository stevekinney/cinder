import { describe, expect, it } from 'bun:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Operative is the only engine, enforced rather than documented.
 *
 * The lab DOES declare `@anthropic-ai/sdk` in its manifest, and that is
 * correct: Operative declares the SDK as an OPTIONAL PEER because it supports
 * several providers and expects the consumer to install whichever one it uses.
 * The manifest entry is the lab provisioning Operative, not the lab using the
 * raw SDK — removing it breaks the app at runtime, because Operative reaches
 * the SDK through a dynamic `import()` that fires on the first provider call.
 *
 * The line that matters is therefore not "is the package present" but "does
 * our code import it". Everything the lab writes goes through Operative;
 * nothing reaches past it to the provider SDK directly.
 *
 * Static, and deliberately so. A runtime test cannot see an import that is
 * never executed on the path it exercises, and the removal that motivated this
 * guard was invisible to `bun why`, `grep` in CI, `check:upstream`, `lint`,
 * `check`, and `build` alike — every one of them passed while the app was
 * broken.
 */

const FORBIDDEN = '@anthropic-ai/sdk';

/** Matches a real module specifier — `import … from`, `import(…)`, `require(…)`. */
const IMPORT_PATTERN = new RegExp(
	String.raw`(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*)['"\`]${FORBIDDEN}(?:/[^'"\`]*)?['"\`]`
);

/** A bare side-effect import, which the pattern above does not cover. */
const SIDE_EFFECT_PATTERN = new RegExp(
	String.raw`\bimport\s*['"\`]${FORBIDDEN}(?:/[^'"\`]*)?['"\`]`
);

const SOURCE_EXTENSIONS = ['.ts', '.svelte', '.js'];

function sourceFiles(directory: string): string[] {
	const found: string[] = [];
	for (const entry of readdirSync(directory)) {
		if (entry === 'node_modules' || entry === '.svelte-kit') continue;
		const path = join(directory, entry);
		if (statSync(path).isDirectory()) {
			found.push(...sourceFiles(path));
		} else if (SOURCE_EXTENSIONS.some((extension) => entry.endsWith(extension))) {
			found.push(path);
		}
	}
	return found;
}

describe('Operative is the only engine', () => {
	it('no file under src/ or scripts/ imports the provider SDK directly', () => {
		const roots = [join(import.meta.dir, '..'), join(import.meta.dir, '..', '..', 'scripts')];

		const offenders = roots
			.flatMap((root) => sourceFiles(root))
			.filter((path) => {
				const contents = readFileSync(path, 'utf8');
				return IMPORT_PATTERN.test(contents) || SIDE_EFFECT_PATTERN.test(contents);
			});

		// Named, not counted. A bare count tells whoever hits this that
		// something is wrong without telling them where.
		expect(offenders).toEqual([]);
	});

	it('matches an import but not a mention in prose', () => {
		// The guard has to distinguish the two, because comments describing the
		// provider transport are legitimate and were the reason an earlier
		// grep-based version of this check reported hits it should not have.
		expect(IMPORT_PATTERN.test(`import Anthropic from '${FORBIDDEN}';`)).toBe(true);
		expect(IMPORT_PATTERN.test(`import type { ContentBlock } from '${FORBIDDEN}';`)).toBe(true);
		expect(IMPORT_PATTERN.test(`const sdk = await import('${FORBIDDEN}');`)).toBe(true);
		expect(IMPORT_PATTERN.test(`require('${FORBIDDEN}/resources')`)).toBe(true);
		expect(SIDE_EFFECT_PATTERN.test(`import '${FORBIDDEN}';`)).toBe(true);

		expect(IMPORT_PATTERN.test(`// ${FORBIDDEN} retries a 429 on its own`)).toBe(false);
		expect(SIDE_EFFECT_PATTERN.test(`// see ${FORBIDDEN} for the retry policy`)).toBe(false);
	});
});
