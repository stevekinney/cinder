import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    text: {
      type: 'string',
      description: 'Text content rendered inside the tooltip.',
    },
    placement: {
      enum: ['top', 'right', 'bottom', 'left'],
      description: 'Preferred side of the trigger on which the tooltip appears. Default `top`.',
    },
    describe: {
      type: 'boolean',
      description: 'Whether to wire tooltip text to the trigger via aria-describedby.',
      default: true,
    },
    class: {
      type: 'string',
      description: "Additional class names merged with the component's root class.",
    },
  },
  additionalProperties: false,
  required: ['text'],
  metadata: {
    unsupportedProps: [
      {
        name: 'children',
        reason: 'function-or-snippet',
        description:
          'The trigger element the tooltip wraps and anchors to. Required unless\n`triggerRef` supplies the anchor instead.',
      },
      {
        name: 'triggerRef',
        reason: 'unknown-shape',
        description:
          'Explicit anchor element, for when the tooltip cannot wrap its trigger.\n\nThe default form renders a wrapper around `children` and resolves the\nanchor from it, which puts the `role="tooltip"` panel inside whatever\nstructure the trigger sits in. That is wrong wherever the surrounding\nmarkup constrains its children — `AvatarGroup` wraps each avatar in a\n`role="listitem"`, so an in-tree panel lands inside a list item.\n\nWith `triggerRef`, the Tooltip renders ONLY the panel and anchors it to the\nsupplied element, so the consumer places the panel wherever it belongs.\n`children` is then unnecessary — the trigger is already in the consumer\'s\nown markup. Mirrors `PopoverProps.triggerRef`.',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
