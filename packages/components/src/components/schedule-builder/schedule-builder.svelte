<script lang="ts" module>
  /**
   * @cinder
   * @category form
   * @status beta
   * @purpose Recurrence-definition control that authors a cron or fixed-interval schedule via presets, raw cron fields, or an interval, alongside an always-visible summary, next-fires preview, and timezone slot.
   * @tag schedule
   * @tag recurrence
   * @tag cron
   * @tag form
   * @useWhen Letting a user define when a job or notification recurs, supplying your own date/cron library to compute upcoming fire times.
   * @useWhen You want a friendly presets UI (every N, daily, weekly, monthly) that still round-trips to a portable cron or interval value.
   * @avoidWhen You need overlap policy, jitter, or backfill controls — those belong to the consumer's surrounding form. | invocation-rule-builder
   * @avoidWhen You only need to pick a single point in time, not a recurrence — use date-picker instead. | date-picker
   * @related date-picker, segmented-control, input, time-field
   * @a11yPattern WAI-ARIA Tabs
   * @a11yNote The available authoring modes render as a tablist; each cron field reports validity via aria-invalid and an associated hint/error.
   */
  export type {
    ScheduleAuthoringMode,
    ScheduleBuilderProps,
    ScheduleFire,
    ScheduleIntervalUnit,
    ScheduleValue,
  } from './schedule-builder.types.ts';
</script>

