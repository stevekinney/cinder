<script lang="ts" module>
  export const title = 'Link';
  export const description = 'Inline text link with underline and color variants.';
</script>

<script lang="ts">
  import { Link } from 'cinder/link';
</script>

<p>
  Read the
  <Link href="/docs">documentation</Link>
  for more details, or visit the
  <Link href="https://example.com" external>official site</Link>.
</p>

<p>
  <Link href="/pricing" underline="always">Always underlined</Link>
  &nbsp;·&nbsp;
  <Link href="/pricing" underline="none">Never underlined</Link>
  &nbsp;·&nbsp;
  <Link href="/pricing" color="inherit">Inherits text color</Link>
  &nbsp;·&nbsp;
  <Link href="/pricing" disabled>Disabled link</Link>
</p>
