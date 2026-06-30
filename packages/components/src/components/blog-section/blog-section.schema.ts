import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    as: {
      enum: ['section', 'div'],
      description: 'Wrapper element tag.',
      default: 'section',
    },
    title: {
      type: 'string',
      description: 'Optional section heading text.',
    },
    description: {
      type: 'string',
      description: 'Optional section description text.',
    },
    posts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'Post title text.',
          },
          excerpt: {
            type: 'string',
            description: 'Summary/excerpt text.',
          },
          href: {
            type: 'string',
            description: 'URL to the full article.',
          },
          category: {
            type: 'string',
            description: 'Optional category label.',
          },
          imageSrc: {
            type: 'string',
            description: 'Optional thumbnail image source.',
          },
          publishedAt: {
            type: 'string',
            description: 'Optional publish date string.',
          },
          authorName: {
            type: 'string',
            description: 'Author display name.',
          },
          authorRole: {
            type: 'string',
            description: 'Optional author role/title text.',
          },
          authorAvatarSrc: {
            type: 'string',
            description: 'Optional author avatar image source.',
          },
        },
        additionalProperties: false,
        required: ['authorName', 'excerpt', 'href', 'title'],
      },
      description: 'Posts to render in the section.',
    },
    columns: {
      enum: [1, 2, 3],
      description: 'Grid column count.',
      default: 3,
    },
    maxWidth: {
      enum: ['prose', 'narrow', 'wide', 'full'],
      description: 'Max width token forwarded to Container.',
      default: 'wide',
    },
    class: {
      type: 'string',
      description: 'Custom class merged with `.cinder-blog-section`.',
    },
  },
  additionalProperties: false,
  required: ['posts'],
} satisfies ComponentSchema;

export default schema as ComponentSchema;
