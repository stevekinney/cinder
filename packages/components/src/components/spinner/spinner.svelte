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
  export type { SpinnerProps, SpinnerSize } from './spinner.types.ts';
</script>

<script lang="ts">
  import { cn } from '../../utilities/class-names.ts';
  import type { SpinnerProps } from './spinner.types.ts';

  const { size = 'md', label = 'Loading', class: className }: SpinnerProps = $props();
</script>

<span
  class={cn('cinder-spinner', className)}
  role="status"
  aria-label={label}
  data-cinder-size={size}
>
  <span class="cinder-spinner__sr-only">{label}</span>
</span>
