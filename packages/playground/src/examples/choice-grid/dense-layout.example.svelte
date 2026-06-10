<script lang="ts" module>
  export const title = 'Dense phone layout';
  export const description =
    'Fixed 2-column grid with compact cells — suitable for narrow mobile viewports.';
</script>

<script lang="ts">
  import { ChoiceGrid } from '@lostgradient/cinder/choice-grid';

  let selected = $state<string | null>(null);
</script>

<div style="max-width: 20rem; margin: 0 auto;">
  <ChoiceGrid
    ariaLabel="Choose a difficulty"
    bind:value={selected}
    columns="responsive"
    minColumnWidth="8rem"
  >
    <ChoiceGrid.Item value="easy">Easy</ChoiceGrid.Item>
    <ChoiceGrid.Item value="medium">Medium</ChoiceGrid.Item>
    <ChoiceGrid.Item value="hard">Hard</ChoiceGrid.Item>
    <ChoiceGrid.Item value="expert">Expert</ChoiceGrid.Item>
  </ChoiceGrid>
</div>
