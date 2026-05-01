<script lang="ts" module>
  export const title = 'Custom separator';
  export const description = 'Override the default "/" separator with any string or snippet.';
</script>

<script lang="ts">
  import { Breadcrumbs } from '../../../../components/src/index.ts';
</script>

<Breadcrumbs
  separator="›"
  items={[
    { label: 'Home', href: '/' },
    { label: 'Library', href: '/library' },
    { label: 'Music', href: '/library/music' },
    { label: 'Albums' },
  ]}
/>
