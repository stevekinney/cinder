import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    playing: {
      type: 'boolean',
      description: 'Whether playback is active.',
      default: false,
    },
    replay: {
      type: 'boolean',
      description: 'Show a replay action when the track has ended.',
      default: false,
    },
    disabled: {
      type: 'boolean',
      description: 'Disable all controls.',
      default: false,
    },
    loading: {
      type: 'boolean',
      description: 'Show loading state while media is buffering.',
      default: false,
    },
    unavailable: {
      type: 'boolean',
      description: 'Controls are unavailable.',
      default: false,
    },
    progress: {
      type: 'number',
      description: 'Progress value between 0 and 1. Omit to hide the progress bar.',
    },
    progressLabel: {
      type: 'string',
      description: 'Accessible label for the progress bar.',
    },
    layout: {
      enum: ['compact', 'expanded'],
      description: 'Layout mode.',
      default: 'compact',
    },
    class: {
      type: 'string',
      description: 'Additional class names merged with `.cinder-media-controls`.',
    },
  },
  additionalProperties: false,
  metadata: {
    unsupportedProps: [
      {
        name: 'onpause',
        reason: 'function-or-snippet',
        description: 'Called when the pause action is triggered.',
      },
      {
        name: 'onplay',
        reason: 'function-or-snippet',
        description: 'Called when the play action is triggered.',
      },
      {
        name: 'onreplay',
        reason: 'function-or-snippet',
        description: 'Called when the replay action is triggered.',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
