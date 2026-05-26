<script lang="ts" module>
  export const title = 'Multiple switches';
  export const description =
    'Several independent on/off settings inside a fieldset. Each Toggle renders its own visible label, so no external <label for> wrapper is needed.';
</script>

<script lang="ts">
  import { FormSection } from 'cinder/form-section';
  import { Toggle } from 'cinder/toggle';

  let emailNotifications = $state(true);
  let darkMode = $state(false);
  let autoSave = $state(true);
</script>

<FormSection as="fieldset" heading="Account preferences" columns={1}>
  <Toggle id="pref-email" bind:checked={emailNotifications} label="Email notifications" />
  <Toggle id="pref-dark" bind:checked={darkMode} label="Dark mode" />
  <Toggle id="pref-autosave" bind:checked={autoSave} label="Auto-save drafts" />
</FormSection>
