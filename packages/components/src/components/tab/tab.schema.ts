import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    value: {
      type: 'string',
      description: 'Identifier — matches the value of the corresponding TabPanel.',
    },
    id: {
      type: 'string',
      description: 'Optional explicit id override; auto-generated otherwise for ARIA wiring.',
    },
    disabled: {
      type: 'boolean',
      description: 'Disables this single tab. The panel content is hidden but its DOM stays.',
    },
    class: {
      type: 'string',
      description: 'Additional class names merged with `.cinder-tab`.',
    },
  },
  additionalProperties: false,
  required: ['value'],
  metadata: {
    unsupportedProps: [
      {
        name: 'children',
        reason: 'function-or-snippet',
        required: true,
        description: 'Tab label content.',
      },
      {
        name: 'trailing',
        reason: 'function-or-snippet',
        description:
          'Decorative content rendered inside an `aria-hidden` span (badges, kbd hints,\ncounters). Do NOT use for interactive controls like close buttons —\n`aria-hidden` removes the content from the accessibility tree, making any\ninteractive child unreachable by keyboard and invisible to screen readers.\n\nFor a closeable tab, render a separate `<button>` immediately after the\n`<Tab>` in the DOM (as a sibling within the tab strip) and associate it\nwith the tab via `aria-label="Close [tab name]"`. The close button must\nlive outside the `<Tab>` element entirely.',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
