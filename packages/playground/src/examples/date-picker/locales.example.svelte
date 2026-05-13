<script lang="ts" module>
  export const title = 'Date picker with locale';
  export const description =
    'The calendar adapts to the locale: day-of-week order, month/year title format, and date display format all change.';
</script>

<script lang="ts">
  import { DatePicker } from '../../../../components/src/index.ts';

  let selectedEnglish = $state<Date | null>(null);
  let selectedGerman = $state<Date | null>(null);
  let selectedJapanese = $state<Date | null>(null);
</script>

<div style="display: flex; flex-direction: column; gap: 2rem;">
  <DatePicker
    id="dp-en-us"
    label="English (en-US)"
    description="Sunday-first week, MM/DD/YYYY format."
    locale="en-US"
    bind:value={selectedEnglish}
  />

  <DatePicker
    id="dp-de-de"
    label="German (de-DE)"
    description="Monday-first week, DD.MM.YYYY format."
    locale="de-DE"
    bind:value={selectedGerman}
  />

  <DatePicker
    id="dp-ja-jp"
    label="Japanese (ja-JP)"
    description="Sunday-first week, YYYY/MM/DD format."
    locale="ja-JP"
    bind:value={selectedJapanese}
  />
</div>
