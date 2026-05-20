<script lang="ts">
  import { SideNavigation, SideNavigationItem } from '../../../components/src/index.ts';
  import { buildShellHref } from './routing.ts';

  type Props = {
    components: string[];
    currentComponent: string;
    onSelect: (componentName: string) => void;
  };

  let { components, currentComponent, onSelect }: Props = $props();

  function handleClick(event: MouseEvent, componentName: string): void {
    // Only intercept plain left-clicks. Modified clicks (cmd/ctrl/shift/alt)
    // and middle-clicks fall through to native browser navigation so
    // open-in-new-tab, "Copy Link Address", and status-bar URL preview all
    // continue to work like regular anchor semantics.
    if (event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onSelect(componentName);
  }
</script>

<!--
  The top bar is fixed and 52px tall. The sidebar is also fixed but its
  top edge starts below the top bar so it never overlaps the wordmark or
  toolbar controls. The height and top values reference the same
  --cinder-top-bar-height token that the top bar declares.
-->
<div class="sidebar-chrome">
  <SideNavigation ariaLabel="Components">
    {#each components as name (name)}
      <SideNavigationItem
        href={buildShellHref(name)}
        active={name === currentComponent}
        onclick={(event) => handleClick(event, name)}
      >
        {name}
      </SideNavigationItem>
    {/each}
  </SideNavigation>
</div>

<style>
  .sidebar-chrome {
    --cinder-top-bar-height: 52px;

    /* stylelint-disable-next-line csstools/use-logical */
    width: 220px;
    min-width: 220px;
    /* Push the sidebar below the fixed top bar */
    height: calc(100vh - var(--cinder-top-bar-height));
    position: fixed;
    top: var(--cinder-top-bar-height);
    left: 0;
    background: var(--cinder-surface);
    /* Playground sidebar is physically anchored at left: 0; keep the
       separator physical so it stays adjacent to the main content. */
    /* stylelint-disable-next-line csstools/use-logical */
    border-right: 1px solid var(--cinder-border);
    overflow-y: auto;
  }
</style>
