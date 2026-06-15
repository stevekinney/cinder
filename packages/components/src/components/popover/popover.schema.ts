import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    id: {
      type: 'string',
      description: 'Optional panel id. Defaults to a generated `cinder-popover-*` id.',
    },
    open: {
      type: 'boolean',
      description: 'Open state. Bindable. Default `false`.',
    },
    placement: {
      enum: [
        'top',
        'bottom',
        'left',
        'right',
        'top-start',
        'top-end',
        'bottom-start',
        'bottom-end',
      ],
      description: "Anchor placement. Default `'bottom-start'`.",
    },
    offset: {
      type: 'number',
      description: 'Distance in px between trigger and panel. Default `8`.',
    },
    showArrow: {
      type: 'boolean',
      description: 'Render a directional arrow on the panel. Default `false`.',
    },
    label: {
      type: 'string',
      description: 'Accessible name. Sets `aria-label` when `ariaLabelledby` is not supplied.',
    },
    ariaLabelledby: {
      type: 'string',
      description: 'Id of an element labelling the panel. Wins over `label`.',
    },
    role: {
      enum: ['dialog', 'group', 'listbox'],
      description: "ARIA role for the panel. Default `'dialog'`.",
    },
    focusManagement: {
      enum: ['panel', 'preserve'],
      description: "Focus behavior for each open session. Default `'panel'`.",
    },
    wireTriggerAria: {
      type: 'boolean',
      description: 'Whether Popover owns trigger ARIA wiring. Default `true`.',
    },
    closeOnEscape: {
      type: 'boolean',
      description:
        "Whether Escape closes the Popover. Default `true`. Set `false` when a parent\ncomposite widget (e.g. Combobox) owns Escape for the whole interaction, so the\nPopover does not shadow the parent's handler while its panel is open.",
    },
    widthMode: {
      enum: ['content', 'match-anchor', 'menu', 'none'],
      description: "Floating panel width strategy. Default `'content'`.",
    },
    class: {
      type: 'string',
      description: 'Extra class merged onto `.cinder-popover`.',
    },
  },
  additionalProperties: false,
  metadata: {
    unsupportedProps: [
      {
        name: 'children',
        reason: 'function-or-snippet',
        required: true,
        description: 'Panel content. Required.',
      },
      {
        name: 'trigger',
        reason: 'function-or-snippet',
        description: 'Optional trigger snippet rendered inside a wrapper.',
      },
      {
        name: 'triggerRef',
        reason: 'unknown-shape',
        description: 'Explicit anchor element. Wins over the snippet-resolved focusable.',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
