<script lang="ts">
	import { createAgent, type StepResult } from '@lostgradient/operative';
	import { appendUserMessage, createConversationHistory } from 'conversationalist';
	import { createTool, createToolbox } from 'armorer';
	import { z } from 'zod';

	// A named stop condition ending the loop after exactly one step.
	//
	// The loop's default is to keep going: a step that produces tool calls
	// normally resolves them and then takes ANOTHER generate call to narrate
	// the results. The condition below is what makes this run stop instead —
	// and the counter proves it, because "no second generation" is invisible
	// in the transcript. A run that took two generate calls and said nothing
	// the second time renders identically.
	//
	// Everything is local: the generator always asks for one `roll_dice`, and
	// the die always returns 4. No network, no key, no randomness.

	const conversation = appendUserMessage(
		createConversationHistory({ id: 'exercise-stop-condition' }),
		'Roll a die.'
	);

	const rollDice = createTool({
		name: 'roll_dice',
		version: '1.0.0',
		description: 'A deterministic die, for a deterministic exercise.',
		input: z.object({ sides: z.number().int().min(2) }),
		async execute() {
			toolExecutions += 1;
			return { value: 4 };
		}
	});

	let generateCalls = 0;
	let toolExecutions = 0;

	/**
	 * The named condition. Reads as its own sentence at the call site, which is
	 * the point of naming it rather than inlining a lambda into `stopWhen`.
	 */
	const rolledTheDie = (step: StepResult): boolean =>
		step.toolCalls.some((call) => call.name === 'roll_dice');

	type Observation = {
		generateCalls: number;
		toolExecutions: number;
		finishReason: string;
		steps: number;
		toolResult: string;
	};

	async function run(): Promise<Observation> {
		const agent = createAgent({
			generate: async () => {
				generateCalls += 1;
				return {
					content: '',
					toolCalls: [{ id: `call-${generateCalls}`, name: 'roll_dice', arguments: { sides: 6 } }]
				};
			},
			toolbox: createToolbox([rollDice]),
			stopWhen: [rolledTheDie]
		});
		const result = await agent.run({ conversation }).result();
		const first = result.steps.at(0);
		const value = first?.results.at(0)?.content;
		return {
			generateCalls,
			toolExecutions,
			finishReason: result.finishReason,
			steps: result.steps.length,
			toolResult: value === undefined ? '(none)' : JSON.stringify(value)
		};
	}

	const observation = run();
</script>

<main>
	<h1>Stop conditions</h1>
	<p>
		Without <code>rolledTheDie</code>, this run would resolve the tool and take a second generate
		call to narrate the result. The counter is the only thing that can show it did not.
	</p>

	<section data-testid="stop-condition">
		{#await observation}
			<p data-testid="stop-condition-pending">Running…</p>
		{:then result}
			<dl>
				<dt>generate calls</dt>
				<dd data-testid="stop-condition-generate-calls">{result.generateCalls}</dd>
				<dt>tool executions</dt>
				<dd data-testid="stop-condition-tool-executions">{result.toolExecutions}</dd>
				<dt>steps</dt>
				<dd data-testid="stop-condition-steps">{result.steps}</dd>
				<dt>finishReason</dt>
				<dd data-testid="stop-condition-finish">{result.finishReason}</dd>
				<dt>tool result</dt>
				<dd data-testid="stop-condition-tool-result">{result.toolResult}</dd>
			</dl>
		{/await}
	</section>
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
