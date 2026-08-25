import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    id: {
      type: 'string',
      description: 'Unique identifier for the popover.',
    },
    open: {
      type: 'boolean',
      description: 'Whether the popover is visible.',
    },
    class: {
      type: 'string',
      description: 'Additional class names merged with `.cinder-selection-popover`.',
    },
  },
  additionalProperties: false,
  required: ['id'],
  metadata: {
    unsupportedProps: [
      {
        name: 'onCancel',
        reason: 'function-or-snippet',
        description: 'Called when the composer is canceled.',
      },
      {
        name: 'onClose',
        reason: 'function-or-snippet',
        description: 'Called when the popover should close.',
      },
      {
        name: 'onCommentSubmit',
        reason: 'function-or-snippet',
        description: 'Called when a comment is submitted.',
      },
      {
        name: 'onExitComplete',
        reason: 'function-or-snippet',
        description:
          'Called once the popover\'s exit transition has genuinely finished and it\nhas fully unmounted from the layout (see `_internal/OVERLAY-POLICY.md` §\n"Transition lifecycle"). This component intentionally never unmounts\nITS OWN root element while closing — `data-cinder-visible`/\n`data-cinder-closing` drive the retained fade instead of an `{#if}` gate\n— so a consumer that wraps this component in its own `{#if}` keyed\ndirectly on the same state that flips `open` false would destroy the\nwhole component instance before its exit transition ever gets a chance\nto play. Use this callback to decouple that wrapping condition from the\nlive open state: keep the consumer\'s own mount gate true until this\nfires, then clear it.',
      },
      {
        name: 'onExpand',
        reason: 'function-or-snippet',
        description: 'Called when the compact action expands into the composer.',
      },
      {
        name: 'position',
        reason: 'unknown-shape',
        required: true,
        description: 'Viewport-relative anchor point for the popover.',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
