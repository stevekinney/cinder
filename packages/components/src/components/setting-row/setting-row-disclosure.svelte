<script lang="ts">
  import Button from '../button/button.svelte';
  import type { SettingRowDisclosureProps } from './setting-row.types.ts';
  let { expanded = $bindable(false), controls, children }: SettingRowDisclosureProps = $props();

  function toggle() {
    expanded = !expanded;
  }
</script>

<Button variant="ghost" aria-expanded={expanded} aria-controls={controls} onclick={toggle}
  >{@render children()}</Button
>
