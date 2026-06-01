<script lang="ts" module>
  export const title = 'Disabled and readonly states';
  export const description =
    'A disabled color field rejects all interaction; a readonly field displays the value but blocks editing.';
</script>

<script lang="ts">
  import { ColorField } from 'cinder/color-field';
</script>

<div style="display: flex; flex-direction: column; gap: 1rem; max-width: 20rem;">
  <div style="display: flex; flex-direction: column; gap: 0.5rem;">
    <label for="color-field-disabled" style="font-size: 0.875rem; font-weight: 500;">
      Disabled
    </label>
    <ColorField id="color-field-disabled" value="#ef4444" ariaLabel="Disabled color" disabled />
  </div>

  <div style="display: flex; flex-direction: column; gap: 0.5rem;">
    <label for="color-field-readonly" style="font-size: 0.875rem; font-weight: 500;">
      Read-only
    </label>
    <ColorField id="color-field-readonly" value="#22c55e" ariaLabel="Read-only color" readonly />
  </div>
</div>
