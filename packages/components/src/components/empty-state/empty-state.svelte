<script lang="ts" module>
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
