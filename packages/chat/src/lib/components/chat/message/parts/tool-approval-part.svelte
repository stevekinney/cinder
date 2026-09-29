<script lang="ts" module>
  import type { ApprovalResolution } from '@lostgradient/cinder';
  import type { ToolApprovalMessagePart } from '../../utilities/types.ts';

  export type ToolApprovalPartProps = {
    /** The tool-approval render part. */
    part: ToolApprovalMessagePart;
    /** Called when the user resolves the approval. */
    onApprovalResolve?:
      ((toolCallId: string, resolution: ApprovalResolution) => void | Promise<void>) | undefined;
  };
</script>

<script lang="ts">
  import { ApprovalCard } from '@lostgradient/cinder';
  import type { ApprovalCardProps } from '@lostgradient/cinder';

  let { part, onApprovalResolve }: ToolApprovalPartProps = $props();

  const canResolve = $derived(
    part.state === 'pending' && !part.resolutionInFlight && onApprovalResolve !== undefined,
  );
  const cardProps = $derived.by(() => {
    const props: ApprovalCardProps = {
      tool: {
        name: part.toolName,
        risk: part.action.risk,
      },
      operation: part.action.operation,
      policyVersion: part.action.policyVersion,
      idempotencyKey: part.action.idempotencyKey,
      state: part.state,
      headingLevel: 4,
    };

    if (part.action.sandbox !== undefined) props.sandbox = part.action.sandbox;
    if (part.action.env !== undefined) props.env = part.action.env;
    if (part.action.snapshotId !== undefined) props.snapshotId = part.action.snapshotId;
    if (part.action.expiresAt !== undefined) props.expiresAt = part.action.expiresAt;
    if (part.action.editableArgs !== undefined) props.editableArgs = part.action.editableArgs;

    return props;
  });

  function resolveApproval(resolution: ApprovalResolution): void {
    if (!canResolve) return;
    onApprovalResolve?.(part.toolCallId, resolution);
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape' || !canResolve) return;
    event.preventDefault();
    resolveApproval({ decision: 'cancel', remember: false });
  }
</script>

<ApprovalCard
  {...cardProps}
  data-cinder-tool-approval
  tabindex={-1}
  onkeydown={handleKeydown}
  {...canResolve ? { onResolve: resolveApproval } : {}}
/>
