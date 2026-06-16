<script lang="ts" module>
  export const title = 'Completed (terminal state)';
  export const description =
    'Passing `currentStep={steps.length}` advances past the final step, marking every step complete — the terminal "done" state shown after a flow finishes.';
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

<Steps {steps} currentStep={steps.length} label="Onboarding" />
