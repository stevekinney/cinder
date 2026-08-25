<script lang="ts">
  import Grid from '../../components/grid/grid.svelte';
  import GridItem from '../../components/grid-item/grid-item.svelte';

  let {
    outerRowEnd,
    innerRowEnd,
  }: {
    outerRowEnd?: number | string;
    innerRowEnd?: number | string;
  } = $props();
</script>

<Grid columns={2}>
  <GridItem {...outerRowEnd !== undefined ? { rowEnd: outerRowEnd } : {}} data-testid="outer-item">
    <Grid columns={2}>
      <GridItem
        {...innerRowEnd !== undefined ? { rowEnd: innerRowEnd } : {}}
        data-testid="inner-item"
      >
        Inner
      </GridItem>
    </Grid>
  </GridItem>
</Grid>
