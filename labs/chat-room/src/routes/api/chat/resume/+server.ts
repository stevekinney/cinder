import { json } from '@sveltejs/kit';
import { z } from 'zod';

import { requestContext, toolbox } from '$lib/toolbox';

import { materializeToolResult } from 'armorer';
import type { SignedPendingToolApproval } from 'armorer';
import type { RequestHandler } from './$types';

const jsonValueSchema = z.json();

const operationSchema = z.discriminatedUnion('kind', [
	z
		.object({
			kind: z.literal('command'),
			command: z.string(),
			filesTouched: z.array(z.string()).optional(),
			argsPreview: jsonValueSchema.optional()
		})
		.strict(),
	z
		.object({
			kind: z.literal('file-write'),
			filesTouched: z.array(z.string()),
			argsPreview: jsonValueSchema.optional()
		})
		.strict(),
	z
		.object({
			kind: z.literal('patch'),
			filesTouched: z.array(z.string()).optional(),
			argsPreview: jsonValueSchema.optional(),
			diff: z.string()
		})
		.strict(),
	z
		.object({
			kind: z.literal('other'),
			filesTouched: z.array(z.string()).optional(),
			argsPreview: jsonValueSchema.optional()
		})
		.strict()
]);

const sandboxSchema = z
	.object({ provider: z.string(), name: z.string(), workingDir: z.string() })
	.strict();

const actionSchema = z
	.discriminatedUnion('type', [
		z
			.object({
				type: z.literal('input'),
				message: z.string().optional(),
				schema: jsonValueSchema.optional()
			})
			.strict(),
		z
			.object({
				type: z.literal('approval'),
				message: z.string().optional(),
				risk: z.enum(['low', 'medium', 'high']),
				operation: operationSchema,
				sandbox: sandboxSchema.optional(),
				env: z.array(z.string()).optional(),
				snapshotId: z.string().optional(),
				expiresAt: z.string().optional(),
				editableArgs: z.boolean().optional(),
				policyVersion: z.string(),
				idempotencyKey: z.string()
			})
			.strict()
	])
	.superRefine((action, context) => {
		try {
			materializeToolResult({
				callId: 'resume-validation',
				outcome: 'action_required',
				content: null,
				action
			});
		} catch (error) {
			context.addIssue({
				code: 'custom',
				message: error instanceof Error ? error.message : 'Invalid tool action'
			});
		}
	});

const policyPauseTierSchema = z.enum(['capability', 'registry', 'tool']);

const approvalSchema = z
	.object({
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
	})
	.passthrough();

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
	const result = await toolbox.resumeApproval(approval as SignedPendingToolApproval, {
		requestContext
	});

	return json({
		callId: result.callId,
		outcome: result.outcome,
		content: result.content,
		...(result.action ? { action: result.action } : {}),
		...(result.pendingApproval ? { pendingApproval: result.pendingApproval } : {}),
		...(result.error ? { error: result.error } : {})
	});
};