<script lang="ts">
  import { untrack } from 'svelte';
  import { classNames } from '../../utilities/class-names.ts';
  import ScheduleBuilderFields from './schedule-builder-fields.svelte';

  import type {
    ScheduleAuthoringMode,
    ScheduleBuilderProps,
    ScheduleFire,
    ScheduleIntervalUnit,
    ScheduleValue,
  } from './schedule-builder.types.ts';
  import {
    cronFieldsValid,
    defaultScheduleValue,
    describeValue,
    joinCron,
    lowerDailyAt,
    lowerEveryN,
    lowerMonthlyOnDay,
    lowerWeeklyAt,
    valueToCronFields,
    valueToInterval,
  } from './schedule-builder.utilities.ts';
  import {
    cronExpressionForEditor,
    editorFromCronField,
    type CronEditor,
    type CronEditorMode,
  } from './schedule-builder-cron-editor.ts';

  type PresetKind = 'every' | 'daily' | 'weekly' | 'monthly';

  const AUTHORING_MODES = [
    'presets',
    'cron',
    'interval',
  ] as const satisfies readonly ScheduleAuthoringMode[];

  let {
    value,
    onValueChange,
    allowedModes,
    computeNextFires,
    previewCount = 5,
    timezoneLabel,
    timezone,
    label = 'Schedule',
    class: className,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledby,
    ...rest
  }: ScheduleBuilderProps = $props();

  const baseId = $props.id();

  const normalizedAriaLabel = $derived(
    typeof ariaLabel === 'string' && ariaLabel.trim().length > 0 ? ariaLabel : undefined,
  );
  const normalizedAriaLabelledby = $derived(
    typeof ariaLabelledby === 'string' && ariaLabelledby.trim().length > 0
      ? ariaLabelledby
      : undefined,
  );
  const resolvedAriaLabel = $derived(
    normalizedAriaLabelledby === undefined && normalizedAriaLabel === undefined
      ? label
      : normalizedAriaLabel,
  );

  const seedValue = untrack(() => value ?? defaultScheduleValue());

  function scheduleValuesEqual(a: ScheduleValue, b: ScheduleValue): boolean {
    if (a.mode !== b.mode) return false;
    if (a.mode === 'cron' && b.mode === 'cron') return a.expression === b.expression;
    if (a.mode === 'interval' && b.mode === 'interval') {
      return a.every === b.every && a.unit === b.unit;
    }
    return false;
  }

  function normalizeAllowedModes(
    candidateModes: readonly ScheduleAuthoringMode[] | undefined,
  ): ScheduleAuthoringMode[] {
    if (candidateModes === undefined) return [...AUTHORING_MODES];
    const normalized = AUTHORING_MODES.filter((mode) => candidateModes.includes(mode));
    return normalized.length > 0 ? normalized : [...AUTHORING_MODES];
  }

  const resolvedAllowedModes = $derived(normalizeAllowedModes(allowedModes));

  function modeIsAllowed(mode: ScheduleAuthoringMode): boolean {
    return resolvedAllowedModes.includes(mode);
  }

  function initialAuthoringMode(
    candidateValue: ScheduleValue | undefined,
    candidateAllowedModes: ScheduleAuthoringMode[],
  ): ScheduleAuthoringMode {
    if (candidateValue?.mode === 'interval') {
      const presetsCanRepresentInterval =
        candidateValue.unit === 'minutes' || candidateValue.unit === 'hours';
      if (presetsCanRepresentInterval && candidateAllowedModes.includes('presets')) {
        return 'presets';
      }
      if (candidateAllowedModes.includes('interval')) return 'interval';
    }

    const preferredMode =
      candidateValue === undefined
        ? 'presets'
        : candidateValue.mode === 'cron'
          ? 'cron'
          : 'interval';
    return candidateAllowedModes.includes(preferredMode)
      ? preferredMode
      : candidateAllowedModes[0]!;
  }

  function seedFieldsFromValue(
    seededValue: ScheduleValue,
    candidateAllowedModes: ScheduleAuthoringMode[],
  ) {
    const interval = valueToInterval(seededValue);
    const isMinutesOrHours =
      interval !== undefined && (interval.unit === 'minutes' || interval.unit === 'hours');
    return {
      authoringMode: initialAuthoringMode(seededValue, candidateAllowedModes),
      cronFields: valueToCronFields(seededValue),
      intervalEvery: interval?.every ?? 15,
      intervalUnit: interval?.unit ?? ('minutes' as ScheduleIntervalUnit),
      presetKind: 'every' as PresetKind,
      presetEveryValue: isMinutesOrHours ? interval!.every : 15,
      presetEveryUnit: (isMinutesOrHours ? interval!.unit : 'minutes') as 'minutes' | 'hours',
      presetDailyTime: '09:00',
      presetWeeklyDays: [] as number[],
      presetWeeklyTime: '09:00',
      presetMonthlyDay: 1,
      presetMonthlyTime: '09:00',
    };
  }

  const initialSeed = seedFieldsFromValue(
    seedValue,
    normalizeAllowedModes(untrack(() => allowedModes)),
  );

  let authoringMode = $state<ScheduleAuthoringMode>(initialSeed.authoringMode);
  let presetKind = $state<PresetKind>(initialSeed.presetKind);

  let cronFields = $state<string[]>(initialSeed.cronFields);
  let cronEditors = $state<CronEditor[]>(initialSeed.cronFields.map(editorFromCronField));

  let intervalEvery = $state(initialSeed.intervalEvery);
  let intervalUnit = $state<ScheduleIntervalUnit>(initialSeed.intervalUnit);

  let presetEveryValue = $state(initialSeed.presetEveryValue);
  let presetEveryUnit = $state<'minutes' | 'hours'>(initialSeed.presetEveryUnit);
  let presetDailyTime = $state(initialSeed.presetDailyTime);
  let presetWeeklyDays = $state<number[]>(initialSeed.presetWeeklyDays);
  let presetWeeklyTime = $state(initialSeed.presetWeeklyTime);
  let presetMonthlyDay = $state(initialSeed.presetMonthlyDay);
  let presetMonthlyTime = $state(initialSeed.presetMonthlyTime);

  function applySeedToFields(seed: ReturnType<typeof seedFieldsFromValue>): void {
    authoringMode = seed.authoringMode;
    cronFields = seed.cronFields;
    cronEditors = seed.cronFields.map(editorFromCronField);
    intervalEvery = seed.intervalEvery;
    intervalUnit = seed.intervalUnit;
    presetKind = seed.presetKind;
    presetEveryValue = seed.presetEveryValue;
    presetEveryUnit = seed.presetEveryUnit;
    presetDailyTime = seed.presetDailyTime;
    presetWeeklyDays = seed.presetWeeklyDays;
    presetWeeklyTime = seed.presetWeeklyTime;
    presetMonthlyDay = seed.presetMonthlyDay;
    presetMonthlyTime = seed.presetMonthlyTime;
  }

  function applyPresetSeedToFields(seed: ReturnType<typeof seedFieldsFromValue>): void {
    presetKind = seed.presetKind;
    presetEveryValue = seed.presetEveryValue;
    presetEveryUnit = seed.presetEveryUnit;
    presetDailyTime = seed.presetDailyTime;
    presetWeeklyDays = seed.presetWeeklyDays;
    presetWeeklyTime = seed.presetWeeklyTime;
    presetMonthlyDay = seed.presetMonthlyDay;
    presetMonthlyTime = seed.presetMonthlyTime;
  }

  function valueForPresets(): ScheduleValue {
    switch (presetKind) {
      case 'every':
        return lowerEveryN(presetEveryValue, presetEveryUnit);
      case 'daily':
        return lowerDailyAt(presetDailyTime);
      case 'weekly':
        return lowerWeeklyAt(presetWeeklyDays, presetWeeklyTime);
      case 'monthly':
        return lowerMonthlyOnDay(presetMonthlyDay, presetMonthlyTime);
    }
  }

  function valueForMode(mode: ScheduleAuthoringMode): ScheduleValue {
    if (mode === 'cron') return { mode: 'cron', expression: joinCron(cronFields) };
    if (mode === 'interval') return { mode: 'interval', every: intervalEvery, unit: intervalUnit };
    return valueForPresets();
  }

  const currentValue = $derived(valueForMode(authoringMode));

  const currentValueIsValid = $derived(authoringMode !== 'cron' || cronFieldsValid(cronFields));

  type PreviewResult =
    | { status: 'hidden' }
    | { status: 'invalid' }
    | { status: 'error' }
    | { status: 'ok'; fires: ScheduleFire[] };

  const resolvedPreviewCount = $derived(
    Number.isInteger(previewCount) && previewCount > 0 ? previewCount : 5,
  );

  const previewResult = $derived.by((): PreviewResult => {
    if (!computeNextFires) return { status: 'hidden' };
    if (!currentValueIsValid) return { status: 'invalid' };
    try {
      return { status: 'ok', fires: computeNextFires(currentValue, resolvedPreviewCount) };
    } catch {
      return { status: 'error' };
    }
  });

  let lastKnownValue: ScheduleValue = seedValue;

  function initialValueProp(): ScheduleValue | undefined {
    return value;
  }

  let previousValueProp: ScheduleValue | undefined = initialValueProp();

  $effect(() => {
    const incoming = value;
    const propChanged = incoming !== previousValueProp;
    previousValueProp = incoming;
    if (!propChanged) return;

    const resolved = incoming ?? defaultScheduleValue();
    // Undefined explicitly resets; defined equal values are controlled echoes.
    if (incoming !== undefined && scheduleValuesEqual(resolved, lastKnownValue)) return;
    applySeedToFields(seedFieldsFromValue(resolved, resolvedAllowedModes));
    lastKnownValue = resolved;
  });

  $effect(() => {
    if (resolvedAllowedModes.includes(authoringMode)) return;
    applySeedToFields(seedFieldsFromValue(lastKnownValue, resolvedAllowedModes));
  });

  function emitChange(): void {
    lastKnownValue = currentValue;
    onValueChange?.(currentValue);
  }

  function handleAuthoringModeChange(nextMode: ScheduleAuthoringMode): void {
    if (nextMode === authoringMode) return;
    if (!modeIsAllowed(nextMode)) return;
    authoringMode = nextMode;
    if (nextMode === 'cron') {
      cronFields = valueToCronFields(lastKnownValue);
      cronEditors = cronFields.map(editorFromCronField);
    } else if (nextMode === 'interval') {
      const interval = valueToInterval(lastKnownValue);
      if (interval) {
        intervalEvery = interval.every;
        intervalUnit = interval.unit;
      }
    } else if (nextMode === 'presets') {
      applyPresetSeedToFields(seedFieldsFromValue(lastKnownValue, resolvedAllowedModes));
    }
  }

  function handlePresetKindChange(nextKind: PresetKind): void {
    if (nextKind === presetKind) return;
    presetKind = nextKind;
    emitChange();
  }

  function handleCronFieldChange(index: number, raw: string): void {
    const next = [...cronFields];
    next[index] = raw;
    cronFields = next;
    const nextEditors = [...cronEditors];
    nextEditors[index] = { ...editorFromCronField(raw, index), mode: 'advanced' };
    cronEditors = nextEditors;
    if (cronFieldsValid(next)) emitChange();
  }

  function handleCronEditorModeChange(index: number, event: Event): void {
    const mode = (event.currentTarget as HTMLSelectElement).value as CronEditorMode;
    if (mode === 'advanced') {
      const next = [...cronEditors];
      next[index] = { ...next[index]!, mode };
      cronEditors = next;
      return;
    }
    const next = [...cronEditors];
    next[index] = { ...next[index]!, mode };
    cronEditors = next;
    handleCronEditorChange(index);
  }

  function handleCronEditorChange(index: number): void {
    const editor = cronEditors[index];
    if (!editor || editor.mode === 'advanced') return;
    const next = [...cronFields];
    next[index] = cronExpressionForEditor(editor);
    cronFields = next;
    if (cronFieldsValid(next)) emitChange();
  }

  function updateCronEditor(index: number, patch: Partial<CronEditor>): void {
    const next = [...cronEditors];
    next[index] = { ...next[index]!, ...patch };
    cronEditors = next;
    handleCronEditorChange(index);
  }

  function toPositiveInteger(next: number | null): number {
    if (next === null || !Number.isFinite(next) || next < 1) return 1;
    return Math.trunc(next);
  }

  function handleIntervalEveryChange(next: number | null): void {
    intervalEvery = toPositiveInteger(next);
    emitChange();
  }

  function handleIntervalUnitChange(event: Event): void {
    intervalUnit = (event.currentTarget as HTMLSelectElement).value as ScheduleIntervalUnit;
    emitChange();
  }

  function handlePresetEveryValueChange(next: number | null): void {
    presetEveryValue = toPositiveInteger(next);
    emitChange();
  }

  function handlePresetEveryUnitChange(event: Event): void {
    presetEveryUnit = (event.currentTarget as HTMLSelectElement).value as 'minutes' | 'hours';
    emitChange();
  }

  function acceptPresetTime(next: string | undefined, commit: (time: string) => void): void {
    if (!next) return;
    commit(next);
    emitChange();
  }

  function handlePresetDailyTimeChange(next: string | undefined): void {
    acceptPresetTime(next, (time) => (presetDailyTime = time));
  }

  function toggleWeeklyDay(day: number): void {
    presetWeeklyDays = presetWeeklyDays.includes(day)
      ? presetWeeklyDays.filter((existing) => existing !== day)
      : [...presetWeeklyDays, day];
    emitChange();
  }

  function handlePresetWeeklyTimeChange(next: string | undefined): void {
    acceptPresetTime(next, (time) => (presetWeeklyTime = time));
  }

  function handlePresetMonthlyDayChange(next: number | null): void {
    presetMonthlyDay = next && next >= 1 ? Math.min(31, Math.trunc(next)) : 1;
    emitChange();
  }

  function handlePresetMonthlyTimeChange(next: string | undefined): void {
    acceptPresetTime(next, (time) => (presetMonthlyTime = time));
  }

  const modeTabId = (mode: ScheduleAuthoringMode) => `${baseId}-mode-${mode}-tab`;
  const modePanelId = (mode: ScheduleAuthoringMode) => `${baseId}-mode-${mode}-panel`;
