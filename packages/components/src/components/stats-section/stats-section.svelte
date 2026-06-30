<script lang="ts" module>
  /**
   * @cinder
   * @category domain
   * @status stable
   * @purpose Marketing metrics section that wraps StatGroup/Stat to present headline numbers with optional trend indicators.
   * @tag marketing
   * @tag metrics
   * @tag stats
   * @useWhen Showing key outcomes such as uptime, customers, revenue, or latency in landing-page copy.
   * @useWhen Presenting a short metrics band between hero/features and pricing sections.
   * @avoidWhen Comparing plan pricing and feature lists across tiers. | pricing-section
   * @avoidWhen Rendering freeform cards that are not structured numeric metrics. | feature-section
   * @related stat, stat-group, pricing-section, feature-section, container
   */
  export type { StatsSectionItem, StatsSectionProps } from './stats-section.types.ts';
</script>

<script lang="ts">
  import Container from '../container/container.svelte';
  import Stat from '../stat/stat.svelte';
  import StatGroup from '../stat-group/stat-group.svelte';
  import { classNames } from '../../utilities/class-names.ts';

  import type { StatsSectionProps } from './stats-section.types.ts';

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
  }: StatsSectionProps = $props();

  function statChange(
    item: StatsSectionProps['stats'][number],
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

  function optionalStatProps(item: StatsSectionProps['stats'][number]): {
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

<svelte:element this={as} class={classNames('cinder-stats-section', className)} {...rest}>
  <Container {maxWidth}>
    <div class="cinder-stats-section__inner">
      {#if title}
        <header class="cinder-stats-section__header">
          <h2 class="cinder-stats-section__title">{title}</h2>
          {#if description}
            <p class="cinder-stats-section__description">{description}</p>
          {/if}
        </header>
      {/if}

      <StatGroup {columns} {variant} {label}>
        {#each stats as item, index (`${item.label}-${index}`)}
          <Stat label={item.label} value={item.value} {...optionalStatProps(item)} />
        {/each}
      </StatGroup>
    </div>
  </Container>
</svelte:element>
