import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    tool: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Human-readable tool name requesting approval.',
        },
        risk: {
          enum: ['low', 'medium', 'high'],
          description: 'Risk level assigned by the policy evaluator.',
        },
      },
      additionalProperties: false,
      required: ['name', 'risk'],
      description: 'Tool requesting approval.',
    },
    sandbox: {
      type: 'object',
      properties: {
        provider: {
          type: 'string',
          description: 'Sandbox provider, such as Codex or a remote execution backend.',
        },
        name: {
          type: 'string',
          description: 'Sandbox profile or policy name.',
        },
        workingDir: {
          type: 'string',
          description: 'Working directory for the pending operation.',
        },
      },
      additionalProperties: false,
      required: ['name', 'provider', 'workingDir'],
      description: 'Optional sandbox context in which the operation will run.',
    },
    env: {
      type: 'array',
      items: {
        type: 'string',
      },
      description:
        'Environment variable names only. Values are ignored if accidentally supplied as `NAME=value`.',
    },
    snapshotId: {
      type: 'string',
      description: 'Snapshot identifier for the pending approval context.',
    },
    policyVersion: {
      type: 'string',
      description: 'Policy version that produced the approval request.',
    },
    idempotencyKey: {
      type: 'string',
      description: 'Idempotency key that makes repeated decisions durable.',
    },
    expiresAt: {
      type: 'string',
      description: 'Optional ISO timestamp after which a pending approval is treated as expired.',
    },
    state: {
      enum: ['pending', 'approved', 'approved_with_edits', 'denied', 'expired', 'cancelled'],
      description: 'Persisted approval state.',
    },
    editableArgs: {
      type: 'boolean',
      description: 'Whether approving with edited JSON arguments is available. Default `false`.',
    },
    class: {
      type: 'string',
      description: 'Additional CSS classes applied to the root element.',
    },
  },
  additionalProperties: false,
  required: ['idempotencyKey', 'policyVersion', 'state', 'tool'],
  metadata: {
    unsupportedProps: [
      {
        name: 'onApprove',
        reason: 'function-or-snippet',
        description: 'Called when the approver accepts the operation as presented.',
      },
      {
        name: 'onApproveWithEdits',
        reason: 'function-or-snippet',
        description:
          'Called with parsed JSON arguments when the approver accepts edited arguments.',
      },
      {
        name: 'onCancel',
        reason: 'function-or-snippet',
        description: 'Called when the approver cancels the approval prompt.',
      },
      {
        name: 'onDeny',
        reason: 'function-or-snippet',
        description: 'Called when the approver denies the operation.',
      },
      {
        name: 'onRemember',
        reason: 'function-or-snippet',
        description: 'Called when the approver asks the host application to remember the decision.',
      },
      {
        name: 'operation',
        reason: 'unknown-shape',
        required: true,
        description: 'Operation details shown to the approver.',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
