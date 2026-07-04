# ApprovalCard

Presentational human-in-the-loop approval surface for reviewing a tool operation
before the host application executes it.

## Usage

```svelte
<script lang="ts">
  import { ApprovalCard } from '@lostgradient/cinder/approval-card';
</script>

<ApprovalCard
  tool={{ name: 'deploy-cloud', risk: 'medium' }}
  sandbox={{
    provider: 'codex',
    name: 'workspace-write',
    workingDir: '/workspace/project',
  }}
  operation={{
    kind: 'command',
    command: 'bun run --filter=@lostgradient/cinder validate',
    argsPreview: { package: '@lostgradient/cinder' },
  }}
  env={['DATABASE_URL', 'OPENAI_API_KEY']}
  policyVersion="policy-2026-06"
  idempotencyKey="approval-01JZ8T"
  state="pending"
  onresolve={(resolution) => resolveApproval(resolution)}
/>
```

`ApprovalCard` is fully controlled. It does not execute commands, apply patches,
persist policy decisions, or read environment values. The component only renders
the supplied context and invokes callback props for host-owned actions.

## Resolution callback

Use `onresolve` when the host needs to persist one durable approval decision.
The callback receives the selected `decision`, parsed `editedArgs` for edited
approvals, optional `reason` text, and the `remember` checkbox state.

The older simple callbacks (`onapprove`, `onapprovewithedits`, `ondeny`,
`onremember`, and `oncancel`) remain supported for hosts that only need a direct
button action.

## Operation rendering

- `operation.kind: 'command'` renders the command with `CodeBlock`.
- `operation.kind: 'patch'` renders the supplied unified patch as diff code.
- `operation.argsPreview` renders through `PayloadInspector`; oversized previews
  are replaced with a bounded truncation notice before rendering.
- `env` renders variable names only. Values are not accepted and are stripped if
  a caller accidentally passes `NAME=value`.

## Approval states

Pending requests render action buttons. Non-pending requests render a read-only
summary. When `expiresAt` passes while `state` is still `pending`, the effective
state becomes `expired`, actions disappear, and no callback fires automatically.

## Props

<!-- generated:props:start -->

| Prop                 | Type                                                                                                                                                                                                                                                                                                                                              | Required | Default | Description                                                                                                                                                               |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`              | `string`                                                                                                                                                                                                                                                                                                                                          | no       | —       | Additional CSS classes applied to the root element.                                                                                                                       |
| `editableArgs`       | `boolean`                                                                                                                                                                                                                                                                                                                                         | no       | —       | Whether approving with edited JSON arguments is available. Default `false`.                                                                                               |
| `env`                | `string`[]                                                                                                                                                                                                                                                                                                                                        | no       | —       | Environment variable names only. Values are ignored if accidentally supplied as `NAME=value`.                                                                             |
| `expiresAt`          | `string`                                                                                                                                                                                                                                                                                                                                          | no       | —       | Optional ISO timestamp after which a pending approval is treated as expired.                                                                                              |
| `idempotencyKey`     | `string`                                                                                                                                                                                                                                                                                                                                          | yes      | —       | Idempotency key that makes repeated decisions durable.                                                                                                                    |
| `operation`          | { argsPreview?: `unknown`; command: `string`; filesTouched?: `string`[]; kind: `"command"` } \| { argsPreview?: `unknown`; filesTouched: `string`[]; kind: `"file-write"` } \| { argsPreview?: `unknown`; diff: `string`; filesTouched?: `string`[]; kind: `"patch"` } \| { argsPreview?: `unknown`; filesTouched?: `string`[]; kind: `"other"` } | yes      | —       | Operation details shown to the approver.                                                                                                                                  |
| `policyVersion`      | `string`                                                                                                                                                                                                                                                                                                                                          | yes      | —       | Policy version that produced the approval request.                                                                                                                        |
| `sandbox`            | { name: `string`; provider: `string`; workingDir: `string` }                                                                                                                                                                                                                                                                                      | no       | —       | Optional sandbox context in which the operation will run.                                                                                                                 |
| `snapshotId`         | `string`                                                                                                                                                                                                                                                                                                                                          | no       | —       | Snapshot identifier for the pending approval context.                                                                                                                     |
| `state`              | `"pending"` \| `"approved"` \| `"approved_with_edits"` \| `"denied"` \| `"expired"` \| `"cancelled"`                                                                                                                                                                                                                                              | yes      | —       | Persisted approval state.                                                                                                                                                 |
| `tool`               | { name: `string`; risk: `"low"` \| `"medium"` \| `"high"` }                                                                                                                                                                                                                                                                                       | yes      | —       | Tool requesting approval.                                                                                                                                                 |
| `onapprove`          | `(opaque)`                                                                                                                                                                                                                                                                                                                                        | no       | —       | Called when the approver accepts the operation as presented. Not expressible in JSON Schema; see the component types for the signature.                                   |
| `onapprovewithedits` | `(opaque)`                                                                                                                                                                                                                                                                                                                                        | no       | —       | Called with parsed JSON arguments when the approver accepts edited arguments. Not expressible in JSON Schema; see the component types for the signature.                  |
| `oncancel`           | `(opaque)`                                                                                                                                                                                                                                                                                                                                        | no       | —       | Called when the approver cancels the approval prompt. Not expressible in JSON Schema; see the component types for the signature.                                          |
| `ondeny`             | `(opaque)`                                                                                                                                                                                                                                                                                                                                        | no       | —       | Called when the approver denies the operation. Not expressible in JSON Schema; see the component types for the signature.                                                 |
| `onremember`         | `(opaque)`                                                                                                                                                                                                                                                                                                                                        | no       | —       | Called when the approver asks the host application to remember the decision. Not expressible in JSON Schema; see the component types for the signature.                   |
| `onresolve`          | `(opaque)`                                                                                                                                                                                                                                                                                                                                        | no       | —       | Called for approve, approve-with-edits, deny, and cancel with the complete resolution payload. Not expressible in JSON Schema; see the component types for the signature. |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
