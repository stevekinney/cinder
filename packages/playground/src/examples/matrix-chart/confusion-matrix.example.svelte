<script lang="ts" module>
  export const title = 'Confusion matrix';
  export const description =
    'A 3-class confusion matrix showing predicted vs actual classification results.';
</script>

<script lang="ts">
  import { MatrixChart } from '@lostgradient/cinder/matrix-chart';

  const data = [
    { actual: 'Cat', predicted: 'Cat', count: 50 },
    { actual: 'Cat', predicted: 'Dog', count: 5 },
    { actual: 'Cat', predicted: 'Bird', count: 2 },
    { actual: 'Dog', predicted: 'Cat', count: 3 },
    { actual: 'Dog', predicted: 'Dog', count: 42 },
    { actual: 'Dog', predicted: 'Bird', count: 1 },
    { actual: 'Bird', predicted: 'Cat', count: 4 },
    { actual: 'Bird', predicted: 'Dog', count: 2 },
    { actual: 'Bird', predicted: 'Bird', count: 38 },
  ];
</script>

<MatrixChart
  label="Confusion matrix — Animal classifier"
  description="Rows are actual classes; columns are predicted classes. Diagonal cells are correct predictions."
  {data}
  xField="predicted"
  yField="actual"
  valueField="count"
  colorScale="sequential"
  dataTableVisibility="visible"
/>
