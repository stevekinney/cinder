<script lang="ts" module>
  /**
   * @cinder
   * @category domain
   * @status stable
   * @purpose Marketing metrics section that wraps StatisticGroup/Statistic to present headline numbers with optional trend indicators.
   * @tag marketing
   * @tag metrics
   * @tag stats
   * @useWhen Showing key outcomes such as uptime, customers, revenue, or latency in landing-page copy.
   * @useWhen Presenting a short metrics band between hero/features and pricing sections.
   * @avoidWhen Comparing plan pricing and feature lists across tiers. | pricing-section
   * @avoidWhen Rendering freeform cards that are not structured numeric metrics. | feature-section
   * @related statistic, statistic-group, pricing-section, feature-section, container
   */
  export type {
    StatisticsSectionItem,
    StatisticsSectionProps,
  } from './statistics-section.types.ts';
</script>

<script lang="ts">
  import Container from '../container/container.svelte';
  import Statistic from '../statistic/statistic.svelte';
  import StatisticGroup from '../statistic-group/statistic-group.svelte';
  import { classNames } from '../../utilities/class-names.ts';

  import type { StatisticsSectionProps } from './statistics-section.types.ts';

  let {
    as = 'section',
    title,
    description,
    stats,
    columns = 'auto',
    variant = 'cards',
    label = 'Key metrics',
    maxWidth = 'wide',
    class: className,
    ...rest
  }: StatisticsSectionProps = $props();

  function statChange(
    item: StatisticsSectionProps['stats'][number],
  ):
    | { value: string; direction: NonNullable<typeof item.changeDirection>; description?: string }
    | undefined {
    if (!item.changeValue || !item.changeDirection) return undefined;
    return item.changeDescription
      ? {
          value: item.changeValue,
          direction: item.changeDirection,
          description: item.changeDescription,
        }
      : { value: item.changeValue, direction: item.changeDirection };
  }

  function optionalStatisticProps(item: StatisticsSectionProps['stats'][number]): {
    change?: {
      value: string;
      direction: NonNullable<typeof item.changeDirection>;
      description?: string;
    };
  } {
    const change = statChange(item);
    return change ? { change } : {};
  }
</script>

<svelte:element this={as} class={classNames('cinder-statistics-section', className)} {...rest}>
  <Container {maxWidth}>
    <div class="cinder-statistics-section__inner">
      {#if title}
        <header class="cinder-statistics-section__header">
          <h2 class="cinder-statistics-section__title">{title}</h2>
          {#if description}
            <p class="cinder-statistics-section__description">{description}</p>
          {/if}
        </header>
      {/if}

      <StatisticGroup {columns} {variant} {label}>
        {#each stats as item, index (`${item.label}-${index}`)}
          <Statistic label={item.label} value={item.value} {...optionalStatisticProps(item)} />
        {/each}
      </StatisticGroup>
    </div>
  </Container>
</svelte:element>
