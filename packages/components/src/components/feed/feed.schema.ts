import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    class: {
      type: 'string',
      description: 'Additional class merged onto the feed root element.',
    },
    kind: {
      enum: ['list', 'log'],
      description: "Discriminates the arms. Omit (or pass `'list'`) for the plain list.",
    },
    live: {
      type: 'boolean',
      description:
        'When true, the wrapper becomes an ARIA live region: `aria-live="polite"`\nand `aria-atomic="false"`. Use for feeds that mutate while the user is\non the page (streaming notifications, chat-like activity).\nDefaults to false — a polite live region on a static feed is noise.',
    },
    following: {
      type: 'boolean',
      description:
        'When true, appended content automatically scrolls the viewport to the\nbottom. Scrolling away from the bottom pauses following; scrolling back\nto the bottom (or the built-in control) resumes it. Bindable so the\nparent can read the paused state the component sets internally.',
    },
    loading: {
      type: 'boolean',
      description:
        'Show a loading skeleton instead of the entries. Use while the first\nbatch of entries is in flight.',
    },
    truncated: {
      type: 'boolean',
      description:
        'Whether to show the "earlier entries not shown" notice. This is a\nboolean flag, not a count: the feed never trims its own children. Set\nit when you have already capped retention and want users to know\nearlier entries are not shown.',
    },
    connectionState: {
      enum: ['connected', 'connecting', 'disconnected', 'error'],
      description:
        'Current connection state. When provided, renders a StatusDot connection\npreset in the toolbar. Omit when the stream has no live transport.',
    },
    label: {
      type: 'string',
      description:
        'Accessible label for the log region. Required for accessibility.\nDefaults to "Activity log".',
    },
  },
  additionalProperties: false,
  metadata: {
    unsupportedProps: [
      {
        name: 'children',
        reason: 'function-or-snippet',
        required: true,
        description: 'Feed entries (typically `<Feed.Event>` / `<Feed.Boundary>` children).',
      },
      {
        name: 'toolbar',
        reason: 'function-or-snippet',
        description:
          'Consumer-composed toolbar controls (filter inputs, copy buttons, …),\nrendered at the end of the toolbar row.',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
