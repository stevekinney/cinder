<script lang="ts" module>
  export const title = 'Multiple switches';
  export const description =
    'Several independent on/off settings inside a fieldset/legend, each with a visible adjacent label.';
</script>

<script lang="ts">
  import { Toggle } from 'cinder/toggle';
  let emailNotifications = $state(true);
  let darkMode = $state(false);
  let autoSave = $state(true);
</script>

<fieldset
  style="display: flex; flex-direction: column; gap: 0.6rem; padding: 0.75rem 1rem; border: 1px solid var(--cinder-border-muted); border-radius: 0.5rem;"
>
  <legend style="padding: 0 0.25rem; font-weight: 600;">Account preferences</legend>

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
</fieldset>
