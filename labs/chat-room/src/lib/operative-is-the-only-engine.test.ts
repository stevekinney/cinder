import { describe, expect, it } from 'bun:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Operative is the only engine, enforced rather than documented.
 *
 * The lab DOES declare `@anthropic-ai/sdk` in its manifest, and that is
 * correct: Operative declares each provider SDK as an OPTIONAL PEER because it
 * supports several providers and expects the consumer to install whichever one
 * it uses. The manifest entry is the lab provisioning Operative, not the lab
 * using the raw SDK — removing it breaks the app at runtime, because Operative
 * reaches the SDK through a dynamic `import()` that fires on the first
 * provider call.
 *
 * The line that matters is therefore not "is the package present" but "does
 * our code import it". Everything the lab writes goes through Operative;
 * nothing reaches past it to a provider SDK directly.
 *
 * Static, and deliberately so. A runtime test cannot see an import that is
 * never executed on the path it exercises, and the removal that motivated this
 * guard was invisible to `bun why`, `grep` in CI, `check:upstream`, `lint`,
 * `check`, and `build` alike — every one of them passed while the app was
 * broken.
 *
 * REGISTERED IN `test:unit`. That script enumerates its files explicitly, so a
 * test not named there never runs in CI even though a local `bun test` picks
 * it up — which is how the first version of this guard shipped inert, passing
 * locally and enforcing nothing.
 */

/** Read from Operative's own manifest, so the list cannot quietly go stale. */
const operativeManifest = JSON.parse(
	readFileSync(
		join(
			import.meta.dir,
			'..',
			'..',
			'..',
			'..',
			'node_modules',
			'@lostgradient',
			'operative',
			'package.json'
		),
		'utf8'
	)
) as { peerDependenciesMeta?: Record<string, { optional?: boolean }> };

/**
 * Every provider SDK Operative can drive. Importing any of them directly is
 * the thing this guard exists to prevent — reaching `openai` past Operative
 * bypasses it exactly as reaching for Anthropic would.
 */
const PROVIDER_PACKAGES = ['@anthropic-ai/sdk', '@google/genai', 'openai'] as const;

/**
 * Optional peers that are NOT providers, listed so the cross-check below can
 * tell "we decided this one is not a provider" from "nobody has looked at this
 * one yet".
 */
const NON_PROVIDER_OPTIONAL_PEERS = ['@opentelemetry/api', 'zod'] as const;

const SOURCE_EXTENSIONS = ['.ts', '.svelte', '.js'];

/**
 * Comments removed before matching, so an import written INSIDE a comment —
 * `// never import Anthropic from '@anthropic-ai/sdk'` — is not reported as an
 * offender. String literals are deliberately left in place: the module
 * specifier of a real import is itself a string, so stripping strings would
 * blind the guard to the thing it is looking for.
 *
 * The residue is honest rather than hidden: a string literal whose CONTENTS
 * happen to contain exact import syntax would still be flagged. That is the
 * safe direction to err — a false positive fails loudly on the next run and
 * takes a minute to inspect, while a false negative is silent and is the whole
 * failure mode this guard exists to close.
 */
function withoutComments(source: string): string {
	return (
		source
			.replace(/\/\*[\s\S]*?\*\//g, ' ')
			// `[^:]` so a `https://` URL is not mistaken for a line comment.
			.replace(/(^|[^:])\/\/[^\n]*/g, '$1')
	);
}

/** Matches a real module specifier — `import … from`, `import(…)`, `require(…)`. */
function importPattern(packageName: string): RegExp {
	const escaped = packageName.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
	return new RegExp(
		String.raw`(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|\bimport\s*)['"\`]${escaped}(?:/[^'"\`]*)?['"\`]`
	);
}

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
	it('no file under src/ or scripts/ imports a provider SDK directly', () => {
		const roots = [join(import.meta.dir, '..'), join(import.meta.dir, '..', '..', 'scripts')];
		const patterns = PROVIDER_PACKAGES.map(importPattern);

		const offenders = roots
			.flatMap((root) => sourceFiles(root))
			// THIS file is excluded, and it is the only exclusion. The file
			// defining the rule necessarily contains examples of breaking it —
			// the assertions below are literally import statements as strings —
			// so scanning itself would make the guard permanently red. Named by
			// exact path rather than by a pattern, so the exclusion cannot widen
			// to cover a real offender that happens to sit nearby.
			.filter((path) => path !== import.meta.path)
			.filter((path) => {
				const code = withoutComments(readFileSync(path, 'utf8'));
				return patterns.some((pattern) => pattern.test(code));
			});

		// Named, not counted. A bare count tells whoever hits this that
		// something is wrong without telling them where.
		expect(offenders).toEqual([]);
	});

	it('covers every provider Operative declares, so the list cannot go stale', () => {
		// Without this, Operative gaining a fourth provider would silently
		// leave a hole: `import X from 'the-new-one'` would bypass Operative
		// and pass the guard above, which is precisely the shape of the bug
		// this whole file is about.
		const meta = operativeManifest.peerDependenciesMeta ?? {};
		const optionalPeers = Object.keys(meta).filter((name) => meta[name]?.optional === true);

		const unaccounted = optionalPeers.filter(
			(name) =>
				!(PROVIDER_PACKAGES as readonly string[]).includes(name) &&
				!(NON_PROVIDER_OPTIONAL_PEERS as readonly string[]).includes(name)
		);

		// If this fails, Operative has an optional peer nobody has classified.
		// Decide whether it is a provider and add it to the right list.
		expect(unaccounted).toEqual([]);

		// And the providers we claim to cover are really still peers of
		// Operative, so a renamed or dropped one is caught rather than
		// silently guarding nothing.
		for (const provider of PROVIDER_PACKAGES) {
			expect(optionalPeers).toContain(provider);
		}
	});

	it('matches an import but not a mention in prose or a commented-out import', () => {
		const anthropic = importPattern('@anthropic-ai/sdk');

		expect(anthropic.test(withoutComments(`import Anthropic from '@anthropic-ai/sdk';`))).toBe(
			true
		);
		expect(
			anthropic.test(withoutComments(`import type { ContentBlock } from '@anthropic-ai/sdk';`))
		).toBe(true);
		expect(anthropic.test(withoutComments(`const sdk = await import('@anthropic-ai/sdk');`))).toBe(
			true
		);
		expect(anthropic.test(withoutComments(`require('@anthropic-ai/sdk/resources')`))).toBe(true);
		expect(anthropic.test(withoutComments(`import '@anthropic-ai/sdk';`))).toBe(true);

		// A plain mention, and — the case the first version of this guard got
		// wrong — a commented-out import, which is prose however much it looks
		// like code.
		expect(anthropic.test(withoutComments(`// @anthropic-ai/sdk retries a 429 on its own`))).toBe(
			false
		);
		expect(
			anthropic.test(withoutComments(`// Never import Anthropic from '@anthropic-ai/sdk'`))
		).toBe(false);
		expect(
			anthropic.test(withoutComments(`/* import Anthropic from '@anthropic-ai/sdk'; */`))
		).toBe(false);

		// A URL is not a line comment.
		expect(withoutComments(`const u = 'https://example.com/x';`)).toContain('https://example.com');
	});

	it('matches the other providers too, not just Anthropic', () => {
		expect(importPattern('openai').test(`import OpenAI from 'openai';`)).toBe(true);
		expect(
			importPattern('@google/genai').test(`import { GoogleGenAI } from '@google/genai';`)
		).toBe(true);
	});
});
