import { describe, expect, it } from 'bun:test';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const libraryRoot = dirname(fileURLToPath(import.meta.url));
const applicationRoot = resolve(libraryRoot, '..');

function sourceFiles(directory: string): string[] {
	const collected: string[] = [];
	for (const entry of readdirSync(directory)) {
		if (entry === 'node_modules') continue;
		const path = join(directory, entry);
		if (statSync(path).isDirectory()) {
			collected.push(...sourceFiles(path));
			continue;
		}
		if (entry.endsWith('.ts') || entry.endsWith('.svelte')) collected.push(path);
	}
	return collected;
}

/** Repository-relative and separator-normalized, so assertions read the same on Windows. */
function relativeToApplication(path: string): string {
	return path.slice(applicationRoot.length + 1).replaceAll('\\', '/');
}

function read(relativePath: string): string {
	return readFileSync(resolve(applicationRoot, relativePath), 'utf8');
}

describe('the approval-signing toolbox is host-owned', () => {
	/**
	 * `approvalSecret` is a per-process `crypto.randomUUID()` minted where the
	 * toolbox is constructed. A second `createToolbox(...)` anywhere would hold
	 * a different secret, so an approval signed while streaming would fail
	 * verification on resume — and the failure would read as a rejected token,
	 * pointing at signing rather than at ownership.
	 */
	it('is the only toolbox any server endpoint constructs', () => {
		// The invariant is narrower than "constructed once in the repository",
		// and stating it that way was wrong: `chat-agent.test.ts` builds its own
		// for isolation, and the `/exercises/*` routes each build throwaway
		// local ones to demonstrate the run loop. None of those signs an
		// approval, and nobody resumes against them.
		//
		// What must never happen is a second instance on a REQUEST path, where
		// it would hold a different `approvalSecret` and reject a token signed
		// by the other one — surfacing as a rejected approval, which points at
		// signing rather than at ownership.
		// Matched on `+server.ts` rather than on a `routes/api/` prefix: that is
		// what makes a file a SvelteKit endpoint, and endpoints are not confined
		// to one directory. A `routes/webhook/+server.ts` that minted its own
		// toolbox would have slipped straight past a path-prefix check.
		const endpoints = sourceFiles(applicationRoot)
			.filter((path) => !/\.(test|e2e)\.ts$/.test(path))
			.filter((path) => /(^|\/)\+server\.ts$/.test(relativeToApplication(path)))
			.filter((path) => /\bcreateToolbox\s*\(/.test(readFileSync(path, 'utf8')))
			.map(relativeToApplication);
		expect(endpoints).toEqual([]);
	});

	it('is constructed in exactly one place outside routes and tests', () => {
		// The other half: the shared instance has one home. An `$lib` module
		// growing a second one would be invisible to the request-path check
		// above while still splitting the secret.
		const constructing = sourceFiles(applicationRoot)
			.filter((path) => !/\.(test|e2e)\.ts$/.test(path))
			.filter((path) => !relativeToApplication(path).startsWith('routes/'))
			.filter((path) => /\bcreateToolbox\s*\(/.test(readFileSync(path, 'utf8')))
			.map(relativeToApplication);
		expect(constructing).toEqual(['lib/toolbox.ts']);
	});

	it('is the instance both the streaming route and the resume route use', () => {
		for (const route of ['routes/api/chat/+server.ts', 'routes/api/chat/resume/+server.ts']) {
			const source = read(route);
			expect(source).toMatch(/import \{[^}]*\btoolbox\b[^}]*\} from '\$lib\/toolbox'/);
			expect(source).not.toMatch(/\bcreateToolbox\s*\(/);
		}
	});

	it('still documents the secret lifecycle where the secret is minted', () => {
		// An acceptance criterion CIN-437 inherited already satisfied. Kept as a
		// check that the documentation still matches the implementation rather
		// than as a unit of work.
		const source = read('lib/toolbox.ts');
		expect(source).toContain('approvalSecret: crypto.randomUUID()');
		expect(source).toMatch(/Stable for the process's lifetime only/);
	});
});
