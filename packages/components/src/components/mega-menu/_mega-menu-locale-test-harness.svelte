<script lang="ts">
  import LocaleProvider from '@lostgradient/cinder/locale-provider';
  import MegaMenu from './mega-menu.svelte';
  import type { MegaMenuProps } from './mega-menu.types.ts';

  let {
    items,
    direction,
    menuDirection,
    localDirection,
  }: Pick<MegaMenuProps, 'items'> & {
    direction: 'ltr' | 'rtl';
    menuDirection?: 'ltr' | 'rtl' | 'auto';
    localDirection?: 'ltr' | 'rtl';
  } = $props();
</script>

<LocaleProvider {direction}>
  <div dir={localDirection}>
    <MegaMenu {items} dir={menuDirection} />
  </div>
</LocaleProvider>
