<script lang="ts" module>
  export const title = 'Basic view switcher';
  export const description = 'Tabs for switching between editor, diff, and summary views.';
</script>

<script lang="ts">
  import { ViewSwitcher, type ViewType } from '../../../../components/src/index.ts';

  let view = $state<ViewType>('editor');
</script>

<div style="display: grid; gap: 0.75rem;">
  <ViewSwitcher id="playground-view-switcher" bind:value={view} />
  <p style="margin: 0; color: var(--cinder-text-muted);">Active view: {view}</p>
</div>
