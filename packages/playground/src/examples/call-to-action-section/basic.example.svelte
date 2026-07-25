<script lang="ts" module>
  export const title = 'CallToActionSection';
  export const description =
    'CallToActionSection with accent tone and primary/secondary conversion actions.';
</script>

<script lang="ts">
  import { CallToActionSection } from '@lostgradient/cinder/call-to-action-section';
</script>

<CallToActionSection
  title="Ready to level up your product UI?"
  description="Start with Cinder and ship accessible components with confidence."
  primaryActionLabel="Start free"
  secondaryActionLabel="Talk to sales"
  tone="accent"
>
  <span>No credit card required.</span>
</CallToActionSection>
