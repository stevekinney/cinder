import { json } from '@sveltejs/kit';
import { z } from 'zod';

import { toolbox } from '$lib/toolbox';

import type { SignedPendingToolApproval } from 'armorer';
import type { RequestHandler } from './$types';

const actionSchema = z.object({
	type: z.enum(['approval', 'input']),
	message: z.string().optional(),
	schema: z.unknown().optional()
});

const policyPauseTierSchema = z.enum(['capability', 'registry', 'tool']);

const approvalSchema = z.object({
	callId: z.string(),
	toolName: z.string(),
	arguments: z.unknown(),
	action: actionSchema,
	reason: z.string().optional(),
	metadata: z.unknown().optional(),
	policyPauseTier: policyPauseTierSchema.optional(),
	satisfiedPolicyPauses: z
		.array(
			z.object({
				action: actionSchema,
				reason: z.string().optional(),
				tier: policyPauseTierSchema.optional()
			})
		)
		.optional(),
	approvalToken: z.string()
});

const requestSchema = z.object({
	approval: approvalSchema,
	decision: z.enum(['approve', 'deny'])
});

export const POST: RequestHandler = async ({ request }) => {
	let body: unknown;

	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON' }, { status: 400 });
	}

	const parsed = requestSchema.safeParse(body);

	if (!parsed.success) {
		return json({ error: 'Invalid request body' }, { status: 400 });
	}

	const { approval, decision } = parsed.data;

	if (decision === 'deny') {
		return json({
			callId: approval.callId,
			outcome: 'error',
			content: null,
			error: {
				code: 'denied',
				category: 'permission',
				retryable: false,
				message: 'The user denied this request.'
			}
		});
	}

	// Validated by zod above; the JSONValue/unknown gap is the only reason for
	// this cast — armorer verifies the signed approvalToken itself.
	const result = await toolbox.resumeApproval(approval as SignedPendingToolApproval);

	return json({
		callId: result.callId,
		outcome: result.outcome,
		content: result.content,
		...(result.error ? { error: result.error } : {})
	});
};
