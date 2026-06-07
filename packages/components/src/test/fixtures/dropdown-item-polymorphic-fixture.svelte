<script lang="ts">
  import Dropdown from '../../components/dropdown/dropdown.svelte';
  import DropdownItem from '../../components/dropdown-item/dropdown-item.svelte';
  import DropdownMenu from '../../components/dropdown-menu/dropdown-menu.svelte';
  import DropdownTrigger from '../../components/dropdown-trigger/dropdown-trigger.svelte';

  let selected = $state('');
  let lastLinkKey = $state('');
</script>

<div>
  <Dropdown id="poly-menu">
    <DropdownTrigger class="trigger">Actions</DropdownTrigger>
    <DropdownMenu>
      <DropdownItem
        href="https://example.com"
        onclick={() => (selected = 'link')}
        onkeydown={(event) => (lastLinkKey = event.key)}
      >
        Link item
      </DropdownItem>
      <DropdownItem
        type="submit"
        name="action"
        value="logout"
        onclick={() => (selected = 'submit')}
      >
        Submit item
      </DropdownItem>
      <DropdownItem
        href="https://example.com"
        disabled
        onclick={() => (selected = 'disabled-link')}
      >
        Disabled link item
      </DropdownItem>
    </DropdownMenu>
  </Dropdown>

  <output>{selected}</output>
  <output data-testid="last-link-key">{lastLinkKey}</output>
</div>
