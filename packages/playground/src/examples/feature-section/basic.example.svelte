<script lang="ts" module>
  export const title = 'FeatureSection';
  export const description =
    'FeatureSection in split layout with icon-rich feature items and supporting screenshot.';
</script>

<script lang="ts">
  import { FeatureSection } from '@lostgradient/cinder/feature-section';

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

<FeatureSection
  title="Everything your product team needs"
  description="Ship UI that looks polished from day one, without rebuilding foundational components."
  layout="split"
  mediaPosition="end"
  {items}
>
  {#snippet media()}
    <img src="https://placehold.co/620x420?text=Feature+Preview" alt="Feature preview screen" />
  {/snippet}
</FeatureSection>
