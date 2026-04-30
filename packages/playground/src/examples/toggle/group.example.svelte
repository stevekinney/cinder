<script lang="ts" module>
  export const title = 'Toggle group with visible labels';
  export const description =
    'Three switches grouped under a fieldset/legend so sighted and assistive-tech users see the same labels.';
</script>

<script lang="ts">
  import { Toggle } from '../../../../components/src/index.ts';

  let bold = $state(false);
  let italic = $state(false);
  let underline = $state(false);
</script>

<fieldset
  style="display: flex; flex-direction: column; gap: 0.5rem; padding: 0.75rem; border: 1px solid var(--cinder-border-muted); border-radius: 0.5rem;"
>
  <legend style="padding: 0 0.25rem; font-weight: 600;">Text formatting</legend>
  <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
    <Toggle id="bold" bind:checked={bold} label="Bold" />
    <span><strong>Bold</strong></span>
  </label>
  <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
    <Toggle id="italic" bind:checked={italic} label="Italic" />
    <span><em>Italic</em></span>
  </label>
  <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
    <Toggle id="underline" bind:checked={underline} label="Underline" />
    <span style="text-decoration: underline;">Underline</span>
  </label>
</fieldset>
