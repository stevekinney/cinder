<script lang="ts" module>
  export const title = 'Basic dropdown';
  export const description = 'A button trigger with a list of menu items.';
</script>

<script lang="ts">
  import { Dropdown } from '../../../../components/src/index.ts';

  let open = $state(false);
</script>

<Dropdown bind:open>
  {#snippet trigger()}
    <button type="button">Options ▾</button>
  {/snippet}
  <ul role="menu" style="list-style: none; margin: 0; padding: 0.5rem 0; min-width: 160px;">
    <li role="menuitem" style="padding: 0.5rem 1rem; cursor: pointer;">Edit</li>
    <li role="menuitem" style="padding: 0.5rem 1rem; cursor: pointer;">Duplicate</li>
    <li
      role="menuitem"
      style="padding: 0.5rem 1rem; cursor: pointer; color: var(--cinder-text-danger);"
    >
      Delete
    </li>
  </ul>
</Dropdown>
