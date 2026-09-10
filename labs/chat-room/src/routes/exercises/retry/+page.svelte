<script lang="ts">
	import { createAgent } from '@lostgradient/operative';
	import { appendUserMessage, createConversationHistory } from 'conversationalist';
	import { createToolbox } from 'armorer';
	import { z } from 'zod';

	// What `retry` covers, and — the part worth the route — what it does not.
	//
	// `RetryOptions` retries "the generate call on transient failures". A
	// response that arrives intact and then fails the output schema is not a
	// failure of the generate call, so the provider is never asked again. All
	// three panels below configure the SAME `retry: { attempts: 2 }`; only the
	// way the fixture fails differs, and the call counts come out 2, 1, 1.
	//
	// Someone who configures `retry` expecting it to re-roll a bad answer has
	// a silent gap. That is the lesson here.
	//
	// `RetryOptions.attempts` is the budget, not a tally: nothing on the
	// terminal result reports how many generate calls a run made. Each fixture
	// counts its own, which is the only honest source.

	const answerSchema = z.object({ answer: z.string() });
	const VALID = JSON.stringify({ answer: 'forty-two' });
	const INVALID = JSON.stringify({ answer: 42 });
	const conversation = appendUserMessage(
		createConversationHistory({ id: 'exercise-retry' }),
		'What is the answer?'
	);

	type Observation = {
		calls: number;
		finishReason: string;
		schemaValid: string;
		output: string;
	};

	async function observe(
		generate: (call: number) => Promise<{ content: string; toolCalls: [] }>,
		options: { validateResponse?: boolean } = {}
	): Promise<Observation> {
		let calls = 0;
		const agent = createAgent({
			generate: async () => {
				calls += 1;
				return generate(calls);
			},
			toolbox: createToolbox([]),
			output: answerSchema,
			// `delay: 0` because this is a determinism exercise, not a timing
			// one — the backoff is real and orthogonal to what is being shown.
			retry: { attempts: 2, delay: 0 },
			...(options.validateResponse
				? {
						// Returns nothing on the success path. The hook's contract is
						// `Promise<GenerateResponse | void>`, and `void` means "leave
						// the response alone" — which is what this wants. Returning
						// the argument back through a cast said the same thing while
						// implying the types disagreed.
						validateResponse: async (response: { content?: string }) => {
							const parsed = answerSchema.safeParse(JSON.parse(response.content ?? '{}'));
							if (!parsed.success) throw new Error('response failed the output schema');
						}
					}
				: {})
		});
		const result = await agent.run({ conversation }).result();
		return {
			calls,
			finishReason: result.finishReason,
			schemaValid:
				result.schemaValidation === undefined ? '(none)' : String(result.schemaValidation.success),
			output: result.output === undefined ? '(none)' : JSON.stringify(result.output)
		};
	}

	// Retried: the generate call itself failed, which is what `retry` is for.
	const transient = observe(async (call) => {
		if (call === 1) throw Object.assign(new Error('transient upstream failure'), { status: 503 });
		return { content: VALID, toolCalls: [] };
	});

	// NOT retried: the call succeeded, the answer is simply wrong. The second,
	// valid response this fixture is willing to give is never requested.
	const invalidThenValid = observe(async (call) => ({
		content: call === 1 ? INVALID : VALID,
		toolCalls: []
	}));

	// Also not retried: rejecting the response in `validateResponse` — the
	// obvious way to say "ask again" — ends the run instead.
	const rejectedByHook = observe(
		async (call) => ({ content: call === 1 ? INVALID : VALID, toolCalls: [] }),
		{ validateResponse: true }
	);
</script>

<main>
	<h1>Retry</h1>
	<p>
		All three runs configure <code>retry: &#123; attempts: 2 &#125;</code>. Only the first one
		retries.
	</p>

	{#each [{ id: 'transient', label: 'Generate throws, then succeeds', promise: transient }, { id: 'invalid', label: 'Invalid output, then valid', promise: invalidThenValid }, { id: 'hook', label: 'validateResponse rejects the answer', promise: rejectedByHook }] as panel (panel.id)}
		<section data-testid="retry-{panel.id}">
			<h2>{panel.label}</h2>
			{#await panel.promise}
				<p data-testid="retry-{panel.id}-pending">Running…</p>
			{:then observation}
				<dl>
					<dt>generate calls</dt>
					<dd data-testid="retry-{panel.id}-calls">{observation.calls}</dd>
					<dt>finishReason</dt>
					<dd data-testid="retry-{panel.id}-finish">{observation.finishReason}</dd>
					<dt>schemaValidation.success</dt>
					<dd data-testid="retry-{panel.id}-schema-valid">{observation.schemaValid}</dd>
					<dt>result.output</dt>
					<dd data-testid="retry-{panel.id}-output">{observation.output}</dd>
				</dl>
			{/await}
		</section>
	{/each}
</main>

<style>
	main {
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	dl {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: 0.25rem 1rem;
		margin: 0;
	}

	dt {
		font-weight: 600;
	}

	dd {
		margin: 0;
		font-family: monospace;
	}
</style>
