<script lang="ts" module>
  export const title = 'CtaSection';
  export const description =
    'CtaSection with accent tone and primary/secondary conversion actions.';
</script>

<script lang="ts">
  import { CtaSection } from '@lostgradient/cinder/cta-section';
</script>

<CtaSection
  title="Ready to level up your product UI?"
  description="Start with Cinder and ship accessible components with confidence."
  primaryActionLabel="Start free"
  secondaryActionLabel="Talk to sales"
  tone="accent"
>
  <span>No credit card required.</span>
</CtaSection>
