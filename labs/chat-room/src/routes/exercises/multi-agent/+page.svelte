<script lang="ts">
	import { createAgent, createSubagentTool, type StepResult } from '@lostgradient/operative';
	import {
		Chat,
		appendUserMessage,
		createConversationHistory,
		type ConversationHistory
	} from '@lostgradient/chat';
	import { createToolbox } from 'armorer';
	import { z } from 'zod';

	// Delegation to a subagent, and what `returnMode` actually controls.
	//
	// The headline, measured rather than assumed: with the default
	// summarizer, `returnMode: 'summary'` is a CHARACTER CAP, not
	// summarization. Operative says so plainly —
	// `defaultSubagentSummarizer` "passes `result.content` through unchanged
	// when it already fits within `maxTokens`, otherwise hard-truncates it
	// … a naive character-based cap, not genuine summarization". The three
	// panels below show the difference between the cap, no cap, and a real
	// summarizer supplied by the caller.
	//
	// `summaryTokenCap` is set to 40 here. The DEFAULT is 500, and this
	// page's fixture answer would pass through whole under it — the cap is
	// lowered so the truncation is observable at all, which is the point of
	// the panel.
	//
	// Everything is local: the child agent returns a fixed string, the parent
	// asks for one delegation and then narrates. No network, no key.

	/** What the child always answers. Long enough to exceed the 40-token cap. */
	const CHILD_ANSWER = 'The staging bucket was retained. '.repeat(30);
	/** What this page's own summarizer condenses that down to. */
	const CUSTOM_SUMMARY = 'condensed: The staging bucket was retained.';
	const QUESTION = 'What did we decide about the staging bucket?';

	type Delegation = {
		parentGenerateCalls: number;
		childGenerateCalls: number;
		toolExecutions: number;
		finishReason: string;
		returnedLength: number;
		keepsWholeAnswer: boolean;
		shortenedFromChild: boolean;
		keepsChildOpening: boolean;
		matchesCustomSummary: string;
		transcriptRoles: string;
		history: ConversationHistory;
	};

	/**
	 * Runs one parent agent that delegates exactly once, and reports what came
	 * back across the tool boundary.
	 *
	 * Every field is computed against this page's own fixtures. Operative's
	 * truncation marker is deliberately not matched: it is vendor copy that
	 * can change without any of this behaviour changing.
	 */
	async function delegate(
		id: string,
		options: { returnMode: 'summary' | 'full'; useCustomSummarizer?: boolean }
	): Promise<Delegation> {
		let childGenerateCalls = 0;
		let parentGenerateCalls = 0;

		const child = createAgent({
			name: 'researcher',
			generate: async () => {
				childGenerateCalls += 1;
				return { content: CHILD_ANSWER, toolCalls: [] };
			}
		});

		const consultResearcher = createSubagentTool({
			name: 'consult_researcher',
			description: 'Delegate a question to the researcher subagent.',
			agent: child,
			agentName: 'researcher',
			input: z.object({ question: z.string() }),
			toAgentInput: (input) => input.question,
			returnMode: options.returnMode,
			summaryTokenCap: 40,
			...(options.useCustomSummarizer === true ? { summarizer: () => CUSTOM_SUMMARY } : {})
		});

		const parent = createAgent({
			name: 'orchestrator',
			generate: async () => {
				parentGenerateCalls += 1;
				if (parentGenerateCalls === 1) {
					return {
						content: '',
						toolCalls: [
							{
								id: `${id}-call`,
								name: 'consult_researcher',
								arguments: { question: QUESTION }
							}
						]
					};
				}
				return { content: 'Relaying what the researcher found.', toolCalls: [] };
			},
			toolbox: createToolbox([consultResearcher]),
			stopWhen: [(step: StepResult) => step.toolCalls.length === 0]
		});

		const conversation = appendUserMessage(
			createConversationHistory({ id: `exercise-multi-agent-${id}` }),
			`Ask the researcher: ${QUESTION}`
		);
		const result = await parent.run({ conversation }).result();

		const messages = result.conversation.getMessages();

		// Counted from what the loop EXECUTED, not from what the parent asked
		// for. Incrementing beside the tool call in `generate` counts emissions,
		// and an emission is not an execution — a call the toolbox rejects, one
		// filtered before execution, or one that produces more than a single
		// result would all make a field labelled "tool executions" lie. The run
		// already reports the truth per step.
		const executions = result.steps.flatMap((step) => step.results);
		const toolExecutions = executions.length;

		// Selected by call id rather than taken as "the first tool result".
		// There is one tool here today, so the two agree — and the moment a
		// second is added the length comparisons below would silently start
		// measuring an unrelated result.
		const execution = executions.find((entry) => entry.toolCallId === `${id}-call`);
		const returned = String(execution?.result ?? '');

		return {
			parentGenerateCalls,
			childGenerateCalls,
			toolExecutions,
			finishReason: result.finishReason,
			returnedLength: returned.length,
			keepsWholeAnswer: returned === CHILD_ANSWER,
			shortenedFromChild: returned.length < CHILD_ANSWER.length,
			// A head truncation keeps the child's opening verbatim. A real
			// summarizer need not, which is what separates the two panels
			// beyond their lengths.
			keepsChildOpening: returned.startsWith(CHILD_ANSWER.slice(0, 32)),
			matchesCustomSummary: returned === CUSTOM_SUMMARY ? 'yes' : 'no',
			transcriptRoles: messages.map((message) => message.role).join(', '),
			history: result.conversation.current
		};
	}

	const panels = [
		{
			id: 'summary',
			label: "returnMode: 'summary' (cap 40)",
			note: 'The default summarizer caps the answer. It does not condense it.',
			promise: delegate('summary', { returnMode: 'summary' })
		},
		{
			id: 'full',
			label: "returnMode: 'full'",
			note: "The child's answer crosses back whole, at whatever length it happens to be.",
			promise: delegate('full', { returnMode: 'full' })
		},
		{
			id: 'custom',
			label: "returnMode: 'summary' with a caller-supplied summarizer",
			note: 'Where real condensation lives — the seam the default fills with a cap.',
			promise: delegate('custom', { returnMode: 'summary', useCustomSummarizer: true })
		}
	];

	let settledCount = $state(0);
	for (const panel of panels) {
		void panel.promise.then(() => {
			settledCount += 1;
		});
	}

	const summaryPanel = panels[0];
