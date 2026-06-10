<script lang="ts" module>
  export const title = 'Account settings panel';
  export const description =
    'FormSection groups related account and privacy controls under a headed section. Text fields use FormField + Input; on/off settings use Toggle standalone (it renders its own label).';
</script>

<script lang="ts">
  import { FormField } from '@lostgradient/cinder/form-field';
  import { FormSection } from '@lostgradient/cinder/form-section';
  import { Input } from '@lostgradient/cinder/input';
  import { Toggle } from '@lostgradient/cinder/toggle';

  let displayName = $state('');
  let email = $state('');
  let publicProfile = $state(true);
  let marketingEmails = $state(false);
</script>

<div style="display: flex; flex-direction: column; gap: 2rem;">
  <FormSection
    heading="Account"
    headingLevel={2}
    description="Update your display name and email address."
    columns={2}
  >
    <FormField id="display-name" label="Display name">
      <Input id="display-name" bind:value={displayName} placeholder="Jane Smith" />
    </FormField>
    <FormField id="account-email" label="Email address">
      <Input id="account-email" bind:value={email} type="email" placeholder="jane@example.com" />
    </FormField>
  </FormSection>

  <FormSection
    heading="Privacy"
    headingLevel={2}
    description="Control who can see your profile and what communications you receive."
  >
    <Toggle id="public-profile" bind:checked={publicProfile} label="Public profile" />
    <Toggle id="marketing-emails" bind:checked={marketingEmails} label="Marketing emails" />
  </FormSection>
</div>
