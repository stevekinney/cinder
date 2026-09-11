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

/**
 * Every extension this lab can execute. Enumerated wide rather than narrow: an
 * allowlist that misses `.mjs` does not fail loudly, it silently stops
 * guarding — a maintenance script added as `scripts/debug-provider.mjs` would
 * import a provider SDK and pass.
 */
const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs', '.svelte'];

/**
 * NOTHING IS STRIPPED. The scan runs against raw source, deliberately.
 *
 * This function used to remove comments before matching, and that design lost
 * five rounds of review in a row: a string containing `/*`, a Svelte markup
 * comment, a regex literal whose character class contains `/*`. Each fix
 * admitted the next construct, because deciding what is a comment in
 * JavaScript means lexing JavaScript — strings, template literals with nested
 * expressions, regex literals versus division, JSX — and a half-lexer is a
 * source of FALSE NEGATIVES. A false negative here is silent: the guard says
 * clean while a provider import sits in the file.
 *
 * So the trade is inverted. Any import-shaped text naming a provider is
 * flagged, wherever it appears — including inside a comment. There is no
 * construct that can hide an import from this, because nothing is interpreted.
 *
 * The cost is real and bounded: you cannot write an example provider import in
 * a comment in this lab. That is a loud, immediate failure with an obvious fix
 * (describe the import instead of spelling it), and it is the reason the two
 * prose mentions in this lab describe the provider transport by role rather
 * than by package name — which they should do anyway, since the package is
 * Operative's choice and not ours.
 *
 * A guard protects against mistakes, not against an author deliberately hiding
 * an import; that is what review is for. What it must never do is report clean
 * when the import is there.
 */
function scannable(source: string): string {
	return source;
}

/**
 * Whitespace OR a comment, which is what JavaScript actually allows between
 * these tokens.
 *
 * `await import/* annotated *\/('openai')` is valid and executes — verified
 * under Bun — so a pattern that accepts only whitespace between `import` and
 * its parenthesis lets an annotated import through. Note this is the reverse of
 * the earlier findings: those were comments hiding an import from a stripper,
 * this is a comment sitting INSIDE the import syntax.
 *
 * A line comment ends at ANY JavaScript line terminator, not just `\n`:
 * carriage return, and the Unicode separators U+2028 and U+2029. Matching only
 * `\n` made `await import// c\r('openai')` — which executes, verified — run
 * off to end of file and swallow the specifier. That set is closed and finite,
 * which is why enumerating it here settles the case rather than inviting the
 * next variant.
 */
const GAP = String.raw`(?:\s|/\*[\s\S]*?\*/|//[^\n\r\u2028\u2029]*[\n\r\u2028\u2029])*`;

/** Matches a real module specifier — `import … from`, `import(…)`, `require(…)`. */
function importPattern(packageName: string): RegExp {
	const escaped = packageName.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
	return new RegExp(
		String.raw`(?:\bfrom${GAP}|\bimport${GAP}\(${GAP}|\brequire${GAP}\(${GAP}|\bimport${GAP})['"\`]${escaped}(?:/[^'"\`]*)?['"\`]`
	);
}

const LAB_ROOT = join(import.meta.dir, '..', '..');

/** Vendored code and VCS, excluded at any depth. */
const IGNORED_ANYWHERE = new Set(['node_modules', '.svelte-kit', '.git']);

/**
 * Build artifacts, excluded only at the LAB ROOT — `build`, `dist`, and
 * `coverage` are ordinary words, and a route directory named `src/build/` is
 * source that must still be scanned.
 */
const IGNORED_AT_ROOT = new Set(['build', 'dist', 'coverage', 'test-results', 'playwright-report']);

