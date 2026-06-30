<script lang="ts" module>
  export const title = 'BlogSection';
  export const description =
    'BlogSection showing recent articles with category, excerpt, and author attribution.';
</script>

<script lang="ts">
  import { BlogSection } from '@lostgradient/cinder/blog-section';

  const posts = [
    {
      title: 'How we scaled our design system governance',
      excerpt: 'A practical playbook for cross-team contributions and review workflows.',
      href: '#',
      category: 'Engineering',
      publishedAt: 'Jun 20, 2026',
      authorName: 'Morgan Yu',
      authorRole: 'Staff Engineer',
      imageSrc: 'https://placehold.co/640x360?text=Design+System',
    },
    {
      title: 'Product launch checklist for frontend teams',
      excerpt: 'A repeatable checklist that reduces launch-day surprises.',
      href: '#',
      category: 'Product',
      publishedAt: 'Jun 8, 2026',
      authorName: 'Jamie Patel',
      authorRole: 'Product Manager',
      imageSrc: 'https://placehold.co/640x360?text=Launch+Checklist',
    },
    {
      title: 'Accessibility debt: how to find and fix it early',
      excerpt: 'Methods for integrating inclusive QA before code reaches production.',
      href: '#',
      category: 'Accessibility',
      publishedAt: 'May 27, 2026',
      authorName: 'Casey Murray',
      authorRole: 'Design Systems Lead',
      imageSrc: 'https://placehold.co/640x360?text=A11y+Debt',
    },
  ];
</script>

<BlogSection
  title="Latest from the Cinder blog"
  description="Guides, launch lessons, and design-system practices from our product team."
  {posts}
/>