</script>

<div
  {...rest}
  class={classNames('cinder-schedule-builder', className)}
  role="group"
  aria-label={resolvedAriaLabel}
  aria-labelledby={normalizedAriaLabelledby}
  data-sb-mode={authoringMode}
>
  <ScheduleBuilderFields
    {baseId}
    {authoringMode}
    {modeIsAllowed}
    {modeTabId}
    {modePanelId}
    onAuthoringModeChange={handleAuthoringModeChange}
    {presetKind}
    onPresetKindChange={handlePresetKindChange}
    {presetEveryValue}
    {presetEveryUnit}
    {presetDailyTime}
    {presetWeeklyDays}
    {presetWeeklyTime}
    {presetMonthlyDay}
    {presetMonthlyTime}
    onPresetEveryValueChange={handlePresetEveryValueChange}
    onPresetEveryUnitChange={handlePresetEveryUnitChange}
    onPresetDailyTimeChange={handlePresetDailyTimeChange}
    onToggleWeeklyDay={toggleWeeklyDay}
    onPresetWeeklyTimeChange={handlePresetWeeklyTimeChange}
    onPresetMonthlyDayChange={handlePresetMonthlyDayChange}
    onPresetMonthlyTimeChange={handlePresetMonthlyTimeChange}
    {cronFields}
    {cronEditors}
    onCronModeChange={handleCronEditorModeChange}
    onCronEditorChange={updateCronEditor}
    onCronRawChange={handleCronFieldChange}
    {intervalEvery}
    {intervalUnit}
    onIntervalEveryChange={handleIntervalEveryChange}
    onIntervalUnitChange={handleIntervalUnitChange}
  />

  <dl class="cinder-schedule-builder__summary">
    <dt class="cinder-schedule-builder__section-label">Summary</dt>
    <dd class="cinder-schedule-builder__summary-text">{describeValue(currentValue)}</dd>
  </dl>

  {#if previewResult.status !== 'hidden'}
    <div class="cinder-schedule-builder__preview">
      <span class="cinder-schedule-builder__section-label" id={`${baseId}-preview-label`}>
        Upcoming fires
      </span>
      {#if previewResult.status === 'invalid'}
        <p class="cinder-schedule-builder__empty">
          Preview unavailable — fix the cron expression above.
        </p>
      {:else if previewResult.status === 'error'}
        <p class="cinder-schedule-builder__empty">Preview unavailable.</p>
      {:else if previewResult.fires.length > 0}
        <ul
          class="cinder-schedule-builder__preview-list"
          aria-labelledby={`${baseId}-preview-label`}
        >
          {#each previewResult.fires as fire (fire.id)}
            <li class="cinder-schedule-builder__preview-item">{fire.label}</li>
          {/each}
        </ul>
      {:else}
        <p class="cinder-schedule-builder__empty">No upcoming fires.</p>
      {/if}
    </div>
  {/if}

  <dl class="cinder-schedule-builder__timezone">
    <dt class="cinder-schedule-builder__section-label">Timezone</dt>
    <dd class="cinder-schedule-builder__timezone-value">
      {#if timezone}
        {@render timezone()}
      {:else if timezoneLabel}
        {timezoneLabel}
      {:else}
        <span class="cinder-schedule-builder__empty">Not set</span>
      {/if}
    </dd>
  </dl>
</div>
