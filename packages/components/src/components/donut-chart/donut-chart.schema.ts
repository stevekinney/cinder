import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    label: {
      type: 'string',
      description: 'Names both the chart and its non-visual fallback list.',
    },
    valueLabels: {
      type: 'boolean',
      description:
        'Adds a visible `<ul>` legend with value labels below the ring, in place\nof the screen-reader-only fallback list. Defaults to `false`.',
      default: false,
    },
    centerLabel: {
      type: 'string',
      description:
        "Supplemental label rendered at the ring's center. Should not be the only explanation of the total.",
    },
    scrollable: {
      type: 'boolean',
      description:
        'Enables a horizontal-scroll escape hatch for narrow containers.\nDefaults to `false`.',
      default: false,
    },
    class: {
      type: 'string',
      description: "Additional class merged with the component's root class.",
    },
  },
  additionalProperties: false,
  required: ['label'],
  metadata: {
    unsupportedProps: [
      {
        name: 'data',
        reason: 'unknown-shape',
        required: true,
        description:
          'Part-to-whole values rendered as the ring and, when `valueLabels` is\noff, as a screen-reader-only fallback `<ul>` (not a data table). A\nnegative, `NaN`, or infinite `value` renders as `0` rather than being\nrejected—see `DonutChartDatum.value`.',
      },
      {
        name: 'onSeriesClick',
        reason: 'function-or-snippet',
        description:
          'Called when a series is activated. Provide only when the series is actionable.',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
