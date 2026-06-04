<script lang="ts" module>
  export const title = 'Basic typography';
  export const description = 'Named typographic variants mapped to the design token scale.';
</script>

<script lang="ts">
  import { Typography } from '@lostgradient/cinder/typography';
</script>

<div style="display: flex; flex-direction: column; gap: 1rem;">
  <Typography variant="h1">Heading 1</Typography>
  <Typography variant="h2">Heading 2</Typography>
  <Typography variant="h3">Heading 3</Typography>
  <Typography variant="h4">Heading 4</Typography>
  <Typography variant="h5">Heading 5</Typography>
  <Typography variant="h6">Heading 6</Typography>
  <Typography variant="subtitle1">Subtitle 1 — rendered as p</Typography>
  <Typography variant="subtitle2">Subtitle 2 — rendered as p</Typography>
  <Typography variant="body1">Body 1 — the default variant, rendered as p.</Typography>
  <Typography variant="body2">Body 2 — smaller paragraph text, rendered as p.</Typography>
  <Typography variant="caption">Caption — rendered as span.</Typography>
  <Typography variant="overline">Overline — uppercase, rendered as span.</Typography>
  <Typography variant="label">Label — medium weight, rendered as span.</Typography>
  <Typography variant="h2" component="span">h2 styled as a span (component override)</Typography>
  <Typography variant="body1" gutterBottom>Body with gutterBottom.</Typography>
  <Typography variant="body1" noWrap style="max-width: 200px;">
    noWrap — this long text will be truncated with an ellipsis when it overflows.
  </Typography>
  <Typography variant="caption" noWrap style="max-width: 200px;">
    noWrap also truncates inline variants like caption, not just block ones.
  </Typography>
</div>
