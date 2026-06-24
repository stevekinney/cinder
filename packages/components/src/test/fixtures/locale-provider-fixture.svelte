<script lang="ts">
  import { LocaleProvider } from '../../components/locale-provider/index.ts';
  import { NumberInput } from '../../components/number-input/index.ts';
  import { PhoneInput } from '../../components/phone-input/index.ts';
  import { Stat } from '../../components/stat/index.ts';

  let {
    locale = 'de-DE',
    explicitStatLocale,
    explicitNumberLocale,
    explicitPhoneLocale,
  }: {
    locale?: string;
    explicitStatLocale?: string;
    explicitNumberLocale?: string;
    explicitPhoneLocale?: string;
  } = $props();

  const statLocaleProps = $derived(
    explicitStatLocale === undefined ? {} : { valueLocale: explicitStatLocale },
  );
  const numberLocaleProps = $derived(
    explicitNumberLocale === undefined ? {} : { locale: explicitNumberLocale },
  );
  const phoneLocaleProps = $derived(
    explicitPhoneLocale === undefined ? {} : { locale: explicitPhoneLocale },
  );
</script>

<LocaleProvider {locale}>
  <Stat label="Revenue" value={1234.5} {...statLocaleProps} />
  <NumberInput id="localized-number" label="Amount" value={1234.5} {...numberLocaleProps} />
  <PhoneInput id="localized-phone" label="Phone" countries={['US']} {...phoneLocaleProps} />
</LocaleProvider>
