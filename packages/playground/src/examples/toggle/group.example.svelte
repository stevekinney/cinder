<script lang="ts" module>
  export const title = 'Multiple switches';
  export const description =
    'Several independent on/off settings inside a fieldset/legend, each with a visible <label for> tied to its switch.';
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
    <label for="pref-email">Email notifications</label>
  </div>

  <div style="display: flex; align-items: center; gap: 0.75rem;">
    <Toggle id="pref-dark" bind:checked={darkMode} label="Dark mode" />
    <label for="pref-dark">Dark mode</label>
  </div>

  <div style="display: flex; align-items: center; gap: 0.75rem;">
    <Toggle id="pref-autosave" bind:checked={autoSave} label="Auto-save drafts" />
    <label for="pref-autosave">Auto-save drafts</label>
  </div>
</FormSection>
