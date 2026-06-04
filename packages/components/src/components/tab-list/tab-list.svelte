<script lang="ts" module>
  /**
   * @cinder
   * @category navigation
   * @status stable
   * @purpose Tablist container inside a tabs composite that wraps tab triggers and exposes the ARIA tablist role with orientation metadata.
   * @tag navigation
   * @tag tabs
   * @useWhen Wrapping a row or column of tab triggers inside a tabs ancestor.
   * @useWhen Providing the accessible label or labelledby reference for the tablist landmark.
   * @avoidWhen Used outside a tabs ancestor — the component throws at construction.
   * @avoidWhen Rendering tab-panel content — keep panels as siblings outside the tab-list.
   * @related tabs, tab, tab-panel
   */
  export type { TabListProps } from './tab-list.types.ts';
</script>

<script lang="ts">
  import type { TabListProps } from './tab-list.types.ts';

  import { getTabsContext } from '../tabs/tabs-context.ts';
  import { classNames } from '../../utilities/class-names.ts';

  let { label, labelledBy, class: className, children }: TabListProps = $props();

  const tabs = getTabsContext();
</script>

<div
  role="tablist"
  class={classNames('cinder-tab-list', className)}
  data-cinder-orientation={tabs.orientation}
  aria-label={label}
  aria-labelledby={labelledBy}
  aria-orientation={tabs.orientation}
>
  {@render children()}
</div>
