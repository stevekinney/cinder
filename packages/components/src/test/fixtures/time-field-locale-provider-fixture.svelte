<script lang="ts">
  import { LocaleProvider } from '../../components/locale-provider/index.ts';
  import { TimeField } from '../../components/time-field/index.ts';

  let { locale = 'de-DE' }: { locale?: string } = $props();
</script>

<LocaleProvider {locale}>
  <TimeField id="provider-time" label="Provider time" value="09:30" />
</LocaleProvider>
