<script lang="ts">
	import { AgentRunError, createAgent } from '@lostgradient/operative';
	import { appendUserMessage, createConversationHistory } from 'conversationalist';
	import { createToolbox } from 'armorer';
	import { z } from 'zod';

	// The result contract for a typed agent, measured rather than assumed.
	//
	// The headline, and the reason this route exists: a schema-invalid run and
	// a valid one are INDISTINGUISHABLE by `finishReason`. Both settle
	// `stop-condition`. The invalid one carries no `result.error` at all. A
	// consumer that checks the finish reason and stops there ships a bug —
	// it will treat garbage as an answer.
	//
	// What actually separates them is `result.schemaValidation.success`, and
	// the rejection from `unwrap()` / `output()`. Nothing else on the terminal
	// result says a word about it.
	//
	// Every fixture here is a local function. No network, no key, no fixture
	// server — the whole point is that the contract is observable without any
	// of that.

	const answerSchema = z.object({ answer: z.string() });
	const conversation = appendUserMessage(
		createConversationHistory({ id: 'exercise-output' }),
		'What is the answer?'
	);

	type Observation = {
		finishReason: string;
		schemaValid: boolean;
		hasResultError: boolean;
		output: string;
		unwrapError: string;
		outputError: string;
		sameErrorInstance: boolean;
		errorKind: string;
		errorCode: string;
		schemaErrorKind: string;
		schemaErrorCode: string;
	};

	/**
	 * Runs one agent whose `generate` always answers with `content`, and reports
	 * every field a caller might reach for when deciding whether it worked.
	 *
	 * `unwrap()` and `output()` are both called, and their rejections compared
	 * by IDENTITY rather than by shape — `result()` caches, and the same cached
	 * error is what both accessors are documented to surface. Comparing
	 * messages would pass even if each call minted a fresh error.
	 */
	async function observe(content: string): Promise<Observation> {
		const agent = createAgent({
			generate: async () => ({ content, toolCalls: [] }),
			toolbox: createToolbox([]),
			output: answerSchema
		});
		const run = agent.run({ conversation });
		const result = await run.result();

		let unwrapError: unknown;
		let outputError: unknown;
		try {
			await run.unwrap();
		} catch (error) {
			unwrapError = error;
		}
		try {
			await run.output();
		} catch (error) {
			outputError = error;
		}

		const failure = unwrapError instanceof AgentRunError ? unwrapError : undefined;
		// Read the terminal result's OWN copy independently of the rejection.
		// Claiming "the same classified error lives on `schemaValidation.error`"
		// while only ever displaying the rejection would leave that claim
		// unchecked — if the field vanished, changed shape, or carried a
		// different classification, nothing here would notice.
		const schemaError =
			result.schemaValidation?.success === false
				? (result.schemaValidation.error as AgentRunError | undefined)
				: undefined;
		return {
			finishReason: result.finishReason,
			schemaValid: result.schemaValidation?.success === true,
			hasResultError: result.error !== undefined,
			// Never render a partial or stale success value on a failed
			// validation: the run reports `output: undefined`, and this shows
			// exactly that rather than a remembered earlier value.
			output: result.output === undefined ? '(none)' : JSON.stringify(result.output),
			unwrapError: unwrapError === undefined ? '(resolved)' : (unwrapError as Error).name,
			outputError: outputError === undefined ? '(resolved)' : (outputError as Error).name,
			sameErrorInstance: unwrapError !== undefined && unwrapError === outputError,
			errorKind: failure?.kind ?? '(none)',
			errorCode: failure?.code ?? '(none)',
			schemaErrorKind: schemaError?.kind ?? '(none)',
			schemaErrorCode: schemaError?.code ?? '(none)'
		};
	}

	const valid = observe(JSON.stringify({ answer: 'forty-two' }));
	const invalid = observe(JSON.stringify({ answer: 42 }));
</script>

<main>
	<h1>Output validation</h1>
	<p>
		A typed agent settles <code>stop-condition</code> whether or not its output satisfies the schema.
		The finish reason cannot tell you which happened.
	</p>

	{#each [{ id: 'valid', label: 'Valid output', promise: valid }, { id: 'invalid', label: 'Invalid output', promise: invalid }] as panel (panel.id)}
		<section data-testid="output-{panel.id}">
			<h2>{panel.label}</h2>
			{#await panel.promise}
				<p data-testid="output-{panel.id}-pending">Running…</p>
			{:then observation}
				<dl>
					<dt>finishReason</dt>
					<dd data-testid="output-{panel.id}-finish">{observation.finishReason}</dd>
					<dt>schemaValidation.success</dt>
					<dd data-testid="output-{panel.id}-schema-valid">{observation.schemaValid}</dd>
					<dt>result.error present</dt>
					<dd data-testid="output-{panel.id}-has-error">{observation.hasResultError}</dd>
					<dt>result.output</dt>
					<dd data-testid="output-{panel.id}-output">{observation.output}</dd>
					<dt>unwrap()</dt>
					<dd data-testid="output-{panel.id}-unwrap">{observation.unwrapError}</dd>
					<dt>output()</dt>
					<dd data-testid="output-{panel.id}-output-method">{observation.outputError}</dd>
					<dt>same error instance</dt>
					<dd data-testid="output-{panel.id}-same-instance">{observation.sameErrorInstance}</dd>
					<dt>kind / code (from the rejection)</dt>
					<dd data-testid="output-{panel.id}-kind-code">
						{observation.errorKind} / {observation.errorCode}
					</dd>
					<dt>kind / code (from schemaValidation.error)</dt>
					<dd data-testid="output-{panel.id}-schema-kind-code">
						{observation.schemaErrorKind} / {observation.schemaErrorCode}
					</dd>
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
