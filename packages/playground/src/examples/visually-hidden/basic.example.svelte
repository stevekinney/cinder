<script lang="ts" module>
  export const title = 'Icon-only button label';
  export const description =
    'Supplemental label for an icon-only button — visible to screen readers, hidden from sighted users.';
</script>

<script lang="ts">
  import { Button } from '@lostgradient/cinder/button';
  import { VisuallyHidden } from '@lostgradient/cinder/visually-hidden';
</script>

<Button>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
  </svg>
  <VisuallyHidden>Copy code to clipboard</VisuallyHidden>
</Button>
