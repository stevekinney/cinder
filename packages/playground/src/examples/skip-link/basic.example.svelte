<script lang="ts" module>
  export const title = 'Basic usage';
  export const description =
    'Tab into this example to reveal the skip link, then press Enter to jump focus to the main content area.';
</script>

<script lang="ts">
  import { SkipLink } from '@lostgradient/cinder/skip-link';
</script>

<div
  style="position: relative; min-height: 80px; border: 1px dashed var(--cinder-border); border-radius: 4px; padding: 1rem;"
>
  <SkipLink target="skip-link-example-main" />

  <nav aria-label="Example navigation">
    <a href="#skip-link-example-main" style="margin-right: 1rem;">Home</a>
    <a href="#skip-link-example-main" style="margin-right: 1rem;">About</a>
    <a href="#skip-link-example-main">Contact</a>
  </nav>

  <main id="skip-link-example-main" style="margin-top: 1rem;">
    <p>Main content area. Focus lands here when the skip link is activated.</p>
  </main>
</div>
