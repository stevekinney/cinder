<script lang="ts" module>
  export const title = 'Basic usage';
  export const description =
    'Tab into this example to reveal the skip link, then press Enter to jump focus to the main content area.';
</script>

<script lang="ts">
  import { SkipLink } from '@lostgradient/cinder/skip-link';

  let { mountIdPrefix }: { mountIdPrefix?: string } = $props();
  const uid = $props.id();
  let mainId = $derived(`${mountIdPrefix ?? uid}-main`);
</script>

<div
  style="position: relative; min-height: 80px; border: 1px dashed var(--cinder-border); border-radius: 4px; padding: 1rem;"
>
  <SkipLink target={mainId} />

  <nav aria-label="Example navigation">
    <a href={`#${mainId}`} style="margin-right: 1rem;">Home</a>
    <a href={`#${mainId}`} style="margin-right: 1rem;">About</a>
    <a href={`#${mainId}`}>Contact</a>
  </nav>

  <main id={mainId} style="margin-top: 1rem;">
    <p>Main content area. Focus lands here when the skip link is activated.</p>
  </main>
</div>
