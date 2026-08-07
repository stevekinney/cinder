<script lang="ts" module>
  export const title = 'Hero section';
  export const description =
    'A landing-page hero recipe: Container centers an eyebrow, headline, supporting copy, and CTA row beside an AspectRatio media panel.';
</script>

<script lang="ts">
  import { AspectRatio } from '@lostgradient/cinder/aspect-ratio';
  import { Button } from '@lostgradient/cinder/button';
  import { Container } from '@lostgradient/cinder/container';
</script>

<section style="padding-block: var(--cinder-space-10);">
  <Container maxWidth="wide">
    <div
      style="display: grid; grid-template-columns: repeat(auto-fit, minmax(20rem, 1fr)); gap: var(--cinder-space-8); align-items: center;"
    >
      <div
        style="display: flex; flex-direction: column; gap: var(--cinder-space-4); align-items: flex-start;"
      >
        <p
          style="margin: 0; text-transform: uppercase; letter-spacing: 0.04em; color: var(--cinder-accent-text); font-size: var(--cinder-text-xs); font-weight: var(--cinder-font-semibold);"
        >
          Now in public beta
        </p>
        <h2
          style="margin: 0; font-size: clamp(var(--cinder-text-3xl), 4vw, var(--cinder-text-5xl)); line-height: var(--cinder-leading-tight); max-inline-size: 24ch;"
        >
          Build polished product interfaces in days, not months.
        </h2>
        <p
          style="margin: 0; color: var(--cinder-text-muted); font-size: var(--cinder-text-lg); max-inline-size: 60ch;"
        >
          Cinder gives your team accessible UI foundations and high-level patterns so you can focus
          on shipping user value.
        </p>
        <div style="display: flex; flex-wrap: wrap; gap: var(--cinder-space-3);">
          <Button label="Start free trial" variant="primary" />
          <Button label="View docs" variant="secondary" />
        </div>
        <p style="margin: 0; color: var(--cinder-text-subtle); font-size: var(--cinder-text-sm);">
          Trusted by 2,000+ product teams worldwide.
        </p>
      </div>
      <div style="min-inline-size: 0;">
        <AspectRatio ratio="16/9">
          <!-- Placeholder media panel — a real app renders its product
               screenshot or video <img> here with the same geometry. -->
          <div
            role="img"
            aria-label="Product dashboard preview"
            style="inline-size: 100%; block-size: 100%; background: var(--cinder-surface-inset); border: 1px solid var(--cinder-border-muted); border-radius: var(--cinder-radius-md);"
          ></div>
        </AspectRatio>
      </div>
    </div>
  </Container>
</section>
