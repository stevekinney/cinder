<script lang="ts" module>
  export const title = 'Basic breadcrumbs';
  export const description = 'Navigation trail with the final entry as the current page.';
</script>

<script lang="ts">
  import { Breadcrumbs } from '../../../../components/src/index.ts';
</script>

<Breadcrumbs
  items={[
    { label: 'Home', href: '/' },
    { label: 'Projects', href: '/projects' },
    { label: 'Cinder', href: '/projects/cinder' },
    { label: 'Settings' },
  ]}
/>
