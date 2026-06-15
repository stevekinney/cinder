import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    class: {
      type: 'string',
      description: 'Additional class merged onto the `.cinder-feed` root element.',
    },
    live: {
      type: 'boolean',
      description:
        'When true, the wrapper becomes an ARIA live region: `aria-live="polite"`\nand `aria-atomic="false"`. Use for feeds that mutate while the user is\non the page (streaming notifications, log tails, chat-like activity).\nDefaults to false — a polite live region on a static feed is noise.',
    },
  },
  additionalProperties: false,
  metadata: {
    unsupportedProps: [
      {
        name: 'children',
        reason: 'function-or-snippet',
        required: true,
        description: 'Feed events (typically `<FeedEvent>` children).',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
