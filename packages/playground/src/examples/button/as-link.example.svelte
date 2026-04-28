<script lang="ts" module>
  export const title = 'Button as link';
  export const description = 'Passing href renders an anchor element with button styling.';
</script>

<script lang="ts">
  import { Button } from '../../../../components/src/index.ts';
</script>

<div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
  <Button href="https://svelte.dev" target="_blank" rel="noopener noreferrer" label="Svelte docs" />
  <Button href="#" variant="ghost" label="Internal link" />
</div>
