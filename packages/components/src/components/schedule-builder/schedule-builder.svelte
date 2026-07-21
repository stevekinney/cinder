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
   * @useWhen You need to restrict authoring to cron-only recurrence values for a backend that cannot persist intervals.
   * @avoidWhen You need overlap policy, jitter, or backfill controls — those belong to the consumer's surrounding form. | invocation-rule-builder
   * @avoidWhen You only need to pick a single point in time, not a recurrence — use date-picker instead. | date-picker
   * @related date-picker, segmented-control, input, time-field
   * @a11yPattern WAI-ARIA Tabs
   * @a11yNote The three authoring modes (presets, cron, interval) are a tablist; each cron field reports validity via aria-invalid and an associated hint/error.
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
  import { classNames } from '../../utilities/class-names.ts';
  import Chip from '../chip/chip.svelte';
  import Input from '../input/input.svelte';
  import NumberInput from '../number-input/number-input.svelte';
  import Segment from '../segment/segment.svelte';
  import SegmentedControl from '../segmented-control/segmented-control.svelte';
  import Select from '../select/select.svelte';
  import TimeField from '../time-field/time-field.svelte';

  import type {
    ScheduleAuthoringMode,
    ScheduleBuilderProps,
    ScheduleFire,
    ScheduleIntervalUnit,
    ScheduleValue,
  } from './schedule-builder.types.ts';
  import {
    CRON_FIELDS,
    WEEKDAYS,
    INTERVAL_UNITS,
    cronFieldsValid,
    defaultScheduleValue,
    describeValue,
    joinCron,
    lowerDailyAt,
    lowerEveryN,
    lowerMonthlyOnDay,
    lowerWeeklyAt,
    validateCronField,
    valueToCronFields,
    valueToInterval,
  } from './schedule-builder.utilities.ts';

  /**
   * Preset authoring "kind" selected inside presets mode. Purely a UI concern —
   * every kind lowers to a `cron` or `interval` {@link ScheduleValue} via the
   * matching `lower*` utility; `PresetKind` never leaves this component.
   */
  type PresetKind = 'every' | 'daily' | 'weekly' | 'monthly';

  const AUTHORING_MODES = [
    'presets',
    'cron',
    'interval',
  ] as const satisfies readonly ScheduleAuthoringMode[];

  const PRESET_EVERY_UNIT_OPTIONS = [
    { value: 'minutes', label: 'Minutes' },
    { value: 'hours', label: 'Hours' },
  ] as const;

  const INTERVAL_UNIT_LABELS: Record<ScheduleIntervalUnit, string> = {
    minutes: 'Minutes',
    hours: 'Hours',
    days: 'Days',
    weeks: 'Weeks',
  };
  const INTERVAL_UNIT_OPTIONS = INTERVAL_UNITS.map((unit) => ({
    value: unit,
    label: INTERVAL_UNIT_LABELS[unit],
  }));

  let {
    value,
    onchange,
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

  // Normalize ARIA label props: an empty string `aria-label=""` (or
  // `aria-labelledby=""`) suppresses the accessible-name fallback (ARIA spec
  // §4.3) without actually providing a name. Convert empty strings to
  // `undefined` so the DOM attribute is omitted and the `label` default
  // remains the accessible name. Matches button.svelte's normalization.
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

  // ---------------------------------------------------------------------------
  // Seed local field state from the `value` prop (or the shared default), so
  // mid-edit intermediate text (e.g. a half-typed cron range) has somewhere to
  // live without fighting a controlled `value` prop on every keystroke. This
  // seeding runs at construction AND — guarded against re-seeding on a mere
  // re-render or an echoed `onchange` — again whenever the CONSUMER hands in a
  // genuinely different `value` (see the resync `$effect` below `lastKnownValue`).
  // ---------------------------------------------------------------------------
  function initialValue(): ScheduleValue {
    return value ?? defaultScheduleValue();
  }

  function initialAllowedModes(): ScheduleAuthoringMode[] {
    return normalizeAllowedModes(allowedModes);
  }

  const seedValue = initialValue();

  /** Structural equality for the small `ScheduleValue` discriminated union. */
  function scheduleValuesEqual(a: ScheduleValue, b: ScheduleValue): boolean {
    if (a.mode !== b.mode) return false;
    if (a.mode === 'cron' && b.mode === 'cron') return a.expression === b.expression;
    if (a.mode === 'interval' && b.mode === 'interval') {
      return a.every === b.every && a.unit === b.unit;
    }
    return false;
  }

  function normalizeAllowedModes(
    candidateModes: ScheduleAuthoringMode[] | undefined,
  ): ScheduleAuthoringMode[] {
    if (candidateModes === undefined) return [...AUTHORING_MODES];
    const normalized = AUTHORING_MODES.filter((mode) => candidateModes.includes(mode));
    return normalized.length > 0 ? normalized : [...AUTHORING_MODES];
  }

  const resolvedAllowedModes = $derived(normalizeAllowedModes(allowedModes));

  function modeIsAllowed(mode: ScheduleAuthoringMode): boolean {
    return resolvedAllowedModes.includes(mode);
  }

  /**
   * The authoring mode to open for a given value. A minutes/hours interval
   * (or no value at all) cleanly matches the "every N" preset — and is
   * already seeded correctly there by `seedFieldsFromValue` below — so those
   * open `presets`. Any other `interval` (days/weeks, which presets cannot
   * represent) opens directly in `interval` mode; any `cron` value opens
   * directly in `cron` mode. Either way the destination mode's fields are
   * seeded from the value, so the summary and preview are correct immediately
   * instead of showing the presets default.
   */
  function initialAuthoringMode(
    candidateValue: ScheduleValue | undefined,
    candidateAllowedModes: ScheduleAuthoringMode[],
  ): ScheduleAuthoringMode {
    const preferredMode =
      candidateValue === undefined
        ? 'presets'
        : candidateValue.mode === 'cron'
          ? 'cron'
          : candidateValue.unit === 'minutes' || candidateValue.unit === 'hours'
            ? 'presets'
            : 'interval';
    return candidateAllowedModes.includes(preferredMode)
      ? preferredMode
      : candidateAllowedModes[0]!;
  }

  /**
   * Computes every field this component seeds from a `ScheduleValue` — shared
   * by the initial seed below and the resync `$effect` (see `lastKnownValue`),
   * so a later controlled `value` change is seeded exactly like the first
   * render. `presetDailyTime`/`presetWeeklyDays`/`presetWeeklyTime`/
   * `presetMonthlyDay`/`presetMonthlyTime` have no general inverse from an
   * arbitrary cron expression (only `valueToInterval` exists), so both the
   * initial seed and a resync reset them to the same neutral defaults.
   */
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

  const initialSeed = seedFieldsFromValue(seedValue, initialAllowedModes());

  let authoringMode = $state<ScheduleAuthoringMode>(initialSeed.authoringMode);
  let presetKind = $state<PresetKind>(initialSeed.presetKind);

  let cronFields = $state<string[]>(initialSeed.cronFields);

  let intervalEvery = $state(initialSeed.intervalEvery);
  let intervalUnit = $state<ScheduleIntervalUnit>(initialSeed.intervalUnit);

  let presetEveryValue = $state(initialSeed.presetEveryValue);
  let presetEveryUnit = $state<'minutes' | 'hours'>(initialSeed.presetEveryUnit);
  let presetDailyTime = $state(initialSeed.presetDailyTime);
  let presetWeeklyDays = $state<number[]>(initialSeed.presetWeeklyDays);
  let presetWeeklyTime = $state(initialSeed.presetWeeklyTime);
  let presetMonthlyDay = $state(initialSeed.presetMonthlyDay);
  let presetMonthlyTime = $state(initialSeed.presetMonthlyTime);

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

  /** The value the given authoring mode currently represents, from its own field state. */
  function valueForMode(mode: ScheduleAuthoringMode): ScheduleValue {
    if (mode === 'cron') return { mode: 'cron', expression: joinCron(cronFields) };
    if (mode === 'interval') return { mode: 'interval', every: intervalEvery, unit: intervalUnit };
    return valueForPresets();
  }

  /**
   * The value the active authoring mode currently represents. This is ONLY
   * ever `cron` or `interval` — presets are sugar that lower to one of the
   * two via the matching `lower*` utility, so `mode: 'preset'` never appears.
   */
  const currentValue = $derived(valueForMode(authoringMode));

  /**
   * Whether `currentValue` is safe to hand to the consumer's `computeNextFires`.
   * In cron mode a mid-edit field can make the joined expression invalid (e.g.
   * an out-of-range hour); a real cron-parsing callback would likely throw on
   * that. Presets and interval mode always produce a structurally valid value.
   */
  const currentValueIsValid = $derived(authoringMode !== 'cron' || cronFieldsValid(cronFields));

  type PreviewResult =
    | { status: 'hidden' }
    | { status: 'invalid' }
    | { status: 'error' }
    | { status: 'ok'; fires: ScheduleFire[] };

  // `previewCount` is documented and schema-constrained as a positive
  // integer, but it's still a public prop a consumer can hand a stray 0,
  // negative, NaN, or fractional value to — normalize before it ever reaches
  // `computeNextFires`, the same way `toPositiveInteger` guards field edits.
  const resolvedPreviewCount = $derived(
    Number.isInteger(previewCount) && previewCount > 0 ? previewCount : 5,
  );

  /**
   * Guards the next-fires preview two ways: (1) `computeNextFires` is only
   * ever called with a value that has passed `cronFieldsValid` — never an
   * in-progress, invalid cron edit (`status: 'invalid'`) — and (2) the call is
   * wrapped in a try/catch so a consumer callback that throws for any other
   * reason degrades to a generic unavailable state (`status: 'error'`)
   * instead of crashing the component.
   */
  const previewResult = $derived.by((): PreviewResult => {
    if (!computeNextFires) return { status: 'hidden' };
    if (!currentValueIsValid) return { status: 'invalid' };
    try {
      return { status: 'ok', fires: computeNextFires(currentValue, resolvedPreviewCount) };
    } catch {
      return { status: 'error' };
    }
  });

  /**
   * The last value this component knows the consumer has (starting from the
   * initial `value`/default seed, then advancing to whatever the user last
   * committed via `onchange`, then advancing again whenever the resync
   * `$effect` below adopts a genuinely new controlled `value`). This is
   * intentionally NOT `currentValue`: `currentValue` reflects whatever the
   * active mode's fields would produce right now, even before the user has
   * touched them (e.g. presets defaults to "every 15 minutes" until edited).
   * Mode-switch seeding and the resync effect must compare against the value
   * actually committed/known, not the untouched default of whichever mode
   * happens to be active — otherwise switching straight from the initial
   * `presets` default into cron mode would clobber a real initial cron
   * `value` with "every 15 minutes" the moment you looked at it.
   *
   * Deliberately a plain (non-`$state`) variable: it is read only from
   * plain functions and the effect below, never from `$derived` or the
   * template, so it needs no reactivity of its own — and keeping it
   * non-reactive means the resync effect's only real dependency is the
   * `value` prop, not a self-write of its own tracked state.
   */
  let lastKnownValue: ScheduleValue = seedValue;

  /**
   * The raw `value` prop as observed on the resync effect's most recent run.
   * This is deliberately separate from `lastKnownValue`: it exists only to
   * answer "did the *prop itself* actually change since I last looked?",
   * independent of whatever this component's own local edits have done to
   * `lastKnownValue`. See the effect below for why that distinction matters.
   */
  function initialValueProp(): ScheduleValue | undefined {
    return value;
  }

  let previousValueProp: ScheduleValue | undefined = initialValueProp();

  /**
   * Two-way-controlled sync: when the CONSUMER hands in a `value` that is
   * genuinely different from what this component last knew about, adopt it —
   * re-seeding every field exactly like the initial seed (see
   * `seedFieldsFromValue`). This is what makes `value` actually controlled:
   * loading a saved schedule, a form reset, or a parent that normalizes or
   * rejects an `onchange` all flow back in.
   *
   * The explicit `scheduleValuesEqual` comparison against `lastKnownValue` —
   * not a bare `$effect(() => { ...reseed from value...})` — is load-bearing:
   * without it, the routine controlled-component echo (parent stores
   * whatever `onchange` just emitted and passes it straight back down,
   * frequently as a freshly-constructed object with the same content) would
   * look like a "new" value on every edit and wipe mid-edit state — e.g. an
   * in-progress, not-yet-valid cron field — on every keystroke.
   *
   * `value === undefined` is treated as "reset to default", not "skip": a
   * controlled parent that clears `value` back to `undefined` is a
   * documented reset to the default/omitted state (e.g. a form reset) and
   * must reseed to `defaultScheduleValue()`, exactly like a transition to
   * any other genuinely new value.
   *
   * The `previousValueProp` reference check runs *before* any of that: this
   * effect is only allowed to reseed on a genuine transition of the raw
   * `value` prop, never merely because its resolved content (after the
   * `?? defaultScheduleValue()` fallback) currently disagrees with
   * `lastKnownValue`. That distinction is load-bearing for the uncontrolled
   * case (no `value` prop, ever): `lastKnownValue` still advances on every
   * local edit (via `emitChange`), so if this effect ever re-ran for a
   * reason unrelated to `value` itself changing — e.g. a host test harness
   * or framework integration that re-invokes effects on unrelated re-renders
   * — a guard keyed only on `scheduleValuesEqual(default, lastKnownValue)`
   * would misread "I have local edits the default doesn't have" as "the
   * parent reset me to default" and wipe an in-progress, uncontrolled edit.
   * Comparing the raw prop to what this effect saw last time is immune to
   * that: for an uncontrolled consumer `value` is always `undefined`, so
   * `previousValueProp` never disagrees with it, and the block below never
   * runs at all — regardless of how many times the effect itself re-fires.
   */
  $effect(() => {
    const incoming = value;
    const propChanged = incoming !== previousValueProp;
    previousValueProp = incoming;
    if (!propChanged) return;

    const resolved = incoming ?? defaultScheduleValue();
    // A genuine reset (`value` transitioning to `undefined`) always reseeds back
    // to the default, even when `lastKnownValue` already equals the default. A
    // non-committing mode switch (browsing Cron/Interval without emitting) leaves
    // `lastKnownValue` at the default while the visible mode/fields have moved on,
    // so a content-equality short-circuit here would swallow the reset and strand
    // the UI in the browsed mode. Content equality still guards the echo case for
    // defined values (parent handing back exactly what we just emitted is a no-op).
    if (incoming !== undefined && scheduleValuesEqual(resolved, lastKnownValue)) return;
    const seed = seedFieldsFromValue(resolved, resolvedAllowedModes);
    authoringMode = seed.authoringMode;
    cronFields = seed.cronFields;
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
    lastKnownValue = resolved;
  });

  $effect(() => {
    if (resolvedAllowedModes.includes(authoringMode)) return;
    const seed = seedFieldsFromValue(lastKnownValue, resolvedAllowedModes);
    authoringMode = seed.authoringMode;
    cronFields = seed.cronFields;
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
  });

  /**
   * `lastKnownValue` is updated optimistically, *before* the consumer's
   * `onchange` handler runs — this is what lets the resync effect above tell
   * "the parent echoed back exactly what I just emitted" (no-op, keep
   * mid-edit state) apart from "the parent handed me something genuinely
   * different" (reseed). A validating/authorizing parent that rejects an
   * edit is expected to express that by re-passing a `value` whose *content*
   * differs from the emitted edit (e.g. its own prior value) — that flows
   * through the same `scheduleValuesEqual` gate and correctly reverts the
   * fields (see the "controlled parent that rejects an edit" test).
   *
   * The one case this does not cover: a parent that rejects by leaving
   * `value` at the exact same object reference it already held. Svelte's
   * prop reactivity never marks an unchanged reference dirty, so no effect
   * re-runs at all — there is no signal for the child to observe. Detecting
   * that would require polling `value` on every local edit instead of only
   * when the prop itself changes, which reintroduces the race this whole
   * mechanism was built to avoid: the child's own optimistic write to
   * `lastKnownValue` happens synchronously in the same tick as the edit,
   * strictly before the parent's (asynchronous, next-render) echo, so a
   * same-tick comparison would misread "parent hasn't responded yet" as
   * "parent rejected this" and revert the edit the user just made. Left
   * unhandled by design — see PR discussion for the fuller tradeoff.
   */
  function emitChange(): void {
    lastKnownValue = currentValue;
    onchange?.(currentValue);
  }

  /**
   * Switching modes never emits a change by itself (browsing modes is
   * exploratory, not a commitment) — it only re-seeds the destination mode's
   * fields from `lastKnownValue`, losslessly where representable
   * (`valueToCronFields` always succeeds; `valueToInterval` returns
   * `undefined` for non-interval cron patterns, in which case the interval
   * fields are left as they were).
   */
  function handleAuthoringModeChange(nextMode: ScheduleAuthoringMode): void {
    if (nextMode === authoringMode) return;
    if (!modeIsAllowed(nextMode)) return;
    authoringMode = nextMode;
    if (nextMode === 'cron') {
      cronFields = valueToCronFields(lastKnownValue);
    } else if (nextMode === 'interval') {
      const interval = valueToInterval(lastKnownValue);
      if (interval) {
        intervalEvery = interval.every;
        intervalUnit = interval.unit;
      }
    } else if (nextMode === 'presets') {
      // Same "lossless where representable" seeding as the initial mount and
      // the resync effect: the only preset kind with a general inverse is
      // "every N" at a minutes/hours cadence (`seedFieldsFromValue` already
      // gates that through `valueToInterval` + the minutes/hours check).
      // Daily/weekly/monthly and non-divisor/day/week intervals have no
      // general inverse, so they fall back to the same neutral defaults used
      // everywhere else a value gets seeded into the preset fields.
      const seed = seedFieldsFromValue(lastKnownValue, resolvedAllowedModes);
      presetKind = seed.presetKind;
      presetEveryValue = seed.presetEveryValue;
      presetEveryUnit = seed.presetEveryUnit;
      presetDailyTime = seed.presetDailyTime;
      presetWeeklyDays = seed.presetWeeklyDays;
      presetWeeklyTime = seed.presetWeeklyTime;
      presetMonthlyDay = seed.presetMonthlyDay;
      presetMonthlyTime = seed.presetMonthlyTime;
    }
  }

  /**
   * Unlike the top-level authoring-mode tabs, switching the preset KIND
   * (Every N / Daily / Weekly / Monthly) changes what `currentValue` computes
   * to immediately — each kind lowers its own already-filled-in fields to a
   * value right away, there is no "browsing, not yet committed" state the way
   * there is for an empty cron/interval panel. So this commits like any other
   * field edit: it emits the newly derived value to a controlled parent.
   */
  function handlePresetKindChange(nextKind: PresetKind): void {
    if (nextKind === presetKind) return;
    presetKind = nextKind;
    emitChange();
  }

  function handleCronFieldChange(index: number, raw: string): void {
    const next = [...cronFields];
    next[index] = raw;
    cronFields = next;
    if (cronFieldsValid(next)) emitChange();
  }

  // `ScheduleValue.every` is contractually a positive integer; NumberInput can
  // yield decimals or nulls, so coerce every edit to `>= 1` whole units.
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

  /**
   * TimeField emits an empty string (via its native `change` event) when the
   * user clears it, and `parseTime('')` silently defaults to midnight —
   * accepting that here would let a user unintentionally submit a `00:00`
   * cron just by clearing the field, with the field itself showing blank
   * rather than "00:00". Reject the empty edit instead: don't touch the
   * backing state at all, and don't emit. Because the preset time fields use
   * a real two-way `bind:value` (not a one-way `value` prop), TimeField's own
   * next read of `value` pulls the unchanged, last-committed time back
   * through this setter's getter — so the field visually re-asserts the last
   * valid time instead of drifting from the emitted cron.
   */
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
  <SegmentedControl
    id={`${baseId}-mode`}
    label="Schedule authoring mode"
    variant="tablist"
    value={authoringMode}
    onchange={handleAuthoringModeChange}
    class="cinder-schedule-builder__mode-switch"
  >
    {#if modeIsAllowed('presets')}
      <Segment id={modeTabId('presets')} value="presets" controls={modePanelId('presets')}>
        Presets
      </Segment>
    {/if}
    {#if modeIsAllowed('cron')}
      <Segment id={modeTabId('cron')} value="cron" controls={modePanelId('cron')}>Cron</Segment>
    {/if}
    {#if modeIsAllowed('interval')}
      <Segment id={modeTabId('interval')} value="interval" controls={modePanelId('interval')}>
        Interval
      </Segment>
    {/if}
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
        onchange={handlePresetKindChange}
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
            bind:value={() => presetEveryValue, handlePresetEveryValueChange}
          />
          <Select
            id={`${baseId}-preset-every-unit`}
            label="Unit"
            options={PRESET_EVERY_UNIT_OPTIONS}
            value={presetEveryUnit}
            onchange={handlePresetEveryUnitChange}
          />
        </div>
      {:else if presetKind === 'daily'}
        <TimeField
          id={`${baseId}-preset-daily-time`}
          label="At"
          bind:value={() => presetDailyTime, handlePresetDailyTimeChange}
        />
      {:else if presetKind === 'weekly'}
        <div class="cinder-schedule-builder__weekday-group" role="group" aria-label="Days of week">
          {#each WEEKDAYS as day (day.value)}
            <Chip
              mode="toggle"
              label={day.short}
              aria-label={day.long}
              pressed={presetWeeklyDays.includes(day.value)}
              onpressedchange={() => toggleWeeklyDay(day.value)}
            />
          {/each}
        </div>
        <TimeField
          id={`${baseId}-preset-weekly-time`}
          label="At"
          bind:value={() => presetWeeklyTime, handlePresetWeeklyTimeChange}
        />
      {:else}
        <div class="cinder-schedule-builder__field-row">
          <NumberInput
            id={`${baseId}-preset-monthly-day`}
            label="Day of month"
            min={1}
            max={31}
            bind:value={() => presetMonthlyDay, handlePresetMonthlyDayChange}
          />
          <TimeField
            id={`${baseId}-preset-monthly-time`}
            label="At"
            bind:value={() => presetMonthlyTime, handlePresetMonthlyTimeChange}
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
      <div class="cinder-schedule-builder__cron-fields">
        {#each CRON_FIELDS as field, index (field.name)}
          {@const fieldError = validateCronField(cronFields[index] ?? '*', index)}
          <Input
            id={`${baseId}-cron-field-${index}`}
            label={field.name}
            description={field.hint}
            bind:value={
              () => cronFields[index] ?? '*', (next) => handleCronFieldChange(index, next)
            }
            {...fieldError ? { error: fieldError } : {}}
          />
        {/each}
      </div>
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
          bind:value={() => intervalEvery, handleIntervalEveryChange}
        />
        <Select
          id={`${baseId}-interval-unit`}
          label="Unit"
          options={INTERVAL_UNIT_OPTIONS}
          value={intervalUnit}
          onchange={handleIntervalUnitChange}
        />
      </div>
    </div>
  {/if}

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
