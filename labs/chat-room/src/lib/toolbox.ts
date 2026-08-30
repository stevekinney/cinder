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
