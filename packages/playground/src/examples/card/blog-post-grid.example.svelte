<script lang="ts" module>
  export const title = 'Blog post grid';
  export const description =
    'An article-listing section recipe: Cards carry post image, category metadata, linked title, excerpt, and an Avatar author byline.';
</script>

<script lang="ts">
  import { Avatar } from '@lostgradient/cinder/avatar';
  import { Card } from '@lostgradient/cinder/card';
  import { Container } from '@lostgradient/cinder/container';

  const posts = [
    {
      title: 'How we scaled our design system governance',
      excerpt: 'A practical playbook for cross-team contributions and review workflows.',
      href: '#',
      category: 'Engineering',
      publishedAt: 'Jun 20, 2026',
      authorName: 'Morgan Yu',
      authorRole: 'Staff Engineer',
    },
    {
      title: 'Product launch checklist for frontend teams',
      excerpt: 'A repeatable checklist that reduces launch-day surprises.',
      href: '#',
      category: 'Product',
      publishedAt: 'Jun 8, 2026',
      authorName: 'Jamie Patel',
      authorRole: 'Product Manager',
    },
    {
      title: 'Accessibility debt: how to find and fix it early',
      excerpt: 'Methods for integrating inclusive QA before code reaches production.',
      href: '#',
      category: 'Accessibility',
      publishedAt: 'May 27, 2026',
      authorName: 'Casey Murray',
      authorRole: 'Design Systems Lead',
    },
  ];
</script>

<section style="padding-block: var(--cinder-space-10);">
  <Container maxWidth="wide">
    <div style="display: grid; gap: var(--cinder-space-6);">
      <header style="display: grid; gap: var(--cinder-space-2); max-inline-size: 60ch;">
        <h2 style="margin: 0;">Latest from the Cinder blog</h2>
        <p style="margin: 0; color: var(--cinder-text-muted);">
          Guides, launch lessons, and design-system practices from our product team.
        </p>
      </header>

      <ul
        style="list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr)); gap: var(--cinder-space-4);"
      >
        {#each posts as post (post.title)}
          <li>
            <Card>
              <article>
                <!-- Placeholder cover panel — a real app renders the post's cover
                     <img> here with the same geometry. -->
                <div
                  aria-hidden="true"
                  style="inline-size: 100%; aspect-ratio: 16 / 9; background: var(--cinder-surface-inset); border-radius: var(--cinder-radius-md); margin-block-end: var(--cinder-space-3);"
                ></div>
                <p
                  style="margin: 0; color: var(--cinder-text-muted); font-size: var(--cinder-text-sm);"
                >
                  {post.category} · {post.publishedAt}
                </p>
                <h3 style="margin: var(--cinder-space-2) 0; font-size: var(--cinder-text-lg);">
                  <a
                    href={post.href}
                    style="color: var(--cinder-text-default); text-decoration: none;"
                  >
                    {post.title}
                  </a>
                </h3>
                <p
                  style="margin: 0; color: var(--cinder-text-muted); font-size: var(--cinder-text-sm);"
                >
                  {post.excerpt}
                </p>
                <div
                  style="margin-block-start: var(--cinder-space-4); display: flex; align-items: center; gap: var(--cinder-space-3);"
                >
                  <Avatar name={post.authorName} size="sm" />
                  <div style="display: grid; gap: var(--cinder-space-1);">
                    <p
                      style="margin: 0; font-size: var(--cinder-text-sm); font-weight: var(--cinder-font-semibold); line-height: var(--cinder-leading-snug);"
                    >
                      {post.authorName}
                    </p>
                    <p
                      style="margin: 0; color: var(--cinder-text-muted); font-size: var(--cinder-text-sm); line-height: var(--cinder-leading-snug);"
                    >
                      {post.authorRole}
                    </p>
                  </div>
                </div>
              </article>
            </Card>
          </li>
        {/each}
      </ul>
    </div>
  </Container>
</section>
