import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';

/**
 * The unit for an interval recurrence.
 */
export type ScheduleIntervalUnit = 'minutes' | 'hours' | 'days' | 'weeks';

/**
 * The emitted, lossless recurrence value. There are only ever TWO value
 * variants — `cron` and `interval` — even though the UI offers a third
 * "presets" authoring mode. Presets are sugar that lower to one of these two
 * (e.g. "every 15 minutes" → `interval`; "daily at 09:00" → `cron`); there is
 * no `mode: 'preset'` in the value a consumer receives.
 */
export type ScheduleValue =
  | {
      /** Discriminator: a 5-field cron recurrence. */
      mode: 'cron';
      /** The 5-field cron expression, space-separated (minute hour day-of-month month day-of-week). */
      expression: string;
    }
  | {
      /** Discriminator: a fixed-interval recurrence. */
      mode: 'interval';
      /** How many `unit`s between fires. A positive integer. */
      every: number;
      /** The interval unit. */
      unit: ScheduleIntervalUnit;
    };

/**
 * The authoring mode surfaced in the UI's SegmentedControl. Distinct from
 * {@link ScheduleValue}'s `mode` discriminator: `presets` is an authoring
 * convenience that emits a `cron` or `interval` value.
 */
export type ScheduleAuthoringMode = 'presets' | 'cron' | 'interval';

/**
 * A single computed upcoming fire, as returned by the injected
 * {@link ScheduleBuilderProps.computeNextFires} callback. The component never
 * computes or formats times itself (it ships no date/cron dependency): the
 * consumer returns already-formatted display strings.
 */
export type ScheduleFire = {
  /** Stable identity for the keyed preview list. */
  id: string;
  /** Human-readable label for this fire, e.g. "Mon Jun 1, 09:00". */
  label: string;
};

/**
 * Props for the ScheduleBuilder component.
 *
 * ScheduleBuilder is a presentational recurrence-definition control. It owns
 * no scheduling execution, persistence, or date math. It is date-library-free:
 * the "next N fires" preview is produced by the injected `computeNextFires`
 * callback, and degrades gracefully (the preview is hidden) when the callback
 * is absent. Scope is recurrence only — overlap policy, jitter, and backfill
 * belong to the consumer's surrounding form.
 */
export type ScheduleBuilderProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  'class' | 'children' | 'onchange'
> & {
  /**
   * The current recurrence value (controlled). Pass the value returned from
   * `onchange` back in to commit an edit. When omitted, the component starts
   * from a sensible default (`interval`, every 15 minutes).
   */
  value?: ScheduleValue | undefined;
  /**
   * Called whenever the user edits the recurrence. Receives the next lossless
   * {@link ScheduleValue}. The consumer owns persistence and validation.
   */
  onchange?: ((value: ScheduleValue) => void) | undefined;
  /**
   * Injected next-fires computation. The component passes the current value and
   * the requested count and renders whatever fires the consumer returns. When
   * omitted, the preview list is hidden (the component ships no date logic).
   */
  computeNextFires?: ((value: ScheduleValue, count: number) => ScheduleFire[]) | undefined;
  /**
   * How many upcoming fires to request from `computeNextFires`. Defaults to 5.
   */
  previewCount?: number | undefined;
  /**
   * Timezone label rendered in the always-visible timezone display slot, e.g.
   * "America/New_York" or "UTC". Purely presentational — the component does not
   * interpret it. When omitted, provide the `timezone` snippet instead, or the
   * slot renders nothing.
   */
  timezoneLabel?: string | undefined;
  /**
   * Custom content for the timezone display slot. Takes precedence over
   * `timezoneLabel` when both are supplied.
   */
  timezone?: Snippet | undefined;
  /** Accessible label for the whole control. Defaults to "Schedule". */
  label?: string | undefined;
  /** Additional CSS classes applied to the root element. */
  class?: string | undefined;
};

/**
 * Schema-facing mirror of {@link ScheduleValue}.
 * @schemaObject
 */
export type ScheduleValueSchema =
  | { mode: 'cron'; expression: string }
  | { mode: 'interval'; every: number; unit: ScheduleIntervalUnit };

/**
 * Cinder-specific schema surface for ScheduleBuilder.
 *
 * The `onchange`, `computeNextFires`, and `timezone` props are documented but
 * unsupported by JSON Schema because functions and snippets cannot be modeled.
 */
export type ScheduleBuilderSchemaProps = {
  /**
   * The current recurrence value (controlled). When omitted, the component
   * starts from a sensible default (`interval`, every 15 minutes).
   * @schemaObject
   */
  value?: ScheduleValueSchema | undefined;
  /**
   * How many upcoming fires to request from `computeNextFires`. Defaults to 5.
   */
  previewCount?: number | undefined;
  /** Timezone label rendered in the always-visible timezone display slot. */
  timezoneLabel?: string | undefined;
  /** Accessible label for the whole control. Defaults to "Schedule". */
  label?: string | undefined;
  /** Additional CSS classes applied to the root element. */
  class?: string | undefined;
};
