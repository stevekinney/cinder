<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    control: Snippet;
    class?: string;
  }

  let { control, class: className }: Props = $props();
</script>

<span class={['cinder-checkbox-field__control', className]} data-cinder-checkbox-indicator-shell>
  {@render control()}
  <span class="cinder-checkbox-field__indicator" aria-hidden="true"></span>
</span>
