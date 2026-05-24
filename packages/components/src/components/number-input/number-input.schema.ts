import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    disabled: {
      type: 'boolean',
    },
    required: {
      type: 'boolean',
    },
    id: {
      type: 'string',
    },
    value: {
      anyOf: [
        {
          type: 'number',
        },
        {
          type: 'null',
        },
      ],
    },
    defaultValue: {
      anyOf: [
        {
          type: 'number',
        },
        {
          type: 'null',
        },
      ],
    },
    min: {
      type: 'number',
    },
    max: {
      type: 'number',
    },
    step: {
      type: 'number',
    },
    format: {
      type: 'object',
      properties: {
        localeMatcher: {
          enum: ['lookup', 'best fit'],
        },
        style: {
          enum: ['decimal', 'percent', 'currency', 'unit'],
        },
        currency: {
          type: 'string',
        },
        currencyDisplay: {
          enum: ['symbol', 'name', 'code', 'narrowSymbol'],
        },
        useGrouping: {
          enum: [false, true, 'min2', 'auto', 'always', 'true', 'false'],
        },
        minimumIntegerDigits: {
          type: 'number',
        },
        minimumFractionDigits: {
          type: 'number',
        },
        maximumFractionDigits: {
          type: 'number',
        },
        minimumSignificantDigits: {
          type: 'number',
        },
        maximumSignificantDigits: {
          type: 'number',
        },
        numberingSystem: {
          type: 'string',
        },
        compactDisplay: {
          enum: ['short', 'long'],
        },
        notation: {
          enum: ['standard', 'scientific', 'engineering', 'compact'],
        },
        signDisplay: {
          enum: ['auto', 'always', 'never', 'exceptZero', 'negative'],
        },
        unit: {
          type: 'string',
        },
        unitDisplay: {
          enum: ['short', 'long', 'narrow'],
        },
        currencySign: {
          enum: ['standard', 'accounting'],
        },
        roundingPriority: {
          enum: ['auto', 'morePrecision', 'lessPrecision'],
        },
        roundingIncrement: {
          enum: [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000],
        },
        roundingMode: {
          enum: [
            'ceil',
            'floor',
            'expand',
            'trunc',
            'halfCeil',
            'halfFloor',
            'halfExpand',
            'halfTrunc',
            'halfEven',
          ],
        },
        trailingZeroDisplay: {
          enum: ['auto', 'stripIfInteger'],
        },
      },
      additionalProperties: false,
    },
    locale: {
      type: 'string',
    },
    name: {
      type: 'string',
    },
    label: {
      type: 'string',
    },
    description: {
      type: 'string',
    },
    error: {
      type: 'string',
    },
  },
  additionalProperties: false,
  required: ['id'],
  metadata: {
    unsupportedProps: [
      {
        name: 'class',
        reason: 'unknown-shape',
      },
      {
        name: 'onchange',
        reason: 'function-or-snippet',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
