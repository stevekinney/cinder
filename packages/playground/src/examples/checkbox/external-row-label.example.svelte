<script lang="ts" module>
  export const title = 'External row label';
  export const description = 'A control-only checkbox associated with a rich row label.';
</script>

<script lang="ts">
  import { Checkbox } from '@lostgradient/cinder/checkbox';

  let selected = $state(false);
</script>

<div
  style="display: grid; grid-template-columns: auto 1fr; align-items: start; gap: 0.75rem; max-width: 26rem;"
>
  <Checkbox id="repository-main" fieldClass="repository-checkbox" bind:checked={selected} />
  <label
    for="repository-main"
    style="display: flex; justify-content: space-between; gap: 1rem; cursor: pointer;"
  >
    <span style="display: flex; flex-direction: column; gap: 0.125rem;">
      <strong>lostgradient/cinder</strong>
      <span style="color: var(--cinder-text-muted);">Component library</span>
    </span>
    <span
      style="align-self: start; border: 1px solid var(--cinder-border); border-radius: var(--cinder-radius-sm); padding: 0.125rem 0.375rem; font-size: var(--cinder-text-xs);"
    >
      Public
    </span>
  </label>
</div>
