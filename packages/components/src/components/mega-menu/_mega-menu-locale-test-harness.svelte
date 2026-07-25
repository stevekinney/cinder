<script lang="ts">
  import LocaleProvider from '@lostgradient/cinder/locale-provider';
  import MegaMenu from './mega-menu.svelte';
  import type { MegaMenuProps } from './mega-menu.types.ts';

  let {
    items,
    direction,
    menuDirection,
    localDirection,
    menuStyle,
  }: Pick<MegaMenuProps, 'items'> & {
    direction: 'ltr' | 'rtl';
    menuDirection?: 'ltr' | 'rtl' | 'auto';
    localDirection?: 'ltr' | 'rtl';
    menuStyle?: string;
  } = $props();
</script>

<LocaleProvider {direction}>
  <div dir={localDirection}>
    <MegaMenu {items} dir={menuDirection} style={menuStyle} />
  </div>
</LocaleProvider>
