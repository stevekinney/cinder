<script lang="ts" module>
  /**
   * @cinder
   * @category data-display
   * @status beta
   * @purpose Localized, live-updating relative date label for timestamps.
   * @tag relative-time
   * @useWhen Showing when a message, issue, or event happened.
   * @avoidWhen An exact calendar date is required.
   * @related date-picker
   * @rationale Nearest alternative: time element — RelativeTime owns localized relative phrasing and ticking.
   */
  export type { RelativeTimeProps } from './relative-time.types.ts';

  type ClockSubscriber = {
    notify: (now: number) => void;
    getDelay: (now: number) => number;
    nextAt: number;
  };
  const clockSubscribers = new Set<ClockSubscriber>();
  let clockTimer: number | undefined;

  function scheduleClock() {
    if (clockTimer !== undefined) window.clearTimeout(clockTimer);
    if (clockSubscribers.size === 0) {
      clockTimer = undefined;
      return;
    }
    const now = Date.now();
    const nextAt = Math.min(...[...clockSubscribers].map(({ nextAt }) => nextAt));
    clockTimer = window.setTimeout(
      () => {
        clockTimer = undefined;
        const nextNow = Date.now();
        for (const subscriber of clockSubscribers) {
          if (subscriber.nextAt <= nextNow) {
            subscriber.notify(nextNow);
            subscriber.nextAt = nextNow + subscriber.getDelay(nextNow);
          }
        }
        scheduleClock();
      },
      Math.max(1_000, nextAt - now),
    );
  }

  function subscribeToClock(subscriber: ClockSubscriber): () => void {
    subscriber.nextAt = Date.now() + subscriber.getDelay(Date.now());
    clockSubscribers.add(subscriber);
    scheduleClock();
    return () => {
      clockSubscribers.delete(subscriber);
      scheduleClock();
    };
  }
</script>

<script lang="ts">
  import { getLocaleContext } from '../../_internal/locale-context.ts';
  import { classNames } from '../../utilities/class-names.ts';

  import type { RelativeTimeProps } from './relative-time.types.ts';

  let {
    date = Date.now(),
    locale,
    tick = true,
    class: customClassName,
    children,
    ...rest
  }: RelativeTimeProps = $props();
  const localeContext = getLocaleContext();
  let now = $state(Date.now());
  let hasMounted = $state(false);
  $effect(() => {
    hasMounted = true;
    now = Date.now();
  });
  const resolvedLocale = $derived(
    locale ?? localeContext?.locale ?? (hasMounted ? navigator.language : 'en-US'),
  );
  const timestamp = $derived(date instanceof Date ? date.getTime() : new Date(date).getTime());
  const validTimestamp = $derived(Number.isFinite(timestamp));
  const clockDelay = $derived.by(() => {
    const absolute = Math.abs(timestamp - now);
    return absolute < 60_000
      ? 1_000
      : absolute < 3_600_000
        ? 60_000
        : absolute < 86_400_000
          ? 3_600_000
          : 86_400_000;
  });
  const relative = $derived.by(() => {
    if (!validTimestamp) return 'Invalid date';
    const delta = timestamp - now;
    const absolute = Math.abs(delta);
    const [value, unit] =
      absolute < 60_000
        ? [Math.round(delta / 1000), 'second']
        : absolute < 3_600_000
          ? [Math.round(delta / 60_000), 'minute']
          : absolute < 86_400_000
            ? [Math.round(delta / 3_600_000), 'hour']
            : [Math.round(delta / 86_400_000), 'day'];
    return new Intl.RelativeTimeFormat(resolvedLocale, { numeric: 'auto' }).format(
      value,
      unit as Intl.RelativeTimeFormatUnit,
    );
  });
  $effect(() => {
    if (!tick || typeof window === 'undefined') return;
    return subscribeToClock({
      notify: (nextNow) => (now = nextNow),
      getDelay: () => clockDelay,
      nextAt: 0,
    });
  });
</script>

<time
  class={classNames('cinder-relative-time', customClassName)}
  datetime={validTimestamp ? new Date(timestamp).toISOString() : undefined}
  {...rest}
  >{relative}{#if children}{@render children()}{/if}</time
>
