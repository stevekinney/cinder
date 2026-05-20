<script lang="ts" module>
  export const title = 'Basic divider';
  export const description = 'Default horizontal rule, subtle tone.';
</script>

<script lang="ts">
  import { Divider } from '../../../../components/src/index.ts';
</script>

<div style="display: flex; flex-direction: column; gap: 12px; padding: 16px;">
  <span>Section A</span>
  <Divider />
  <span>Section B</span>
</div>
