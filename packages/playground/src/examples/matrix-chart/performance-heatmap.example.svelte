<script lang="ts" module>
  export const title = 'Performance heatmap';
  export const description =
    'Team performance scores across quarters, colored with a diverging scale.';
</script>

<script lang="ts">
  import { MatrixChart } from '@lostgradient/cinder/matrix-chart';

  const data = [
    { team: 'Engineering', quarter: 'Q1', score: 82 },
    { team: 'Engineering', quarter: 'Q2', score: 91 },
    { team: 'Engineering', quarter: 'Q3', score: 78 },
    { team: 'Engineering', quarter: 'Q4', score: 95 },
    { team: 'Design', quarter: 'Q1', score: 74 },
    { team: 'Design', quarter: 'Q2', score: 68 },
    { team: 'Design', quarter: 'Q3', score: 85 },
    { team: 'Design', quarter: 'Q4', score: 90 },
    { team: 'Marketing', quarter: 'Q1', score: 60 },
    { team: 'Marketing', quarter: 'Q2', score: 72 },
    { team: 'Marketing', quarter: 'Q3', score: 65 },
    { team: 'Marketing', quarter: 'Q4', score: 88 },
    { team: 'Sales', quarter: 'Q1', score: 88 },
    { team: 'Sales', quarter: 'Q2', score: 93 },
    { team: 'Sales', quarter: 'Q3', score: 97 },
    { team: 'Sales', quarter: 'Q4', score: 84 },
  ];
</script>

<MatrixChart
  label="Team performance scores by quarter"
  description="Higher scores indicate stronger team performance for the period."
  {data}
  xField="quarter"
  yField="team"
  valueField="score"
  colorScale="sequential"
  dataTableVisibility="visible"
/>
