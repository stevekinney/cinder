import { createTool, createToolbox, type ToolRequestContext } from 'armorer';
import { z } from 'zod';

const rollDice = createTool({
	name: 'roll_dice',
	version: '1.0.0',
	description: 'Roll one or more dice and return the individual results.',
	input: z.object({
		sides: z.number().int().min(2).max(1000),
		count: z.number().int().min(1).max(20)
	}),
	async execute({ sides, count }) {
		const rolls = Array.from({ length: count }, () => 1 + Math.floor(Math.random() * sides));
		return { rolls, total: rolls.reduce((sum, roll) => sum + roll, 0) };
	}
});

const rememberNote = createTool({
	name: 'remember_note',
	version: '1.0.0',
	description: 'Save a short note for later reference.',
	input: z.object({ text: z.string() }),
	policy: {
		beforeExecute: () => ({ status: 'needs_approval', reason: 'Save this note?' })
	},
	async execute({ text }) {
		return { saved: true, text };
	}
});

/**
 * Stable for the process's lifetime only. Nothing else in this app survives
 * a server restart either (`conversation` lives in the browser tab), so a
 * restart invalidating an in-flight approval is an acceptable limitation
 * rather than a reason to commit a secret to `.env`.
 */
export const toolbox = createToolbox([rollDice, rememberNote], {
	approvalSecret: crypto.randomUUID()
});

export const requestContext: ToolRequestContext = {
	authority: {
		principalId: 'chat-room-user',
		tenantId: 'chat-room',
		ownerId: 'chat-room-session',
		capabilities: [],
		authorizationRevision: '1'
	},
	audience: 'tenant',
	agentId: 'chat-room-assistant',
	runId: 'chat-room-session'
};

/**
 * A toolbox with nothing in it.
 *
 * Constructed HERE rather than at the route, because the ownership guard is
 * right to insist on that: a route that builds its own toolbox is a route
 * that can quietly acquire an approval-gated tool without the host noticing.
 * Keeping even the empty one in this module means the guard stays a simple,
 * total rule rather than one with an exception that has to be maintained.
 *
 * Still used by the recovery endpoint, which must supply `runOptions` even
 * though it never generates, and has no business carrying tools (AB-424).
 *
 * NOT "a read-only question", which this said while that endpoint was a GET.
 * `recover()` reconciles the stranded run it reports and consumes the
 * classification, which is why the verb is a POST — and why calling it
 * read-only anywhere invites restoring caching or retries that spend the one
 * diagnosis there will ever be.
 */
export const emptyToolbox = createToolbox([]);

/**
 * The same note tool with NO approval policy on it.
 *
 * The gated `rememberNote` above parks: `beforeExecute` answers
 * `needs_approval`, armorer mints a signed token describing the call, the run
 * stops, and the next HTTP request carries the token back to
 * `toolbox.resumeApproval()`. That is the canonical stateless flow CIN-437
 * built, and it is right for the browser-owned route, where the conversation
 * lives in the tab and the server remembers nothing between turns.
 *
 * The server-owned family gates the same tool a different way: a
 * `beforeToolExecution` hook calls Operative's `ctx.elicit(...)`, and the
 * answer comes from a person through `/api/server-owned/conversations/[id]/
 * elicitation`. Leaving the armorer policy in place as well would gate it
 * TWICE — the hook would ask, and the approved call would then park anyway
 * with a token no one in this family knows how to resume.
 *
 * So this is not a laxer copy of the tool. The approval moved from the
 * toolbox to the loop, which is the comparison CIN-445 asked for; see
 * `docs/reference-architecture.md` § Toolbox and approval ownership.
 */
const rememberNoteAwaitingElicitation = createTool({
	name: 'remember_note',
	version: '1.0.0',
	description: 'Save a short note for later reference.',
	input: z.object({ text: z.string() }),
	async execute({ text }) {
		return { saved: true, text };
	}
});

/**
 * The server-owned family's toolbox.
 *
 * No `approvalSecret`, and that absence is the point rather than an
 * oversight: nothing in this family mints or verifies an approval token, so a
 * secret would be dead configuration implying a flow that is not here.
 */
export const serverOwnedToolbox = createToolbox([rollDice, rememberNoteAwaitingElicitation]);

/** The one tool in the server-owned family that a person has to approve. */
export const ELICITED_TOOL_NAME = 'remember_note';

/** The question a person is asked before that tool runs. */
export const ELICITATION_MESSAGE = 'Save this note?';
