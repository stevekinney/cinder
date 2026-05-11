<script lang="ts">
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

<nav aria-label="Components">
  <div class="nav-header">cinder</div>
  <ul>
    {#each components as name (name)}
      {@const isActive = name === currentComponent}
      <li>
        <a
          href={buildShellHref(name)}
          aria-current={isActive ? 'page' : undefined}
          onclick={(event) => handleClick(event, name)}
        >
          {name}
        </a>
      </li>
    {/each}
  </ul>
</nav>

<style>
  nav {
    width: 220px;
    min-width: 220px;
    height: 100vh;
    position: fixed;
    top: 0;
    left: 0;
    background: #fff;
    border-right: 1px solid #e5e5e5;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }

  .nav-header {
    padding: 16px;
    font-weight: 700;
    font-size: 13px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #666;
    border-bottom: 1px solid #e5e5e5;
  }

  ul {
    list-style: none;
    padding: 8px 0;
    margin: 0;
    flex: 1;
  }

  li {
    margin: 0;
  }

  ul li a {
    display: block;
    padding: 6px 16px;
    text-decoration: none;
    color: #333;
    border-radius: 4px;
    margin: 1px 8px;
    transition: background 0.1s;
  }

  ul li a:hover {
    background: #f0f0f0;
  }

  ul li a[aria-current='page'] {
    background: #e8f0fe;
    color: #1a56db;
    font-weight: 600;
  }
</style>
