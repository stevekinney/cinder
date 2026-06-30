# StatsSection

Renders a key-metrics section by composing StatGroup and Stat cards.

## Usage

```svelte
<script lang="ts">
  import StatsSection from '@lostgradient/cinder/stats-section';

  const stats = [
    { label: 'Active users', value: '12,400' },
    { label: 'Avg. response time', value: '180ms' },
    { label: 'Uptime', value: '99.99%' },
  ];
</script>

<StatsSection title="Performance at a glance" {stats} />
```

## Props

<!-- generated:props:start -->

| Prop          | Type                                                                                                                                                            | Required | Default         | Description                                       |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | --------------- | ------------------------------------------------- |
| `as`          | `"section"` \| `"div"`                                                                                                                                          | no       | `"section"`     | Wrapper element tag.                              |
| `class`       | `string`                                                                                                                                                        | no       | —               | Custom class merged with `.cinder-stats-section`. |
| `columns`     | `1` \| `2` \| `3` \| `4` \| `"auto"`                                                                                                                            | no       | `"auto"`        | Columns forwarded to StatGroup.                   |
| `description` | `string`                                                                                                                                                        | no       | —               | Optional section description text.                |
| `label`       | `string`                                                                                                                                                        | no       | `"Key metrics"` | Accessible label forwarded to StatGroup.          |
| `maxWidth`    | `"prose"` \| `"narrow"` \| `"wide"` \| `"full"`                                                                                                                 | no       | `"wide"`        | Max width token forwarded to Container.           |
| `stats`       | ({ changeDescription?: `string`; changeDirection?: `"up"` \| `"down"` \| `"neutral"`; changeValue?: `string`; label: `string`; value: `string` \| `number` })[] | yes      | —               | Stats to render via StatGroup + Stat.             |
| `title`       | `string`                                                                                                                                                        | no       | —               | Optional section heading text.                    |
| `variant`     | `"default"` \| `"cards"` \| `"shared-borders"`                                                                                                                  | no       | `"cards"`       | Variant forwarded to StatGroup.                   |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
