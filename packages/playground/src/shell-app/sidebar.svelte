<script lang="ts">
  import { SideNavigation } from '../../../components/src/index.ts';
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
      {@const isActive = name === currentComponent}
      <li class="cinder-side-navigation__item">
        <a
          href={buildShellHref(name)}
          aria-current={isActive ? 'page' : undefined}
          onclick={(event) => handleClick(event, name)}
        >
          {name}
        </a>
      </li>
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

  .sidebar-chrome :global(ul) {
    padding: 8px 0;
  }

  .sidebar-chrome :global(li a) {
    display: block;
    padding: 6px 16px;
    text-decoration: none;
    color: var(--cinder-text);
    border-radius: 4px;
    margin: 1px 8px;
    transition: background var(--cinder-duration-fast) var(--cinder-ease-standard);
  }

  .sidebar-chrome :global(li a:hover) {
    background: var(--cinder-surface-hover);
  }

  .sidebar-chrome :global(li a[aria-current='page']) {
    background: color-mix(in oklch, var(--cinder-accent), transparent 85%);
    color: var(--cinder-accent);
    font-weight: 600;
  }
</style>
