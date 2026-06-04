import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    value: {
      type: 'number',
      description: 'Current progress value. Omit for indeterminate.',
    },
    max: {
      type: 'number',
      description: 'Maximum value. Defaults to 100.',
    },
    variant: {
      enum: ['bar', 'ring'],
      description: 'Visual variant. Default `bar`.',
    },
    size: {
      enum: ['sm', 'md', 'lg'],
      description: 'Size token. Default `md`.',
    },
    label: {
      type: 'string',
      description:
        'Human-readable status, exposed as `aria-valuetext`. NOT the accessible\nname — supply `ariaLabel` or `ariaLabelledby` for that.',
    },
    ariaLabel: {
      type: 'string',
      description:
        'Accessible name applied directly to the progressbar element when no\nvisible label element is present in the page. Required unless\n`ariaLabelledby` is supplied.',
    },
    ariaLabelledby: {
      type: 'string',
      description:
        'Id of a visible element that serves as the accessible name for the\nprogressbar. Prefer this over `ariaLabel` when a visible label exists.\nRequired unless `ariaLabel` is supplied.',
    },
    class: {
      type: 'string',
      description: 'Additional class names merged with `.cinder-progress`.',
    },
  },
  additionalProperties: false,
} satisfies ComponentSchema;

export default schema as ComponentSchema;
