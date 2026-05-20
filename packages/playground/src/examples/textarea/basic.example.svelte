<script lang="ts" module>
  export const title = 'Basic textarea';
  export const description = 'Multi-line text input with label and bound value.';
</script>

<script lang="ts">
  import { Textarea } from 'cinder/textarea';
  let bio = $state('');
</script>

<Textarea
  id="bio"
  bind:value={bio}
  label="Bio"
  description="Tell us a little about yourself."
  placeholder="I'm a designer who…"
/>
{#if bio.length > 0}
  <p style="margin-top: 0.5rem; color: var(--cinder-text-muted);">{bio.length} characters</p>
{/if}
