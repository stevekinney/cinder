<script lang="ts" module>
  export const title = 'HeroSection';
  export const description =
    'HeroSection with eyebrow copy, dual actions, trust note, and a media panel.';
</script>

<script lang="ts">
  import { Button } from '@lostgradient/cinder/button';
  import { HeroSection } from '@lostgradient/cinder/hero-section';
</script>

<HeroSection
  eyebrow="Now in public beta"
  title="Build polished product interfaces in days, not months."
  description="Cinder gives your team accessible UI foundations and high-level patterns so you can focus on shipping user value."
  align="start"
>
  {#snippet actions()}
    <Button label="Start free trial" variant="primary" />
    <Button label="View docs" variant="secondary" />
  {/snippet}

  {#snippet media()}
    <img
      src="https://placehold.co/640x420?text=Dashboard+Preview"
      alt="Product dashboard preview"
    />
  {/snippet}

  <p>Trusted by 2,000+ product teams worldwide.</p>
</HeroSection>
