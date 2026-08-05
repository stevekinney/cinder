<script lang="ts" module>
  export const title = 'Disabled checkbox group';
  export const description =
    'A disabled CheckboxGroup dims every child checkbox through the native fieldset cascade, with no per-checkbox disabled prop.';
</script>

<script lang="ts">
  import { Checkbox } from '@lostgradient/cinder/checkbox';
  import { CheckboxGroup } from '@lostgradient/cinder/checkbox-group';
</script>

<CheckboxGroup label="Notification channels" disabled>
  <Checkbox id="disabled-fieldset-email" label="Email" checked />
  <Checkbox id="disabled-fieldset-sms" label="SMS" />
</CheckboxGroup>