function sourceFiles(directory: string): string[] {
	const found: string[] = [];
	for (const entry of readdirSync(directory)) {
		if (IGNORED_ANYWHERE.has(entry)) continue;
		if (directory === LAB_ROOT && IGNORED_AT_ROOT.has(entry)) continue;
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
	it('no file in the lab imports a provider SDK directly', () => {
		// The WHOLE lab, not two hand-picked roots. Executable code outside
		// `src/` and `scripts/` — a helper under `tests/`, or a file at the lab
		// root — was never visited, so it could import a provider and pass. The
		// inventory guard had the identical hole and was fixed the same way; I
		// did not carry the fix across at the time.
		const patterns = PROVIDER_PACKAGES.map(importPattern);

		const offenders = sourceFiles(LAB_ROOT)
			// THIS file is excluded, and it is the only exclusion. The file
			// defining the rule necessarily contains examples of breaking it —
			// the assertions below are literally import statements as strings —
			// so scanning itself would make the guard permanently red. Named by
			// exact path rather than by a pattern, so the exclusion cannot widen
			// to cover a real offender that happens to sit nearby.
			// Separator-normalized on both sides before comparing: a raw string
			// comparison can differ by `\` versus `/` on Windows, which would
			// make this file fail to exclude itself and go permanently red.
			.filter((path) => path.replaceAll('\\', '/') !== import.meta.path.replaceAll('\\', '/'))
			.filter((path) => {
				const code = scannable(readFileSync(path, 'utf8'));
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

	it('matches every import form', () => {
		const anthropic = importPattern('@anthropic-ai/sdk');

		expect(anthropic.test(`import Anthropic from '@anthropic-ai/sdk';`)).toBe(true);
		expect(anthropic.test(`import type { ContentBlock } from '@anthropic-ai/sdk';`)).toBe(true);
		expect(anthropic.test(`const sdk = await import('@anthropic-ai/sdk');`)).toBe(true);
		expect(anthropic.test(`require('@anthropic-ai/sdk/resources')`)).toBe(true);
		expect(anthropic.test(`import '@anthropic-ai/sdk';`)).toBe(true);

		// A bare mention is still not an import — the pattern needs `from`,
		// `import(`, `require(`, or `import` before the specifier, so prose that
		// merely names a package is unaffected.
		expect(anthropic.test(`// the transport retries a 429 on its own`)).toBe(false);
		expect(anthropic.test(`const note = 'we use @anthropic-ai/sdk indirectly';`)).toBe(false);
	});

	it('cannot be hidden behind any construct, because nothing is interpreted', () => {
		// Each of these defeated a previous version of this guard by making the
		// stripper treat the real import as part of a comment. Against raw
		// source they all still match, and no future construct can change that.
		const cases = [
			`const marker = '/*'; import OpenAI from 'openai'; const close = '*/';`,
			`const punctuation = /[/*]/; import OpenAI from 'openai';`,
			`<!-- --> import OpenAI from 'openai';`,
			`/* a real comment */ import OpenAI from 'openai';`
		];

		for (const offender of cases) {
			expect(importPattern('openai').test(offender)).toBe(true);
		}
	});

	it('matches an import annotated with comments between its tokens', () => {
		// JavaScript allows comments wherever whitespace is allowed, and these
		// all execute. A pattern accepting only whitespace between the tokens
		// lets every one of them through.
		const annotated = [
			`await import/* c */('openai')`,
			`import /* c */ OpenAI /* c */ from /* c */ 'openai';`,
			`require/* c */(/* c */'openai')`,
			`import// trailing\n'openai';`
		];

		for (const offender of annotated) {
			expect(importPattern('openai').test(offender)).toBe(true);
		}

		// Every line terminator, not just `\n` — all of these execute.
		for (const terminator of ['\n', '\r', '\u2028', '\u2029']) {
			expect(importPattern('openai').test(`await import//c${terminator}('openai')`)).toBe(true);
		}
	});

	it('matches the other providers too, not just Anthropic', () => {
		expect(importPattern('openai').test(`import OpenAI from 'openai';`)).toBe(true);
		expect(
			importPattern('@google/genai').test(`import { GoogleGenAI } from '@google/genai';`)
		).toBe(true);
	});
});
