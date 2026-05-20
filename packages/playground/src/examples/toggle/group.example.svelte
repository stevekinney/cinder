<script lang="ts" module>
  export const title = 'Multiple switches';
  export const description =
    'Several independent on/off settings inside a fieldset/legend, each with a visible adjacent label.';
</script>

<script lang="ts">
  import { FormSection, Toggle } from '../../../../components/src/index.ts';

  let emailNotifications = $state(true);
  let darkMode = $state(false);
  let autoSave = $state(true);
</script>

<FormSection as="fieldset" heading="Account preferences" columns={1}>
  <div style="display: flex; align-items: center; gap: 0.75rem;">
    <Toggle id="pref-email" bind:checked={emailNotifications} label="Email notifications" />
    <span aria-hidden="true">Email notifications</span>
  </div>

  <div style="display: flex; align-items: center; gap: 0.75rem;">
    <Toggle id="pref-dark" bind:checked={darkMode} label="Dark mode" />
    <span aria-hidden="true">Dark mode</span>
  </div>

  <div style="display: flex; align-items: center; gap: 0.75rem;">
    <Toggle id="pref-autosave" bind:checked={autoSave} label="Auto-save drafts" />
    <span aria-hidden="true">Auto-save drafts</span>
  </div>
</FormSection>
