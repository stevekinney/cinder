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
      default: 'list',
    },
    live: {
      type: 'boolean',
      description:
        'List arm only (`kind` omitted or `\'list\'`) — rejected by the log arm,\nwhose `role="log"` viewport is implicitly live. When true, the wrapper\nbecomes an ARIA live region: `aria-live="polite"` and\n`aria-atomic="false"`. Use for feeds that mutate while the user is\non the page (streaming notifications, chat-like activity).\nA polite live region on a static feed is noise, hence the false default.',
      default: false,
    },
    following: {
      type: 'boolean',
      description:
        "Log arm only — requires `kind: 'log'`; rejected by the list arm. When\ntrue, the viewport scrolls to the bottom whenever appended content\ngrows the entry list — or whenever the viewport itself shrinks, so a\ncollapsing parent layout cannot leave the latest entries below the\nfold. Scrolling away from the bottom pauses following; scrolling back\nto the bottom (or the built-in control) resumes it. Bindable so the\nparent can read the paused state the component sets internally.",
      default: true,
    },
    loading: {
      type: 'boolean',
      description:
        "Log arm only — requires `kind: 'log'`; rejected by the list arm. Show\na loading skeleton instead of the entries. Use while the first batch\nof entries is in flight.",
      default: false,
    },
    truncated: {
      type: 'boolean',
      description:
        'Log arm only — requires `kind: \'log\'`; rejected by the list arm.\nWhether to show the "earlier entries not shown" notice. This is a\nboolean flag, not a count: the feed never trims its own children. Set\nit when you have already capped retention and want users to know\nearlier entries are not shown.',
      default: false,
    },
    connectionState: {
      enum: ['connected', 'connecting', 'disconnected', 'error'],
      description:
        "Log arm only — requires `kind: 'log'`; rejected by the list arm.\nCurrent connection state. When provided, renders a StatusDot connection\npreset in the toolbar. Omit when the stream has no live transport.",
    },
    label: {
      type: 'string',
      description:
        "Log arm only — requires `kind: 'log'`; rejected by the list arm.\nAccessible label for the log region. Required for accessibility.",
      default: 'Activity log',
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
