<script lang="ts">
  import type { TextDirection } from '../../_internal/locale-context.ts';
  import LocaleProvider from '../../components/locale-provider/locale-provider.svelte';
  import Slider from '../../components/slider/slider.svelte';

  let {
    providerDirection = 'rtl',
    localDirection = 'ltr',
  }: {
    providerDirection?: TextDirection;
    localDirection?: TextDirection;
  } = $props();
</script>

<LocaleProvider direction={providerDirection}>
  <div dir={localDirection}>
    <Slider label="Brightness" defaultValue={20} step={5} />
  </div>
</LocaleProvider>
