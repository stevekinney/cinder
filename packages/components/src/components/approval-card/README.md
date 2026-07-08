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

`onresolve` is the single decision contract. It fires for every action —
Approve, Approve with edits, Deny, and Dismiss — with the complete
`ApprovalResolution` payload: the selected `decision`, parsed `editedArgs` for
edited approvals, optional `reason` text, and the `remember` checkbox state.
Action buttons render only while the request is actionable and `onresolve` is
wired; a card without the callback is purely presentational.

`decision: 'deny'` means the approver actively refused the operation.
`decision: 'cancel'` (the Dismiss button) means the prompt was dismissed
without a decision.

## Operation rendering

- `tool.name` renders in monospace inside the title, distinguishing the
  identifier from the surrounding sentence.
- `tool.risk` renders as a stacked-bar signal icon (bar count scales with
  risk, so it doesn't rely on color alone) with a tooltip carrying the risk
  label; the icon itself is the accessible name via `aria-label`.
- `operation.kind: 'command'` renders the command as a syntax-highlighted
  shell `CodeBlock`.
- `operation.kind: 'patch'` renders the supplied unified patch as a
  syntax-highlighted diff.
- `operation.filesTouched` renders one row per unique path, each with a copy
  button. Duplicate paths are collapsed.
- `operation.argsPreview` renders through `PayloadInspector`; oversized
  previews are replaced with a bounded truncation notice before rendering.
- `env` renders variable names only, as plain text. Values are not accepted
  and are stripped if a caller accidentally passes `NAME=value`.
- Sandbox context, environment names, and the policy version / idempotency
  key / snapshot id all live in a single collapsed "Details" disclosure so
  supporting context stays out of the approver's way until they ask for it.
  The action buttons are the last element of a pending card.

## Approval states

Pending requests render action buttons. Non-pending requests render a
read-only, state-tinted summary. When `expiresAt` passes while `state` is
still `pending`, the effective state becomes `expired`, actions disappear, and
no callback fires automatically.

## Heading levels

The card title defaults to an `h3` with section headings one level deeper.
Pass `headingLevel` to fit the card into the host page's document outline,
matching the `Card` convention.

## Props

<!-- generated:props:start -->

| Prop             | Type                                                                                                                                                                                                                                                                                                                                              | Required | Default | Description                                                                                                                                                                |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`          | `string`                                                                                                                                                                                                                                                                                                                                          | no       | —       | Additional CSS classes applied to the root element.                                                                                                                        |
| `editableArgs`   | `boolean`                                                                                                                                                                                                                                                                                                                                         | no       | —       | Whether approving with edited JSON arguments is available. Default `false`.                                                                                                |
| `env`            | `string`[]                                                                                                                                                                                                                                                                                                                                        | no       | —       | Environment variable names only. Values are ignored if accidentally supplied as `NAME=value`.                                                                              |
| `expiresAt`      | `string`                                                                                                                                                                                                                                                                                                                                          | no       | —       | Optional ISO timestamp after which a pending approval is treated as expired.                                                                                               |
| `headingLevel`   | `2` \| `3` \| `4` \| `5` \| `6`                                                                                                                                                                                                                                                                                                                   | no       | —       | Heading level for the card title; section headings render one level deeper. Default `3`.                                                                                   |
| `idempotencyKey` | `string`                                                                                                                                                                                                                                                                                                                                          | yes      | —       | Idempotency key that makes repeated decisions durable.                                                                                                                     |
| `operation`      | { argsPreview?: `unknown`; command: `string`; filesTouched?: `string`[]; kind: `"command"` } \| { argsPreview?: `unknown`; filesTouched: `string`[]; kind: `"file-write"` } \| { argsPreview?: `unknown`; diff: `string`; filesTouched?: `string`[]; kind: `"patch"` } \| { argsPreview?: `unknown`; filesTouched?: `string`[]; kind: `"other"` } | yes      | —       | Operation details shown to the approver.                                                                                                                                   |
| `policyVersion`  | `string`                                                                                                                                                                                                                                                                                                                                          | yes      | —       | Policy version that produced the approval request.                                                                                                                         |
| `sandbox`        | { name: `string`; provider: `string`; workingDir: `string` }                                                                                                                                                                                                                                                                                      | no       | —       | Optional sandbox context in which the operation will run.                                                                                                                  |
| `snapshotId`     | `string`                                                                                                                                                                                                                                                                                                                                          | no       | —       | Snapshot identifier for the pending approval context.                                                                                                                      |
| `state`          | `"pending"` \| `"approved"` \| `"approved_with_edits"` \| `"denied"` \| `"expired"` \| `"cancelled"`                                                                                                                                                                                                                                              | yes      | —       | Persisted approval state.                                                                                                                                                  |
| `tool`           | { name: `string`; risk: `"low"` \| `"medium"` \| `"high"` }                                                                                                                                                                                                                                                                                       | yes      | —       | Tool requesting approval.                                                                                                                                                  |
| `onresolve`      | `(opaque)`                                                                                                                                                                                                                                                                                                                                        | no       | —       | Called for approve, approve-with-edits, deny, and dismiss with the complete resolution payload. Not expressible in JSON Schema; see the component types for the signature. |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
