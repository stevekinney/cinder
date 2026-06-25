<script lang="ts" module>
  export const title = 'Command approval';
  export const description =
    'A pending command approval with sandbox, policy, arguments, and masked environment names.';
</script>

<script lang="ts">
  import { ApprovalCard } from '@lostgradient/cinder/approval-card';
</script>

<ApprovalCard
  tool={{ name: 'deploy-cloud', risk: 'medium' }}
  sandbox={{
    provider: 'codex',
    name: 'workspace-write',
    workingDir: '/Users/stevekinney/Developer/cinder',
  }}
  operation={{
    kind: 'command',
    command: 'bun run --filter=@lostgradient/cinder validate',
    filesTouched: ['packages/components/src/components/approval-card/approval-card.svelte'],
    argsPreview: {
      package: '@lostgradient/cinder',
      dryRun: false,
    },
  }}
  env={['DATABASE_URL', 'OPENAI_API_KEY']}
  snapshotId="snapshot-01JZ8"
  policyVersion="policy-2026-06"
  idempotencyKey="approval-command-01"
  expiresAt="2026-06-24T12:30:00.000Z"
  state="pending"
  editableArgs={true}
  onApprove={() => undefined}
  onApproveWithEdits={() => undefined}
  onDeny={() => undefined}
  onRemember={() => undefined}
  onCancel={() => undefined}
/>
