<script lang="ts">
  import { Button } from '../button/index.ts';
  import { Dropdown } from './index.ts';

  type FixtureProps = {
    open?: boolean;
  };

  let { open = false }: FixtureProps = $props();
  let menuOpen = $derived(open);
</script>

<div class="dropdown-fixture">
  <Dropdown id="visual-fixture-dropdown" bind:open={menuOpen} placement="bottom-start">
    {#snippet trigger()}
      <Button variant="secondary">Document actions</Button>
    {/snippet}
    <Dropdown.Item>Copy link</Dropdown.Item>
    <Dropdown.Item>Duplicate</Dropdown.Item>
    <Dropdown.Item variant="danger">Delete</Dropdown.Item>
  </Dropdown>
</div>

<style>
  .dropdown-fixture {
    min-block-size: 12rem;
  }
</style>
