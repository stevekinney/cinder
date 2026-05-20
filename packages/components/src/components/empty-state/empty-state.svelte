<script lang="ts" module>
  /**
   * @cinder
   * @category feedback
   * @status stable
   * @purpose Centered placeholder with optional icon, title, description, and call-to-action for views that have no data to render.
   * @tag feedback
   * @tag empty
   * @useWhen Communicating that a list, table, or workspace has no items yet and suggesting a next step.
   * @useWhen Replacing a primary content region after a filter or search returns no results.
   * @avoidWhen Indicating that data is still loading — use skeleton or spinner instead.
   * @avoidWhen Reporting a transient error — use alert, banner, or toast-region.
   * @related skeleton, spinner
   */
  export type { EmptyStateProps } from './empty-state.types.ts';
</script>

<script lang="ts">
  import type { EmptyStateProps } from './empty-state.types.ts';
  import { classNames } from '../../utilities/class-names.ts';

  let { title, description, class: className, icon, action }: EmptyStateProps = $props();
</script>

<div class={classNames('cinder-empty-state', className)}>
  {#if icon}
    <div class="cinder-empty-state-icon" aria-hidden="true">
      {@render icon()}
    </div>
  {/if}
  <h3 class="cinder-empty-state-title">{title}</h3>
  {#if description}
    <p class="cinder-empty-state-description">{description}</p>
  {/if}
  {#if action}
    <div class="cinder-empty-state-action">
      {@render action()}
    </div>
  {/if}
</div>
