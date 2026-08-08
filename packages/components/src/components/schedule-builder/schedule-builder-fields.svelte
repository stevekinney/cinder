<script lang="ts">
  import Chip from '../chip/chip.svelte';
  import NumberInput from '../number-input/number-input.svelte';
  import Segment from '../segment/segment.svelte';
  import SegmentedControl from '../segmented-control/segmented-control.svelte';
  import Select from '../select/select.svelte';
  import TimeField from '../time-field/time-field.svelte';
  import CronEditorFields from './schedule-builder-cron-editor.svelte';
  import type { CronEditor } from './schedule-builder-cron-editor.ts';
  import type { ScheduleAuthoringMode, ScheduleIntervalUnit } from './schedule-builder.types.ts';
  import { INTERVAL_UNITS, WEEKDAYS } from './schedule-builder.utilities.ts';

  type PresetKind = 'every' | 'daily' | 'weekly' | 'monthly';

  const presetUnitOptions = [
    { value: 'minutes', label: 'Minutes' },
    { value: 'hours', label: 'Hours' },
  ] as const;
  const intervalUnitLabels: Record<ScheduleIntervalUnit, string> = {
    minutes: 'Minutes',
    hours: 'Hours',
    days: 'Days',
    weeks: 'Weeks',
  };
  const intervalUnitOptions = INTERVAL_UNITS.map((unit) => ({
    value: unit,
    label: intervalUnitLabels[unit],
  }));

  let {
    baseId,
    authoringMode,
    modeIsAllowed,
    modeTabId,
    modePanelId,
    onAuthoringModeChange,
    presetKind,
    onPresetKindChange,
    presetEveryValue,
    presetEveryUnit,
    presetDailyTime,
    presetWeeklyDays,
    presetWeeklyTime,
    presetMonthlyDay,
    presetMonthlyTime,
    onPresetEveryValueChange,
    onPresetEveryUnitChange,
    onPresetDailyTimeChange,
    onToggleWeeklyDay,
    onPresetWeeklyTimeChange,
    onPresetMonthlyDayChange,
    onPresetMonthlyTimeChange,
    cronFields,
    cronEditors,
    onCronModeChange,
    onCronEditorChange,
    onCronRawChange,
    intervalEvery,
    intervalUnit,
    onIntervalEveryChange,
    onIntervalUnitChange,
  }: {
    baseId: string;
    authoringMode: ScheduleAuthoringMode;
    modeIsAllowed: (mode: ScheduleAuthoringMode) => boolean;
    modeTabId: (mode: ScheduleAuthoringMode) => string;
    modePanelId: (mode: ScheduleAuthoringMode) => string;
    onAuthoringModeChange: (mode: ScheduleAuthoringMode) => void;
    presetKind: PresetKind;
    onPresetKindChange: (kind: PresetKind) => void;
    presetEveryValue: number;
    presetEveryUnit: 'minutes' | 'hours';
    presetDailyTime: string;
    presetWeeklyDays: number[];
    presetWeeklyTime: string;
    presetMonthlyDay: number;
    presetMonthlyTime: string;
    onPresetEveryValueChange: (value: number | null) => void;
    onPresetEveryUnitChange: (event: Event) => void;
    onPresetDailyTimeChange: (value: string | undefined) => void;
    onToggleWeeklyDay: (day: number) => void;
    onPresetWeeklyTimeChange: (value: string | undefined) => void;
    onPresetMonthlyDayChange: (value: number | null) => void;
    onPresetMonthlyTimeChange: (value: string | undefined) => void;
    cronFields: string[];
    cronEditors: CronEditor[];
    onCronModeChange: (index: number, event: Event) => void;
    onCronEditorChange: (index: number, patch: Partial<CronEditor>) => void;
    onCronRawChange: (index: number, value: string) => void;
    intervalEvery: number;
    intervalUnit: ScheduleIntervalUnit;
    onIntervalEveryChange: (value: number | null) => void;
    onIntervalUnitChange: (event: Event) => void;
  } = $props();
</script>

<SegmentedControl
  id={`${baseId}-mode`}
  label="Schedule authoring mode"
  variant="tablist"
  value={authoringMode}
  onValueChange={onAuthoringModeChange}
  class="cinder-schedule-builder__mode-switch"
