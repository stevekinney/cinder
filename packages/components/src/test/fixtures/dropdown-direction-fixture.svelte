<script lang="ts">
  import type { TextDirection } from '../../_internal/locale-context.ts';
  import Dropdown from '../../components/dropdown/dropdown.svelte';
  import DropdownItem from '../../components/dropdown-item/dropdown-item.svelte';
  import DropdownMenu from '../../components/dropdown-menu/dropdown-menu.svelte';
  import DropdownTrigger from '../../components/dropdown-trigger/dropdown-trigger.svelte';
  import LocaleProvider from '../../components/locale-provider/locale-provider.svelte';

  let {
    providerDirection = 'rtl',
    localDirection,
    menuDirection,
  }: {
    providerDirection?: TextDirection;
    localDirection?: TextDirection | undefined;
    menuDirection?: TextDirection | 'auto' | undefined;
  } = $props();
</script>

<LocaleProvider direction={providerDirection}>
  {#if localDirection}
    <div dir={localDirection}>
      <Dropdown id="provider-direction-menu">
        <DropdownTrigger class="trigger">Actions</DropdownTrigger>
        <DropdownMenu dir={menuDirection}>
          <DropdownItem>Copy link</DropdownItem>
        </DropdownMenu>
      </Dropdown>
    </div>
  {:else}
    <Dropdown id="provider-direction-menu">
      <DropdownTrigger class="trigger">Actions</DropdownTrigger>
      <DropdownMenu dir={menuDirection}>
        <DropdownItem>Copy link</DropdownItem>
      </DropdownMenu>
    </Dropdown>
  {/if}
</LocaleProvider>
