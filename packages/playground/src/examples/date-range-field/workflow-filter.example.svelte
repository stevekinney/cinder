<script lang="ts" module>
  export const title = 'Workflow list filter';
  export const description =
    'Filter an operational workflow list by creation date with custom presets and validation feedback.';
</script>

<script lang="ts">
  import { DateRangeField } from '@lostgradient/cinder/date-range-field';
  import type { DateRangeDatePreset, DateRangeValue } from '@lostgradient/cinder/date-range-field';

  let range: DateRangeValue = $state({ start: undefined, end: undefined });

  function formatLocalDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  const presets: DateRangeDatePreset[] = [
    {
      id: 'today',
      label: 'Today',
      resolve: () => {
        const now = new Date();
        return {
          start: formatLocalDate(now),
          end: formatLocalDate(now),
        };
      },
    },
    {
      id: 'yesterday-today',
      label: 'Yesterday & today',
      resolve: () => {
        const now = new Date();
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        return {
          start: formatLocalDate(yesterday),
          end: formatLocalDate(now),
        };
      },
    },
    {
      id: 'last-7d',
      label: 'Last 7 days',
      resolve: () => {
        const now = new Date();
        const sixDaysAgo = new Date(now);
        sixDaysAgo.setDate(now.getDate() - 6);
        return {
          start: formatLocalDate(sixDaysAgo),
          end: formatLocalDate(now),
        };
      },
    },
    {
      id: 'last-30d',
      label: 'Last 30 days',
      resolve: () => {
        const now = new Date();
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        return {
          start: formatLocalDate(monthAgo),
          end: formatLocalDate(now),
        };
      },
    },
  ];

  const error = $derived(
    range.start && range.end && range.start > range.end
      ? 'Start date must be on or before the end date.'
      : undefined,
  );
</script>

<DateRangeField
  id="workflow-filter"
  label="Created between"
  {presets}
  bind:value={range}
  {...error ? { error } : {}}
  description="Filter workflow runs by their creation date."
/>
