<script lang="ts" module>
  export const title = 'Feature grid';
  export const description =
    'A product-features section recipe: Grid with minItemWidth lays out icon + title + description tiles under a section heading.';
</script>

<script lang="ts">
  import { Container } from '@lostgradient/cinder/container';
  import { Grid } from '@lostgradient/cinder/grid';

  const items = [
    {
      icon: '⚡',
      title: 'Fast setup',
      description: 'Install, import styles, and start composing in minutes.',
    },
    {
      icon: '♿',
      title: 'Accessible by default',
      description: 'Keyboard interaction and semantic markup are built in.',
    },
    {
      icon: '🎨',
      title: 'Theme-ready tokens',
      description: 'Adapt spacing, type, and color with CSS custom properties.',
    },
  ];
</script>

<section style="padding-block: var(--cinder-space-10);">
  <Container maxWidth="wide">
    <div style="display: grid; gap: var(--cinder-space-6);">
      <header style="display: grid; gap: var(--cinder-space-3); max-inline-size: 70ch;">
        <h2
          style="margin: 0; font-size: var(--cinder-text-3xl); line-height: var(--cinder-leading-tight);"
        >
          Everything your product team needs
        </h2>
        <p style="margin: 0; color: var(--cinder-text-muted);">
          Ship UI that looks polished from day one, without rebuilding foundational components.
        </p>
      </header>

      <Grid
        as="ul"
        minItemWidth="14rem"
        gap="var(--cinder-space-4)"
        style="list-style: none; margin: 0; padding: 0;"
      >
        {#each items as item (item.title)}
          <li
            style="border: 1px solid var(--cinder-border); border-radius: var(--cinder-radius-lg); padding: var(--cinder-space-4); background: var(--cinder-surface-raised); display: grid; gap: var(--cinder-space-2);"
          >
            <span
              aria-hidden="true"
              style="color: var(--cinder-accent-text); font-size: var(--cinder-text-xl); line-height: 1;"
            >
              {item.icon}
            </span>
            <h3 style="margin: 0; font-size: var(--cinder-text-base);">{item.title}</h3>
            <p
              style="margin: 0; color: var(--cinder-text-muted); font-size: var(--cinder-text-sm);"
            >
              {item.description}
            </p>
          </li>
        {/each}
      </Grid>
    </div>
  </Container>
</section>
