<script lang="ts" module>
  export const title = 'Inherited locale';
  export const description =
    'Change the provider locale to update number formatting in its descendant.';
</script>

<script lang="ts">
  import { Button } from '@lostgradient/cinder/button';
  import { LocaleProvider } from '@lostgradient/cinder/locale-provider';
  import { NumberInput } from '@lostgradient/cinder/number-input';

  let { mountIdPrefix }: { mountIdPrefix?: string } = $props();
  const uid = $props.id();
  const fieldId = $derived(`${mountIdPrefix ?? uid}-amount`);
  let locale = $state('de-DE');
  let amount = $state<number | null>(1234.5);
</script>

<div class="example-preview-column">
  <div class="example-preview-row" role="group" aria-label="Number format locale">
    <Button type="button" aria-pressed={locale === 'de-DE'} onclick={() => (locale = 'de-DE')}
      >German</Button
    >
    <Button type="button" aria-pressed={locale === 'en-US'} onclick={() => (locale = 'en-US')}
      >English</Button
    >
  </div>
  <LocaleProvider {locale}>
    <NumberInput
      id={fieldId}
      label="Amount"
      bind:value={amount}
      format={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }}
    />
  </LocaleProvider>
</div>
