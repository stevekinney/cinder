import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    connectionState: {
      enum: ['connected', 'connecting', 'disconnected', 'error'],
      description:
        'Current connection state. When provided, renders a StatusDot connection preset in\nthe toolbar. Omit when the stream has no live transport.',
    },
    followLatest: {
      type: 'boolean',
      description:
        'When true, new events automatically scroll the list to the bottom.\nSet to false to pause follow-latest (e.g. while the user reads earlier events).\nBindable so the parent can read the paused state the component sets internally.',
    },
    truncated: {
      type: 'boolean',
      description:
        'Whether to show the "events were truncated" notice. This is a boolean flag,\nnot a count: the viewer never slices `events` itself. Set it to `true` when\nyou have already trimmed the array (e.g. capped retention) and want users to\nknow earlier events are not shown.',
    },
    loading: {
      type: 'boolean',
      description:
        'Show a loading skeleton instead of the event list. Use while the first\nbatch of events is in flight.',
    },
    label: {
      type: 'string',
      description:
        'Accessible label for the event list region. Required for accessibility.\nDefaults to "Event stream".',
    },
    filterQuery: {
      type: 'string',
      description: 'Current filter query value, for controlled usage. Pairs with `onfilter`.',
    },
    class: {
      type: 'string',
      description: 'Additional CSS classes applied to the root element.',
    },
  },
  additionalProperties: false,
  metadata: {
    unsupportedProps: [
      {
        name: 'events',
        reason: 'unknown-shape',
        required: true,
        description: 'Events to render in chronological order, oldest first.',
      },
      {
        name: 'oncopyvisible',
        reason: 'function-or-snippet',
        description:
          'Callback fired when the user clicks the "Copy visible" toolbar action.\nReceives the text of all currently visible events. When omitted the copy\naction is hidden.',
      },
      {
        name: 'onfilter',
        reason: 'function-or-snippet',
        description:
          "Callback fired when the user updates the filter query in the toolbar's\nsearch field. The consumer is responsible for filtering `events` in\nresponse. When omitted the filter input is hidden.",
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
