<script lang="ts" module>
  export const title = 'Patch approval';
  export const description =
    'A high-risk patch approval that previews touched files, arguments, and the proposed diff.';
</script>

<script lang="ts">
  import { ApprovalCard } from '@lostgradient/cinder/approval-card';
</script>

<ApprovalCard
  tool={{ name: 'apply_patch', risk: 'high' }}
  sandbox={{
    provider: 'codex',
    name: 'workspace-write',
    workingDir: '/workspace/project',
  }}
  operation={{
    kind: 'patch',
    filesTouched: [
      'packages/components/src/components/run-step-timeline/run-step-timeline.svelte',
      'packages/components/src/components/run-step-timeline/run-step-timeline.types.ts',
    ],
    argsPreview: {
      strip: 0,
      files: 2,
    },
    diff: `--- a/run-step-timeline.types.ts
+++ b/run-step-timeline.types.ts
+@@
+ export type RunStepStatus =
+   | 'running'
++  | 'waiting_approval'
+   | 'succeeded';`,
  }}
  env={['CINDER_RELEASE_TOKEN']}
  snapshotId="snapshot-patch-01"
  policyVersion="policy-2026-06"
  idempotencyKey="approval-patch-01"
  state="pending"
  onapprove={() => undefined}
  ondeny={() => undefined}
  onremember={() => undefined}
  oncancel={() => undefined}
/>
