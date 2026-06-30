<script lang="ts" module>
  /**
   * @cinder
   * @category domain
   * @status stable
   * @purpose Blog/article listing section that renders post cards with metadata, excerpt text, and author attribution.
   * @tag marketing
   * @tag blog
   * @tag content
   * @useWhen Showing recent posts or resources on a landing page.
   * @useWhen Building a featured-articles grid with author and publish metadata.
   * @avoidWhen Rendering partner logos or brand marks only. | logo-cloud
   * @avoidWhen Presenting customer testimonials in quote format. | testimonial-section
   * @related logo-cloud, testimonial-section, card, avatar, container
   */
  export type { BlogSectionPost, BlogSectionProps } from './blog-section.types.ts';
</script>

<script lang="ts">
  import Avatar from '../avatar/avatar.svelte';
  import Container from '../container/container.svelte';
  import { classNames } from '../../utilities/class-names.ts';

  import type { BlogSectionProps } from './blog-section.types.ts';

  let {
    as = 'section',
    title,
    description,
    posts,
    columns = 3,
    maxWidth = 'wide',
    class: className,
    ...rest
  }: BlogSectionProps = $props();

  function avatarProps(name: string, src: string | undefined): { name: string; src?: string } {
    return src ? { name, src } : { name };
  }

  function postMetadata(category: string | undefined, publishedAt: string | undefined): string {
    return [category, publishedAt].filter(Boolean).join(' · ');
  }
</script>

<svelte:element
  this={as}
  class={classNames('cinder-blog-section', className)}
  data-cinder-columns={String(columns)}
  {...rest}
>
  <Container {maxWidth}>
    <div class="cinder-blog-section__inner">
      {#if title || description}
        <header class="cinder-blog-section__header">
          {#if title}
            <h2 class="cinder-blog-section__title">{title}</h2>
          {/if}
          {#if description}
            <p class="cinder-blog-section__description">{description}</p>
          {/if}
        </header>
      {/if}

      <ul class="cinder-blog-section__list">
        {#each posts as post, index (`${post.title}-${index}`)}
          <li class="cinder-blog-section__item">
            <article class="cinder-card" data-cinder-variant="card">
              <div
                class="cinder-card__body"
                data-cinder-tone="default"
                data-cinder-padding="default"
              >
                {#if post.imageSrc}
                  <img
                    class="cinder-blog-section__image"
                    src={post.imageSrc}
                    alt=""
                    loading="lazy"
                  />
                {/if}
                {#if post.category || post.publishedAt}
                  <p class="cinder-blog-section__meta">
                    {postMetadata(post.category, post.publishedAt)}
                  </p>
                {/if}
                <h3 class="cinder-blog-section__post-title">
                  <a href={post.href} class="cinder-blog-section__link">{post.title}</a>
                </h3>
                <p class="cinder-blog-section__excerpt">{post.excerpt}</p>
                <div class="cinder-blog-section__author">
                  <Avatar {...avatarProps(post.authorName, post.authorAvatarSrc)} size="sm" />
                  <div class="cinder-blog-section__author-meta">
                    <p class="cinder-blog-section__author-name">{post.authorName}</p>
                    {#if post.authorRole}
                      <p class="cinder-blog-section__author-role">{post.authorRole}</p>
                    {/if}
                  </div>
                </div>
              </div>
            </article>
          </li>
        {/each}
      </ul>
    </div>
  </Container>
</svelte:element>
