<script lang="ts" module>
  export const title = 'Logo cloud';
  export const description =
    'A trusted-by strip recipe: Grid auto-fills brand wordmarks under a heading, muted onto the subtle text ramp. Swap the wordmark spans for your real logo images.';
</script>

<script lang="ts">
  import { Container } from '@lostgradient/cinder/container';
  import { Grid } from '@lostgradient/cinder/grid';

  const logos = [
    { name: 'Acme', href: '#' },
    { name: 'Orbit', href: '#' },
    { name: 'Northline' },
    { name: 'Wave', href: '#' },
    { name: 'Summit' },
  ];

  // Placeholder wordmarks stand in for logo images; a real app renders
  // <img> marks here (typically with `filter: grayscale(1)` to mute them).
  const wordmarkStyle =
    'font-size: var(--cinder-text-xl); font-weight: var(--cinder-font-semibold); letter-spacing: -0.02em; color: var(--cinder-text-subtle);';
</script>

<section style="padding-block: var(--cinder-space-8);">
  <Container maxWidth="wide">
    <div style="display: grid; gap: var(--cinder-space-5);">
      <header style="display: grid; gap: var(--cinder-space-2);">
        <h2 style="margin: 0;">Trusted by modern product teams</h2>
      </header>

      <Grid
        as="ul"
        minItemWidth="8rem"
        gap="var(--cinder-space-5)"
        style="list-style: none; margin: 0; padding: 0; align-items: center;"
      >
        {#each logos as logo (logo.name)}
          <li style="display: flex; justify-content: center;">
            {#if logo.href}
              <a
                href={logo.href}
                style="display: inline-flex; text-decoration: none; {wordmarkStyle}"
              >
                {logo.name}
              </a>
            {:else}
              <span style={wordmarkStyle}>{logo.name}</span>
            {/if}
          </li>
        {/each}
      </Grid>
    </div>
  </Container>
</section>
