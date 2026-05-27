<script lang="ts" module>
  export const title = 'Prose reading column';
  export const description =
    'The prose width caps line length at a readable measure and centers the column.';
</script>

<script lang="ts">
  import { Container } from 'cinder/container';
</script>

<Container maxWidth="prose">
  <h1 style="font: var(--cinder-font-heading-lg); color: var(--cinder-text);">Reading column</h1>
  <p style="font: var(--cinder-font-body-md); color: var(--cinder-text-muted);">
    Container keeps long-form content at a comfortable measure and adds an inline gutter so text
    never touches the viewport edge.
  </p>
</Container>
