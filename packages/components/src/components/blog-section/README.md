# BlogSection

Renders a marketing blog section with post cards, metadata, and author attribution.

## Usage

```svelte
<script lang="ts">
  import BlogSection from '@lostgradient/cinder/blog-section';

  const posts = [
    {
      title: 'Introducing Cinder',
      excerpt: 'A quick look at our new UI component library.',
      href: '/blog/introducing-cinder',
      authorName: 'Alex Morgan',
    },
  ];
</script>

<BlogSection title="From the blog" {posts} />
```

## Props

<!-- generated:props:start -->

| Prop          | Type                                                                                                                                                                                                | Required | Default     | Description                                      |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------- | ------------------------------------------------ |
| `as`          | `"section"` \| `"div"`                                                                                                                                                                              | no       | `"section"` | Wrapper element tag.                             |
| `class`       | `string`                                                                                                                                                                                            | no       | —           | Custom class merged with `.cinder-blog-section`. |
| `columns`     | `1` \| `2` \| `3`                                                                                                                                                                                   | no       | `3`         | Grid column count.                               |
| `description` | `string`                                                                                                                                                                                            | no       | —           | Optional section description text.               |
| `maxWidth`    | `"prose"` \| `"narrow"` \| `"wide"` \| `"full"`                                                                                                                                                     | no       | `"wide"`    | Max width token forwarded to Container.          |
| `posts`       | { authorAvatarSrc?: `string`; authorName: `string`; authorRole?: `string`; category?: `string`; excerpt: `string`; href: `string`; imageSrc?: `string`; publishedAt?: `string`; title: `string` }[] | yes      | —           | Posts to render in the section.                  |
| `title`       | `string`                                                                                                                                                                                            | no       | —           | Optional section heading text.                   |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
