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

  const clockSubscribers = new Set<(now: number) => void>();
  let clockTimer: number | undefined;

  function subscribeToClock(subscriber: (now: number) => void): () => void {
    clockSubscribers.add(subscriber);
    if (clockTimer === undefined) {
      clockTimer = window.setInterval(() => {
        const now = Date.now();
        for (const notify of clockSubscribers) notify(now);
      }, 30_000);
    }
    return () => {
      clockSubscribers.delete(subscriber);
      if (clockSubscribers.size === 0 && clockTimer !== undefined) {
        window.clearInterval(clockTimer);
        clockTimer = undefined;
      }
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
    return subscribeToClock((nextNow) => (now = nextNow));
  });
</script>

<time
  class={classNames('cinder-relative-time', customClassName)}
  datetime={validTimestamp ? new Date(timestamp).toISOString() : undefined}
  {...rest}
  >{relative}{#if children}{@render children()}{/if}</time
>
