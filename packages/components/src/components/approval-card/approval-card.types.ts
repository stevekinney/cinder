import type { HTMLAttributes } from 'svelte/elements';

export type ApprovalToolRisk = 'low' | 'medium' | 'high';

/** @schemaObject */
export type ApprovalTool = {
  /** Human-readable tool name requesting approval. */
  name: string;
  /** Risk level assigned by the policy evaluator. */
  risk: ApprovalToolRisk;
};

/** @schemaObject */
export type ApprovalSandbox = {
  /** Sandbox provider, such as Codex or a remote execution backend. */
  provider: string;
  /** Sandbox profile or policy name. */
  name: string;
  /** Working directory for the pending operation. */
  workingDir: string;
};

export type ApprovalOperationKind = 'command' | 'file-write' | 'patch' | 'other';

/** @schemaObject */
export type ApprovalOperation = {
  /** Operation family being approved. */
  kind: ApprovalOperationKind;
  /** Shell command for command approvals. */
  command?: string;
  /** File paths that the operation may read or write. */
  filesTouched?: string[];
  /** JSON-like argument preview shown to the approver. */
  argsPreview?: unknown;
  /** Patch diff for patch approvals. */
  diff?: string;
};

export type ApprovalState =
  | 'pending'
  | 'approved'
  | 'approved_with_edits'
  | 'denied'
  | 'expired'
  | 'cancelled';

export type ApprovalCardCallbacks = {
  /** Called when the approver accepts the operation as presented. */
  onApprove?: () => void;
  /** Called with parsed JSON arguments when the approver accepts edited arguments. */
  onApproveWithEdits?: (editedArgs: unknown) => void;
  /** Called when the approver denies the operation. */
  onDeny?: () => void;
  /** Called when the approver asks the host application to remember the decision. */
  onRemember?: () => void;
  /** Called when the approver cancels the approval prompt. */
  onCancel?: () => void;
};

/** Props for the ApprovalCard component. */
export type ApprovalCardProps = Omit<HTMLAttributes<HTMLElement>, 'class' | 'children'> &
  ApprovalCardCallbacks & {
    /** Tool requesting approval. */
    tool: ApprovalTool;
    /** Optional sandbox context in which the operation will run. */
    sandbox?: ApprovalSandbox;
    /** Operation details shown to the approver. */
    operation: ApprovalOperation;
    /** Environment variable names only. Values are ignored if accidentally supplied as `NAME=value`. */
    env?: string[];
    /** Snapshot identifier for the pending approval context. */
    snapshotId?: string;
    /** Policy version that produced the approval request. */
    policyVersion: string;
    /** Idempotency key that makes repeated decisions durable. */
    idempotencyKey: string;
    /** Optional ISO timestamp after which a pending approval is treated as expired. */
    expiresAt?: string;
    /** Persisted approval state. */
    state: ApprovalState;
    /** Whether approving with edited JSON arguments is available. Default `false`. */
    editableArgs?: boolean;
    /** Additional CSS classes applied to the root element. */
    class?: string;
  };

/**
 * Cinder-specific schema surface for ApprovalCard.
 *
 * Callback props and nested operation objects are documented but may be marked
 * unsupported by the schema generator when they cannot be represented as JSON
 * Schema controls.
 */
export type ApprovalCardSchemaProps = {
  /** Tool requesting approval. */
  tool: ApprovalTool;
  /** Optional sandbox context in which the operation will run. */
  sandbox?: ApprovalSandbox;
  /** Operation details shown to the approver. */
  operation: ApprovalOperation;
  /** Environment variable names only. Values are ignored if accidentally supplied as `NAME=value`. */
  env?: string[];
  /** Snapshot identifier for the pending approval context. */
  snapshotId?: string;
  /** Policy version that produced the approval request. */
  policyVersion: string;
  /** Idempotency key that makes repeated decisions durable. */
  idempotencyKey: string;
  /** Optional ISO timestamp after which a pending approval is treated as expired. */
  expiresAt?: string;
  /** Persisted approval state. */
  state: ApprovalState;
  /** Whether approving with edited JSON arguments is available. Default `false`. */
  editableArgs?: boolean;
  /** Called when the approver accepts the operation as presented. */
  onApprove?: () => void;
  /** Called with parsed JSON arguments when the approver accepts edited arguments. */
  onApproveWithEdits?: (editedArgs: unknown) => void;
  /** Called when the approver denies the operation. */
  onDeny?: () => void;
  /** Called when the approver asks the host application to remember the decision. */
  onRemember?: () => void;
  /** Called when the approver cancels the approval prompt. */
  onCancel?: () => void;
  /** Additional CSS classes applied to the root element. */
  class?: string;
};
