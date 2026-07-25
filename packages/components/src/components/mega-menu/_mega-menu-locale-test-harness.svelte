<script lang="ts">
  import LocaleProvider from '@lostgradient/cinder/locale-provider';
  import MegaMenu from './mega-menu.svelte';
  import type { MegaMenuProps } from './mega-menu.types.ts';

  let {
    items,
    direction,
    menuDirection,
  }: Pick<MegaMenuProps, 'items'> & {
    direction: 'ltr' | 'rtl';
    menuDirection?: 'ltr' | 'rtl' | 'auto';
  } = $props();
</script>

<LocaleProvider {direction}>
  <MegaMenu {items} dir={menuDirection} />
</LocaleProvider>
