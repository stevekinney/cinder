#!/usr/bin/env bun
/**
 * Finds `upstream:` markers next to workarounds in tracked and untracked,
 * non-ignored source files. GitHub references use `owner/repo#number`; Linear
 * references use an issue key such as `CIN-311`. A closed tracking issue means
 * its workaround is a candidate for removal.
 */
import { $ } from 'bun';

const MARKER_PATTERN = /upstream:\s*(?:([\w.-]+\/[\w.-]+)#(\d+)|([A-Z][A-Z0-9]*-\d+))/;
const LINEAR_CLOSED_STATE_TYPES = new Set(['completed', 'canceled']);

type GithubReference = {
	file: string;
	issue: number;
	line: number;
	repo: string;
	type: 'github';
};

type LinearReference = {
	file: string;
	key: string;
	line: number;
	type: 'linear';
};

export type Reference = GithubReference | LinearReference;

type Issue = { state: string; title: string; url: string };
type IssueLookup = (reference: Reference) => Promise<Issue>;
export type CheckResult = { issue: Issue; key: string; references: Reference[] };

function referenceKey(reference: Reference): string {
	return reference.type === 'github' ? `${reference.repo}#${reference.issue}` : reference.key;
}

/** Parse the `git grep -n` output into GitHub and Linear workaround references. */
export function parseReferences(grepOutput: string): Reference[] {
	const references: Reference[] = [];
	for (const line of grepOutput.split('\n')) {
		if (!line) continue;
		const [file, lineNumber, ...rest] = line.split(':');
		const match = rest.join(':').match(MARKER_PATTERN);
		if (!match) continue;

		if (match[3]) {
			references.push({ file, key: match[3], line: Number(lineNumber), type: 'linear' });
		} else {
			references.push({
				file,
				issue: Number(match[2]),
				line: Number(lineNumber),
				repo: match[1],
				type: 'github'
			});
		}
	}
	return references;
}

/** Groups duplicate markers so every tracked issue is queried once. */
export function groupReferences(references: Reference[]): Map<string, Reference[]> {
	const byIssue = new Map<string, Reference[]>();
	for (const reference of references) {
		const key = referenceKey(reference);
		byIssue.set(key, [...(byIssue.get(key) ?? []), reference]);
	}
	return byIssue;
}

export function isClosedState(state: string): boolean {
	return state === 'CLOSED' || LINEAR_CLOSED_STATE_TYPES.has(state.toLowerCase());
}

/** Looks up a GitHub issue with the existing authenticated `gh` path. */
async function lookupGithubIssue(reference: GithubReference): Promise<Issue> {
	const result =
		await $`gh issue view ${reference.issue} --repo ${reference.repo} --json state,title,url`
			.nothrow()
			.quiet();
	if (result.exitCode !== 0) {
		throw new Error(result.stderr.toString().trim() || 'gh error');
	}

	return JSON.parse(result.stdout.toString()) as Issue;
}

/** Looks up a Linear issue through its authenticated GraphQL API. */
export async function lookupLinearIssue(
	reference: LinearReference,
	request: typeof fetch = fetch,
	apiKey = process.env.LINEAR_API_KEY
): Promise<Issue> {
	if (!apiKey) {
		throw new Error('LINEAR_API_KEY is required to check Linear upstream markers');
	}

	const response = await request('https://api.linear.app/graphql', {
		body: JSON.stringify({
			query: `query UpstreamIssue($identifier: String!) {
				issues(filter: { identifier: { eq: $identifier } }, first: 1) {
					nodes { title url state { type } }
				}
			}`,
			variables: { identifier: reference.key }
		}),
		headers: {
			Authorization: apiKey,
			'Content-Type': 'application/json'
		},
		method: 'POST'
	});

	const payload: unknown = await response.json();
	if (!response.ok || !isLinearPayload(payload)) {
		throw new Error('Linear API error');
	}

	const issue = payload.data.issues.nodes[0];
	if (!issue) {
		throw new Error(`Linear issue ${reference.key} was not found`);
	}

	return { state: issue.state.type, title: issue.title, url: issue.url };
}

function isLinearPayload(payload: unknown): payload is {
	data: { issues: { nodes: { state: { type: string }; title: string; url: string }[] } };
} {
	if (typeof payload !== 'object' || payload === null || !('data' in payload)) return false;
	const { data } = payload;
	if (typeof data !== 'object' || data === null || !('issues' in data)) return false;
	const { issues } = data;
	if (typeof issues !== 'object' || issues === null || !('nodes' in issues)) return false;
	return Array.isArray(issues.nodes);
}

const lookupIssue: IssueLookup = (reference) =>
	reference.type === 'github' ? lookupGithubIssue(reference) : lookupLinearIssue(reference);

/** Checks each distinct reference and returns the live issue state with its markers. */
export async function checkReferences(
	references: Reference[],
	lookup: IssueLookup = lookupIssue
): Promise<CheckResult[]> {
	const byIssue = groupReferences(references);
	return Promise.all(
		[...byIssue.entries()].map(async ([key, issueReferences]) => ({
			issue: await lookup(issueReferences[0]),
			key,
			references: issueReferences
		}))
	);
}

function fail(message: string): never {
	console.error(`\n✗ ${message}`);
	process.exit(1);
}

async function main(): Promise<void> {
	const grep = await $`git grep -nP --untracked ${MARKER_PATTERN.source}`.nothrow().quiet();
	if (grep.exitCode !== 0 && grep.stdout.toString().trim() === '') {
		console.log('No upstream markers found in tracked or untracked files.');
		return;
	}

	const references = parseReferences(grep.stdout.toString());
	if (references.length === 0) {
		console.log('No upstream markers found in tracked or untracked files.');
		return;
	}

	console.log(`Checking ${groupReferences(references).size} upstream issue(s)...\n`);

	let hadClosed = false;
	let hadError = false;
	for (const reference of groupReferences(references).values()) {
		const key = referenceKey(reference[0]);
		try {
			const issue = await lookupIssue(reference[0]);
			if (isClosedState(issue.state)) {
				hadClosed = true;
				console.log(`✗ ${key} is CLOSED — "${issue.title}"\n  ${issue.url}`);
				for (const marker of reference) console.log(`  refactor: ${marker.file}:${marker.line}`);
			} else {
				console.log(`✓ ${key} still open — "${issue.title}"`);
			}
		} catch (error) {
			hadError = true;
			console.error(
				`? ${key} — could not check (${error instanceof Error ? error.message : 'unknown error'})`
			);
		}
	}

	if (hadError) fail('One or more issues could not be checked — see errors above.');
	if (hadClosed)
		fail('One or more upstream issues have closed. Remove the corresponding workarounds.');
	console.log('\n✓ All referenced upstream issues are still open — no workarounds to remove yet.');
}

if (import.meta.main) await main();