>
  {#each ['presets', 'cron', 'interval'] as const as mode (mode)}
    {#if modeIsAllowed(mode)}
      <Segment
        id={modeTabId(mode)}
        value={mode}
        controls={authoringMode === mode ? modePanelId(mode) : undefined}
      >
        {mode === 'presets' ? 'Presets' : mode === 'cron' ? 'Cron' : 'Interval'}
      </Segment>
    {/if}
  {/each}
</SegmentedControl>

{#if authoringMode === 'presets'}
  <div
    id={modePanelId('presets')}
    role="tabpanel"
    aria-labelledby={modeTabId('presets')}
    class="cinder-schedule-builder__panel"
    data-sb-panel="presets"
  >
    <SegmentedControl
      id={`${baseId}-preset-kind`}
      label="Preset kind"
      value={presetKind}
      onValueChange={onPresetKindChange}
      class="cinder-schedule-builder__preset-kind"
    >
      <Segment id={`${baseId}-preset-kind-every`} value="every">Every N</Segment>
      <Segment id={`${baseId}-preset-kind-daily`} value="daily">Daily</Segment>
      <Segment id={`${baseId}-preset-kind-weekly`} value="weekly">Weekly</Segment>
      <Segment id={`${baseId}-preset-kind-monthly`} value="monthly">Monthly</Segment>
    </SegmentedControl>

    {#if presetKind === 'every'}
      <div class="cinder-schedule-builder__field-row">
        <NumberInput
          id={`${baseId}-preset-every-value`}
          label="Every"
          min={1}
          step={1}
          bind:value={() => presetEveryValue, onPresetEveryValueChange}
        />
        <Select
          id={`${baseId}-preset-every-unit`}
          label="Unit"
          options={presetUnitOptions}
          value={presetEveryUnit}
          onchange={onPresetEveryUnitChange}
        />
      </div>
    {:else if presetKind === 'daily'}
      <TimeField
        id={`${baseId}-preset-daily-time`}
        label="At"
        bind:value={() => presetDailyTime, onPresetDailyTimeChange}
      />
    {:else if presetKind === 'weekly'}
      <div class="cinder-schedule-builder__weekday-group" role="group" aria-label="Days of week">
        {#each WEEKDAYS as day (day.value)}
          <Chip
            mode="toggle"
            label={day.short}
            aria-label={day.long}
            pressed={presetWeeklyDays.includes(day.value)}
            onPressedChange={() => onToggleWeeklyDay(day.value)}
          />
        {/each}
      </div>
      <TimeField
        id={`${baseId}-preset-weekly-time`}
        label="At"
        bind:value={() => presetWeeklyTime, onPresetWeeklyTimeChange}
      />
    {:else}
      <div class="cinder-schedule-builder__field-row">
        <NumberInput
          id={`${baseId}-preset-monthly-day`}
          label="Day of month"
          min={1}
          max={31}
          bind:value={() => presetMonthlyDay, onPresetMonthlyDayChange}
        />
        <TimeField
          id={`${baseId}-preset-monthly-time`}
          label="At"
          bind:value={() => presetMonthlyTime, onPresetMonthlyTimeChange}
        />
      </div>
    {/if}
  </div>
{:else if authoringMode === 'cron'}
  <div
    id={modePanelId('cron')}
    role="tabpanel"
    aria-labelledby={modeTabId('cron')}
    class="cinder-schedule-builder__panel"
    data-sb-panel="cron"
  >
    <CronEditorFields
      {baseId}
      {cronFields}
      {cronEditors}
      onModeChange={onCronModeChange}
      onEditorChange={onCronEditorChange}
      onRawChange={onCronRawChange}
    />
  </div>
{:else}
  <div
    id={modePanelId('interval')}
    role="tabpanel"
    aria-labelledby={modeTabId('interval')}
    class="cinder-schedule-builder__panel"
    data-sb-panel="interval"
  >
    <div class="cinder-schedule-builder__field-row">
      <NumberInput
        id={`${baseId}-interval-every`}
        label="Every"
        min={1}
        step={1}
        bind:value={() => intervalEvery, onIntervalEveryChange}
      />
      <Select
        id={`${baseId}-interval-unit`}
        label="Unit"
        options={intervalUnitOptions}
        value={intervalUnit}
        onchange={onIntervalUnitChange}
      />
    </div>
  </div>
{/if}
