import { describe, expect, test } from 'bun:test';
import {
	checkReferences,
	isClosedState,
	lookupLinearIssue,
	parseReferences
} from './check-upstream-issues';

const marker = 'upstream:';
const fixture = `
src/github-workaround.ts:7:// ${marker} acme/widget#42
src/linear-workaround.ts:9:// ${marker} CIN-311
src/closed-github.ts:12:// ${marker} acme/widget#99
src/closed-linear.ts:14:// ${marker} AB-27
`;

describe('check:upstream marker parsing', () => {
	test('recognizes GitHub and Linear markers from the same fixture', () => {
		expect(parseReferences(fixture)).toEqual([
			{ file: 'src/github-workaround.ts', issue: 42, line: 7, repo: 'acme/widget', type: 'github' },
			{ file: 'src/linear-workaround.ts', key: 'CIN-311', line: 9, type: 'linear' },
			{ file: 'src/closed-github.ts', issue: 99, line: 12, repo: 'acme/widget', type: 'github' },
			{ file: 'src/closed-linear.ts', key: 'AB-27', line: 14, type: 'linear' }
		]);
	});

	test('reports closed GitHub and Linear tracking issues from the same fixture', async () => {
		const results = await checkReferences(parseReferences(fixture), async (reference) => {
			const closed =
				(reference.type === 'github' && reference.issue === 99) ||
				(reference.type === 'linear' && reference.key === 'AB-27');
			return {
				state: closed ? (reference.type === 'github' ? 'CLOSED' : 'completed') : 'OPEN',
				title:
					reference.type === 'github' ? `GitHub ${reference.issue}` : `Linear ${reference.key}`,
				url: 'https://example.test/issue'
			};
		});

		expect(
			results.filter((result) => isClosedState(result.issue.state)).map((result) => result.key)
		).toEqual(['acme/widget#99', 'AB-27']);
	});

	test('queries Linear by issue key and preserves its completed state', async () => {
		const issue = await lookupLinearIssue(
			{ file: 'src/workaround.ts', key: 'CIN-311', line: 7, type: 'linear' },
			async (input, init) => {
				expect(input).toBe('https://api.linear.app/graphql');
				expect(init?.headers).toMatchObject({ Authorization: 'linear-test-key' });
				expect(init?.body).toContain('identifier');
				expect(init?.body).toContain('CIN-311');
				const payload = {
					data: {
						issues: {
							nodes: [
								{
									state: { type: 'completed' },
									title: 'Resolved Linear issue',
									url: 'https://linear.app/example/issue/CIN-311'
								}
							]
						}
					}
				};
				return Response.json(payload);
			},
			'linear-test-key'
		);

		expect(issue).toEqual({
			state: 'completed',
			title: 'Resolved Linear issue',
			url: 'https://linear.app/example/issue/CIN-311'
		});
	});

	test('fails clearly when a Linear marker has no configured credential', async () => {
		await expect(
			lookupLinearIssue(
				{ file: 'src/workaround.ts', key: 'AB-27', line: 7, type: 'linear' },
				fetch,
				undefined
			)
		).rejects.toThrow('LINEAR_API_KEY is required');
	});
});
