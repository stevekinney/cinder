<script lang="ts" module>
  export const title = 'Long labels and narrow widths';
  export const description =
    'Long item labels truncate with an ellipsis rather than forcing the tree wider than its container. The full text stays available to assistive tech via the visually-hidden label. Resize narrow to see truncation; rows keep a comfortable touch target.';
</script>

<script lang="ts">
  import { Tree } from '@lostgradient/cinder/tree';

  let expandedIds = $state<string[]>(['reports']);
</script>

<!-- Constrained width to demonstrate truncation without needing a viewport resize. -->
<div
  style="max-inline-size: 18rem; border: 1px solid var(--cinder-border); border-radius: var(--cinder-radius-md); padding: var(--cinder-space-2, 0.5rem);"
>
  <Tree aria-label="Documents" bind:expandedIds>
    <Tree.Item id="reports" label="Quarterly financial reports and supporting appendices" branch>
      <Tree.Item
        id="q1"
        label="Q1 2026 — revenue, expenses, and reconciliation worksheet (final, approved)"
      />
      <Tree.Item id="q2" label="Q2 2026 — preliminary figures pending audit committee sign-off" />
    </Tree.Item>
    <Tree.Item id="readme" label="A short label" />
  </Tree>
</div>
