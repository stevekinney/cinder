<script lang="ts" module>
  export const title = 'Skip link';
  export const description =
    'Focusable skip link revealed on keyboard focus. Tab into this example to see it appear.';
</script>

<script lang="ts">
  import { VisuallyHidden } from '../../../../components/src/index.ts';
</script>

<div
  style="position: relative; min-height: 80px; border: 1px dashed var(--cinder-border); border-radius: 4px; padding: 1rem;"
>
  <VisuallyHidden as="a" href="#example-main" focusable>Skip to main content</VisuallyHidden>

  <nav aria-label="Example navigation">
    <a href="#example-main" style="margin-right: 1rem;">Home</a>
    <a href="#example-main" style="margin-right: 1rem;">About</a>
    <a href="#example-main">Contact</a>
  </nav>

  <!-- tabindex="-1" lets the browser move focus to this landmark on activation -->
  <main id="example-main" tabindex="-1" style="margin-top: 1rem;">
    <p>Main content area.</p>
  </main>
</div>
