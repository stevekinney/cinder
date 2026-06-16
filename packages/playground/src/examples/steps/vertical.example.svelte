<script lang="ts" module>
  export const title = 'Vertical orientation';
  export const description =
    'Set `orientation="vertical"` to stack the steps top-to-bottom with the connector running down the side — useful in narrow side panels or wizards.';
</script>

<script lang="ts">
  import { Steps } from '@lostgradient/cinder/steps';
  import type { StepItem } from '@lostgradient/cinder/steps';

  const steps: StepItem[] = [
    { id: 'account', label: 'Account', description: 'Create your login' },
    { id: 'profile', label: 'Profile', description: 'Add your details' },
    { id: 'review', label: 'Review', description: 'Confirm and submit' },
  ];
</script>

<Steps {steps} currentStep={1} orientation="vertical" label="Onboarding" />
