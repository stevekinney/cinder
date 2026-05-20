<script lang="ts" module>
  export const title = 'as prop — description list';
  export const description =
    'Visually hidden <dt> inside a narrow description-list layout, where the term is implied by context.';
</script>

<script lang="ts">
  import { VisuallyHidden } from 'cinder/visually-hidden';
</script>

<dl style="display: grid; grid-template-columns: auto 1fr; gap: 0.25rem 1rem;">
  <dt>
    <VisuallyHidden as="span">Created</VisuallyHidden>
  </dt>
  <dd>January 1, 2025</dd>

  <dt>
    <VisuallyHidden as="span">Updated</VisuallyHidden>
  </dt>
  <dd>March 15, 2025</dd>

  <dt>
    <VisuallyHidden as="span">Author</VisuallyHidden>
  </dt>
  <dd>Alice Smith</dd>
</dl>
