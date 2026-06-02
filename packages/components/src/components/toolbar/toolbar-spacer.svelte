<script lang="ts" module>
  /**
   * @cinder
   * @category action
   * @status stable
   * @purpose Compound child for Toolbar that grows to consume remaining inline space and pushes following groups to the far edge.
   * @tag action
   * @tag layout
   * @useWhen Separating leading controls from trailing utility actions inside a single Toolbar row.
   * @avoidWhen Creating vertical rhythm between stacked blocks — use spacer, stack, or inline layout primitives instead.
   * @related toolbar
   */
  export type { ToolbarSpacerProps } from './toolbar.types.ts';
</script>

<script lang="ts">
  import { DEV } from 'esm-env';

  import type { ToolbarSpacerProps } from './toolbar.types.ts';

  import { classNames } from '../../utilities/class-names.ts';

  let { class: className, flex = 1, ...rest }: ToolbarSpacerProps = $props();

  const resolvedFlex = $derived(
    typeof flex === 'number' && Number.isFinite(flex) && flex > 0 ? flex : 1,
  );

  $effect(() => {
    if (!DEV) return;
    if (typeof flex === 'number' && Number.isFinite(flex) && flex > 0) return;
    console.warn(
      '[cinder/Toolbar.Spacer] `flex` must be a positive finite number. Falling back to 1.',
    );
  });
</script>

<div
  {...rest}
  aria-hidden="true"
  class={classNames('cinder-toolbar__spacer', className)}
  data-cinder-toolbar-spacer=""
  style={`flex-grow: ${resolvedFlex};`}
></div>
