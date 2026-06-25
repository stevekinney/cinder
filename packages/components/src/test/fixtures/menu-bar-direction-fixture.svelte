<script lang="ts">
  import type { TextDirection } from '../../_internal/locale-context.ts';
  import LocaleProvider from '../../components/locale-provider/locale-provider.svelte';
  import MenuBar from '../../components/menu-bar/menu-bar.svelte';
  import type { MenuBarProps } from '../../components/menu-bar/menu-bar.types.ts';

  let {
    menus,
    providerDirection = 'rtl',
  }: {
    menus: MenuBarProps['menus'];
    providerDirection?: TextDirection;
  } = $props();
</script>

<LocaleProvider direction={providerDirection}>
  <MenuBar {menus} label="Application menu" />
</LocaleProvider>
