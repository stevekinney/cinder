<script lang="ts" module>
  export const title = 'Workflow list filter';
  export const description =
    'Filter an operational workflow list by creation date with custom presets and validation feedback.';
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
        const now = new Date();
        return {
          start: now.toISOString().slice(0, 10),
          end: now.toISOString().slice(0, 10),
        };
      },
    },
    {
      id: 'yesterday-today',
      label: 'Yesterday & today',
      resolve: () => {
        const now = new Date();
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        return {
          start: yesterday.toISOString().slice(0, 10),
          end: now.toISOString().slice(0, 10),
        };
      },
    },
    {
      id: 'last-7d',
      label: 'Last 7 days',
      resolve: () => {
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return {
          start: weekAgo.toISOString().slice(0, 10),
          end: now.toISOString().slice(0, 10),
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
          start: monthAgo.toISOString().slice(0, 10),
          end: now.toISOString().slice(0, 10),
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
