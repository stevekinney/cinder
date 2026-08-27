<script lang="ts" module>
  export const title = 'Call to action';
  export const description =
    'A conversion band recipe: Container wraps an accent-tinted panel with a short headline, supporting copy, and primary/secondary action buttons.';
</script>

<script lang="ts">
  import { Button } from '@lostgradient/cinder/button';
  import { Container } from '@lostgradient/cinder/container';
</script>

<section style="padding-block: var(--cinder-space-10);">
  <Container maxWidth="wide">
    <div
      style="border: 1px solid color-mix(in oklch, var(--cinder-accent-solid), transparent 65%); border-radius: var(--cinder-radius-lg); background: color-mix(in oklch, var(--cinder-accent-solid), transparent 92%); padding: var(--cinder-space-7); display: grid; gap: var(--cinder-space-4); justify-items: center; text-align: center;"
    >
      <h2
        style="margin: 0; font-size: var(--cinder-text-3xl); line-height: var(--cinder-leading-tight);"
      >
        Ready to level up your product UI?
      </h2>
      <p style="margin: 0; color: var(--cinder-text-muted); max-inline-size: 60ch;">
        Start with Cinder and ship accessible components with confidence.
      </p>
      <div style="display: flex; flex-wrap: wrap; gap: var(--cinder-space-3);">
        <Button label="Start free" variant="primary" />
        <Button label="Talk to sales" variant="secondary" />
      </div>
      <p style="margin: 0; color: var(--cinder-text-subtle); font-size: var(--cinder-text-sm);">
        No credit card required.
      </p>
    </div>
  </Container>
</section>
