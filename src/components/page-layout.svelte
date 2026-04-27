<script lang="ts" module>
  import type { Snippet } from 'svelte';

  export type PageLayoutProps = {
    title: string;
    class?: string;
    actions?: Snippet;
    children: Snippet;
  };
</script>

<script lang="ts">
  import { classNames } from '../utilities/class-names.ts';

  let { title, class: className, actions, children }: PageLayoutProps = $props();
</script>

<div class={classNames('cinder-page-layout', className)}>
  <header class="cinder-page-layout-header">
    <div class="cinder-page-layout-header-row">
      <h1 class="cinder-page-layout-title">{title}</h1>
      {#if actions}
        <div class="cinder-page-layout-actions">
          {@render actions()}
        </div>
      {/if}
    </div>
  </header>

  <div class="cinder-page-layout-content">
    {@render children()}
  </div>
</div>
