<script lang="ts" module>
  export const title = 'Skipped step';
  export const description =
    'Use `state: "skipped"` when a flow advances past a step without completing it.';
</script>

<script lang="ts">
  import { Steps } from '@lostgradient/cinder/steps';
  import type { StepItem } from '@lostgradient/cinder/steps';

  const steps: StepItem[] = [
    { id: 'account', label: 'Account', description: 'Create your login' },
    {
      id: 'profile',
      label: 'Profile',
      description: 'Optional details were skipped',
      state: 'skipped',
    },
    { id: 'review', label: 'Review', description: 'Confirm and submit' },
  ];
</script>

<Steps {steps} currentStep={2} label="Onboarding" />
