<script lang="ts" module>
  export const title = 'Mega menu';
  export const description =
    'Top-level trigger/content navigation with viewport, indicator, and nested submenu.';
</script>

<script lang="ts">
  import { MegaMenu } from '@lostgradient/cinder/mega-menu';

  const items = [
    {
      id: 'products',
      label: 'Products',
      sections: [
        {
          id: 'platform',
          title: 'Platform',
          links: [
            {
              id: 'components',
              label: 'Components',
              href: '/components',
              description: 'Accessible building blocks for app UIs.',
            },
            {
              id: 'tokens',
              label: 'Design tokens',
              href: '/tokens',
              description: 'Color, typography, spacing, and motion tokens.',
            },
          ],
        },
      ],
      submenu: [
        {
          id: 'frontend',
          label: 'Frontend',
          sections: [
            {
              id: 'frontend-links',
              title: 'Frontend',
              links: [
                { id: 'svelte', label: 'Svelte', href: '/integrations/svelte' },
                { id: 'react', label: 'React', href: '/integrations/react' },
              ],
            },
          ],
        },
        {
          id: 'backend',
          label: 'Backend',
          sections: [
            {
              id: 'backend-links',
              title: 'Backend',
              links: [
                { id: 'apis', label: 'APIs', href: '/platform/apis' },
                { id: 'events', label: 'Events', href: '/platform/events' },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 'resources',
      label: 'Resources',
      sections: [
        {
          id: 'learn',
          title: 'Learn',
          links: [
            { id: 'docs', label: 'Documentation', href: '/docs' },
            { id: 'guides', label: 'Guides', href: '/guides' },
          ],
        },
      ],
    },
  ];
</script>

<MegaMenu {items} openOnHover showViewport showIndicator />
