<script lang="ts" module>
  import type { SVGAttributes } from 'svelte/elements';

  export type IconProps = Omit<SVGAttributes<SVGSVGElement>, 'class'> & {
    class?: string;
    size?: number | string;
  };
</script>

<script lang="ts">
  let { class: className, size = 16, ...rest }: IconProps = $props();
</script>

<svg
  class={className}
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
  {...rest}
>
  <path d="M12 5v14" />
  <path d="M5 12h14" />
</svg>