</script>

<main>
	<h1>Multi-agent — delegating to a subagent</h1>
	<p>
		One parent agent, one <code>createSubagentTool</code> delegation, three settings for what comes
		back across the boundary. With the default summarizer, <code>'summary'</code> hard-truncates; condensation
		is something the caller supplies.
	</p>

	<!--
		One concise, persistent status line rather than an `aria-live` region
		around each result table: it exists at mount, since a live region
		inserted along with its content announces unreliably.
	-->
	<p role="status" data-testid="multi-agent-status">
		{settledCount} of {panels.length} delegations settled.
	</p>

	<section data-testid="multi-agent-transcript">
		<h2>The delegation, in Chat's transcript</h2>
		<p>
			The <code>'summary'</code> delegation above, rendered by
			<code>&lt;Chat&gt;</code>. A completed tool-call/tool-result pair renders as a grouped
			tool-activity row; expanding it shows the arguments the parent sent and the result that
			crossed back.
		</p>
		{#await summaryPanel.promise}
			<p data-testid="multi-agent-transcript-pending">Running…</p>
		{:then delegation}
			<div data-testid="multi-agent-chat">
				<Chat id="multi-agent-chat" conversation={delegation.history} />
			</div>
		{/await}
	</section>

	{#each panels as panel (panel.id)}
		<section data-testid="multi-agent-{panel.id}">
			<h2>{panel.label}</h2>
			<p>{panel.note}</p>
			{#await panel.promise}
				<p data-testid="multi-agent-{panel.id}-pending">Running…</p>
			{:then delegation}
				<dl>
					<dt>finishReason</dt>
					<dd data-testid="multi-agent-{panel.id}-finish">{delegation.finishReason}</dd>
					<dt>parent generate calls</dt>
					<dd data-testid="multi-agent-{panel.id}-parent-calls">
						{delegation.parentGenerateCalls}
					</dd>
					<dt>child generate calls</dt>
					<dd data-testid="multi-agent-{panel.id}-child-calls">{delegation.childGenerateCalls}</dd>
					<dt>tool executions</dt>
					<dd data-testid="multi-agent-{panel.id}-tool-executions">{delegation.toolExecutions}</dd>
					<dt>transcript roles</dt>
					<dd data-testid="multi-agent-{panel.id}-roles">{delegation.transcriptRoles}</dd>
					<dt>returned characters</dt>
					<dd data-testid="multi-agent-{panel.id}-length">{delegation.returnedLength}</dd>
					<dt>identical to the child's answer</dt>
					<dd data-testid="multi-agent-{panel.id}-whole">{delegation.keepsWholeAnswer}</dd>
					<dt>shorter than the child's answer</dt>
					<dd data-testid="multi-agent-{panel.id}-shortened">{delegation.shortenedFromChild}</dd>
					<dt>opens with the child's own words</dt>
					<dd data-testid="multi-agent-{panel.id}-opening">{delegation.keepsChildOpening}</dd>
					<dt>equals this page's summarizer output</dt>
					<dd data-testid="multi-agent-{panel.id}-custom">{delegation.matchesCustomSummary}</dd>
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

	/*
	 * At 320 CSS pixels a `max-content` label column cannot shrink, pushing
	 * the value column off-screen and making a reader at high zoom pan
	 * sideways to pair a term with its value. Stack once there is no room.
	 */
	@media (max-width: 32rem) {
		dl {
			grid-template-columns: 1fr;
			gap: 0;
		}

		dt {
			margin-block-start: 0.75rem;
		}
	}
</style>
