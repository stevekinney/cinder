<script lang="ts" module>
  export type SpinnerSize = 'sm' | 'md' | 'lg';

  export type SpinnerProps = {
    size?: SpinnerSize;
    label?: string;
    class?: string;
  };
</script>

<script lang="ts">
  import { cn } from '../utilities/class-names.ts';

  const { size = 'md', label = 'Loading...', class: className }: SpinnerProps = $props();
</script>

<span
  class={cn('cinder-spinner', className)}
  role="status"
  aria-label={label}
  data-cinder-size={size}
>
  <span class="cinder-spinner__sr-only">{label}</span>
</span>
