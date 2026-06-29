<script lang="ts" module>
  export const title = 'Footer layout';
  export const description = 'Brand copy, grouped links, and legal row composition.';
</script>

<script lang="ts">
  import { Footer } from '@lostgradient/cinder/footer';

  const groups = [
    {
      id: 'product',
      title: 'Product',
      links: [
        { id: 'features', label: 'Features', href: '/features' },
        { id: 'pricing', label: 'Pricing', href: '/pricing' },
      ],
    },
    {
      id: 'company',
      title: 'Company',
      links: [
        { id: 'about', label: 'About', href: '/about' },
        { id: 'careers', label: 'Careers', href: '/careers' },
      ],
    },
  ];

  const legalLinks = [
    { id: 'privacy', label: 'Privacy', href: '/privacy' },
    { id: 'terms', label: 'Terms', href: '/terms' },
  ];
</script>

<Footer
  brand="Acme"
  description="Design and engineering tools for modern teams."
  {groups}
  {legalLinks}
  copyright="© 2026 Acme Inc."
/>
