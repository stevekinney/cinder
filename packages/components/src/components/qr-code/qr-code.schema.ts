import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    value: {
      type: 'string',
      description: 'Text payload encoded into the QR code matrix.',
    },
    label: {
      type: 'string',
      description: 'Accessible label announced for the QR image.',
      default: 'QR code',
    },
    size: {
      type: 'number',
      description: 'Square pixel size of the rendered QR code.',
      default: 160,
    },
    margin: {
      type: 'number',
      description: 'Quiet-zone width in QR modules.',
      default: 1,
    },
    errorCorrectionLevel: {
      enum: ['L', 'M', 'Q', 'H'],
      description: 'QR error correction level.',
      default: 'M',
    },
    class: {
      type: 'string',
      description: 'Custom class merged with `.cinder-qr-code`.',
    },
  },
  additionalProperties: false,
  required: ['value'],
} satisfies ComponentSchema;

export default schema as ComponentSchema;
