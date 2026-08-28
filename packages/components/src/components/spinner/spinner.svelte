<script lang="ts" module>
  /**
   * @cinder
   * @category feedback
   * @status stable
   * @purpose Compact role="status" indicator that communicates indeterminate background work with an accessible loading label.
   * @tag feedback
   * @tag loading
   * @useWhen Showing that a short asynchronous action is in progress without a predictable completion time.
   * @useWhen Indicating inline busy state next to a control while a request resolves.
   * @avoidWhen Reserving layout space for content with a known final shape — use skeleton.
   * @avoidWhen Reporting determinate progress with a measurable percentage — use progress.
   * @related skeleton, progress
   */
  export type { SpinnerProps, SpinnerSize, SpinnerVariant } from './spinner.types.ts';
</script>

<script lang="ts">
  import { classNames } from '../../utilities/class-names.ts';
  import type { SpinnerProps } from './spinner.types.ts';

  const {
    size = 'md',
    variant = 'default',
    label = 'Loading',
    class: className,
    ...rest
  }: SpinnerProps = $props();
</script>

<span
  {...rest}
  class={classNames('cinder-spinner', className)}
  role="status"
  aria-label={label}
  data-cinder-size={size}
  data-cinder-variant={variant}
>
  {#if variant === 'arc'}
    <svg class="cinder-spinner__arc" viewBox="0 0 24 24" aria-hidden="true">
      <circle class="cinder-spinner__arc-track" cx="12" cy="12" r="9"></circle>
      <circle class="cinder-spinner__arc-indicator" cx="12" cy="12" r="9"></circle>
    </svg>
  {/if}
  <span class="cinder-spinner__sr-only">{label}</span>
</span>
