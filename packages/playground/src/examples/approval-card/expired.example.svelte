<script lang="ts" module>
  export const title = 'Expired approval';
  export const description =
    'A read-only approval request whose pending decision window has expired.';
</script>

<script lang="ts">
  import { ApprovalCard } from '@lostgradient/cinder/approval-card';
</script>

<ApprovalCard
  tool={{ name: 'write-file', risk: 'low' }}
  operation={{
    kind: 'file-write',
    filesTouched: ['packages/components/src/components/approval-card/README.md'],
    argsPreview: {
      mode: 'append',
      bytes: 384,
    },
  }}
  policyVersion="policy-2026-06"
  idempotencyKey="approval-expired-01"
  expiresAt="2026-06-24T11:00:00.000Z"
  state="pending"
/>
