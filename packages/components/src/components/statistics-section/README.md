# StatisticsSection

Renders a key-metrics section by composing StatisticGroup and Statistic cards.

## Usage

```svelte
<script lang="ts">
  import StatisticsSection from '@lostgradient/cinder/statistics-section';

  const stats = [
    { label: 'Active users', value: '12,400' },
    { label: 'Avg. response time', value: '180ms' },
    { label: 'Uptime', value: '99.99%' },
  ];
</script>

<StatisticsSection title="Performance at a glance" {stats} />
```

## Props

<!-- generated:props:start -->

| Prop          | Type                                                                                                                                                            | Required | Default         | Description                                            |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | --------------- | ------------------------------------------------------ |
| `as`          | `"section"` \| `"div"`                                                                                                                                          | no       | `"section"`     | Wrapper element tag.                                   |
| `class`       | `string`                                                                                                                                                        | no       | —               | Custom class merged with `.cinder-statistics-section`. |
| `columns`     | `1` \| `2` \| `3` \| `4` \| `"auto"`                                                                                                                            | no       | `"auto"`        | Columns forwarded to StatisticGroup.                   |
| `description` | `string`                                                                                                                                                        | no       | —               | Optional section description text.                     |
| `label`       | `string`                                                                                                                                                        | no       | `"Key metrics"` | Accessible label forwarded to StatisticGroup.          |
| `maxWidth`    | `"prose"` \| `"narrow"` \| `"wide"` \| `"full"`                                                                                                                 | no       | `"wide"`        | Max width token forwarded to Container.                |
| `stats`       | ({ changeDescription?: `string`; changeDirection?: `"up"` \| `"down"` \| `"neutral"`; changeValue?: `string`; label: `string`; value: `string` \| `number` })[] | yes      | —               | Statistics to render via StatisticGroup + Statistic.   |
| `title`       | `string`                                                                                                                                                        | no       | —               | Optional section heading text.                         |
| `variant`     | `"default"` \| `"cards"` \| `"shared-borders"`                                                                                                                  | no       | `"cards"`       | Variant forwarded to StatisticGroup.                   |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
