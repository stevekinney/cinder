<script lang="ts">
  import type { TextDirection } from '../../_internal/locale-context.ts';
  import LocaleProvider from '../../components/locale-provider/locale-provider.svelte';
  import Slider from '../../components/slider/slider.svelte';

  let {
    providerDirection = 'rtl',
    localDirection,
  }: {
    providerDirection?: TextDirection;
    localDirection?: TextDirection | undefined;
  } = $props();
</script>

<LocaleProvider direction={providerDirection}>
  {#if localDirection}
    <div dir={localDirection}>
      <Slider label="Brightness" defaultValue={20} step={5} />
    </div>
  {:else}
    <Slider label="Brightness" defaultValue={20} step={5} />
  {/if}
</LocaleProvider>
