<script lang="ts" module>
  export const title = 'Interactive steps';
  export const description =
    'A step becomes navigable when its `StepItem` carries an `href` (renders the body as a link) or an `onclick` (renders it as a button). The marker and connector stay decorative — only the body region is the focusable, clickable target.';
</script>

<script lang="ts">
  import { Steps } from '@lostgradient/cinder/steps';
  import type { StepItem } from '@lostgradient/cinder/steps';

  let current = $state(1);

  const steps: StepItem[] = [
    { id: 'account', label: 'Account', description: 'Create your login', href: '#account' },
    {
      id: 'profile',
      label: 'Profile',
      description: 'Jump back to edit',
      onclick: () => (current = 1),
    },
    { id: 'review', label: 'Review', description: 'Confirm and submit' },
  ];
</script>

<Steps {steps} currentStep={current} label="Onboarding" />
