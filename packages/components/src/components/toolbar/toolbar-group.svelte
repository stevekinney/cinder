<script lang="ts" module>
  /**
   * @cinder
   * @category action
   * @status stable
   * @purpose Compound child for Toolbar that groups related controls and owns the separator boundary between groups.
   * @tag action
   * @tag grouping
   * @useWhen Clustering related toolbar controls such as a viewport preset control plus its numeric width field.
   * @useWhen Letting the toolbar itself draw separators between adjacent groups instead of hand-placing dividers.
   * @avoidWhen Rendering a standalone action group outside a Toolbar — use button-group or plain layout primitives instead.
   * @related toolbar, button-group
   */
  export type { ToolbarGroupProps } from './toolbar.types.ts';
</script>

<script lang="ts">
  import type { ToolbarGroupProps } from './toolbar.types.ts';

  import { classNames } from '../../utilities/class-names.ts';

  let { class: className, orientation, children, role, ...rest }: ToolbarGroupProps = $props();

  const normalizedAriaLabel = $derived(
    typeof rest['aria-label'] === 'string' && rest['aria-label'].trim().length > 0
      ? rest['aria-label']
      : undefined,
  );
  const normalizedAriaLabelledBy = $derived(
    typeof rest['aria-labelledby'] === 'string' && rest['aria-labelledby'].trim().length > 0
      ? rest['aria-labelledby']
      : undefined,
  );
  const hasAccessibleName = $derived(Boolean(normalizedAriaLabel || normalizedAriaLabelledBy));
</script>

<div
  {...rest}
  aria-label={normalizedAriaLabel}
  aria-labelledby={normalizedAriaLabelledBy}
  role={role ?? (hasAccessibleName ? 'group' : undefined)}
  class={classNames('cinder-toolbar__group', className)}
  data-cinder-toolbar-group=""
  data-cinder-orientation={orientation}
>
  {@render children()}
</div>
