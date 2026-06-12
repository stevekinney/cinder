<script lang="ts" module>
  export const title = 'Custom presets';
  export const description =
    'Consumer-supplied presets with labels suited to a billing or audit log context.';
</script>

<script lang="ts">
  import { DateRangeField } from '@lostgradient/cinder/date-range-field';
  import type { DateRangeDatePreset, DateRangeValue } from '@lostgradient/cinder/date-range-field';

  let range: DateRangeValue = $state({ start: undefined, end: undefined });

  const presets: DateRangeDatePreset[] = [
    {
      id: 'today',
      label: 'Today',
      resolve: () => {
        const today = new Date().toISOString().slice(0, 10);
        return { start: today, end: today };
      },
    },
    {
      id: 'this-week',
      label: 'This week',
      resolve: () => {
        const now = new Date();
        const day = now.getDay();
        const monday = new Date(now);
        monday.setDate(now.getDate() - ((day + 6) % 7));
        return {
          start: monday.toISOString().slice(0, 10),
          end: now.toISOString().slice(0, 10),
        };
      },
    },
    {
      id: 'this-month',
      label: 'This month',
      resolve: () => {
        const now = new Date();
        const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
        return { start, end: now.toISOString().slice(0, 10) };
      },
    },
    {
      id: 'this-quarter',
      label: 'This quarter',
      resolve: () => {
        const now = new Date();
        const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
        const start = new Date(now.getFullYear(), quarterStartMonth, 1);
        return {
          start: start.toISOString().slice(0, 10),
          end: now.toISOString().slice(0, 10),
        };
      },
    },
  ];
</script>

<DateRangeField
  id="custom-presets-range"
  label="Report period"
  {presets}
  bind:value={range}
  description="Select the period to include in this report."
/>
