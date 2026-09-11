import { describe, expect, it } from 'bun:test';
import { readdir } from 'node:fs/promises';
import { dirname, join, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Every relative import in `scripts/` resolves to a file that exists.
 *
 * This guards a gap rather than a preference. `scripts/` is OUTSIDE the
 * project's `tsconfig` include — SvelteKit's generated config covers `src`,
 * `test`, and `tests`, and nothing else — so `bun run check` never looks at
 * these files. Combined with `test:live-operative` being deliberately excluded
 * from CI (it costs real money and needs a live credential), a script here can
 * import a module that no longer exists and every gate in the repository stays
 * green.
 *
 * That is not hypothetical: moving `chat-agent.ts` from
 * `src/routes/api/chat/` to `src/lib/` left `test-live-operative.ts` importing
 * the old path, and the break was found by a reviewer rather than by any
 * check. Module resolution is the part of that failure a cheap test can pin,
 * and it is the part that actually broke.
 *
 * Resolution only — these modules are never IMPORTED here. A script's body
 * runs on import, and `test-live-operative.ts` sets a non-zero `exitCode` when
 * it finds no API key, which would fail this suite for the wrong reason.
 */
const SCRIPTS_DIRECTORY = dirname(fileURLToPath(import.meta.url));

/** Every `from` and `import()` specifier that starts with a dot. */
const RELATIVE_IMPORT = /(?:from|import)\s*\(?\s*['"](\.[^'"]*)['"]/g;

/**
 * Comments are stripped before matching, and the reason is that this file
 * caught ITSELF on the first run: a docblock quoting the two import forms it
 * looks for reads, to the scanner, exactly like two unresolvable imports.
 */
const COMMENTS = /\/\*[\s\S]*?\*\/|(^|[^:])\/\/[^\n]*/g;

const withoutComments = (source: string): string =>
	source.replace(COMMENTS, (match, prefix: string | undefined) => prefix ?? '');

/**
 * The extensions a specifier may be rewritten to. `.ts` sources may import
 * each other as `.ts` (the project sets `rewriteRelativeImportExtensions`) or
 * extensionless, and either has to land on a real file.
 */
const CANDIDATE_SUFFIXES = ['', '.ts', '.js', '/index.ts', '/index.js'];

async function scriptFiles(): Promise<string[]> {
	const entries = await readdir(SCRIPTS_DIRECTORY, { withFileTypes: true });
	return entries
		.filter((entry) => entry.isFile() && entry.name.endsWith('.ts'))
		.map((entry) => entry.name)
		.sort();
}

describe('scripts/ imports', () => {
	it('has scripts to check', async () => {
		// Without this the suite passes vacuously if the folder is ever moved:
		// zero files means zero assertions means green.
		expect((await scriptFiles()).length).toBeGreaterThan(0);
	});

	it('resolves every relative import to a file that exists', async () => {
		const unresolved: string[] = [];

		for (const name of await scriptFiles()) {
			const path = join(SCRIPTS_DIRECTORY, name);
			const source = withoutComments(await Bun.file(path).text());

			for (const match of source.matchAll(RELATIVE_IMPORT)) {
				const specifier = match[1];
				const base = resolvePath(SCRIPTS_DIRECTORY, specifier);
				const found = await Promise.all(
					CANDIDATE_SUFFIXES.map((suffix) => Bun.file(`${base}${suffix}`).exists())
				);
				if (!found.some(Boolean)) unresolved.push(`${name} → ${specifier}`);
			}
		}

		expect(unresolved).toEqual([]);
	});
});
