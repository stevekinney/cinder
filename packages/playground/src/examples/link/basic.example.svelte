<script lang="ts" module>
  export const title = 'Link';
  export const description = 'Inline text link with underline and color variants.';
</script>

<script lang="ts">
  import { Link } from 'cinder/link';
</script>

<!-- Links inside a text block must stay distinguishable without relying on color
     (WCAG 1.4.1 / axe link-in-text-block), so in-prose links use underline="always". -->
<p>
  Read the
  <Link href="/docs" underline="always">documentation</Link>
  for more details, or visit the
  <Link href="https://example.com" external underline="always">official site</Link>.
</p>

<!-- Underline/color variants shown as a standalone list (one link per row), not inside
     running prose. Outside a text block the hover/none treatments are an acceptable,
     intentional choice and don't trip axe's link-in-text-block rule. -->
<ul style="list-style: none; padding: 0; display: flex; flex-direction: column; gap: 0.5rem;">
  <li><Link href="/pricing" underline="always">Always underlined</Link></li>
  <li><Link href="/pricing" underline="hover">Underline on hover</Link></li>
  <li><Link href="/pricing" underline="none">No underline</Link></li>
  <li><Link href="/pricing" color="inherit" underline="always">Inherits text color</Link></li>
  <li><Link href="/pricing" disabled>Disabled link</Link></li>
</ul>
