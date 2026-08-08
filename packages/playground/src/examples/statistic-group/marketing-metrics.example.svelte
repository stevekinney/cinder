<script lang="ts" module>
  export const title = 'Marketing metrics';
  export const description =
    'A landing-page KPI band recipe: Container frames heading copy above StatisticGroup in the cards variant, with fully-worded change labels.';
</script>

<script lang="ts">
  import { Container } from '@lostgradient/cinder/container';
  import { StatisticGroup } from '@lostgradient/cinder/statistic-group';
</script>

<section style="padding-block: var(--cinder-space-10);">
  <Container maxWidth="wide">
    <div style="display: grid; gap: var(--cinder-space-6);">
      <header style="display: grid; gap: var(--cinder-space-2); max-inline-size: 60ch;">
        <h2 style="margin: 0;">Outcomes teams achieve with Cinder</h2>
        <p style="margin: 0; color: var(--cinder-text-muted);">
          Measured improvements after standardizing on shared UI patterns.
        </p>
      </header>

      <StatisticGroup label="Key metrics" variant="cards">
        <StatisticGroup.Statistic label="Uptime" value="99.99%" />
        <StatisticGroup.Statistic
          label="Deploys / month"
          value={420}
          change={{
            value: '+18%',
            direction: 'up',
            description: 'vs last quarter',
            label: 'Up 18% versus last quarter',
          }}
        />
        <StatisticGroup.Statistic
          label="Mean time to ship"
          value="2.4 days"
          change={{
            value: '-11%',
            direction: 'down',
            description: 'vs last quarter',
            label: 'Down 11% versus last quarter',
          }}
        />
      </StatisticGroup>
    </div>
  </Container>
</section>
