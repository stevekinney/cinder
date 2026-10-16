/**
 * GENERATED FILE. Do not edit by hand.
 *
 * Standalone validator for scripts/tokens/schemas/dtcg-format-2025-10.json.
 * Regenerate: bun run --filter=@lostgradient/cinder tokens:generate
 */
'use strict';
export const validate = validate10;
export default validate10;
const schema11 = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'https://www.designtokens.org/schemas/2025.10/format.json',
  title: 'DTCG Format Schema',
  description: 'JSON Schema for the Design Tokens Community Group (DTCG) Format specification.',
  type: 'object',
  properties: {
    $schema: {
      type: 'string',
      format: 'uri-reference',
      description: 'URI reference to this JSON schema.',
      $comment: '$schema is not part of the official DTCG specification.',
    },
    $type: { $ref: 'https://www.designtokens.org/schemas/2025.10/format/tokenType.json' },
    $description: { type: 'string', description: 'A plain text description of the group' },
    $extensions: { type: 'object', description: 'Vendor-specific extensions' },
    $extends: {
      oneOf: [
        { $ref: '#/definitions/curlyBraceReference' },
        { $ref: '#/definitions/jsonPointerReference' },
      ],
      description: 'Reference to another group to inherit tokens and properties from',
    },
    $deprecated: {
      oneOf: [{ type: 'boolean' }, { type: 'string' }],
      description: 'Whether this group is deprecated',
    },
    $root: { $ref: 'https://www.designtokens.org/schemas/2025.10/format/token.json' },
  },
  patternProperties: {
    '^[^${}.][^{}.]*$': {
      $ref: 'https://www.designtokens.org/schemas/2025.10/format/groupOrToken.json',
    },
  },
  additionalProperties: false,
  definitions: {
    tokenOrGroupName: {
      title: 'Token or Group Name',
      type: 'string',
      pattern: '^[^${}.][^{}.]*$',
      description: 'Valid token/group names: must not start with $ and must not contain {, }, or .',
    },
    curlyBraceReference: {
      title: 'Curly Brace Reference',
      type: 'string',
      pattern: '^\\{[^${}.][^{}.]*(\\.[^${}.][^{}.]*)*\\}$',
      description: "Curly brace reference (e.g., '{tokenName}' or '{group.nested.token}')",
    },
    jsonPointerReference: {
      title: 'JSON Pointer Reference',
      type: 'string',
      pattern: '^#/',
      format: 'json-pointer-uri-fragment',
      description:
        "JSON Pointer reference (RFC 6901) to a location in the document (e.g., '#/path/to/target')",
    },
    jsonPointerReferenceObject: {
      title: 'JSON Pointer Reference Object',
      type: 'object',
      properties: { $ref: { $ref: '#/definitions/jsonPointerReference' } },
      required: ['$ref'],
      additionalProperties: false,
      description: 'Object containing a JSON Pointer reference for property-level references',
    },
    tokenValueReference: {
      title: 'Token Value Reference',
      oneOf: [
        { $ref: '#/definitions/curlyBraceReference' },
        { $ref: '#/definitions/jsonPointerReferenceObject' },
      ],
      description:
        'A reference to a token value using either curly brace syntax or JSON Pointer syntax',
    },
    'https://www.designtokens.org/schemas/2025.10/format/tokenType.json': {
      $schema: 'http://json-schema.org/draft-07/schema#',
      $id: 'https://www.designtokens.org/schemas/2025.10/format/tokenType.json',
      title: 'TokenType',
      description: 'A token type in the DTCG specification',
      type: 'string',
      enum: [
        'color',
        'dimension',
        'fontFamily',
        'fontWeight',
        'duration',
        'cubicBezier',
        'number',
        'strokeStyle',
        'border',
        'transition',
        'shadow',
        'gradient',
        'typography',
      ],
    },
    'https://www.designtokens.org/schemas/2025.10/format/token.json': {
      $schema: 'http://json-schema.org/draft-07/schema#',
      $id: 'https://www.designtokens.org/schemas/2025.10/format/token.json',
      title: 'Token',
      description: 'A token in the DTCG specification',
      type: 'object',
      properties: {
        $value: {
          description:
            "The token's value - can be a direct value or a reference to another token using curly brace syntax (e.g., '{token.name}'). Mutually exclusive with $ref.",
        },
        $type: { $ref: 'https://www.designtokens.org/schemas/2025.10/format/tokenType.json' },
        $ref: {
          $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/jsonPointerReference',
        },
        $description: { type: 'string', description: 'A plain text description of the token' },
        $extensions: { type: 'object', description: 'Vendor-specific extensions' },
        $deprecated: {
          oneOf: [{ type: 'boolean' }, { type: 'string' }],
          description: 'Whether this token is deprecated',
        },
      },
      additionalProperties: false,
      allOf: [
        {
          description:
            'Tokens cannot define both $value and $ref; they must choose exactly one form of reference or direct value.',
          if: { required: ['$value'], properties: { $value: true } },
          then: { not: { required: ['$ref'], properties: { $ref: true } } },
          else: { required: ['$ref'], properties: { $ref: true } },
        },
        {
          if: { required: ['$type'], properties: { $type: { const: 'color' } } },
          then: {
            properties: {
              $value: {
                oneOf: [
                  { $ref: 'https://www.designtokens.org/schemas/2025.10/format/values/color.json' },
                  {
                    $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/tokenValueReference',
                  },
                ],
              },
            },
          },
        },
        {
          if: { required: ['$type'], properties: { $type: { const: 'dimension' } } },
          then: {
            properties: {
              $value: {
                oneOf: [
                  {
                    $ref: 'https://www.designtokens.org/schemas/2025.10/format/values/dimension.json',
                  },
                  {
                    $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/tokenValueReference',
                  },
                ],
              },
            },
          },
        },
        {
          if: { required: ['$type'], properties: { $type: { const: 'fontFamily' } } },
          then: {
            properties: {
              $value: {
                oneOf: [
                  {
                    $ref: 'https://www.designtokens.org/schemas/2025.10/format/values/fontFamily.json',
                  },
                  {
                    $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/tokenValueReference',
                  },
                ],
              },
            },
          },
        },
        {
          if: { required: ['$type'], properties: { $type: { const: 'fontWeight' } } },
          then: {
            properties: {
              $value: {
                oneOf: [
                  {
                    $ref: 'https://www.designtokens.org/schemas/2025.10/format/values/fontWeight.json',
                  },
                  {
                    $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/tokenValueReference',
                  },
                ],
              },
            },
          },
        },
        {
          if: { required: ['$type'], properties: { $type: { const: 'duration' } } },
          then: {
            properties: {
              $value: {
                oneOf: [
                  {
                    $ref: 'https://www.designtokens.org/schemas/2025.10/format/values/duration.json',
                  },
                  {
                    $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/tokenValueReference',
                  },
                ],
              },
            },
          },
        },
        {
          if: { required: ['$type'], properties: { $type: { const: 'cubicBezier' } } },
          then: {
            properties: {
              $value: {
                oneOf: [
                  {
                    $ref: 'https://www.designtokens.org/schemas/2025.10/format/values/cubicBezier.json',
                  },
                  {
                    $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/tokenValueReference',
                  },
                ],
              },
            },
          },
        },
        {
          if: { required: ['$type'], properties: { $type: { const: 'number' } } },
          then: {
            properties: {
              $value: {
                oneOf: [
                  {
                    $ref: 'https://www.designtokens.org/schemas/2025.10/format/values/number.json',
                  },
                  {
                    $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/tokenValueReference',
                  },
                ],
              },
            },
          },
        },
        {
          if: { required: ['$type'], properties: { $type: { const: 'strokeStyle' } } },
          then: {
            properties: {
              $value: {
                oneOf: [
                  {
                    $ref: 'https://www.designtokens.org/schemas/2025.10/format/values/strokeStyle.json',
                  },
                  {
                    $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/tokenValueReference',
                  },
                ],
              },
            },
          },
        },
        {
          if: { required: ['$type'], properties: { $type: { const: 'border' } } },
          then: {
            properties: {
              $value: {
                oneOf: [
                  {
                    $ref: 'https://www.designtokens.org/schemas/2025.10/format/values/border.json',
                  },
                  {
                    $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/tokenValueReference',
                  },
                ],
              },
            },
          },
        },
        {
          if: { required: ['$type'], properties: { $type: { const: 'transition' } } },
          then: {
            properties: {
              $value: {
                oneOf: [
                  {
                    $ref: 'https://www.designtokens.org/schemas/2025.10/format/values/transition.json',
                  },
                  {
                    $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/tokenValueReference',
                  },
                ],
              },
            },
          },
        },
        {
          if: { required: ['$type'], properties: { $type: { const: 'shadow' } } },
          then: {
            properties: {
              $value: {
                oneOf: [
                  {
                    $ref: 'https://www.designtokens.org/schemas/2025.10/format/values/shadow.json',
                  },
                  {
                    $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/tokenValueReference',
                  },
                ],
              },
            },
          },
        },
        {
          if: { required: ['$type'], properties: { $type: { const: 'gradient' } } },
          then: {
            properties: {
              $value: {
                oneOf: [
                  {
                    $ref: 'https://www.designtokens.org/schemas/2025.10/format/values/gradient.json',
                  },
                  {
                    $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/tokenValueReference',
                  },
                ],
              },
            },
          },
        },
        {
          if: { required: ['$type'], properties: { $type: { const: 'typography' } } },
          then: {
            properties: {
              $value: {
                oneOf: [
                  {
                    $ref: 'https://www.designtokens.org/schemas/2025.10/format/values/typography.json',
                  },
                  {
                    $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/tokenValueReference',
                  },
                ],
              },
            },
          },
        },
        {
          if: {
            allOf: [
              { not: { required: ['$type'] } },
              { required: ['$value'] },
              {
                properties: {
                  $value: {
                    not: {
                      $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/tokenValueReference',
                    },
                  },
                },
              },
            ],
          },
          then: {
            properties: {
              $value: {
                oneOf: [
                  { $ref: 'https://www.designtokens.org/schemas/2025.10/format/values/color.json' },
                  {
                    $ref: 'https://www.designtokens.org/schemas/2025.10/format/values/dimension.json',
                  },
                  {
                    $ref: 'https://www.designtokens.org/schemas/2025.10/format/values/fontFamily.json',
                  },
                  {
                    $ref: 'https://www.designtokens.org/schemas/2025.10/format/values/duration.json',
                  },
                  {
                    $ref: 'https://www.designtokens.org/schemas/2025.10/format/values/cubicBezier.json',
                  },
                  {
                    $ref: 'https://www.designtokens.org/schemas/2025.10/format/values/strokeStyle.json',
                  },
                  {
                    $ref: 'https://www.designtokens.org/schemas/2025.10/format/values/border.json',
                  },
                  {
                    $ref: 'https://www.designtokens.org/schemas/2025.10/format/values/transition.json',
                  },
                  {
                    $ref: 'https://www.designtokens.org/schemas/2025.10/format/values/shadow.json',
                  },
                  {
                    $ref: 'https://www.designtokens.org/schemas/2025.10/format/values/gradient.json',
                  },
                  {
                    $ref: 'https://www.designtokens.org/schemas/2025.10/format/values/typography.json',
                  },
                  {
                    anyOf: [
                      {
                        $ref: 'https://www.designtokens.org/schemas/2025.10/format/values/number.json',
                      },
                      {
                        $ref: 'https://www.designtokens.org/schemas/2025.10/format/values/fontWeight.json',
                      },
                    ],
                  },
                ],
              },
            },
          },
        },
      ],
    },
    'https://www.designtokens.org/schemas/2025.10/format/values/color.json': {
      $schema: 'http://json-schema.org/draft-07/schema#',
      $id: 'https://www.designtokens.org/schemas/2025.10/format/values/color.json',
      title: 'Color Value',
      description:
        'Value schema for color type tokens. Represents a color in a specific color space.',
      type: 'object',
      properties: {
        colorSpace: {
          description: 'The color space or color model used to represent the color',
          oneOf: [
            {
              type: 'string',
              enum: [
                'srgb',
                'srgb-linear',
                'hsl',
                'hwb',
                'lab',
                'lch',
                'oklab',
                'oklch',
                'display-p3',
                'a98-rgb',
                'prophoto-rgb',
                'rec2020',
                'xyz-d65',
                'xyz-d50',
              ],
            },
            {
              $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/jsonPointerReferenceObject',
            },
          ],
        },
        components: {
          description:
            "Array of color components. The number and meaning of components depend on the color space. Each component can be a number or the 'none' keyword.",
          oneOf: [
            { type: 'array' },
            {
              $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/jsonPointerReferenceObject',
            },
          ],
        },
        alpha: {
          description:
            'The alpha (transparency) value of the color. 0 is fully transparent, 1 is fully opaque. If omitted, defaults to 1.',
          oneOf: [
            { type: 'number', minimum: 0, maximum: 1 },
            {
              $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/jsonPointerReferenceObject',
            },
          ],
        },
        hex: {
          description:
            "Optional fallback value in 6-digit CSS hex color notation (e.g., '#ff00ff'). Must be 6 digits to avoid conflicts with the alpha value.",
          $comment:
            'Only JSON Pointer references (not curly brace references) are allowed for hex because no string token type exists in the specification that could be referenced with curly braces.',
          oneOf: [
            { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
            {
              $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/jsonPointerReferenceObject',
            },
          ],
        },
      },
      required: ['colorSpace', 'components'],
      additionalProperties: false,
      definitions: {
        zeroToOneComponent: {
          title: 'Zero to One Component',
          description:
            'A color component normalized to the range [0-1] (e.g., RGB values, XYZ values)',
          oneOf: [
            { type: 'number', minimum: 0, maximum: 1 },
            { type: 'string', const: 'none' },
            {
              $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/jsonPointerReferenceObject',
            },
          ],
        },
        hueComponent: {
          title: 'Hue Component',
          description: 'Hue angle from 0 up to (but not including) 360 degrees',
          oneOf: [
            { type: 'number', minimum: 0, exclusiveMaximum: 360 },
            { type: 'string', const: 'none' },
            {
              $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/jsonPointerReferenceObject',
            },
          ],
        },
        percentageComponent: {
          title: 'Percentage Component',
          description: 'Percentage value from 0 to 100',
          oneOf: [
            { type: 'number', minimum: 0, maximum: 100 },
            { type: 'string', const: 'none' },
            {
              $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/jsonPointerReferenceObject',
            },
          ],
        },
        chromaComponent: {
          title: 'Chroma Component',
          description: 'Chroma value from 0 to infinity',
          oneOf: [
            { type: 'number', minimum: 0 },
            { type: 'string', const: 'none' },
            {
              $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/jsonPointerReferenceObject',
            },
          ],
        },
        unboundedComponent: {
          title: 'Unbounded Component',
          description:
            'A color component with no numeric bounds (e.g., A and B in LAB/OKLAB color spaces)',
          oneOf: [
            { type: 'number' },
            { type: 'string', const: 'none' },
            {
              $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/jsonPointerReferenceObject',
            },
          ],
        },
        rgbComponents: {
          title: 'RGB Components',
          description:
            'Array of RGB color components [Red, Green, Blue], each normalized to the range [0-1]',
          type: 'array',
          minItems: 3,
          maxItems: 3,
          items: [
            { $ref: '#/definitions/zeroToOneComponent' },
            { $ref: '#/definitions/zeroToOneComponent' },
            { $ref: '#/definitions/zeroToOneComponent' },
          ],
        },
        xyzComponents: {
          title: 'XYZ Components',
          description:
            'Array of XYZ color components [X, Y, Z], each normalized to the range [0-1]',
          type: 'array',
          minItems: 3,
          maxItems: 3,
          items: [
            { $ref: '#/definitions/zeroToOneComponent' },
            { $ref: '#/definitions/zeroToOneComponent' },
            { $ref: '#/definitions/zeroToOneComponent' },
          ],
        },
      },
      allOf: [
        {
          if: { properties: { colorSpace: { const: 'srgb' }, components: { type: 'array' } } },
          then: { properties: { components: { $ref: '#/definitions/rgbComponents' } } },
        },
        {
          if: {
            properties: { colorSpace: { const: 'srgb-linear' }, components: { type: 'array' } },
          },
          then: { properties: { components: { $ref: '#/definitions/rgbComponents' } } },
        },
        {
          if: {
            properties: { colorSpace: { const: 'display-p3' }, components: { type: 'array' } },
          },
          then: { properties: { components: { $ref: '#/definitions/rgbComponents' } } },
        },
        {
          if: { properties: { colorSpace: { const: 'a98-rgb' }, components: { type: 'array' } } },
          then: { properties: { components: { $ref: '#/definitions/rgbComponents' } } },
        },
        {
          if: {
            properties: { colorSpace: { const: 'prophoto-rgb' }, components: { type: 'array' } },
          },
          then: { properties: { components: { $ref: '#/definitions/rgbComponents' } } },
        },
        {
          if: { properties: { colorSpace: { const: 'rec2020' }, components: { type: 'array' } } },
          then: { properties: { components: { $ref: '#/definitions/rgbComponents' } } },
        },
        {
          if: { properties: { colorSpace: { const: 'xyz-d65' }, components: { type: 'array' } } },
          then: { properties: { components: { $ref: '#/definitions/xyzComponents' } } },
        },
        {
          if: { properties: { colorSpace: { const: 'xyz-d50' }, components: { type: 'array' } } },
          then: { properties: { components: { $ref: '#/definitions/xyzComponents' } } },
        },
        {
          if: { properties: { colorSpace: { const: 'hsl' }, components: { type: 'array' } } },
          then: {
            properties: {
              components: {
                type: 'array',
                minItems: 3,
                maxItems: 3,
                items: [
                  { $ref: '#/definitions/hueComponent' },
                  { $ref: '#/definitions/percentageComponent' },
                  { $ref: '#/definitions/percentageComponent' },
                ],
              },
            },
          },
        },
        {
          if: { properties: { colorSpace: { const: 'hwb' }, components: { type: 'array' } } },
          then: {
            properties: {
              components: {
                type: 'array',
                minItems: 3,
                maxItems: 3,
                items: [
                  { $ref: '#/definitions/hueComponent' },
                  { $ref: '#/definitions/percentageComponent' },
                  { $ref: '#/definitions/percentageComponent' },
                ],
              },
            },
          },
        },
        {
          if: { properties: { colorSpace: { const: 'lab' }, components: { type: 'array' } } },
          then: {
            properties: {
              components: {
                type: 'array',
                minItems: 3,
                maxItems: 3,
                items: [
                  { $ref: '#/definitions/percentageComponent' },
                  { $ref: '#/definitions/unboundedComponent' },
                  { $ref: '#/definitions/unboundedComponent' },
                ],
              },
            },
          },
        },
        {
          if: { properties: { colorSpace: { const: 'lch' }, components: { type: 'array' } } },
          then: {
            properties: {
              components: {
                type: 'array',
                minItems: 3,
                maxItems: 3,
                items: [
                  { $ref: '#/definitions/percentageComponent' },
                  { $ref: '#/definitions/chromaComponent' },
                  { $ref: '#/definitions/hueComponent' },
                ],
              },
            },
          },
        },
        {
          if: { properties: { colorSpace: { const: 'oklab' }, components: { type: 'array' } } },
          then: {
            properties: {
              components: {
                type: 'array',
                minItems: 3,
                maxItems: 3,
                items: [
                  { $ref: '#/definitions/zeroToOneComponent' },
                  { $ref: '#/definitions/unboundedComponent' },
                  { $ref: '#/definitions/unboundedComponent' },
                ],
              },
            },
          },
        },
        {
          if: { properties: { colorSpace: { const: 'oklch' }, components: { type: 'array' } } },
          then: {
            properties: {
              components: {
                type: 'array',
                minItems: 3,
                maxItems: 3,
                items: [
                  { $ref: '#/definitions/zeroToOneComponent' },
                  { $ref: '#/definitions/chromaComponent' },
                  { $ref: '#/definitions/hueComponent' },
                ],
              },
            },
          },
        },
      ],
    },
    'https://www.designtokens.org/schemas/2025.10/format/values/dimension.json': {
      $schema: 'http://json-schema.org/draft-07/schema#',
      $id: 'https://www.designtokens.org/schemas/2025.10/format/values/dimension.json',
      title: 'Dimension Value',
      description:
        'Value schema for dimension type tokens. Represents an amount of distance in a single dimension in the UI, such as a position, width, height, radius, or thickness.',
      type: 'object',
      properties: {
        value: {
          description: 'An integer or floating-point value representing the numeric value.',
          oneOf: [
            { type: 'number' },
            {
              $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/jsonPointerReferenceObject',
            },
          ],
        },
        unit: {
          description:
            "Unit of distance. Supported values: 'px' (idealized pixel, equivalent to dp on Android and pt on iOS), 'rem' (multiple of system's default font size).",
          oneOf: [
            { type: 'string', enum: ['px', 'rem'] },
            {
              $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/jsonPointerReferenceObject',
            },
          ],
        },
      },
      required: ['value', 'unit'],
      additionalProperties: false,
    },
    'https://www.designtokens.org/schemas/2025.10/format/values/fontFamily.json': {
      $schema: 'http://json-schema.org/draft-07/schema#',
      $id: 'https://www.designtokens.org/schemas/2025.10/format/values/fontFamily.json',
      title: 'Font Family Value',
      description:
        'Value schema for fontFamily type tokens. Represents a font name or an array of font names (ordered from most to least preferred).',
      oneOf: [
        {
          type: 'string',
          description: 'A single font name',
          not: {
            $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/curlyBraceReference',
          },
        },
        {
          type: 'array',
          description: 'An array of font names, ordered from most to least preferred',
          items: {
            oneOf: [
              {
                type: 'string',
                not: {
                  $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/curlyBraceReference',
                },
              },
              {
                $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/jsonPointerReferenceObject',
              },
            ],
          },
          minItems: 1,
        },
      ],
    },
    'https://www.designtokens.org/schemas/2025.10/format/values/fontWeight.json': {
      $schema: 'http://json-schema.org/draft-07/schema#',
      $id: 'https://www.designtokens.org/schemas/2025.10/format/values/fontWeight.json',
      title: 'Font Weight Value',
      description:
        'Value schema for fontWeight type tokens. Represents a font weight as per the OpenType wght tag specification. Lower numbers represent lighter weights, higher numbers represent thicker weights.',
      oneOf: [
        { type: 'number', description: 'Numeric font weight value', minimum: 1, maximum: 1000 },
        {
          type: 'string',
          description: 'Pre-defined font weight string value',
          enum: [
            'thin',
            'hairline',
            'extra-light',
            'ultra-light',
            'light',
            'normal',
            'regular',
            'book',
            'medium',
            'semi-bold',
            'demi-bold',
            'bold',
            'extra-bold',
            'ultra-bold',
            'black',
            'heavy',
            'extra-black',
            'ultra-black',
          ],
        },
      ],
    },
    'https://www.designtokens.org/schemas/2025.10/format/values/duration.json': {
      $schema: 'http://json-schema.org/draft-07/schema#',
      $id: 'https://www.designtokens.org/schemas/2025.10/format/values/duration.json',
      title: 'Duration Value',
      description:
        'Value schema for duration type tokens. Represents the length of time in milliseconds an animation or animation cycle takes to complete.',
      type: 'object',
      properties: {
        value: {
          description: 'An integer or floating-point value representing the numeric value.',
          oneOf: [
            { type: 'number' },
            {
              $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/jsonPointerReferenceObject',
            },
          ],
        },
        unit: {
          description: "Unit of time. Supported values: 'ms' (millisecond), 's' (second).",
          oneOf: [
            { type: 'string', enum: ['ms', 's'] },
            {
              $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/jsonPointerReferenceObject',
            },
          ],
        },
      },
      required: ['value', 'unit'],
      additionalProperties: false,
    },
    'https://www.designtokens.org/schemas/2025.10/format/values/cubicBezier.json': {
      $schema: 'http://json-schema.org/draft-07/schema#',
      $id: 'https://www.designtokens.org/schemas/2025.10/format/values/cubicBezier.json',
      title: 'Cubic Bezier Value',
      description:
        'Value schema for cubicBezier type tokens. Represents how the value of an animated property progresses towards completion over the duration of an animation, effectively creating visual effects such as acceleration, deceleration, and bounce.',
      type: 'array',
      items: [
        { $ref: '#/definitions/xCoordinate' },
        { $ref: '#/definitions/yCoordinate' },
        { $ref: '#/definitions/xCoordinate' },
        { $ref: '#/definitions/yCoordinate' },
      ],
      additionalItems: false,
      minItems: 4,
      maxItems: 4,
      definitions: {
        xCoordinate: {
          title: 'X Coordinate',
          description: 'X coordinate of control point (must be between 0 and 1)',
          oneOf: [
            { type: 'number', minimum: 0, maximum: 1 },
            {
              $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/jsonPointerReferenceObject',
            },
          ],
        },
        yCoordinate: {
          title: 'Y Coordinate',
          description: 'Y coordinate of control point (can be any real number)',
          oneOf: [
            { type: 'number' },
            {
              $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/jsonPointerReferenceObject',
            },
          ],
        },
      },
    },
    'https://www.designtokens.org/schemas/2025.10/format/values/number.json': {
      $schema: 'http://json-schema.org/draft-07/schema#',
      $id: 'https://www.designtokens.org/schemas/2025.10/format/values/number.json',
      title: 'Number Value',
      description:
        'Value schema for number type tokens. Numbers can be positive, negative and have fractions. Example uses are gradient stop positions or unitless line heights.',
      type: 'number',
    },
    'https://www.designtokens.org/schemas/2025.10/format/values/strokeStyle.json': {
      $schema: 'http://json-schema.org/draft-07/schema#',
      $id: 'https://www.designtokens.org/schemas/2025.10/format/values/strokeStyle.json',
      title: 'Stroke Style Value',
      description:
        'Value schema for strokeStyle type tokens. Represents the style applied to lines or borders.',
      oneOf: [
        {
          type: 'string',
          enum: ['solid', 'dashed', 'dotted', 'double', 'groove', 'ridge', 'outset', 'inset'],
          description:
            'Pre-defined stroke style values with the same meaning as CSS line style values',
        },
        {
          type: 'object',
          properties: {
            dashArray: {
              description:
                'Array of dimension values specifying lengths of alternating dashes and gaps',
              oneOf: [
                {
                  type: 'array',
                  items: {
                    oneOf: [
                      {
                        $ref: 'https://www.designtokens.org/schemas/2025.10/format/values/dimension.json',
                      },
                      {
                        $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/tokenValueReference',
                      },
                    ],
                  },
                  minItems: 1,
                },
                {
                  $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/jsonPointerReferenceObject',
                },
              ],
            },
            lineCap: {
              description: 'Line cap style, same meaning as SVG stroke-linecap attribute',
              oneOf: [
                { type: 'string', enum: ['round', 'butt', 'square'] },
                {
                  $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/jsonPointerReferenceObject',
                },
              ],
            },
          },
          required: ['dashArray', 'lineCap'],
          additionalProperties: false,
        },
      ],
    },
    'https://www.designtokens.org/schemas/2025.10/format/values/border.json': {
      $schema: 'http://json-schema.org/draft-07/schema#',
      $id: 'https://www.designtokens.org/schemas/2025.10/format/values/border.json',
      title: 'Border Value',
      description: 'Value schema for border type tokens. Represents a border style.',
      type: 'object',
      properties: {
        color: {
          description: 'The color of the border',
          oneOf: [
            { $ref: 'https://www.designtokens.org/schemas/2025.10/format/values/color.json' },
            {
              $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/tokenValueReference',
            },
          ],
        },
        width: {
          description: 'The width or thickness of the border',
          oneOf: [
            { $ref: 'https://www.designtokens.org/schemas/2025.10/format/values/dimension.json' },
            {
              $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/tokenValueReference',
            },
          ],
        },
        style: {
          description: "The border's style",
          oneOf: [
            { $ref: 'https://www.designtokens.org/schemas/2025.10/format/values/strokeStyle.json' },
            {
              $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/tokenValueReference',
            },
          ],
        },
      },
      required: ['color', 'width', 'style'],
      additionalProperties: false,
    },
    'https://www.designtokens.org/schemas/2025.10/format/values/transition.json': {
      $schema: 'http://json-schema.org/draft-07/schema#',
      $id: 'https://www.designtokens.org/schemas/2025.10/format/values/transition.json',
      title: 'Transition Value',
      description:
        'Value schema for transition type tokens. Represents an animated transition between two states.',
      type: 'object',
      properties: {
        duration: {
          description: 'The duration of the transition',
          oneOf: [
            { $ref: 'https://www.designtokens.org/schemas/2025.10/format/values/duration.json' },
            {
              $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/tokenValueReference',
            },
          ],
        },
        delay: {
          description: 'The time to wait before the transition begins',
          oneOf: [
            { $ref: 'https://www.designtokens.org/schemas/2025.10/format/values/duration.json' },
            {
              $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/tokenValueReference',
            },
          ],
        },
        timingFunction: {
          description: 'The timing function of the transition',
          oneOf: [
            { $ref: 'https://www.designtokens.org/schemas/2025.10/format/values/cubicBezier.json' },
            {
              $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/tokenValueReference',
            },
          ],
        },
      },
      required: ['duration', 'delay', 'timingFunction'],
      additionalProperties: false,
    },
    'https://www.designtokens.org/schemas/2025.10/format/values/shadow.json': {
      $schema: 'http://json-schema.org/draft-07/schema#',
      $id: 'https://www.designtokens.org/schemas/2025.10/format/values/shadow.json',
      title: 'Shadow Value',
      description: 'Value schema for shadow type tokens. Represents a shadow style.',
      oneOf: [
        { $ref: '#/definitions/shadowObject' },
        {
          type: 'array',
          description: 'Array of shadow objects and/or references to shadow tokens',
          items: {
            oneOf: [
              { $ref: '#/definitions/shadowObject' },
              {
                $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/tokenValueReference',
              },
            ],
          },
          minItems: 1,
        },
      ],
      definitions: {
        shadowObject: {
          title: 'Shadow Object',
          type: 'object',
          properties: {
            color: {
              description: 'The color of the shadow',
              oneOf: [
                { $ref: 'https://www.designtokens.org/schemas/2025.10/format/values/color.json' },
                {
                  $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/tokenValueReference',
                },
              ],
            },
            offsetX: {
              description:
                'The horizontal offset that shadow has from the element it is applied to',
              oneOf: [
                {
                  $ref: 'https://www.designtokens.org/schemas/2025.10/format/values/dimension.json',
                },
                {
                  $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/tokenValueReference',
                },
              ],
            },
            offsetY: {
              description: 'The vertical offset that shadow has from the element it is applied to',
              oneOf: [
                {
                  $ref: 'https://www.designtokens.org/schemas/2025.10/format/values/dimension.json',
                },
                {
                  $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/tokenValueReference',
                },
              ],
            },
            blur: {
              description: 'The blur radius that is applied to the shadow',
              oneOf: [
                {
                  $ref: 'https://www.designtokens.org/schemas/2025.10/format/values/dimension.json',
                },
                {
                  $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/tokenValueReference',
                },
              ],
            },
            spread: {
              description: 'The amount by which to expand or contract the shadow',
              oneOf: [
                {
                  $ref: 'https://www.designtokens.org/schemas/2025.10/format/values/dimension.json',
                },
                {
                  $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/tokenValueReference',
                },
              ],
            },
            inset: {
              description:
                'Whether this shadow is inside the containing shape (inner shadow) rather than a drop shadow (default: false)',
              oneOf: [
                { type: 'boolean' },
                {
                  $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/jsonPointerReferenceObject',
                },
              ],
            },
          },
          required: ['color', 'offsetX', 'offsetY', 'blur', 'spread'],
          additionalProperties: false,
        },
      },
    },
    'https://www.designtokens.org/schemas/2025.10/format/values/gradient.json': {
      $schema: 'http://json-schema.org/draft-07/schema#',
      $id: 'https://www.designtokens.org/schemas/2025.10/format/values/gradient.json',
      title: 'Gradient Value',
      description: 'Value schema for gradient type tokens. Represents a color gradient.',
      type: 'array',
      items: {
        oneOf: [
          { $ref: '#/definitions/gradientStop' },
          {
            $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/tokenValueReference',
          },
        ],
      },
      minItems: 1,
      definitions: {
        gradientStop: {
          title: 'Gradient Stop',
          type: 'object',
          properties: {
            color: {
              description: "The color value at the stop's position on the gradient",
              oneOf: [
                { $ref: 'https://www.designtokens.org/schemas/2025.10/format/values/color.json' },
                {
                  $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/tokenValueReference',
                },
              ],
            },
            position: {
              description:
                "The position of the stop along the gradient's axis (range [0, 1]). Values outside this range are clamped.",
              oneOf: [
                { type: 'number', minimum: 0, maximum: 1 },
                {
                  $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/tokenValueReference',
                },
              ],
            },
          },
          required: ['color', 'position'],
          additionalProperties: false,
        },
      },
    },
    'https://www.designtokens.org/schemas/2025.10/format/values/typography.json': {
      $schema: 'http://json-schema.org/draft-07/schema#',
      $id: 'https://www.designtokens.org/schemas/2025.10/format/values/typography.json',
      title: 'Typography Value',
      description: 'Value schema for typography type tokens. Represents a typographic style.',
      type: 'object',
      properties: {
        fontFamily: {
          description: "The typography's font",
          oneOf: [
            { $ref: 'https://www.designtokens.org/schemas/2025.10/format/values/fontFamily.json' },
            {
              $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/tokenValueReference',
            },
          ],
        },
        fontSize: {
          description: 'The size of the typography',
          oneOf: [
            { $ref: 'https://www.designtokens.org/schemas/2025.10/format/values/dimension.json' },
            {
              $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/tokenValueReference',
            },
          ],
        },
        fontWeight: {
          description: 'The weight of the typography',
          oneOf: [
            { $ref: 'https://www.designtokens.org/schemas/2025.10/format/values/fontWeight.json' },
            {
              $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/tokenValueReference',
            },
          ],
        },
        letterSpacing: {
          description: 'The horizontal spacing between characters',
          oneOf: [
            { $ref: 'https://www.designtokens.org/schemas/2025.10/format/values/dimension.json' },
            {
              $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/tokenValueReference',
            },
          ],
        },
        lineHeight: {
          description:
            'The vertical spacing between lines of typography (interpreted as a multiplier of fontSize)',
          oneOf: [
            { $ref: 'https://www.designtokens.org/schemas/2025.10/format/values/number.json' },
            {
              $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/tokenValueReference',
            },
          ],
        },
      },
      required: ['fontFamily', 'fontSize', 'fontWeight', 'letterSpacing', 'lineHeight'],
      additionalProperties: false,
    },
    'https://www.designtokens.org/schemas/2025.10/format/groupOrToken.json': {
      $schema: 'http://json-schema.org/draft-07/schema#',
      $id: 'https://www.designtokens.org/schemas/2025.10/format/groupOrToken.json',
      title: 'Group or Token',
      description:
        'A group or a token in the DTCG specification. A token is identified by the presence of a $value property, while a group is any object without a $value property.',
      oneOf: [
        { $ref: 'https://www.designtokens.org/schemas/2025.10/format/group.json' },
        { $ref: 'https://www.designtokens.org/schemas/2025.10/format/token.json' },
      ],
    },
    'https://www.designtokens.org/schemas/2025.10/format/group.json': {
      $schema: 'http://json-schema.org/draft-07/schema#',
      $id: 'https://www.designtokens.org/schemas/2025.10/format/group.json',
      title: 'Group',
      description: 'A group in the DTCG specification',
      type: 'object',
      properties: {
        $type: { $ref: 'https://www.designtokens.org/schemas/2025.10/format/tokenType.json' },
        $description: { type: 'string', description: 'A plain text description of the group' },
        $extensions: { type: 'object', description: 'Vendor-specific extensions' },
        $extends: {
          oneOf: [
            {
              $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/curlyBraceReference',
            },
            {
              $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/jsonPointerReference',
            },
          ],
          description: 'Reference to another group to inherit tokens and properties from',
        },
        $deprecated: {
          oneOf: [{ type: 'boolean' }, { type: 'string' }],
          description: 'Whether this group is deprecated',
        },
        $root: { $ref: 'https://www.designtokens.org/schemas/2025.10/format/token.json' },
      },
      patternProperties: {
        '^[^${}.][^{}.]*$': {
          $ref: 'https://www.designtokens.org/schemas/2025.10/format/groupOrToken.json',
        },
      },
      additionalProperties: false,
    },
  },
};
const schema12 = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'https://www.designtokens.org/schemas/2025.10/format/tokenType.json',
  title: 'TokenType',
  description: 'A token type in the DTCG specification',
  type: 'string',
  enum: [
    'color',
    'dimension',
    'fontFamily',
    'fontWeight',
    'duration',
    'cubicBezier',
    'number',
    'strokeStyle',
    'border',
    'transition',
    'shadow',
    'gradient',
    'typography',
  ],
};
const schema13 = {
  title: 'Curly Brace Reference',
  type: 'string',
  pattern: '^\\{[^${}.][^{}.]*(\\.[^${}.][^{}.]*)*\\}$',
  description: "Curly brace reference (e.g., '{tokenName}' or '{group.nested.token}')",
};
const schema14 = {
  title: 'JSON Pointer Reference',
  type: 'string',
  pattern: '^#/',
  format: 'json-pointer-uri-fragment',
  description:
    "JSON Pointer reference (RFC 6901) to a location in the document (e.g., '#/path/to/target')",
};
const pattern0 = new RegExp('^[^${}.][^{}.]*$', 'u');
const pattern1 = new RegExp('^\\{[^${}.][^{}.]*(\\.[^${}.][^{}.]*)*\\}$', 'u');
const pattern2 = new RegExp('^#/', 'u');
const formats0 =
  /^(?:[a-z][a-z0-9+\-.]*:)?(?:\/?\/(?:(?:[a-z0-9\-._~!$&'()*+,;=:]|%[0-9a-f]{2})*@)?(?:\[(?:(?:(?:(?:[0-9a-f]{1,4}:){6}|::(?:[0-9a-f]{1,4}:){5}|(?:[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){4}|(?:(?:[0-9a-f]{1,4}:){0,1}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){3}|(?:(?:[0-9a-f]{1,4}:){0,2}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){2}|(?:(?:[0-9a-f]{1,4}:){0,3}[0-9a-f]{1,4})?::[0-9a-f]{1,4}:|(?:(?:[0-9a-f]{1,4}:){0,4}[0-9a-f]{1,4})?::)(?:[0-9a-f]{1,4}:[0-9a-f]{1,4}|(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?))|(?:(?:[0-9a-f]{1,4}:){0,5}[0-9a-f]{1,4})?::[0-9a-f]{1,4}|(?:(?:[0-9a-f]{1,4}:){0,6}[0-9a-f]{1,4})?::)|[Vv][0-9a-f]+\.[a-z0-9\-._~!$&'()*+,;=:]+)\]|(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)|(?:[a-z0-9\-._~!$&'"()*+,;=]|%[0-9a-f]{2})*)(?::\d*)?(?:\/(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})*)*|\/(?:(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})*)*)?|(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})*)*)?(?:\?(?:[a-z0-9\-._~!$&'"()*+,;=:@/?]|%[0-9a-f]{2})*)?(?:#(?:[a-z0-9\-._~!$&'"()*+,;=:@/?]|%[0-9a-f]{2})*)?$/i;
const formats2 = /^#(?:\/(?:[a-z0-9_\-.!$&'()*+,;:=@]|%[0-9a-f]{2}|~0|~1)*)*$/i;
const schema15 = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'https://www.designtokens.org/schemas/2025.10/format/token.json',
  title: 'Token',
  description: 'A token in the DTCG specification',
  type: 'object',
  properties: {
    $value: {
      description:
        "The token's value - can be a direct value or a reference to another token using curly brace syntax (e.g., '{token.name}'). Mutually exclusive with $ref.",
    },
    $type: { $ref: 'https://www.designtokens.org/schemas/2025.10/format/tokenType.json' },
    $ref: {
      $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/jsonPointerReference',
    },
    $description: { type: 'string', description: 'A plain text description of the token' },
    $extensions: { type: 'object', description: 'Vendor-specific extensions' },
    $deprecated: {
      oneOf: [{ type: 'boolean' }, { type: 'string' }],
      description: 'Whether this token is deprecated',
    },
  },
  additionalProperties: false,
  allOf: [
    {
      description:
        'Tokens cannot define both $value and $ref; they must choose exactly one form of reference or direct value.',
      if: { required: ['$value'], properties: { $value: true } },
      then: { not: { required: ['$ref'], properties: { $ref: true } } },
      else: { required: ['$ref'], properties: { $ref: true } },
    },
    {
      if: { required: ['$type'], properties: { $type: { const: 'color' } } },
      then: {
        properties: {
          $value: {
            oneOf: [
              { $ref: 'https://www.designtokens.org/schemas/2025.10/format/values/color.json' },
              {
                $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/tokenValueReference',
              },
            ],
          },
        },
      },
    },
    {
      if: { required: ['$type'], properties: { $type: { const: 'dimension' } } },
      then: {
        properties: {
          $value: {
            oneOf: [
              { $ref: 'https://www.designtokens.org/schemas/2025.10/format/values/dimension.json' },
              {
                $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/tokenValueReference',
              },
            ],
          },
        },
      },
    },
    {
      if: { required: ['$type'], properties: { $type: { const: 'fontFamily' } } },
      then: {
        properties: {
          $value: {
            oneOf: [
              {
                $ref: 'https://www.designtokens.org/schemas/2025.10/format/values/fontFamily.json',
              },
              {
                $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/tokenValueReference',
              },
            ],
          },
        },
      },
    },
    {
      if: { required: ['$type'], properties: { $type: { const: 'fontWeight' } } },
      then: {
        properties: {
          $value: {
            oneOf: [
              {
                $ref: 'https://www.designtokens.org/schemas/2025.10/format/values/fontWeight.json',
              },
              {
                $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/tokenValueReference',
              },
            ],
          },
        },
      },
    },
    {
      if: { required: ['$type'], properties: { $type: { const: 'duration' } } },
      then: {
        properties: {
          $value: {
            oneOf: [
              { $ref: 'https://www.designtokens.org/schemas/2025.10/format/values/duration.json' },
              {
                $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/tokenValueReference',
              },
            ],
          },
        },
      },
    },
    {
      if: { required: ['$type'], properties: { $type: { const: 'cubicBezier' } } },
      then: {
        properties: {
          $value: {
            oneOf: [
              {
                $ref: 'https://www.designtokens.org/schemas/2025.10/format/values/cubicBezier.json',
              },
              {
                $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/tokenValueReference',
              },
            ],
          },
        },
      },
    },
    {
      if: { required: ['$type'], properties: { $type: { const: 'number' } } },
      then: {
        properties: {
          $value: {
            oneOf: [
              { $ref: 'https://www.designtokens.org/schemas/2025.10/format/values/number.json' },
              {
                $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/tokenValueReference',
              },
            ],
          },
        },
      },
    },
    {
      if: { required: ['$type'], properties: { $type: { const: 'strokeStyle' } } },
      then: {
        properties: {
          $value: {
            oneOf: [
              {
                $ref: 'https://www.designtokens.org/schemas/2025.10/format/values/strokeStyle.json',
              },
              {
                $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/tokenValueReference',
              },
            ],
          },
        },
      },
    },
    {
      if: { required: ['$type'], properties: { $type: { const: 'border' } } },
      then: {
        properties: {
          $value: {
            oneOf: [
              { $ref: 'https://www.designtokens.org/schemas/2025.10/format/values/border.json' },
              {
                $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/tokenValueReference',
              },
            ],
          },
        },
      },
    },
    {
      if: { required: ['$type'], properties: { $type: { const: 'transition' } } },
      then: {
        properties: {
          $value: {
            oneOf: [
              {
                $ref: 'https://www.designtokens.org/schemas/2025.10/format/values/transition.json',
              },
              {
                $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/tokenValueReference',
              },
            ],
          },
        },
      },
    },
    {
      if: { required: ['$type'], properties: { $type: { const: 'shadow' } } },
      then: {
        properties: {
          $value: {
            oneOf: [
              { $ref: 'https://www.designtokens.org/schemas/2025.10/format/values/shadow.json' },
              {
                $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/tokenValueReference',
              },
            ],
          },
        },
      },
    },
    {
      if: { required: ['$type'], properties: { $type: { const: 'gradient' } } },
      then: {
        properties: {
          $value: {
            oneOf: [
              { $ref: 'https://www.designtokens.org/schemas/2025.10/format/values/gradient.json' },
              {
                $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/tokenValueReference',
              },
            ],
          },
        },
      },
    },
    {
      if: { required: ['$type'], properties: { $type: { const: 'typography' } } },
      then: {
        properties: {
          $value: {
            oneOf: [
              {
                $ref: 'https://www.designtokens.org/schemas/2025.10/format/values/typography.json',
              },
              {
                $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/tokenValueReference',
              },
            ],
          },
        },
      },
    },
    {
      if: {
        allOf: [
          { not: { required: ['$type'] } },
          { required: ['$value'] },
          {
            properties: {
              $value: {
                not: {
                  $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/tokenValueReference',
                },
              },
            },
          },
        ],
      },
      then: {
        properties: {
          $value: {
            oneOf: [
              { $ref: 'https://www.designtokens.org/schemas/2025.10/format/values/color.json' },
              { $ref: 'https://www.designtokens.org/schemas/2025.10/format/values/dimension.json' },
              {
                $ref: 'https://www.designtokens.org/schemas/2025.10/format/values/fontFamily.json',
              },
              { $ref: 'https://www.designtokens.org/schemas/2025.10/format/values/duration.json' },
              {
                $ref: 'https://www.designtokens.org/schemas/2025.10/format/values/cubicBezier.json',
              },
              {
                $ref: 'https://www.designtokens.org/schemas/2025.10/format/values/strokeStyle.json',
              },
              { $ref: 'https://www.designtokens.org/schemas/2025.10/format/values/border.json' },
              {
                $ref: 'https://www.designtokens.org/schemas/2025.10/format/values/transition.json',
              },
              { $ref: 'https://www.designtokens.org/schemas/2025.10/format/values/shadow.json' },
              { $ref: 'https://www.designtokens.org/schemas/2025.10/format/values/gradient.json' },
              {
                $ref: 'https://www.designtokens.org/schemas/2025.10/format/values/typography.json',
              },
              {
                anyOf: [
                  {
                    $ref: 'https://www.designtokens.org/schemas/2025.10/format/values/number.json',
                  },
                  {
                    $ref: 'https://www.designtokens.org/schemas/2025.10/format/values/fontWeight.json',
                  },
                ],
              },
            ],
          },
        },
      },
    },
  ],
};
const schema32 = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'https://www.designtokens.org/schemas/2025.10/format/values/fontWeight.json',
  title: 'Font Weight Value',
  description:
    'Value schema for fontWeight type tokens. Represents a font weight as per the OpenType wght tag specification. Lower numbers represent lighter weights, higher numbers represent thicker weights.',
  oneOf: [
    { type: 'number', description: 'Numeric font weight value', minimum: 1, maximum: 1000 },
    {
      type: 'string',
      description: 'Pre-defined font weight string value',
      enum: [
        'thin',
        'hairline',
        'extra-light',
        'ultra-light',
        'light',
        'normal',
        'regular',
        'book',
        'medium',
        'semi-bold',
        'demi-bold',
        'bold',
        'extra-bold',
        'ultra-bold',
        'black',
        'heavy',
        'extra-black',
        'ultra-black',
      ],
    },
  ],
};
const schema37 = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'https://www.designtokens.org/schemas/2025.10/format/values/number.json',
  title: 'Number Value',
  description:
    'Value schema for number type tokens. Numbers can be positive, negative and have fractions. Example uses are gradient stop positions or unitless line heights.',
  type: 'number',
};
const schema16 = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'https://www.designtokens.org/schemas/2025.10/format/values/color.json',
  title: 'Color Value',
  description: 'Value schema for color type tokens. Represents a color in a specific color space.',
  type: 'object',
  properties: {
    colorSpace: {
      description: 'The color space or color model used to represent the color',
      oneOf: [
        {
          type: 'string',
          enum: [
            'srgb',
            'srgb-linear',
            'hsl',
            'hwb',
            'lab',
            'lch',
            'oklab',
            'oklch',
            'display-p3',
            'a98-rgb',
            'prophoto-rgb',
            'rec2020',
            'xyz-d65',
            'xyz-d50',
          ],
        },
        {
          $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/jsonPointerReferenceObject',
        },
      ],
    },
    components: {
      description:
        "Array of color components. The number and meaning of components depend on the color space. Each component can be a number or the 'none' keyword.",
      oneOf: [
        { type: 'array' },
        {
          $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/jsonPointerReferenceObject',
        },
      ],
    },
    alpha: {
      description:
        'The alpha (transparency) value of the color. 0 is fully transparent, 1 is fully opaque. If omitted, defaults to 1.',
      oneOf: [
        { type: 'number', minimum: 0, maximum: 1 },
        {
          $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/jsonPointerReferenceObject',
        },
      ],
    },
    hex: {
      description:
        "Optional fallback value in 6-digit CSS hex color notation (e.g., '#ff00ff'). Must be 6 digits to avoid conflicts with the alpha value.",
      $comment:
        'Only JSON Pointer references (not curly brace references) are allowed for hex because no string token type exists in the specification that could be referenced with curly braces.',
      oneOf: [
        { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
        {
          $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/jsonPointerReferenceObject',
        },
      ],
    },
  },
  required: ['colorSpace', 'components'],
  additionalProperties: false,
  definitions: {
    zeroToOneComponent: {
      title: 'Zero to One Component',
      description: 'A color component normalized to the range [0-1] (e.g., RGB values, XYZ values)',
      oneOf: [
        { type: 'number', minimum: 0, maximum: 1 },
        { type: 'string', const: 'none' },
        {
          $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/jsonPointerReferenceObject',
        },
      ],
    },
    hueComponent: {
      title: 'Hue Component',
      description: 'Hue angle from 0 up to (but not including) 360 degrees',
      oneOf: [
        { type: 'number', minimum: 0, exclusiveMaximum: 360 },
        { type: 'string', const: 'none' },
        {
          $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/jsonPointerReferenceObject',
        },
      ],
    },
    percentageComponent: {
      title: 'Percentage Component',
      description: 'Percentage value from 0 to 100',
      oneOf: [
        { type: 'number', minimum: 0, maximum: 100 },
        { type: 'string', const: 'none' },
        {
          $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/jsonPointerReferenceObject',
        },
      ],
    },
    chromaComponent: {
      title: 'Chroma Component',
      description: 'Chroma value from 0 to infinity',
      oneOf: [
        { type: 'number', minimum: 0 },
        { type: 'string', const: 'none' },
        {
          $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/jsonPointerReferenceObject',
        },
      ],
    },
    unboundedComponent: {
      title: 'Unbounded Component',
      description:
        'A color component with no numeric bounds (e.g., A and B in LAB/OKLAB color spaces)',
      oneOf: [
        { type: 'number' },
        { type: 'string', const: 'none' },
        {
          $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/jsonPointerReferenceObject',
        },
      ],
    },
    rgbComponents: {
      title: 'RGB Components',
      description:
        'Array of RGB color components [Red, Green, Blue], each normalized to the range [0-1]',
      type: 'array',
      minItems: 3,
      maxItems: 3,
      items: [
        { $ref: '#/definitions/zeroToOneComponent' },
        { $ref: '#/definitions/zeroToOneComponent' },
        { $ref: '#/definitions/zeroToOneComponent' },
      ],
    },
    xyzComponents: {
      title: 'XYZ Components',
      description: 'Array of XYZ color components [X, Y, Z], each normalized to the range [0-1]',
      type: 'array',
      minItems: 3,
      maxItems: 3,
      items: [
        { $ref: '#/definitions/zeroToOneComponent' },
        { $ref: '#/definitions/zeroToOneComponent' },
        { $ref: '#/definitions/zeroToOneComponent' },
      ],
    },
  },
  allOf: [
    {
      if: { properties: { colorSpace: { const: 'srgb' }, components: { type: 'array' } } },
      then: { properties: { components: { $ref: '#/definitions/rgbComponents' } } },
    },
    {
      if: { properties: { colorSpace: { const: 'srgb-linear' }, components: { type: 'array' } } },
      then: { properties: { components: { $ref: '#/definitions/rgbComponents' } } },
    },
    {
      if: { properties: { colorSpace: { const: 'display-p3' }, components: { type: 'array' } } },
      then: { properties: { components: { $ref: '#/definitions/rgbComponents' } } },
    },
    {
      if: { properties: { colorSpace: { const: 'a98-rgb' }, components: { type: 'array' } } },
      then: { properties: { components: { $ref: '#/definitions/rgbComponents' } } },
    },
    {
      if: { properties: { colorSpace: { const: 'prophoto-rgb' }, components: { type: 'array' } } },
      then: { properties: { components: { $ref: '#/definitions/rgbComponents' } } },
    },
    {
      if: { properties: { colorSpace: { const: 'rec2020' }, components: { type: 'array' } } },
      then: { properties: { components: { $ref: '#/definitions/rgbComponents' } } },
    },
    {
      if: { properties: { colorSpace: { const: 'xyz-d65' }, components: { type: 'array' } } },
      then: { properties: { components: { $ref: '#/definitions/xyzComponents' } } },
    },
    {
      if: { properties: { colorSpace: { const: 'xyz-d50' }, components: { type: 'array' } } },
      then: { properties: { components: { $ref: '#/definitions/xyzComponents' } } },
    },
    {
      if: { properties: { colorSpace: { const: 'hsl' }, components: { type: 'array' } } },
      then: {
        properties: {
          components: {
            type: 'array',
            minItems: 3,
            maxItems: 3,
            items: [
              { $ref: '#/definitions/hueComponent' },
              { $ref: '#/definitions/percentageComponent' },
              { $ref: '#/definitions/percentageComponent' },
            ],
          },
        },
      },
    },
    {
      if: { properties: { colorSpace: { const: 'hwb' }, components: { type: 'array' } } },
      then: {
        properties: {
          components: {
            type: 'array',
            minItems: 3,
            maxItems: 3,
            items: [
              { $ref: '#/definitions/hueComponent' },
              { $ref: '#/definitions/percentageComponent' },
              { $ref: '#/definitions/percentageComponent' },
            ],
          },
        },
      },
    },
    {
      if: { properties: { colorSpace: { const: 'lab' }, components: { type: 'array' } } },
      then: {
        properties: {
          components: {
            type: 'array',
            minItems: 3,
            maxItems: 3,
            items: [
              { $ref: '#/definitions/percentageComponent' },
              { $ref: '#/definitions/unboundedComponent' },
              { $ref: '#/definitions/unboundedComponent' },
            ],
          },
        },
      },
    },
    {
      if: { properties: { colorSpace: { const: 'lch' }, components: { type: 'array' } } },
      then: {
        properties: {
          components: {
            type: 'array',
            minItems: 3,
            maxItems: 3,
            items: [
              { $ref: '#/definitions/percentageComponent' },
              { $ref: '#/definitions/chromaComponent' },
              { $ref: '#/definitions/hueComponent' },
            ],
          },
        },
      },
    },
    {
      if: { properties: { colorSpace: { const: 'oklab' }, components: { type: 'array' } } },
      then: {
        properties: {
          components: {
            type: 'array',
            minItems: 3,
            maxItems: 3,
            items: [
              { $ref: '#/definitions/zeroToOneComponent' },
              { $ref: '#/definitions/unboundedComponent' },
              { $ref: '#/definitions/unboundedComponent' },
            ],
          },
        },
      },
    },
    {
      if: { properties: { colorSpace: { const: 'oklch' }, components: { type: 'array' } } },
      then: {
        properties: {
          components: {
            type: 'array',
            minItems: 3,
            maxItems: 3,
            items: [
              { $ref: '#/definitions/zeroToOneComponent' },
              { $ref: '#/definitions/chromaComponent' },
              { $ref: '#/definitions/hueComponent' },
            ],
          },
        },
      },
    },
  ],
};
const schema17 = {
  title: 'RGB Components',
  description:
    'Array of RGB color components [Red, Green, Blue], each normalized to the range [0-1]',
  type: 'array',
  minItems: 3,
  maxItems: 3,
  items: [
    { $ref: '#/definitions/zeroToOneComponent' },
    { $ref: '#/definitions/zeroToOneComponent' },
    { $ref: '#/definitions/zeroToOneComponent' },
  ],
};
const schema18 = {
  title: 'Zero to One Component',
  description: 'A color component normalized to the range [0-1] (e.g., RGB values, XYZ values)',
  oneOf: [
    { type: 'number', minimum: 0, maximum: 1 },
    { type: 'string', const: 'none' },
    {
      $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/jsonPointerReferenceObject',
    },
  ],
};
const schema19 = {
  title: 'JSON Pointer Reference Object',
  type: 'object',
  properties: { $ref: { $ref: '#/definitions/jsonPointerReference' } },
  required: ['$ref'],
  additionalProperties: false,
  description: 'Object containing a JSON Pointer reference for property-level references',
};
function validate15(
  data,
  { instancePath = '', parentData, parentDataProperty, rootData = data } = {},
) {
  let vErrors = null;
  let errors = 0;
  if (data && typeof data == 'object' && !Array.isArray(data)) {
    if (data.$ref === undefined) {
      const err0 = {
        instancePath,
        schemaPath: '#/required',
        keyword: 'required',
        params: { missingProperty: '$ref' },
        message: "must have required property '" + '$ref' + "'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === '$ref')) {
        const err1 = {
          instancePath,
          schemaPath: '#/additionalProperties',
          keyword: 'additionalProperties',
          params: { additionalProperty: key0 },
          message: 'must NOT have additional properties',
        };
        if (vErrors === null) {
          vErrors = [err1];
        } else {
          vErrors.push(err1);
        }
        errors++;
      }
    }
    if (data.$ref !== undefined) {
      let data0 = data.$ref;
      if (typeof data0 === 'string') {
        if (!pattern2.test(data0)) {
          const err2 = {
            instancePath: instancePath + '/$ref',
            schemaPath: '#/definitions/jsonPointerReference/pattern',
            keyword: 'pattern',
            params: { pattern: '^#/' },
            message: 'must match pattern "' + '^#/' + '"',
          };
          if (vErrors === null) {
            vErrors = [err2];
          } else {
            vErrors.push(err2);
          }
          errors++;
        }
        if (!formats2.test(data0)) {
          const err3 = {
            instancePath: instancePath + '/$ref',
            schemaPath: '#/definitions/jsonPointerReference/format',
            keyword: 'format',
            params: { format: 'json-pointer-uri-fragment' },
            message: 'must match format "' + 'json-pointer-uri-fragment' + '"',
          };
          if (vErrors === null) {
            vErrors = [err3];
          } else {
            vErrors.push(err3);
          }
          errors++;
        }
      } else {
        const err4 = {
          instancePath: instancePath + '/$ref',
          schemaPath: '#/definitions/jsonPointerReference/type',
          keyword: 'type',
          params: { type: 'string' },
          message: 'must be string',
        };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      }
    }
  } else {
    const err5 = {
      instancePath,
      schemaPath: '#/type',
      keyword: 'type',
      params: { type: 'object' },
      message: 'must be object',
    };
    if (vErrors === null) {
      vErrors = [err5];
    } else {
      vErrors.push(err5);
    }
    errors++;
  }
  validate15.errors = vErrors;
  return errors === 0;
}
function validate14(
  data,
  { instancePath = '', parentData, parentDataProperty, rootData = data } = {},
) {
  let vErrors = null;
  let errors = 0;
  const _errs0 = errors;
  let valid0 = false;
  let passing0 = null;
  const _errs1 = errors;
  if (typeof data == 'number') {
    if (data > 1 || isNaN(data)) {
      const err0 = {
        instancePath,
        schemaPath: '#/oneOf/0/maximum',
        keyword: 'maximum',
        params: { comparison: '<=', limit: 1 },
        message: 'must be <= 1',
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data < 0 || isNaN(data)) {
      const err1 = {
        instancePath,
        schemaPath: '#/oneOf/0/minimum',
        keyword: 'minimum',
        params: { comparison: '>=', limit: 0 },
        message: 'must be >= 0',
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
  } else {
    const err2 = {
      instancePath,
      schemaPath: '#/oneOf/0/type',
      keyword: 'type',
      params: { type: 'number' },
      message: 'must be number',
    };
    if (vErrors === null) {
      vErrors = [err2];
    } else {
      vErrors.push(err2);
    }
    errors++;
  }
  var _valid0 = _errs1 === errors;
  if (_valid0) {
    valid0 = true;
    passing0 = 0;
  }
  const _errs3 = errors;
  if (typeof data !== 'string') {
    const err3 = {
      instancePath,
      schemaPath: '#/oneOf/1/type',
      keyword: 'type',
      params: { type: 'string' },
      message: 'must be string',
    };
    if (vErrors === null) {
      vErrors = [err3];
    } else {
      vErrors.push(err3);
    }
    errors++;
  }
  if ('none' !== data) {
    const err4 = {
      instancePath,
      schemaPath: '#/oneOf/1/const',
      keyword: 'const',
      params: { allowedValue: 'none' },
      message: 'must be equal to constant',
    };
    if (vErrors === null) {
      vErrors = [err4];
    } else {
      vErrors.push(err4);
    }
    errors++;
  }
  var _valid0 = _errs3 === errors;
  if (_valid0 && valid0) {
    valid0 = false;
    passing0 = [passing0, 1];
  } else {
    if (_valid0) {
      valid0 = true;
      passing0 = 1;
    }
    const _errs5 = errors;
    if (!validate15(data, { instancePath, parentData, parentDataProperty, rootData })) {
      vErrors = vErrors === null ? validate15.errors : vErrors.concat(validate15.errors);
      errors = vErrors.length;
    }
    var _valid0 = _errs5 === errors;
    if (_valid0 && valid0) {
      valid0 = false;
      passing0 = [passing0, 2];
    } else {
      if (_valid0) {
        valid0 = true;
        passing0 = 2;
      }
    }
  }
  if (!valid0) {
    const err5 = {
      instancePath,
      schemaPath: '#/oneOf',
      keyword: 'oneOf',
      params: { passingSchemas: passing0 },
      message: 'must match exactly one schema in oneOf',
    };
    if (vErrors === null) {
      vErrors = [err5];
    } else {
      vErrors.push(err5);
    }
    errors++;
  } else {
    errors = _errs0;
    if (vErrors !== null) {
      if (_errs0) {
        vErrors.length = _errs0;
      } else {
        vErrors = null;
      }
    }
  }
  validate14.errors = vErrors;
  return errors === 0;
}
function validate13(
  data,
  { instancePath = '', parentData, parentDataProperty, rootData = data } = {},
) {
  let vErrors = null;
  let errors = 0;
  if (Array.isArray(data)) {
    if (data.length > 3) {
      const err0 = {
        instancePath,
        schemaPath: '#/maxItems',
        keyword: 'maxItems',
        params: { limit: 3 },
        message: 'must NOT have more than 3 items',
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.length < 3) {
      const err1 = {
        instancePath,
        schemaPath: '#/minItems',
        keyword: 'minItems',
        params: { limit: 3 },
        message: 'must NOT have fewer than 3 items',
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    const len0 = data.length;
    if (len0 > 0) {
      if (
        !validate14(data[0], {
          instancePath: instancePath + '/0',
          parentData: data,
          parentDataProperty: 0,
          rootData,
        })
      ) {
        vErrors = vErrors === null ? validate14.errors : vErrors.concat(validate14.errors);
        errors = vErrors.length;
      }
    }
    if (len0 > 1) {
      if (
        !validate14(data[1], {
          instancePath: instancePath + '/1',
          parentData: data,
          parentDataProperty: 1,
          rootData,
        })
      ) {
        vErrors = vErrors === null ? validate14.errors : vErrors.concat(validate14.errors);
        errors = vErrors.length;
      }
    }
    if (len0 > 2) {
      if (
        !validate14(data[2], {
          instancePath: instancePath + '/2',
          parentData: data,
          parentDataProperty: 2,
          rootData,
        })
      ) {
        vErrors = vErrors === null ? validate14.errors : vErrors.concat(validate14.errors);
        errors = vErrors.length;
      }
    }
  } else {
    const err2 = {
      instancePath,
      schemaPath: '#/type',
      keyword: 'type',
      params: { type: 'array' },
      message: 'must be array',
    };
    if (vErrors === null) {
      vErrors = [err2];
    } else {
      vErrors.push(err2);
    }
    errors++;
  }
  validate13.errors = vErrors;
  return errors === 0;
}
const schema21 = {
  title: 'XYZ Components',
  description: 'Array of XYZ color components [X, Y, Z], each normalized to the range [0-1]',
  type: 'array',
  minItems: 3,
  maxItems: 3,
  items: [
    { $ref: '#/definitions/zeroToOneComponent' },
    { $ref: '#/definitions/zeroToOneComponent' },
    { $ref: '#/definitions/zeroToOneComponent' },
  ],
};
function validate26(
  data,
  { instancePath = '', parentData, parentDataProperty, rootData = data } = {},
) {
  let vErrors = null;
  let errors = 0;
  if (Array.isArray(data)) {
    if (data.length > 3) {
      const err0 = {
        instancePath,
        schemaPath: '#/maxItems',
        keyword: 'maxItems',
        params: { limit: 3 },
        message: 'must NOT have more than 3 items',
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.length < 3) {
      const err1 = {
        instancePath,
        schemaPath: '#/minItems',
        keyword: 'minItems',
        params: { limit: 3 },
        message: 'must NOT have fewer than 3 items',
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    const len0 = data.length;
    if (len0 > 0) {
      if (
        !validate14(data[0], {
          instancePath: instancePath + '/0',
          parentData: data,
          parentDataProperty: 0,
          rootData,
        })
      ) {
        vErrors = vErrors === null ? validate14.errors : vErrors.concat(validate14.errors);
        errors = vErrors.length;
      }
    }
    if (len0 > 1) {
      if (
        !validate14(data[1], {
          instancePath: instancePath + '/1',
          parentData: data,
          parentDataProperty: 1,
          rootData,
        })
      ) {
        vErrors = vErrors === null ? validate14.errors : vErrors.concat(validate14.errors);
        errors = vErrors.length;
      }
    }
    if (len0 > 2) {
      if (
        !validate14(data[2], {
          instancePath: instancePath + '/2',
          parentData: data,
          parentDataProperty: 2,
          rootData,
        })
      ) {
        vErrors = vErrors === null ? validate14.errors : vErrors.concat(validate14.errors);
        errors = vErrors.length;
      }
    }
  } else {
    const err2 = {
      instancePath,
      schemaPath: '#/type',
      keyword: 'type',
      params: { type: 'array' },
      message: 'must be array',
    };
    if (vErrors === null) {
      vErrors = [err2];
    } else {
      vErrors.push(err2);
    }
    errors++;
  }
  validate26.errors = vErrors;
  return errors === 0;
}
const schema22 = {
  title: 'Hue Component',
  description: 'Hue angle from 0 up to (but not including) 360 degrees',
  oneOf: [
    { type: 'number', minimum: 0, exclusiveMaximum: 360 },
    { type: 'string', const: 'none' },
    {
      $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/jsonPointerReferenceObject',
    },
  ],
};
function validate32(
  data,
  { instancePath = '', parentData, parentDataProperty, rootData = data } = {},
) {
  let vErrors = null;
  let errors = 0;
  const _errs0 = errors;
  let valid0 = false;
  let passing0 = null;
  const _errs1 = errors;
  if (typeof data == 'number') {
    if (data < 0 || isNaN(data)) {
      const err0 = {
        instancePath,
        schemaPath: '#/oneOf/0/minimum',
        keyword: 'minimum',
        params: { comparison: '>=', limit: 0 },
        message: 'must be >= 0',
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data >= 360 || isNaN(data)) {
      const err1 = {
        instancePath,
        schemaPath: '#/oneOf/0/exclusiveMaximum',
        keyword: 'exclusiveMaximum',
        params: { comparison: '<', limit: 360 },
        message: 'must be < 360',
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
  } else {
    const err2 = {
      instancePath,
      schemaPath: '#/oneOf/0/type',
      keyword: 'type',
      params: { type: 'number' },
      message: 'must be number',
    };
    if (vErrors === null) {
      vErrors = [err2];
    } else {
      vErrors.push(err2);
    }
    errors++;
  }
  var _valid0 = _errs1 === errors;
  if (_valid0) {
    valid0 = true;
    passing0 = 0;
  }
  const _errs3 = errors;
  if (typeof data !== 'string') {
    const err3 = {
      instancePath,
      schemaPath: '#/oneOf/1/type',
      keyword: 'type',
      params: { type: 'string' },
      message: 'must be string',
    };
    if (vErrors === null) {
      vErrors = [err3];
    } else {
      vErrors.push(err3);
    }
    errors++;
  }
  if ('none' !== data) {
    const err4 = {
      instancePath,
      schemaPath: '#/oneOf/1/const',
      keyword: 'const',
      params: { allowedValue: 'none' },
      message: 'must be equal to constant',
    };
    if (vErrors === null) {
      vErrors = [err4];
    } else {
      vErrors.push(err4);
    }
    errors++;
  }
  var _valid0 = _errs3 === errors;
  if (_valid0 && valid0) {
    valid0 = false;
    passing0 = [passing0, 1];
  } else {
    if (_valid0) {
      valid0 = true;
      passing0 = 1;
    }
    const _errs5 = errors;
    if (!validate15(data, { instancePath, parentData, parentDataProperty, rootData })) {
      vErrors = vErrors === null ? validate15.errors : vErrors.concat(validate15.errors);
      errors = vErrors.length;
    }
    var _valid0 = _errs5 === errors;
    if (_valid0 && valid0) {
      valid0 = false;
      passing0 = [passing0, 2];
    } else {
      if (_valid0) {
        valid0 = true;
        passing0 = 2;
      }
    }
  }
  if (!valid0) {
    const err5 = {
      instancePath,
      schemaPath: '#/oneOf',
      keyword: 'oneOf',
      params: { passingSchemas: passing0 },
      message: 'must match exactly one schema in oneOf',
    };
    if (vErrors === null) {
      vErrors = [err5];
    } else {
      vErrors.push(err5);
    }
    errors++;
  } else {
    errors = _errs0;
    if (vErrors !== null) {
      if (_errs0) {
        vErrors.length = _errs0;
      } else {
        vErrors = null;
      }
    }
  }
  validate32.errors = vErrors;
  return errors === 0;
}
const schema23 = {
  title: 'Percentage Component',
  description: 'Percentage value from 0 to 100',
  oneOf: [
    { type: 'number', minimum: 0, maximum: 100 },
    { type: 'string', const: 'none' },
    {
      $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/jsonPointerReferenceObject',
    },
  ],
};
function validate35(
  data,
  { instancePath = '', parentData, parentDataProperty, rootData = data } = {},
) {
  let vErrors = null;
  let errors = 0;
  const _errs0 = errors;
  let valid0 = false;
  let passing0 = null;
  const _errs1 = errors;
  if (typeof data == 'number') {
    if (data > 100 || isNaN(data)) {
      const err0 = {
        instancePath,
        schemaPath: '#/oneOf/0/maximum',
        keyword: 'maximum',
        params: { comparison: '<=', limit: 100 },
        message: 'must be <= 100',
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data < 0 || isNaN(data)) {
      const err1 = {
        instancePath,
        schemaPath: '#/oneOf/0/minimum',
        keyword: 'minimum',
        params: { comparison: '>=', limit: 0 },
        message: 'must be >= 0',
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
  } else {
    const err2 = {
      instancePath,
      schemaPath: '#/oneOf/0/type',
      keyword: 'type',
      params: { type: 'number' },
      message: 'must be number',
    };
    if (vErrors === null) {
      vErrors = [err2];
    } else {
      vErrors.push(err2);
    }
    errors++;
  }
  var _valid0 = _errs1 === errors;
  if (_valid0) {
    valid0 = true;
    passing0 = 0;
  }
  const _errs3 = errors;
  if (typeof data !== 'string') {
    const err3 = {
      instancePath,
      schemaPath: '#/oneOf/1/type',
      keyword: 'type',
      params: { type: 'string' },
      message: 'must be string',
    };
    if (vErrors === null) {
      vErrors = [err3];
    } else {
      vErrors.push(err3);
    }
    errors++;
  }
  if ('none' !== data) {
    const err4 = {
      instancePath,
      schemaPath: '#/oneOf/1/const',
      keyword: 'const',
      params: { allowedValue: 'none' },
      message: 'must be equal to constant',
    };
    if (vErrors === null) {
      vErrors = [err4];
    } else {
      vErrors.push(err4);
    }
    errors++;
  }
  var _valid0 = _errs3 === errors;
  if (_valid0 && valid0) {
    valid0 = false;
    passing0 = [passing0, 1];
  } else {
    if (_valid0) {
      valid0 = true;
      passing0 = 1;
    }
    const _errs5 = errors;
    if (!validate15(data, { instancePath, parentData, parentDataProperty, rootData })) {
      vErrors = vErrors === null ? validate15.errors : vErrors.concat(validate15.errors);
      errors = vErrors.length;
    }
    var _valid0 = _errs5 === errors;
    if (_valid0 && valid0) {
      valid0 = false;
      passing0 = [passing0, 2];
    } else {
      if (_valid0) {
        valid0 = true;
        passing0 = 2;
      }
    }
  }
  if (!valid0) {
    const err5 = {
      instancePath,
      schemaPath: '#/oneOf',
      keyword: 'oneOf',
      params: { passingSchemas: passing0 },
      message: 'must match exactly one schema in oneOf',
    };
    if (vErrors === null) {
      vErrors = [err5];
    } else {
      vErrors.push(err5);
    }
    errors++;
  } else {
    errors = _errs0;
    if (vErrors !== null) {
      if (_errs0) {
        vErrors.length = _errs0;
      } else {
        vErrors = null;
      }
    }
  }
  validate35.errors = vErrors;
  return errors === 0;
}
const schema24 = {
  title: 'Unbounded Component',
  description: 'A color component with no numeric bounds (e.g., A and B in LAB/OKLAB color spaces)',
  oneOf: [
    { type: 'number' },
    { type: 'string', const: 'none' },
    {
      $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/jsonPointerReferenceObject',
    },
  ],
};
function validate43(
  data,
  { instancePath = '', parentData, parentDataProperty, rootData = data } = {},
) {
  let vErrors = null;
  let errors = 0;
  const _errs0 = errors;
  let valid0 = false;
  let passing0 = null;
  const _errs1 = errors;
  if (!(typeof data == 'number')) {
    const err0 = {
      instancePath,
      schemaPath: '#/oneOf/0/type',
      keyword: 'type',
      params: { type: 'number' },
      message: 'must be number',
    };
    if (vErrors === null) {
      vErrors = [err0];
    } else {
      vErrors.push(err0);
    }
    errors++;
  }
  var _valid0 = _errs1 === errors;
  if (_valid0) {
    valid0 = true;
    passing0 = 0;
  }
  const _errs3 = errors;
  if (typeof data !== 'string') {
    const err1 = {
      instancePath,
      schemaPath: '#/oneOf/1/type',
      keyword: 'type',
      params: { type: 'string' },
      message: 'must be string',
    };
    if (vErrors === null) {
      vErrors = [err1];
    } else {
      vErrors.push(err1);
    }
    errors++;
  }
  if ('none' !== data) {
    const err2 = {
      instancePath,
      schemaPath: '#/oneOf/1/const',
      keyword: 'const',
      params: { allowedValue: 'none' },
      message: 'must be equal to constant',
    };
    if (vErrors === null) {
      vErrors = [err2];
    } else {
      vErrors.push(err2);
    }
    errors++;
  }
  var _valid0 = _errs3 === errors;
  if (_valid0 && valid0) {
    valid0 = false;
    passing0 = [passing0, 1];
  } else {
    if (_valid0) {
      valid0 = true;
      passing0 = 1;
    }
    const _errs5 = errors;
    if (!validate15(data, { instancePath, parentData, parentDataProperty, rootData })) {
      vErrors = vErrors === null ? validate15.errors : vErrors.concat(validate15.errors);
      errors = vErrors.length;
    }
    var _valid0 = _errs5 === errors;
    if (_valid0 && valid0) {
      valid0 = false;
      passing0 = [passing0, 2];
    } else {
      if (_valid0) {
        valid0 = true;
        passing0 = 2;
      }
    }
  }
  if (!valid0) {
    const err3 = {
      instancePath,
      schemaPath: '#/oneOf',
      keyword: 'oneOf',
      params: { passingSchemas: passing0 },
      message: 'must match exactly one schema in oneOf',
    };
    if (vErrors === null) {
      vErrors = [err3];
    } else {
      vErrors.push(err3);
    }
    errors++;
  } else {
    errors = _errs0;
    if (vErrors !== null) {
      if (_errs0) {
        vErrors.length = _errs0;
      } else {
        vErrors = null;
      }
    }
  }
  validate43.errors = vErrors;
  return errors === 0;
}
const schema25 = {
  title: 'Chroma Component',
  description: 'Chroma value from 0 to infinity',
  oneOf: [
    { type: 'number', minimum: 0 },
    { type: 'string', const: 'none' },
    {
      $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/jsonPointerReferenceObject',
    },
  ],
};
function validate48(
  data,
  { instancePath = '', parentData, parentDataProperty, rootData = data } = {},
) {
  let vErrors = null;
  let errors = 0;
  const _errs0 = errors;
  let valid0 = false;
  let passing0 = null;
  const _errs1 = errors;
  if (typeof data == 'number') {
    if (data < 0 || isNaN(data)) {
      const err0 = {
        instancePath,
        schemaPath: '#/oneOf/0/minimum',
        keyword: 'minimum',
        params: { comparison: '>=', limit: 0 },
        message: 'must be >= 0',
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
  } else {
    const err1 = {
      instancePath,
      schemaPath: '#/oneOf/0/type',
      keyword: 'type',
      params: { type: 'number' },
      message: 'must be number',
    };
    if (vErrors === null) {
      vErrors = [err1];
    } else {
      vErrors.push(err1);
    }
    errors++;
  }
  var _valid0 = _errs1 === errors;
  if (_valid0) {
    valid0 = true;
    passing0 = 0;
  }
  const _errs3 = errors;
  if (typeof data !== 'string') {
    const err2 = {
      instancePath,
      schemaPath: '#/oneOf/1/type',
      keyword: 'type',
      params: { type: 'string' },
      message: 'must be string',
    };
    if (vErrors === null) {
      vErrors = [err2];
    } else {
      vErrors.push(err2);
    }
    errors++;
  }
  if ('none' !== data) {
    const err3 = {
      instancePath,
      schemaPath: '#/oneOf/1/const',
      keyword: 'const',
      params: { allowedValue: 'none' },
      message: 'must be equal to constant',
    };
    if (vErrors === null) {
      vErrors = [err3];
    } else {
      vErrors.push(err3);
    }
    errors++;
  }
  var _valid0 = _errs3 === errors;
  if (_valid0 && valid0) {
    valid0 = false;
    passing0 = [passing0, 1];
  } else {
    if (_valid0) {
      valid0 = true;
      passing0 = 1;
    }
    const _errs5 = errors;
    if (!validate15(data, { instancePath, parentData, parentDataProperty, rootData })) {
      vErrors = vErrors === null ? validate15.errors : vErrors.concat(validate15.errors);
      errors = vErrors.length;
    }
    var _valid0 = _errs5 === errors;
    if (_valid0 && valid0) {
      valid0 = false;
      passing0 = [passing0, 2];
    } else {
      if (_valid0) {
        valid0 = true;
        passing0 = 2;
      }
    }
  }
  if (!valid0) {
    const err4 = {
      instancePath,
      schemaPath: '#/oneOf',
      keyword: 'oneOf',
      params: { passingSchemas: passing0 },
      message: 'must match exactly one schema in oneOf',
    };
    if (vErrors === null) {
      vErrors = [err4];
    } else {
      vErrors.push(err4);
    }
    errors++;
  } else {
    errors = _errs0;
    if (vErrors !== null) {
      if (_errs0) {
        vErrors.length = _errs0;
      } else {
        vErrors = null;
      }
    }
  }
  validate48.errors = vErrors;
  return errors === 0;
}
const pattern4 = new RegExp('^#[0-9a-fA-F]{6}$', 'u');
function validate12(
  data,
  { instancePath = '', parentData, parentDataProperty, rootData = data } = {},
) {
  /*# sourceURL="https://www.designtokens.org/schemas/2025.10/format/values/color.json" */ let vErrors =
    null;
  let errors = 0;
  const _errs2 = errors;
  let valid1 = true;
  const _errs3 = errors;
  if (data && typeof data == 'object' && !Array.isArray(data)) {
    if (data.colorSpace !== undefined) {
      const _errs4 = errors;
      if ('srgb' !== data.colorSpace) {
        const err0 = {};
        if (vErrors === null) {
          vErrors = [err0];
        } else {
          vErrors.push(err0);
        }
        errors++;
      }
      var valid2 = _errs4 === errors;
    } else {
      var valid2 = true;
    }
    if (valid2) {
      if (data.components !== undefined) {
        const _errs5 = errors;
        if (!Array.isArray(data.components)) {
          const err1 = {};
          if (vErrors === null) {
            vErrors = [err1];
          } else {
            vErrors.push(err1);
          }
          errors++;
        }
        var valid2 = _errs5 === errors;
      } else {
        var valid2 = true;
      }
    }
  }
  var _valid0 = _errs3 === errors;
  errors = _errs2;
  if (vErrors !== null) {
    if (_errs2) {
      vErrors.length = _errs2;
    } else {
      vErrors = null;
    }
  }
  if (_valid0) {
    const _errs7 = errors;
    if (data && typeof data == 'object' && !Array.isArray(data)) {
      if (data.components !== undefined) {
        if (
          !validate13(data.components, {
            instancePath: instancePath + '/components',
            parentData: data,
            parentDataProperty: 'components',
            rootData,
          })
        ) {
          vErrors = vErrors === null ? validate13.errors : vErrors.concat(validate13.errors);
          errors = vErrors.length;
        }
      }
    }
    var _valid0 = _errs7 === errors;
    valid1 = _valid0;
  }
  if (!valid1) {
    const err2 = {
      instancePath,
      schemaPath: '#/allOf/0/if',
      keyword: 'if',
      params: { failingKeyword: 'then' },
      message: 'must match "then" schema',
    };
    if (vErrors === null) {
      vErrors = [err2];
    } else {
      vErrors.push(err2);
    }
    errors++;
  }
  const _errs10 = errors;
  let valid4 = true;
  const _errs11 = errors;
  if (data && typeof data == 'object' && !Array.isArray(data)) {
    if (data.colorSpace !== undefined) {
      const _errs12 = errors;
      if ('srgb-linear' !== data.colorSpace) {
        const err3 = {};
        if (vErrors === null) {
          vErrors = [err3];
        } else {
          vErrors.push(err3);
        }
        errors++;
      }
      var valid5 = _errs12 === errors;
    } else {
      var valid5 = true;
    }
    if (valid5) {
      if (data.components !== undefined) {
        const _errs13 = errors;
        if (!Array.isArray(data.components)) {
          const err4 = {};
          if (vErrors === null) {
            vErrors = [err4];
          } else {
            vErrors.push(err4);
          }
          errors++;
        }
        var valid5 = _errs13 === errors;
      } else {
        var valid5 = true;
      }
    }
  }
  var _valid1 = _errs11 === errors;
  errors = _errs10;
  if (vErrors !== null) {
    if (_errs10) {
      vErrors.length = _errs10;
    } else {
      vErrors = null;
    }
  }
  if (_valid1) {
    const _errs15 = errors;
    if (data && typeof data == 'object' && !Array.isArray(data)) {
      if (data.components !== undefined) {
        if (
          !validate13(data.components, {
            instancePath: instancePath + '/components',
            parentData: data,
            parentDataProperty: 'components',
            rootData,
          })
        ) {
          vErrors = vErrors === null ? validate13.errors : vErrors.concat(validate13.errors);
          errors = vErrors.length;
        }
      }
    }
    var _valid1 = _errs15 === errors;
    valid4 = _valid1;
  }
  if (!valid4) {
    const err5 = {
      instancePath,
      schemaPath: '#/allOf/1/if',
      keyword: 'if',
      params: { failingKeyword: 'then' },
      message: 'must match "then" schema',
    };
    if (vErrors === null) {
      vErrors = [err5];
    } else {
      vErrors.push(err5);
    }
    errors++;
  }
  const _errs18 = errors;
  let valid7 = true;
  const _errs19 = errors;
  if (data && typeof data == 'object' && !Array.isArray(data)) {
    if (data.colorSpace !== undefined) {
      const _errs20 = errors;
      if ('display-p3' !== data.colorSpace) {
        const err6 = {};
        if (vErrors === null) {
          vErrors = [err6];
        } else {
          vErrors.push(err6);
        }
        errors++;
      }
      var valid8 = _errs20 === errors;
    } else {
      var valid8 = true;
    }
    if (valid8) {
      if (data.components !== undefined) {
        const _errs21 = errors;
        if (!Array.isArray(data.components)) {
          const err7 = {};
          if (vErrors === null) {
            vErrors = [err7];
          } else {
            vErrors.push(err7);
          }
          errors++;
        }
        var valid8 = _errs21 === errors;
      } else {
        var valid8 = true;
      }
    }
  }
  var _valid2 = _errs19 === errors;
  errors = _errs18;
  if (vErrors !== null) {
    if (_errs18) {
      vErrors.length = _errs18;
    } else {
      vErrors = null;
    }
  }
  if (_valid2) {
    const _errs23 = errors;
    if (data && typeof data == 'object' && !Array.isArray(data)) {
      if (data.components !== undefined) {
        if (
          !validate13(data.components, {
            instancePath: instancePath + '/components',
            parentData: data,
            parentDataProperty: 'components',
            rootData,
          })
        ) {
          vErrors = vErrors === null ? validate13.errors : vErrors.concat(validate13.errors);
          errors = vErrors.length;
        }
      }
    }
    var _valid2 = _errs23 === errors;
    valid7 = _valid2;
  }
  if (!valid7) {
    const err8 = {
      instancePath,
      schemaPath: '#/allOf/2/if',
      keyword: 'if',
      params: { failingKeyword: 'then' },
      message: 'must match "then" schema',
    };
    if (vErrors === null) {
      vErrors = [err8];
    } else {
      vErrors.push(err8);
    }
    errors++;
  }
  const _errs26 = errors;
  let valid10 = true;
  const _errs27 = errors;
  if (data && typeof data == 'object' && !Array.isArray(data)) {
    if (data.colorSpace !== undefined) {
      const _errs28 = errors;
      if ('a98-rgb' !== data.colorSpace) {
        const err9 = {};
        if (vErrors === null) {
          vErrors = [err9];
        } else {
          vErrors.push(err9);
        }
        errors++;
      }
      var valid11 = _errs28 === errors;
    } else {
      var valid11 = true;
    }
    if (valid11) {
      if (data.components !== undefined) {
        const _errs29 = errors;
        if (!Array.isArray(data.components)) {
          const err10 = {};
          if (vErrors === null) {
            vErrors = [err10];
          } else {
            vErrors.push(err10);
          }
          errors++;
        }
        var valid11 = _errs29 === errors;
      } else {
        var valid11 = true;
      }
    }
  }
  var _valid3 = _errs27 === errors;
  errors = _errs26;
  if (vErrors !== null) {
    if (_errs26) {
      vErrors.length = _errs26;
    } else {
      vErrors = null;
    }
  }
  if (_valid3) {
    const _errs31 = errors;
    if (data && typeof data == 'object' && !Array.isArray(data)) {
      if (data.components !== undefined) {
        if (
          !validate13(data.components, {
            instancePath: instancePath + '/components',
            parentData: data,
            parentDataProperty: 'components',
            rootData,
          })
        ) {
          vErrors = vErrors === null ? validate13.errors : vErrors.concat(validate13.errors);
          errors = vErrors.length;
        }
      }
    }
    var _valid3 = _errs31 === errors;
    valid10 = _valid3;
  }
  if (!valid10) {
    const err11 = {
      instancePath,
      schemaPath: '#/allOf/3/if',
      keyword: 'if',
      params: { failingKeyword: 'then' },
      message: 'must match "then" schema',
    };
    if (vErrors === null) {
      vErrors = [err11];
    } else {
      vErrors.push(err11);
    }
    errors++;
  }
  const _errs34 = errors;
  let valid13 = true;
  const _errs35 = errors;
  if (data && typeof data == 'object' && !Array.isArray(data)) {
    if (data.colorSpace !== undefined) {
      const _errs36 = errors;
      if ('prophoto-rgb' !== data.colorSpace) {
        const err12 = {};
        if (vErrors === null) {
          vErrors = [err12];
        } else {
          vErrors.push(err12);
        }
        errors++;
      }
      var valid14 = _errs36 === errors;
    } else {
      var valid14 = true;
    }
    if (valid14) {
      if (data.components !== undefined) {
        const _errs37 = errors;
        if (!Array.isArray(data.components)) {
          const err13 = {};
          if (vErrors === null) {
            vErrors = [err13];
          } else {
            vErrors.push(err13);
          }
          errors++;
        }
        var valid14 = _errs37 === errors;
      } else {
        var valid14 = true;
      }
    }
  }
  var _valid4 = _errs35 === errors;
  errors = _errs34;
  if (vErrors !== null) {
    if (_errs34) {
      vErrors.length = _errs34;
    } else {
      vErrors = null;
    }
  }
  if (_valid4) {
    const _errs39 = errors;
    if (data && typeof data == 'object' && !Array.isArray(data)) {
      if (data.components !== undefined) {
        if (
          !validate13(data.components, {
            instancePath: instancePath + '/components',
            parentData: data,
            parentDataProperty: 'components',
            rootData,
          })
        ) {
          vErrors = vErrors === null ? validate13.errors : vErrors.concat(validate13.errors);
          errors = vErrors.length;
        }
      }
    }
    var _valid4 = _errs39 === errors;
    valid13 = _valid4;
  }
  if (!valid13) {
    const err14 = {
      instancePath,
      schemaPath: '#/allOf/4/if',
      keyword: 'if',
      params: { failingKeyword: 'then' },
      message: 'must match "then" schema',
    };
    if (vErrors === null) {
      vErrors = [err14];
    } else {
      vErrors.push(err14);
    }
    errors++;
  }
  const _errs42 = errors;
  let valid16 = true;
  const _errs43 = errors;
  if (data && typeof data == 'object' && !Array.isArray(data)) {
    if (data.colorSpace !== undefined) {
      const _errs44 = errors;
      if ('rec2020' !== data.colorSpace) {
        const err15 = {};
        if (vErrors === null) {
          vErrors = [err15];
        } else {
          vErrors.push(err15);
        }
        errors++;
      }
      var valid17 = _errs44 === errors;
    } else {
      var valid17 = true;
    }
    if (valid17) {
      if (data.components !== undefined) {
        const _errs45 = errors;
        if (!Array.isArray(data.components)) {
          const err16 = {};
          if (vErrors === null) {
            vErrors = [err16];
          } else {
            vErrors.push(err16);
          }
          errors++;
        }
        var valid17 = _errs45 === errors;
      } else {
        var valid17 = true;
      }
    }
  }
  var _valid5 = _errs43 === errors;
  errors = _errs42;
  if (vErrors !== null) {
    if (_errs42) {
      vErrors.length = _errs42;
    } else {
      vErrors = null;
    }
  }
  if (_valid5) {
    const _errs47 = errors;
    if (data && typeof data == 'object' && !Array.isArray(data)) {
      if (data.components !== undefined) {
        if (
          !validate13(data.components, {
            instancePath: instancePath + '/components',
            parentData: data,
            parentDataProperty: 'components',
            rootData,
          })
        ) {
          vErrors = vErrors === null ? validate13.errors : vErrors.concat(validate13.errors);
          errors = vErrors.length;
        }
      }
    }
    var _valid5 = _errs47 === errors;
    valid16 = _valid5;
  }
  if (!valid16) {
    const err17 = {
      instancePath,
      schemaPath: '#/allOf/5/if',
      keyword: 'if',
      params: { failingKeyword: 'then' },
      message: 'must match "then" schema',
    };
    if (vErrors === null) {
      vErrors = [err17];
    } else {
      vErrors.push(err17);
    }
    errors++;
  }
  const _errs50 = errors;
  let valid19 = true;
  const _errs51 = errors;
  if (data && typeof data == 'object' && !Array.isArray(data)) {
    if (data.colorSpace !== undefined) {
      const _errs52 = errors;
      if ('xyz-d65' !== data.colorSpace) {
        const err18 = {};
        if (vErrors === null) {
          vErrors = [err18];
        } else {
          vErrors.push(err18);
        }
        errors++;
      }
      var valid20 = _errs52 === errors;
    } else {
      var valid20 = true;
    }
    if (valid20) {
      if (data.components !== undefined) {
        const _errs53 = errors;
        if (!Array.isArray(data.components)) {
          const err19 = {};
          if (vErrors === null) {
            vErrors = [err19];
          } else {
            vErrors.push(err19);
          }
          errors++;
        }
        var valid20 = _errs53 === errors;
      } else {
        var valid20 = true;
      }
    }
  }
  var _valid6 = _errs51 === errors;
  errors = _errs50;
  if (vErrors !== null) {
    if (_errs50) {
      vErrors.length = _errs50;
    } else {
      vErrors = null;
    }
  }
  if (_valid6) {
    const _errs55 = errors;
    if (data && typeof data == 'object' && !Array.isArray(data)) {
      if (data.components !== undefined) {
        if (
          !validate26(data.components, {
            instancePath: instancePath + '/components',
            parentData: data,
            parentDataProperty: 'components',
            rootData,
          })
        ) {
          vErrors = vErrors === null ? validate26.errors : vErrors.concat(validate26.errors);
          errors = vErrors.length;
        }
      }
    }
    var _valid6 = _errs55 === errors;
    valid19 = _valid6;
  }
  if (!valid19) {
    const err20 = {
      instancePath,
      schemaPath: '#/allOf/6/if',
      keyword: 'if',
      params: { failingKeyword: 'then' },
      message: 'must match "then" schema',
    };
    if (vErrors === null) {
      vErrors = [err20];
    } else {
      vErrors.push(err20);
    }
    errors++;
  }
  const _errs58 = errors;
  let valid22 = true;
  const _errs59 = errors;
  if (data && typeof data == 'object' && !Array.isArray(data)) {
    if (data.colorSpace !== undefined) {
      const _errs60 = errors;
      if ('xyz-d50' !== data.colorSpace) {
        const err21 = {};
        if (vErrors === null) {
          vErrors = [err21];
        } else {
          vErrors.push(err21);
        }
        errors++;
      }
      var valid23 = _errs60 === errors;
    } else {
      var valid23 = true;
    }
    if (valid23) {
      if (data.components !== undefined) {
        const _errs61 = errors;
        if (!Array.isArray(data.components)) {
          const err22 = {};
          if (vErrors === null) {
            vErrors = [err22];
          } else {
            vErrors.push(err22);
          }
          errors++;
        }
        var valid23 = _errs61 === errors;
      } else {
        var valid23 = true;
      }
    }
  }
  var _valid7 = _errs59 === errors;
  errors = _errs58;
  if (vErrors !== null) {
    if (_errs58) {
      vErrors.length = _errs58;
    } else {
      vErrors = null;
    }
  }
  if (_valid7) {
    const _errs63 = errors;
    if (data && typeof data == 'object' && !Array.isArray(data)) {
      if (data.components !== undefined) {
        if (
          !validate26(data.components, {
            instancePath: instancePath + '/components',
            parentData: data,
            parentDataProperty: 'components',
            rootData,
          })
        ) {
          vErrors = vErrors === null ? validate26.errors : vErrors.concat(validate26.errors);
          errors = vErrors.length;
        }
      }
    }
    var _valid7 = _errs63 === errors;
    valid22 = _valid7;
  }
  if (!valid22) {
    const err23 = {
      instancePath,
      schemaPath: '#/allOf/7/if',
      keyword: 'if',
      params: { failingKeyword: 'then' },
      message: 'must match "then" schema',
    };
    if (vErrors === null) {
      vErrors = [err23];
    } else {
      vErrors.push(err23);
    }
    errors++;
  }
  const _errs66 = errors;
  let valid25 = true;
  const _errs67 = errors;
  if (data && typeof data == 'object' && !Array.isArray(data)) {
    if (data.colorSpace !== undefined) {
      const _errs68 = errors;
      if ('hsl' !== data.colorSpace) {
        const err24 = {};
        if (vErrors === null) {
          vErrors = [err24];
        } else {
          vErrors.push(err24);
        }
        errors++;
      }
      var valid26 = _errs68 === errors;
    } else {
      var valid26 = true;
    }
    if (valid26) {
      if (data.components !== undefined) {
        const _errs69 = errors;
        if (!Array.isArray(data.components)) {
          const err25 = {};
          if (vErrors === null) {
            vErrors = [err25];
          } else {
            vErrors.push(err25);
          }
          errors++;
        }
        var valid26 = _errs69 === errors;
      } else {
        var valid26 = true;
      }
    }
  }
  var _valid8 = _errs67 === errors;
  errors = _errs66;
  if (vErrors !== null) {
    if (_errs66) {
      vErrors.length = _errs66;
    } else {
      vErrors = null;
    }
  }
  if (_valid8) {
    const _errs71 = errors;
    if (data && typeof data == 'object' && !Array.isArray(data)) {
      if (data.components !== undefined) {
        let data26 = data.components;
        if (Array.isArray(data26)) {
          if (data26.length > 3) {
            const err26 = {
              instancePath: instancePath + '/components',
              schemaPath: '#/allOf/8/then/properties/components/maxItems',
              keyword: 'maxItems',
              params: { limit: 3 },
              message: 'must NOT have more than 3 items',
            };
            if (vErrors === null) {
              vErrors = [err26];
            } else {
              vErrors.push(err26);
            }
            errors++;
          }
          if (data26.length < 3) {
            const err27 = {
              instancePath: instancePath + '/components',
              schemaPath: '#/allOf/8/then/properties/components/minItems',
              keyword: 'minItems',
              params: { limit: 3 },
              message: 'must NOT have fewer than 3 items',
            };
            if (vErrors === null) {
              vErrors = [err27];
            } else {
              vErrors.push(err27);
            }
            errors++;
          }
          const len0 = data26.length;
          if (len0 > 0) {
            if (
              !validate32(data26[0], {
                instancePath: instancePath + '/components/0',
                parentData: data26,
                parentDataProperty: 0,
                rootData,
              })
            ) {
              vErrors = vErrors === null ? validate32.errors : vErrors.concat(validate32.errors);
              errors = vErrors.length;
            }
          }
          if (len0 > 1) {
            if (
              !validate35(data26[1], {
                instancePath: instancePath + '/components/1',
                parentData: data26,
                parentDataProperty: 1,
                rootData,
              })
            ) {
              vErrors = vErrors === null ? validate35.errors : vErrors.concat(validate35.errors);
              errors = vErrors.length;
            }
          }
          if (len0 > 2) {
            if (
              !validate35(data26[2], {
                instancePath: instancePath + '/components/2',
                parentData: data26,
                parentDataProperty: 2,
                rootData,
              })
            ) {
              vErrors = vErrors === null ? validate35.errors : vErrors.concat(validate35.errors);
              errors = vErrors.length;
            }
          }
        } else {
          const err28 = {
            instancePath: instancePath + '/components',
            schemaPath: '#/allOf/8/then/properties/components/type',
            keyword: 'type',
            params: { type: 'array' },
            message: 'must be array',
          };
          if (vErrors === null) {
            vErrors = [err28];
          } else {
            vErrors.push(err28);
          }
          errors++;
        }
      }
    }
    var _valid8 = _errs71 === errors;
    valid25 = _valid8;
  }
  if (!valid25) {
    const err29 = {
      instancePath,
      schemaPath: '#/allOf/8/if',
      keyword: 'if',
      params: { failingKeyword: 'then' },
      message: 'must match "then" schema',
    };
    if (vErrors === null) {
      vErrors = [err29];
    } else {
      vErrors.push(err29);
    }
    errors++;
  }
  const _errs78 = errors;
  let valid29 = true;
  const _errs79 = errors;
  if (data && typeof data == 'object' && !Array.isArray(data)) {
    if (data.colorSpace !== undefined) {
      const _errs80 = errors;
      if ('hwb' !== data.colorSpace) {
        const err30 = {};
        if (vErrors === null) {
          vErrors = [err30];
        } else {
          vErrors.push(err30);
        }
        errors++;
      }
      var valid30 = _errs80 === errors;
    } else {
      var valid30 = true;
    }
    if (valid30) {
      if (data.components !== undefined) {
        const _errs81 = errors;
        if (!Array.isArray(data.components)) {
          const err31 = {};
          if (vErrors === null) {
            vErrors = [err31];
          } else {
            vErrors.push(err31);
          }
          errors++;
        }
        var valid30 = _errs81 === errors;
      } else {
        var valid30 = true;
      }
    }
  }
  var _valid9 = _errs79 === errors;
  errors = _errs78;
  if (vErrors !== null) {
    if (_errs78) {
      vErrors.length = _errs78;
    } else {
      vErrors = null;
    }
  }
  if (_valid9) {
    const _errs83 = errors;
    if (data && typeof data == 'object' && !Array.isArray(data)) {
      if (data.components !== undefined) {
        let data32 = data.components;
        if (Array.isArray(data32)) {
          if (data32.length > 3) {
            const err32 = {
              instancePath: instancePath + '/components',
              schemaPath: '#/allOf/9/then/properties/components/maxItems',
              keyword: 'maxItems',
              params: { limit: 3 },
              message: 'must NOT have more than 3 items',
            };
            if (vErrors === null) {
              vErrors = [err32];
            } else {
              vErrors.push(err32);
            }
            errors++;
          }
          if (data32.length < 3) {
            const err33 = {
              instancePath: instancePath + '/components',
              schemaPath: '#/allOf/9/then/properties/components/minItems',
              keyword: 'minItems',
              params: { limit: 3 },
              message: 'must NOT have fewer than 3 items',
            };
            if (vErrors === null) {
              vErrors = [err33];
            } else {
              vErrors.push(err33);
            }
            errors++;
          }
          const len1 = data32.length;
          if (len1 > 0) {
            if (
              !validate32(data32[0], {
                instancePath: instancePath + '/components/0',
                parentData: data32,
                parentDataProperty: 0,
                rootData,
              })
            ) {
              vErrors = vErrors === null ? validate32.errors : vErrors.concat(validate32.errors);
              errors = vErrors.length;
            }
          }
          if (len1 > 1) {
            if (
              !validate35(data32[1], {
                instancePath: instancePath + '/components/1',
                parentData: data32,
                parentDataProperty: 1,
                rootData,
              })
            ) {
              vErrors = vErrors === null ? validate35.errors : vErrors.concat(validate35.errors);
              errors = vErrors.length;
            }
          }
          if (len1 > 2) {
            if (
              !validate35(data32[2], {
                instancePath: instancePath + '/components/2',
                parentData: data32,
                parentDataProperty: 2,
                rootData,
              })
            ) {
              vErrors = vErrors === null ? validate35.errors : vErrors.concat(validate35.errors);
              errors = vErrors.length;
            }
          }
        } else {
          const err34 = {
            instancePath: instancePath + '/components',
            schemaPath: '#/allOf/9/then/properties/components/type',
            keyword: 'type',
            params: { type: 'array' },
            message: 'must be array',
          };
          if (vErrors === null) {
            vErrors = [err34];
          } else {
            vErrors.push(err34);
          }
          errors++;
        }
      }
    }
    var _valid9 = _errs83 === errors;
    valid29 = _valid9;
  }
  if (!valid29) {
    const err35 = {
      instancePath,
      schemaPath: '#/allOf/9/if',
      keyword: 'if',
      params: { failingKeyword: 'then' },
      message: 'must match "then" schema',
    };
    if (vErrors === null) {
      vErrors = [err35];
    } else {
      vErrors.push(err35);
    }
    errors++;
  }
  const _errs90 = errors;
  let valid33 = true;
  const _errs91 = errors;
  if (data && typeof data == 'object' && !Array.isArray(data)) {
    if (data.colorSpace !== undefined) {
      const _errs92 = errors;
      if ('lab' !== data.colorSpace) {
        const err36 = {};
        if (vErrors === null) {
          vErrors = [err36];
        } else {
          vErrors.push(err36);
        }
        errors++;
      }
      var valid34 = _errs92 === errors;
    } else {
      var valid34 = true;
    }
    if (valid34) {
      if (data.components !== undefined) {
        const _errs93 = errors;
        if (!Array.isArray(data.components)) {
          const err37 = {};
          if (vErrors === null) {
            vErrors = [err37];
          } else {
            vErrors.push(err37);
          }
          errors++;
        }
        var valid34 = _errs93 === errors;
      } else {
        var valid34 = true;
      }
    }
  }
  var _valid10 = _errs91 === errors;
  errors = _errs90;
  if (vErrors !== null) {
    if (_errs90) {
      vErrors.length = _errs90;
    } else {
      vErrors = null;
    }
  }
  if (_valid10) {
    const _errs95 = errors;
    if (data && typeof data == 'object' && !Array.isArray(data)) {
      if (data.components !== undefined) {
        let data38 = data.components;
        if (Array.isArray(data38)) {
          if (data38.length > 3) {
            const err38 = {
              instancePath: instancePath + '/components',
              schemaPath: '#/allOf/10/then/properties/components/maxItems',
              keyword: 'maxItems',
              params: { limit: 3 },
              message: 'must NOT have more than 3 items',
            };
            if (vErrors === null) {
              vErrors = [err38];
            } else {
              vErrors.push(err38);
            }
            errors++;
          }
          if (data38.length < 3) {
            const err39 = {
              instancePath: instancePath + '/components',
              schemaPath: '#/allOf/10/then/properties/components/minItems',
              keyword: 'minItems',
              params: { limit: 3 },
              message: 'must NOT have fewer than 3 items',
            };
            if (vErrors === null) {
              vErrors = [err39];
            } else {
              vErrors.push(err39);
            }
            errors++;
          }
          const len2 = data38.length;
          if (len2 > 0) {
            if (
              !validate35(data38[0], {
                instancePath: instancePath + '/components/0',
                parentData: data38,
                parentDataProperty: 0,
                rootData,
              })
            ) {
              vErrors = vErrors === null ? validate35.errors : vErrors.concat(validate35.errors);
              errors = vErrors.length;
            }
          }
          if (len2 > 1) {
            if (
              !validate43(data38[1], {
                instancePath: instancePath + '/components/1',
                parentData: data38,
                parentDataProperty: 1,
                rootData,
              })
            ) {
              vErrors = vErrors === null ? validate43.errors : vErrors.concat(validate43.errors);
              errors = vErrors.length;
            }
          }
          if (len2 > 2) {
            if (
              !validate43(data38[2], {
                instancePath: instancePath + '/components/2',
                parentData: data38,
                parentDataProperty: 2,
                rootData,
              })
            ) {
              vErrors = vErrors === null ? validate43.errors : vErrors.concat(validate43.errors);
              errors = vErrors.length;
            }
          }
        } else {
          const err40 = {
            instancePath: instancePath + '/components',
            schemaPath: '#/allOf/10/then/properties/components/type',
            keyword: 'type',
            params: { type: 'array' },
            message: 'must be array',
          };
          if (vErrors === null) {
            vErrors = [err40];
          } else {
            vErrors.push(err40);
          }
          errors++;
        }
      }
    }
    var _valid10 = _errs95 === errors;
    valid33 = _valid10;
  }
  if (!valid33) {
    const err41 = {
      instancePath,
      schemaPath: '#/allOf/10/if',
      keyword: 'if',
      params: { failingKeyword: 'then' },
      message: 'must match "then" schema',
    };
    if (vErrors === null) {
      vErrors = [err41];
    } else {
      vErrors.push(err41);
    }
    errors++;
  }
  const _errs102 = errors;
  let valid37 = true;
  const _errs103 = errors;
  if (data && typeof data == 'object' && !Array.isArray(data)) {
    if (data.colorSpace !== undefined) {
      const _errs104 = errors;
      if ('lch' !== data.colorSpace) {
        const err42 = {};
        if (vErrors === null) {
          vErrors = [err42];
        } else {
          vErrors.push(err42);
        }
        errors++;
      }
      var valid38 = _errs104 === errors;
    } else {
      var valid38 = true;
    }
    if (valid38) {
      if (data.components !== undefined) {
        const _errs105 = errors;
        if (!Array.isArray(data.components)) {
          const err43 = {};
          if (vErrors === null) {
            vErrors = [err43];
          } else {
            vErrors.push(err43);
          }
          errors++;
        }
        var valid38 = _errs105 === errors;
      } else {
        var valid38 = true;
      }
    }
  }
  var _valid11 = _errs103 === errors;
  errors = _errs102;
  if (vErrors !== null) {
    if (_errs102) {
      vErrors.length = _errs102;
    } else {
      vErrors = null;
    }
  }
  if (_valid11) {
    const _errs107 = errors;
    if (data && typeof data == 'object' && !Array.isArray(data)) {
      if (data.components !== undefined) {
        let data44 = data.components;
        if (Array.isArray(data44)) {
          if (data44.length > 3) {
            const err44 = {
              instancePath: instancePath + '/components',
              schemaPath: '#/allOf/11/then/properties/components/maxItems',
              keyword: 'maxItems',
              params: { limit: 3 },
              message: 'must NOT have more than 3 items',
            };
            if (vErrors === null) {
              vErrors = [err44];
            } else {
              vErrors.push(err44);
            }
            errors++;
          }
          if (data44.length < 3) {
            const err45 = {
              instancePath: instancePath + '/components',
              schemaPath: '#/allOf/11/then/properties/components/minItems',
              keyword: 'minItems',
              params: { limit: 3 },
              message: 'must NOT have fewer than 3 items',
            };
            if (vErrors === null) {
              vErrors = [err45];
            } else {
              vErrors.push(err45);
            }
            errors++;
          }
          const len3 = data44.length;
          if (len3 > 0) {
            if (
              !validate35(data44[0], {
                instancePath: instancePath + '/components/0',
                parentData: data44,
                parentDataProperty: 0,
                rootData,
              })
            ) {
              vErrors = vErrors === null ? validate35.errors : vErrors.concat(validate35.errors);
              errors = vErrors.length;
            }
          }
          if (len3 > 1) {
            if (
              !validate48(data44[1], {
                instancePath: instancePath + '/components/1',
                parentData: data44,
                parentDataProperty: 1,
                rootData,
              })
            ) {
              vErrors = vErrors === null ? validate48.errors : vErrors.concat(validate48.errors);
              errors = vErrors.length;
            }
          }
          if (len3 > 2) {
            if (
              !validate32(data44[2], {
                instancePath: instancePath + '/components/2',
                parentData: data44,
                parentDataProperty: 2,
                rootData,
              })
            ) {
              vErrors = vErrors === null ? validate32.errors : vErrors.concat(validate32.errors);
              errors = vErrors.length;
            }
          }
        } else {
          const err46 = {
            instancePath: instancePath + '/components',
            schemaPath: '#/allOf/11/then/properties/components/type',
            keyword: 'type',
            params: { type: 'array' },
            message: 'must be array',
          };
          if (vErrors === null) {
            vErrors = [err46];
          } else {
            vErrors.push(err46);
          }
          errors++;
        }
      }
    }
    var _valid11 = _errs107 === errors;
    valid37 = _valid11;
  }
  if (!valid37) {
    const err47 = {
      instancePath,
      schemaPath: '#/allOf/11/if',
      keyword: 'if',
      params: { failingKeyword: 'then' },
      message: 'must match "then" schema',
    };
    if (vErrors === null) {
      vErrors = [err47];
    } else {
      vErrors.push(err47);
    }
    errors++;
  }
  const _errs114 = errors;
  let valid41 = true;
  const _errs115 = errors;
  if (data && typeof data == 'object' && !Array.isArray(data)) {
    if (data.colorSpace !== undefined) {
      const _errs116 = errors;
      if ('oklab' !== data.colorSpace) {
        const err48 = {};
        if (vErrors === null) {
          vErrors = [err48];
        } else {
          vErrors.push(err48);
        }
        errors++;
      }
      var valid42 = _errs116 === errors;
    } else {
      var valid42 = true;
    }
    if (valid42) {
      if (data.components !== undefined) {
        const _errs117 = errors;
        if (!Array.isArray(data.components)) {
          const err49 = {};
          if (vErrors === null) {
            vErrors = [err49];
          } else {
            vErrors.push(err49);
          }
          errors++;
        }
        var valid42 = _errs117 === errors;
      } else {
        var valid42 = true;
      }
    }
  }
  var _valid12 = _errs115 === errors;
  errors = _errs114;
  if (vErrors !== null) {
    if (_errs114) {
      vErrors.length = _errs114;
    } else {
      vErrors = null;
    }
  }
  if (_valid12) {
    const _errs119 = errors;
    if (data && typeof data == 'object' && !Array.isArray(data)) {
      if (data.components !== undefined) {
        let data50 = data.components;
        if (Array.isArray(data50)) {
          if (data50.length > 3) {
            const err50 = {
              instancePath: instancePath + '/components',
              schemaPath: '#/allOf/12/then/properties/components/maxItems',
              keyword: 'maxItems',
              params: { limit: 3 },
              message: 'must NOT have more than 3 items',
            };
            if (vErrors === null) {
              vErrors = [err50];
            } else {
              vErrors.push(err50);
            }
            errors++;
          }
          if (data50.length < 3) {
            const err51 = {
              instancePath: instancePath + '/components',
              schemaPath: '#/allOf/12/then/properties/components/minItems',
              keyword: 'minItems',
              params: { limit: 3 },
              message: 'must NOT have fewer than 3 items',
            };
            if (vErrors === null) {
              vErrors = [err51];
            } else {
              vErrors.push(err51);
            }
            errors++;
          }
          const len4 = data50.length;
          if (len4 > 0) {
            if (
              !validate14(data50[0], {
                instancePath: instancePath + '/components/0',
                parentData: data50,
                parentDataProperty: 0,
                rootData,
              })
            ) {
              vErrors = vErrors === null ? validate14.errors : vErrors.concat(validate14.errors);
              errors = vErrors.length;
            }
          }
          if (len4 > 1) {
            if (
              !validate43(data50[1], {
                instancePath: instancePath + '/components/1',
                parentData: data50,
                parentDataProperty: 1,
                rootData,
              })
            ) {
              vErrors = vErrors === null ? validate43.errors : vErrors.concat(validate43.errors);
              errors = vErrors.length;
            }
          }
          if (len4 > 2) {
            if (
              !validate43(data50[2], {
                instancePath: instancePath + '/components/2',
                parentData: data50,
                parentDataProperty: 2,
                rootData,
              })
            ) {
              vErrors = vErrors === null ? validate43.errors : vErrors.concat(validate43.errors);
              errors = vErrors.length;
            }
          }
        } else {
          const err52 = {
            instancePath: instancePath + '/components',
            schemaPath: '#/allOf/12/then/properties/components/type',
            keyword: 'type',
            params: { type: 'array' },
            message: 'must be array',
          };
          if (vErrors === null) {
            vErrors = [err52];
          } else {
            vErrors.push(err52);
          }
          errors++;
        }
      }
    }
    var _valid12 = _errs119 === errors;
    valid41 = _valid12;
  }
  if (!valid41) {
    const err53 = {
      instancePath,
      schemaPath: '#/allOf/12/if',
      keyword: 'if',
      params: { failingKeyword: 'then' },
      message: 'must match "then" schema',
    };
    if (vErrors === null) {
      vErrors = [err53];
    } else {
      vErrors.push(err53);
    }
    errors++;
  }
  const _errs126 = errors;
  let valid45 = true;
  const _errs127 = errors;
  if (data && typeof data == 'object' && !Array.isArray(data)) {
    if (data.colorSpace !== undefined) {
      const _errs128 = errors;
      if ('oklch' !== data.colorSpace) {
        const err54 = {};
        if (vErrors === null) {
          vErrors = [err54];
        } else {
          vErrors.push(err54);
        }
        errors++;
      }
      var valid46 = _errs128 === errors;
    } else {
      var valid46 = true;
    }
    if (valid46) {
      if (data.components !== undefined) {
        const _errs129 = errors;
        if (!Array.isArray(data.components)) {
          const err55 = {};
          if (vErrors === null) {
            vErrors = [err55];
          } else {
            vErrors.push(err55);
          }
          errors++;
        }
        var valid46 = _errs129 === errors;
      } else {
        var valid46 = true;
      }
    }
  }
  var _valid13 = _errs127 === errors;
  errors = _errs126;
  if (vErrors !== null) {
    if (_errs126) {
      vErrors.length = _errs126;
    } else {
      vErrors = null;
    }
  }
  if (_valid13) {
    const _errs131 = errors;
    if (data && typeof data == 'object' && !Array.isArray(data)) {
      if (data.components !== undefined) {
        let data56 = data.components;
        if (Array.isArray(data56)) {
          if (data56.length > 3) {
            const err56 = {
              instancePath: instancePath + '/components',
              schemaPath: '#/allOf/13/then/properties/components/maxItems',
              keyword: 'maxItems',
              params: { limit: 3 },
              message: 'must NOT have more than 3 items',
            };
            if (vErrors === null) {
              vErrors = [err56];
            } else {
              vErrors.push(err56);
            }
            errors++;
          }
          if (data56.length < 3) {
            const err57 = {
              instancePath: instancePath + '/components',
              schemaPath: '#/allOf/13/then/properties/components/minItems',
              keyword: 'minItems',
              params: { limit: 3 },
              message: 'must NOT have fewer than 3 items',
            };
            if (vErrors === null) {
              vErrors = [err57];
            } else {
              vErrors.push(err57);
            }
            errors++;
          }
          const len5 = data56.length;
          if (len5 > 0) {
            if (
              !validate14(data56[0], {
                instancePath: instancePath + '/components/0',
                parentData: data56,
                parentDataProperty: 0,
                rootData,
              })
            ) {
              vErrors = vErrors === null ? validate14.errors : vErrors.concat(validate14.errors);
              errors = vErrors.length;
            }
          }
          if (len5 > 1) {
            if (
              !validate48(data56[1], {
                instancePath: instancePath + '/components/1',
                parentData: data56,
                parentDataProperty: 1,
                rootData,
              })
            ) {
              vErrors = vErrors === null ? validate48.errors : vErrors.concat(validate48.errors);
              errors = vErrors.length;
            }
          }
          if (len5 > 2) {
            if (
              !validate32(data56[2], {
                instancePath: instancePath + '/components/2',
                parentData: data56,
                parentDataProperty: 2,
                rootData,
              })
            ) {
              vErrors = vErrors === null ? validate32.errors : vErrors.concat(validate32.errors);
              errors = vErrors.length;
            }
          }
        } else {
          const err58 = {
            instancePath: instancePath + '/components',
            schemaPath: '#/allOf/13/then/properties/components/type',
            keyword: 'type',
            params: { type: 'array' },
            message: 'must be array',
          };
          if (vErrors === null) {
            vErrors = [err58];
          } else {
            vErrors.push(err58);
          }
          errors++;
        }
      }
    }
    var _valid13 = _errs131 === errors;
    valid45 = _valid13;
  }
  if (!valid45) {
    const err59 = {
      instancePath,
      schemaPath: '#/allOf/13/if',
      keyword: 'if',
      params: { failingKeyword: 'then' },
      message: 'must match "then" schema',
    };
    if (vErrors === null) {
      vErrors = [err59];
    } else {
      vErrors.push(err59);
    }
    errors++;
  }
  if (data && typeof data == 'object' && !Array.isArray(data)) {
    if (data.colorSpace === undefined) {
      const err60 = {
        instancePath,
        schemaPath: '#/required',
        keyword: 'required',
        params: { missingProperty: 'colorSpace' },
        message: "must have required property '" + 'colorSpace' + "'",
      };
      if (vErrors === null) {
        vErrors = [err60];
      } else {
        vErrors.push(err60);
      }
      errors++;
    }
    if (data.components === undefined) {
      const err61 = {
        instancePath,
        schemaPath: '#/required',
        keyword: 'required',
        params: { missingProperty: 'components' },
        message: "must have required property '" + 'components' + "'",
      };
      if (vErrors === null) {
        vErrors = [err61];
      } else {
        vErrors.push(err61);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === 'colorSpace' || key0 === 'components' || key0 === 'alpha' || key0 === 'hex')) {
        const err62 = {
          instancePath,
          schemaPath: '#/additionalProperties',
          keyword: 'additionalProperties',
          params: { additionalProperty: key0 },
          message: 'must NOT have additional properties',
        };
        if (vErrors === null) {
          vErrors = [err62];
        } else {
          vErrors.push(err62);
        }
        errors++;
      }
    }
    if (data.colorSpace !== undefined) {
      let data60 = data.colorSpace;
      const _errs139 = errors;
      let valid50 = false;
      let passing0 = null;
      const _errs140 = errors;
      if (typeof data60 !== 'string') {
        const err63 = {
          instancePath: instancePath + '/colorSpace',
          schemaPath: '#/properties/colorSpace/oneOf/0/type',
          keyword: 'type',
          params: { type: 'string' },
          message: 'must be string',
        };
        if (vErrors === null) {
          vErrors = [err63];
        } else {
          vErrors.push(err63);
        }
        errors++;
      }
      if (!(
        data60 === 'srgb' ||
        data60 === 'srgb-linear' ||
        data60 === 'hsl' ||
        data60 === 'hwb' ||
        data60 === 'lab' ||
        data60 === 'lch' ||
        data60 === 'oklab' ||
        data60 === 'oklch' ||
        data60 === 'display-p3' ||
        data60 === 'a98-rgb' ||
        data60 === 'prophoto-rgb' ||
        data60 === 'rec2020' ||
        data60 === 'xyz-d65' ||
        data60 === 'xyz-d50'
      )) {
        const err64 = {
          instancePath: instancePath + '/colorSpace',
          schemaPath: '#/properties/colorSpace/oneOf/0/enum',
          keyword: 'enum',
          params: { allowedValues: schema16.properties.colorSpace.oneOf[0].enum },
          message: 'must be equal to one of the allowed values',
        };
        if (vErrors === null) {
          vErrors = [err64];
        } else {
          vErrors.push(err64);
        }
        errors++;
      }
      var _valid14 = _errs140 === errors;
      if (_valid14) {
        valid50 = true;
        passing0 = 0;
      }
      const _errs142 = errors;
      if (
        !validate15(data60, {
          instancePath: instancePath + '/colorSpace',
          parentData: data,
          parentDataProperty: 'colorSpace',
          rootData,
        })
      ) {
        vErrors = vErrors === null ? validate15.errors : vErrors.concat(validate15.errors);
        errors = vErrors.length;
      }
      var _valid14 = _errs142 === errors;
      if (_valid14 && valid50) {
        valid50 = false;
        passing0 = [passing0, 1];
      } else {
        if (_valid14) {
          valid50 = true;
          passing0 = 1;
        }
      }
      if (!valid50) {
        const err65 = {
          instancePath: instancePath + '/colorSpace',
          schemaPath: '#/properties/colorSpace/oneOf',
          keyword: 'oneOf',
          params: { passingSchemas: passing0 },
          message: 'must match exactly one schema in oneOf',
        };
        if (vErrors === null) {
          vErrors = [err65];
        } else {
          vErrors.push(err65);
        }
        errors++;
      } else {
        errors = _errs139;
        if (vErrors !== null) {
          if (_errs139) {
            vErrors.length = _errs139;
          } else {
            vErrors = null;
          }
        }
      }
    }
    if (data.components !== undefined) {
      let data61 = data.components;
      const _errs144 = errors;
      let valid51 = false;
      let passing1 = null;
      const _errs145 = errors;
      if (!Array.isArray(data61)) {
        const err66 = {
          instancePath: instancePath + '/components',
          schemaPath: '#/properties/components/oneOf/0/type',
          keyword: 'type',
          params: { type: 'array' },
          message: 'must be array',
        };
        if (vErrors === null) {
          vErrors = [err66];
        } else {
          vErrors.push(err66);
        }
        errors++;
      }
      var _valid15 = _errs145 === errors;
      if (_valid15) {
        valid51 = true;
        passing1 = 0;
      }
      const _errs147 = errors;
      if (
        !validate15(data61, {
          instancePath: instancePath + '/components',
          parentData: data,
          parentDataProperty: 'components',
          rootData,
        })
      ) {
        vErrors = vErrors === null ? validate15.errors : vErrors.concat(validate15.errors);
        errors = vErrors.length;
      }
      var _valid15 = _errs147 === errors;
      if (_valid15 && valid51) {
        valid51 = false;
        passing1 = [passing1, 1];
      } else {
        if (_valid15) {
          valid51 = true;
          passing1 = 1;
        }
      }
      if (!valid51) {
        const err67 = {
          instancePath: instancePath + '/components',
          schemaPath: '#/properties/components/oneOf',
          keyword: 'oneOf',
          params: { passingSchemas: passing1 },
          message: 'must match exactly one schema in oneOf',
        };
        if (vErrors === null) {
          vErrors = [err67];
        } else {
          vErrors.push(err67);
        }
        errors++;
      } else {
        errors = _errs144;
        if (vErrors !== null) {
          if (_errs144) {
            vErrors.length = _errs144;
          } else {
            vErrors = null;
          }
        }
      }
    }
    if (data.alpha !== undefined) {
      let data62 = data.alpha;
      const _errs149 = errors;
      let valid52 = false;
      let passing2 = null;
      const _errs150 = errors;
      if (typeof data62 == 'number') {
        if (data62 > 1 || isNaN(data62)) {
          const err68 = {
            instancePath: instancePath + '/alpha',
            schemaPath: '#/properties/alpha/oneOf/0/maximum',
            keyword: 'maximum',
            params: { comparison: '<=', limit: 1 },
            message: 'must be <= 1',
          };
          if (vErrors === null) {
            vErrors = [err68];
          } else {
            vErrors.push(err68);
          }
          errors++;
        }
        if (data62 < 0 || isNaN(data62)) {
          const err69 = {
            instancePath: instancePath + '/alpha',
            schemaPath: '#/properties/alpha/oneOf/0/minimum',
            keyword: 'minimum',
            params: { comparison: '>=', limit: 0 },
            message: 'must be >= 0',
          };
          if (vErrors === null) {
            vErrors = [err69];
          } else {
            vErrors.push(err69);
          }
          errors++;
        }
      } else {
        const err70 = {
          instancePath: instancePath + '/alpha',
          schemaPath: '#/properties/alpha/oneOf/0/type',
          keyword: 'type',
          params: { type: 'number' },
          message: 'must be number',
        };
        if (vErrors === null) {
          vErrors = [err70];
        } else {
          vErrors.push(err70);
        }
        errors++;
      }
      var _valid16 = _errs150 === errors;
      if (_valid16) {
        valid52 = true;
        passing2 = 0;
      }
      const _errs152 = errors;
      if (
        !validate15(data62, {
          instancePath: instancePath + '/alpha',
          parentData: data,
          parentDataProperty: 'alpha',
          rootData,
        })
      ) {
        vErrors = vErrors === null ? validate15.errors : vErrors.concat(validate15.errors);
        errors = vErrors.length;
      }
      var _valid16 = _errs152 === errors;
      if (_valid16 && valid52) {
        valid52 = false;
        passing2 = [passing2, 1];
      } else {
        if (_valid16) {
          valid52 = true;
          passing2 = 1;
        }
      }
      if (!valid52) {
        const err71 = {
          instancePath: instancePath + '/alpha',
          schemaPath: '#/properties/alpha/oneOf',
          keyword: 'oneOf',
          params: { passingSchemas: passing2 },
          message: 'must match exactly one schema in oneOf',
        };
        if (vErrors === null) {
          vErrors = [err71];
        } else {
          vErrors.push(err71);
        }
        errors++;
      } else {
        errors = _errs149;
        if (vErrors !== null) {
          if (_errs149) {
            vErrors.length = _errs149;
          } else {
            vErrors = null;
          }
        }
      }
    }
    if (data.hex !== undefined) {
      let data63 = data.hex;
      const _errs155 = errors;
      let valid53 = false;
      let passing3 = null;
      const _errs156 = errors;
      if (typeof data63 === 'string') {
        if (!pattern4.test(data63)) {
          const err72 = {
            instancePath: instancePath + '/hex',
            schemaPath: '#/properties/hex/oneOf/0/pattern',
            keyword: 'pattern',
            params: { pattern: '^#[0-9a-fA-F]{6}$' },
            message: 'must match pattern "' + '^#[0-9a-fA-F]{6}$' + '"',
          };
          if (vErrors === null) {
            vErrors = [err72];
          } else {
            vErrors.push(err72);
          }
          errors++;
        }
      } else {
        const err73 = {
          instancePath: instancePath + '/hex',
          schemaPath: '#/properties/hex/oneOf/0/type',
          keyword: 'type',
          params: { type: 'string' },
          message: 'must be string',
        };
        if (vErrors === null) {
          vErrors = [err73];
        } else {
          vErrors.push(err73);
        }
        errors++;
      }
      var _valid17 = _errs156 === errors;
      if (_valid17) {
        valid53 = true;
        passing3 = 0;
      }
      const _errs158 = errors;
      if (
        !validate15(data63, {
          instancePath: instancePath + '/hex',
          parentData: data,
          parentDataProperty: 'hex',
          rootData,
        })
      ) {
        vErrors = vErrors === null ? validate15.errors : vErrors.concat(validate15.errors);
        errors = vErrors.length;
      }
      var _valid17 = _errs158 === errors;
      if (_valid17 && valid53) {
        valid53 = false;
        passing3 = [passing3, 1];
      } else {
        if (_valid17) {
          valid53 = true;
          passing3 = 1;
        }
      }
      if (!valid53) {
        const err74 = {
          instancePath: instancePath + '/hex',
          schemaPath: '#/properties/hex/oneOf',
          keyword: 'oneOf',
          params: { passingSchemas: passing3 },
          message: 'must match exactly one schema in oneOf',
        };
        if (vErrors === null) {
          vErrors = [err74];
        } else {
          vErrors.push(err74);
        }
        errors++;
      } else {
        errors = _errs155;
        if (vErrors !== null) {
          if (_errs155) {
            vErrors.length = _errs155;
          } else {
            vErrors = null;
          }
        }
      }
    }
  } else {
    const err75 = {
      instancePath,
      schemaPath: '#/type',
      keyword: 'type',
      params: { type: 'object' },
      message: 'must be object',
    };
    if (vErrors === null) {
      vErrors = [err75];
    } else {
      vErrors.push(err75);
    }
    errors++;
  }
  validate12.errors = vErrors;
  return errors === 0;
}
const schema26 = {
  title: 'Token Value Reference',
  oneOf: [
    { $ref: '#/definitions/curlyBraceReference' },
    { $ref: '#/definitions/jsonPointerReferenceObject' },
  ],
  description:
    'A reference to a token value using either curly brace syntax or JSON Pointer syntax',
};
function validate63(
  data,
  { instancePath = '', parentData, parentDataProperty, rootData = data } = {},
) {
  let vErrors = null;
  let errors = 0;
  const _errs0 = errors;
  let valid0 = false;
  let passing0 = null;
  const _errs1 = errors;
  if (typeof data === 'string') {
    if (!pattern1.test(data)) {
      const err0 = {
        instancePath,
        schemaPath: '#/definitions/curlyBraceReference/pattern',
        keyword: 'pattern',
        params: { pattern: '^\\{[^${}.][^{}.]*(\\.[^${}.][^{}.]*)*\\}$' },
        message: 'must match pattern "' + '^\\{[^${}.][^{}.]*(\\.[^${}.][^{}.]*)*\\}$' + '"',
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
  } else {
    const err1 = {
      instancePath,
      schemaPath: '#/definitions/curlyBraceReference/type',
      keyword: 'type',
      params: { type: 'string' },
      message: 'must be string',
    };
    if (vErrors === null) {
      vErrors = [err1];
    } else {
      vErrors.push(err1);
    }
    errors++;
  }
  var _valid0 = _errs1 === errors;
  if (_valid0) {
    valid0 = true;
    passing0 = 0;
  }
  const _errs4 = errors;
  if (!validate15(data, { instancePath, parentData, parentDataProperty, rootData })) {
    vErrors = vErrors === null ? validate15.errors : vErrors.concat(validate15.errors);
    errors = vErrors.length;
  }
  var _valid0 = _errs4 === errors;
  if (_valid0 && valid0) {
    valid0 = false;
    passing0 = [passing0, 1];
  } else {
    if (_valid0) {
      valid0 = true;
      passing0 = 1;
    }
  }
  if (!valid0) {
    const err2 = {
      instancePath,
      schemaPath: '#/oneOf',
      keyword: 'oneOf',
      params: { passingSchemas: passing0 },
      message: 'must match exactly one schema in oneOf',
    };
    if (vErrors === null) {
      vErrors = [err2];
    } else {
      vErrors.push(err2);
    }
    errors++;
  } else {
    errors = _errs0;
    if (vErrors !== null) {
      if (_errs0) {
        vErrors.length = _errs0;
      } else {
        vErrors = null;
      }
    }
  }
  validate63.errors = vErrors;
  return errors === 0;
}
const schema28 = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'https://www.designtokens.org/schemas/2025.10/format/values/dimension.json',
  title: 'Dimension Value',
  description:
    'Value schema for dimension type tokens. Represents an amount of distance in a single dimension in the UI, such as a position, width, height, radius, or thickness.',
  type: 'object',
  properties: {
    value: {
      description: 'An integer or floating-point value representing the numeric value.',
      oneOf: [
        { type: 'number' },
        {
          $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/jsonPointerReferenceObject',
        },
      ],
    },
    unit: {
      description:
        "Unit of distance. Supported values: 'px' (idealized pixel, equivalent to dp on Android and pt on iOS), 'rem' (multiple of system's default font size).",
      oneOf: [
        { type: 'string', enum: ['px', 'rem'] },
        {
          $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/jsonPointerReferenceObject',
        },
      ],
    },
  },
  required: ['value', 'unit'],
  additionalProperties: false,
};
function validate66(
  data,
  { instancePath = '', parentData, parentDataProperty, rootData = data } = {},
) {
  /*# sourceURL="https://www.designtokens.org/schemas/2025.10/format/values/dimension.json" */ let vErrors =
    null;
  let errors = 0;
  if (data && typeof data == 'object' && !Array.isArray(data)) {
    if (data.value === undefined) {
      const err0 = {
        instancePath,
        schemaPath: '#/required',
        keyword: 'required',
        params: { missingProperty: 'value' },
        message: "must have required property '" + 'value' + "'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.unit === undefined) {
      const err1 = {
        instancePath,
        schemaPath: '#/required',
        keyword: 'required',
        params: { missingProperty: 'unit' },
        message: "must have required property '" + 'unit' + "'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === 'value' || key0 === 'unit')) {
        const err2 = {
          instancePath,
          schemaPath: '#/additionalProperties',
          keyword: 'additionalProperties',
          params: { additionalProperty: key0 },
          message: 'must NOT have additional properties',
        };
        if (vErrors === null) {
          vErrors = [err2];
        } else {
          vErrors.push(err2);
        }
        errors++;
      }
    }
    if (data.value !== undefined) {
      let data0 = data.value;
      const _errs3 = errors;
      let valid1 = false;
      let passing0 = null;
      const _errs4 = errors;
      if (!(typeof data0 == 'number')) {
        const err3 = {
          instancePath: instancePath + '/value',
          schemaPath: '#/properties/value/oneOf/0/type',
          keyword: 'type',
          params: { type: 'number' },
          message: 'must be number',
        };
        if (vErrors === null) {
          vErrors = [err3];
        } else {
          vErrors.push(err3);
        }
        errors++;
      }
      var _valid0 = _errs4 === errors;
      if (_valid0) {
        valid1 = true;
        passing0 = 0;
      }
      const _errs6 = errors;
      if (
        !validate15(data0, {
          instancePath: instancePath + '/value',
          parentData: data,
          parentDataProperty: 'value',
          rootData,
        })
      ) {
        vErrors = vErrors === null ? validate15.errors : vErrors.concat(validate15.errors);
        errors = vErrors.length;
      }
      var _valid0 = _errs6 === errors;
      if (_valid0 && valid1) {
        valid1 = false;
        passing0 = [passing0, 1];
      } else {
        if (_valid0) {
          valid1 = true;
          passing0 = 1;
        }
      }
      if (!valid1) {
        const err4 = {
          instancePath: instancePath + '/value',
          schemaPath: '#/properties/value/oneOf',
          keyword: 'oneOf',
          params: { passingSchemas: passing0 },
          message: 'must match exactly one schema in oneOf',
        };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      } else {
        errors = _errs3;
        if (vErrors !== null) {
          if (_errs3) {
            vErrors.length = _errs3;
          } else {
            vErrors = null;
          }
        }
      }
    }
    if (data.unit !== undefined) {
      let data1 = data.unit;
      const _errs8 = errors;
      let valid2 = false;
      let passing1 = null;
      const _errs9 = errors;
      if (typeof data1 !== 'string') {
        const err5 = {
          instancePath: instancePath + '/unit',
          schemaPath: '#/properties/unit/oneOf/0/type',
          keyword: 'type',
          params: { type: 'string' },
          message: 'must be string',
        };
        if (vErrors === null) {
          vErrors = [err5];
        } else {
          vErrors.push(err5);
        }
        errors++;
      }
      if (!(data1 === 'px' || data1 === 'rem')) {
        const err6 = {
          instancePath: instancePath + '/unit',
          schemaPath: '#/properties/unit/oneOf/0/enum',
          keyword: 'enum',
          params: { allowedValues: schema28.properties.unit.oneOf[0].enum },
          message: 'must be equal to one of the allowed values',
        };
        if (vErrors === null) {
          vErrors = [err6];
        } else {
          vErrors.push(err6);
        }
        errors++;
      }
      var _valid1 = _errs9 === errors;
      if (_valid1) {
        valid2 = true;
        passing1 = 0;
      }
      const _errs11 = errors;
      if (
        !validate15(data1, {
          instancePath: instancePath + '/unit',
          parentData: data,
          parentDataProperty: 'unit',
          rootData,
        })
      ) {
        vErrors = vErrors === null ? validate15.errors : vErrors.concat(validate15.errors);
        errors = vErrors.length;
      }
      var _valid1 = _errs11 === errors;
      if (_valid1 && valid2) {
        valid2 = false;
        passing1 = [passing1, 1];
      } else {
        if (_valid1) {
          valid2 = true;
          passing1 = 1;
        }
      }
      if (!valid2) {
        const err7 = {
          instancePath: instancePath + '/unit',
          schemaPath: '#/properties/unit/oneOf',
          keyword: 'oneOf',
          params: { passingSchemas: passing1 },
          message: 'must match exactly one schema in oneOf',
        };
        if (vErrors === null) {
          vErrors = [err7];
        } else {
          vErrors.push(err7);
        }
        errors++;
      } else {
        errors = _errs8;
        if (vErrors !== null) {
          if (_errs8) {
            vErrors.length = _errs8;
          } else {
            vErrors = null;
          }
        }
      }
    }
  } else {
    const err8 = {
      instancePath,
      schemaPath: '#/type',
      keyword: 'type',
      params: { type: 'object' },
      message: 'must be object',
    };
    if (vErrors === null) {
      vErrors = [err8];
    } else {
      vErrors.push(err8);
    }
    errors++;
  }
  validate66.errors = vErrors;
  return errors === 0;
}
const schema29 = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'https://www.designtokens.org/schemas/2025.10/format/values/fontFamily.json',
  title: 'Font Family Value',
  description:
    'Value schema for fontFamily type tokens. Represents a font name or an array of font names (ordered from most to least preferred).',
  oneOf: [
    {
      type: 'string',
      description: 'A single font name',
      not: {
        $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/curlyBraceReference',
      },
    },
    {
      type: 'array',
      description: 'An array of font names, ordered from most to least preferred',
      items: {
        oneOf: [
          {
            type: 'string',
            not: {
              $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/curlyBraceReference',
            },
          },
          {
            $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/jsonPointerReferenceObject',
          },
        ],
      },
      minItems: 1,
    },
  ],
};
function validate71(
  data,
  { instancePath = '', parentData, parentDataProperty, rootData = data } = {},
) {
  /*# sourceURL="https://www.designtokens.org/schemas/2025.10/format/values/fontFamily.json" */ let vErrors =
    null;
  let errors = 0;
  const _errs0 = errors;
  let valid0 = false;
  let passing0 = null;
  const _errs1 = errors;
  if (typeof data !== 'string') {
    const err0 = {
      instancePath,
      schemaPath: '#/oneOf/0/type',
      keyword: 'type',
      params: { type: 'string' },
      message: 'must be string',
    };
    if (vErrors === null) {
      vErrors = [err0];
    } else {
      vErrors.push(err0);
    }
    errors++;
  }
  const _errs3 = errors;
  const _errs4 = errors;
  const _errs5 = errors;
  if (errors === _errs5) {
    if (typeof data === 'string') {
      if (!pattern1.test(data)) {
        const err1 = {};
        if (vErrors === null) {
          vErrors = [err1];
        } else {
          vErrors.push(err1);
        }
        errors++;
      }
    } else {
      const err2 = {};
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
  }
  var valid1 = _errs4 === errors;
  if (valid1) {
    const err3 = {
      instancePath,
      schemaPath: '#/oneOf/0/not',
      keyword: 'not',
      params: {},
      message: 'must NOT be valid',
    };
    if (vErrors === null) {
      vErrors = [err3];
    } else {
      vErrors.push(err3);
    }
    errors++;
  } else {
    errors = _errs3;
    if (vErrors !== null) {
      if (_errs3) {
        vErrors.length = _errs3;
      } else {
        vErrors = null;
      }
    }
  }
  var _valid0 = _errs1 === errors;
  if (_valid0) {
    valid0 = true;
    passing0 = 0;
  }
  const _errs7 = errors;
  if (Array.isArray(data)) {
    if (data.length < 1) {
      const err4 = {
        instancePath,
        schemaPath: '#/oneOf/1/minItems',
        keyword: 'minItems',
        params: { limit: 1 },
        message: 'must NOT have fewer than 1 items',
      };
      if (vErrors === null) {
        vErrors = [err4];
      } else {
        vErrors.push(err4);
      }
      errors++;
    }
    const len0 = data.length;
    for (let i0 = 0; i0 < len0; i0++) {
      let data0 = data[i0];
      const _errs10 = errors;
      let valid5 = false;
      let passing1 = null;
      const _errs11 = errors;
      if (typeof data0 !== 'string') {
        const err5 = {
          instancePath: instancePath + '/' + i0,
          schemaPath: '#/oneOf/1/items/oneOf/0/type',
          keyword: 'type',
          params: { type: 'string' },
          message: 'must be string',
        };
        if (vErrors === null) {
          vErrors = [err5];
        } else {
          vErrors.push(err5);
        }
        errors++;
      }
      const _errs13 = errors;
      const _errs14 = errors;
      const _errs15 = errors;
      if (errors === _errs15) {
        if (typeof data0 === 'string') {
          if (!pattern1.test(data0)) {
            const err6 = {};
            if (vErrors === null) {
              vErrors = [err6];
            } else {
              vErrors.push(err6);
            }
            errors++;
          }
        } else {
          const err7 = {};
          if (vErrors === null) {
            vErrors = [err7];
          } else {
            vErrors.push(err7);
          }
          errors++;
        }
      }
      var valid6 = _errs14 === errors;
      if (valid6) {
        const err8 = {
          instancePath: instancePath + '/' + i0,
          schemaPath: '#/oneOf/1/items/oneOf/0/not',
          keyword: 'not',
          params: {},
          message: 'must NOT be valid',
        };
        if (vErrors === null) {
          vErrors = [err8];
        } else {
          vErrors.push(err8);
        }
        errors++;
      } else {
        errors = _errs13;
        if (vErrors !== null) {
          if (_errs13) {
            vErrors.length = _errs13;
          } else {
            vErrors = null;
          }
        }
      }
      var _valid1 = _errs11 === errors;
      if (_valid1) {
        valid5 = true;
        passing1 = 0;
      }
      const _errs17 = errors;
      if (
        !validate15(data0, {
          instancePath: instancePath + '/' + i0,
          parentData: data,
          parentDataProperty: i0,
          rootData,
        })
      ) {
        vErrors = vErrors === null ? validate15.errors : vErrors.concat(validate15.errors);
        errors = vErrors.length;
      }
      var _valid1 = _errs17 === errors;
      if (_valid1 && valid5) {
        valid5 = false;
        passing1 = [passing1, 1];
      } else {
        if (_valid1) {
          valid5 = true;
          passing1 = 1;
        }
      }
      if (!valid5) {
        const err9 = {
          instancePath: instancePath + '/' + i0,
          schemaPath: '#/oneOf/1/items/oneOf',
          keyword: 'oneOf',
          params: { passingSchemas: passing1 },
          message: 'must match exactly one schema in oneOf',
        };
        if (vErrors === null) {
          vErrors = [err9];
        } else {
          vErrors.push(err9);
        }
        errors++;
      } else {
        errors = _errs10;
        if (vErrors !== null) {
          if (_errs10) {
            vErrors.length = _errs10;
          } else {
            vErrors = null;
          }
        }
      }
    }
  } else {
    const err10 = {
      instancePath,
      schemaPath: '#/oneOf/1/type',
      keyword: 'type',
      params: { type: 'array' },
      message: 'must be array',
    };
    if (vErrors === null) {
      vErrors = [err10];
    } else {
      vErrors.push(err10);
    }
    errors++;
  }
  var _valid0 = _errs7 === errors;
  if (_valid0 && valid0) {
    valid0 = false;
    passing0 = [passing0, 1];
  } else {
    if (_valid0) {
      valid0 = true;
      passing0 = 1;
    }
  }
  if (!valid0) {
    const err11 = {
      instancePath,
      schemaPath: '#/oneOf',
      keyword: 'oneOf',
      params: { passingSchemas: passing0 },
      message: 'must match exactly one schema in oneOf',
    };
    if (vErrors === null) {
      vErrors = [err11];
    } else {
      vErrors.push(err11);
    }
    errors++;
  } else {
    errors = _errs0;
    if (vErrors !== null) {
      if (_errs0) {
        vErrors.length = _errs0;
      } else {
        vErrors = null;
      }
    }
  }
  validate71.errors = vErrors;
  return errors === 0;
}
const schema33 = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'https://www.designtokens.org/schemas/2025.10/format/values/duration.json',
  title: 'Duration Value',
  description:
    'Value schema for duration type tokens. Represents the length of time in milliseconds an animation or animation cycle takes to complete.',
  type: 'object',
  properties: {
    value: {
      description: 'An integer or floating-point value representing the numeric value.',
      oneOf: [
        { type: 'number' },
        {
          $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/jsonPointerReferenceObject',
        },
      ],
    },
    unit: {
      description: "Unit of time. Supported values: 'ms' (millisecond), 's' (second).",
      oneOf: [
        { type: 'string', enum: ['ms', 's'] },
        {
          $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/jsonPointerReferenceObject',
        },
      ],
    },
  },
  required: ['value', 'unit'],
  additionalProperties: false,
};
function validate76(
  data,
  { instancePath = '', parentData, parentDataProperty, rootData = data } = {},
) {
  /*# sourceURL="https://www.designtokens.org/schemas/2025.10/format/values/duration.json" */ let vErrors =
    null;
  let errors = 0;
  if (data && typeof data == 'object' && !Array.isArray(data)) {
    if (data.value === undefined) {
      const err0 = {
        instancePath,
        schemaPath: '#/required',
        keyword: 'required',
        params: { missingProperty: 'value' },
        message: "must have required property '" + 'value' + "'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.unit === undefined) {
      const err1 = {
        instancePath,
        schemaPath: '#/required',
        keyword: 'required',
        params: { missingProperty: 'unit' },
        message: "must have required property '" + 'unit' + "'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === 'value' || key0 === 'unit')) {
        const err2 = {
          instancePath,
          schemaPath: '#/additionalProperties',
          keyword: 'additionalProperties',
          params: { additionalProperty: key0 },
          message: 'must NOT have additional properties',
        };
        if (vErrors === null) {
          vErrors = [err2];
        } else {
          vErrors.push(err2);
        }
        errors++;
      }
    }
    if (data.value !== undefined) {
      let data0 = data.value;
      const _errs3 = errors;
      let valid1 = false;
      let passing0 = null;
      const _errs4 = errors;
      if (!(typeof data0 == 'number')) {
        const err3 = {
          instancePath: instancePath + '/value',
          schemaPath: '#/properties/value/oneOf/0/type',
          keyword: 'type',
          params: { type: 'number' },
          message: 'must be number',
        };
        if (vErrors === null) {
          vErrors = [err3];
        } else {
          vErrors.push(err3);
        }
        errors++;
      }
      var _valid0 = _errs4 === errors;
      if (_valid0) {
        valid1 = true;
        passing0 = 0;
      }
      const _errs6 = errors;
      if (
        !validate15(data0, {
          instancePath: instancePath + '/value',
          parentData: data,
          parentDataProperty: 'value',
          rootData,
        })
      ) {
        vErrors = vErrors === null ? validate15.errors : vErrors.concat(validate15.errors);
        errors = vErrors.length;
      }
      var _valid0 = _errs6 === errors;
      if (_valid0 && valid1) {
        valid1 = false;
        passing0 = [passing0, 1];
      } else {
        if (_valid0) {
          valid1 = true;
          passing0 = 1;
        }
      }
      if (!valid1) {
        const err4 = {
          instancePath: instancePath + '/value',
          schemaPath: '#/properties/value/oneOf',
          keyword: 'oneOf',
          params: { passingSchemas: passing0 },
          message: 'must match exactly one schema in oneOf',
        };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      } else {
        errors = _errs3;
        if (vErrors !== null) {
          if (_errs3) {
            vErrors.length = _errs3;
          } else {
            vErrors = null;
          }
        }
      }
    }
    if (data.unit !== undefined) {
      let data1 = data.unit;
      const _errs8 = errors;
      let valid2 = false;
      let passing1 = null;
      const _errs9 = errors;
      if (typeof data1 !== 'string') {
        const err5 = {
          instancePath: instancePath + '/unit',
          schemaPath: '#/properties/unit/oneOf/0/type',
          keyword: 'type',
          params: { type: 'string' },
          message: 'must be string',
        };
        if (vErrors === null) {
          vErrors = [err5];
        } else {
          vErrors.push(err5);
        }
        errors++;
      }
      if (!(data1 === 'ms' || data1 === 's')) {
        const err6 = {
          instancePath: instancePath + '/unit',
          schemaPath: '#/properties/unit/oneOf/0/enum',
          keyword: 'enum',
          params: { allowedValues: schema33.properties.unit.oneOf[0].enum },
          message: 'must be equal to one of the allowed values',
        };
        if (vErrors === null) {
          vErrors = [err6];
        } else {
          vErrors.push(err6);
        }
        errors++;
      }
      var _valid1 = _errs9 === errors;
      if (_valid1) {
        valid2 = true;
        passing1 = 0;
      }
      const _errs11 = errors;
      if (
        !validate15(data1, {
          instancePath: instancePath + '/unit',
          parentData: data,
          parentDataProperty: 'unit',
          rootData,
        })
      ) {
        vErrors = vErrors === null ? validate15.errors : vErrors.concat(validate15.errors);
        errors = vErrors.length;
      }
      var _valid1 = _errs11 === errors;
      if (_valid1 && valid2) {
        valid2 = false;
        passing1 = [passing1, 1];
      } else {
        if (_valid1) {
          valid2 = true;
          passing1 = 1;
        }
      }
      if (!valid2) {
        const err7 = {
          instancePath: instancePath + '/unit',
          schemaPath: '#/properties/unit/oneOf',
          keyword: 'oneOf',
          params: { passingSchemas: passing1 },
          message: 'must match exactly one schema in oneOf',
        };
        if (vErrors === null) {
          vErrors = [err7];
        } else {
          vErrors.push(err7);
        }
        errors++;
      } else {
        errors = _errs8;
        if (vErrors !== null) {
          if (_errs8) {
            vErrors.length = _errs8;
          } else {
            vErrors = null;
          }
        }
      }
    }
  } else {
    const err8 = {
      instancePath,
      schemaPath: '#/type',
      keyword: 'type',
      params: { type: 'object' },
      message: 'must be object',
    };
    if (vErrors === null) {
      vErrors = [err8];
    } else {
      vErrors.push(err8);
    }
    errors++;
  }
  validate76.errors = vErrors;
  return errors === 0;
}
const schema34 = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'https://www.designtokens.org/schemas/2025.10/format/values/cubicBezier.json',
  title: 'Cubic Bezier Value',
  description:
    'Value schema for cubicBezier type tokens. Represents how the value of an animated property progresses towards completion over the duration of an animation, effectively creating visual effects such as acceleration, deceleration, and bounce.',
  type: 'array',
  items: [
    { $ref: '#/definitions/xCoordinate' },
    { $ref: '#/definitions/yCoordinate' },
    { $ref: '#/definitions/xCoordinate' },
    { $ref: '#/definitions/yCoordinate' },
  ],
  additionalItems: false,
  minItems: 4,
  maxItems: 4,
  definitions: {
    xCoordinate: {
      title: 'X Coordinate',
      description: 'X coordinate of control point (must be between 0 and 1)',
      oneOf: [
        { type: 'number', minimum: 0, maximum: 1 },
        {
          $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/jsonPointerReferenceObject',
        },
      ],
    },
    yCoordinate: {
      title: 'Y Coordinate',
      description: 'Y coordinate of control point (can be any real number)',
      oneOf: [
        { type: 'number' },
        {
          $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/jsonPointerReferenceObject',
        },
      ],
    },
  },
};
const schema35 = {
  title: 'X Coordinate',
  description: 'X coordinate of control point (must be between 0 and 1)',
  oneOf: [
    { type: 'number', minimum: 0, maximum: 1 },
    {
      $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/jsonPointerReferenceObject',
    },
  ],
};
function validate82(
  data,
  { instancePath = '', parentData, parentDataProperty, rootData = data } = {},
) {
  let vErrors = null;
  let errors = 0;
  const _errs0 = errors;
  let valid0 = false;
  let passing0 = null;
  const _errs1 = errors;
  if (typeof data == 'number') {
    if (data > 1 || isNaN(data)) {
      const err0 = {
        instancePath,
        schemaPath: '#/oneOf/0/maximum',
        keyword: 'maximum',
        params: { comparison: '<=', limit: 1 },
        message: 'must be <= 1',
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data < 0 || isNaN(data)) {
      const err1 = {
        instancePath,
        schemaPath: '#/oneOf/0/minimum',
        keyword: 'minimum',
        params: { comparison: '>=', limit: 0 },
        message: 'must be >= 0',
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
  } else {
    const err2 = {
      instancePath,
      schemaPath: '#/oneOf/0/type',
      keyword: 'type',
      params: { type: 'number' },
      message: 'must be number',
    };
    if (vErrors === null) {
      vErrors = [err2];
    } else {
      vErrors.push(err2);
    }
    errors++;
  }
  var _valid0 = _errs1 === errors;
  if (_valid0) {
    valid0 = true;
    passing0 = 0;
  }
  const _errs3 = errors;
  if (!validate15(data, { instancePath, parentData, parentDataProperty, rootData })) {
    vErrors = vErrors === null ? validate15.errors : vErrors.concat(validate15.errors);
    errors = vErrors.length;
  }
  var _valid0 = _errs3 === errors;
  if (_valid0 && valid0) {
    valid0 = false;
    passing0 = [passing0, 1];
  } else {
    if (_valid0) {
      valid0 = true;
      passing0 = 1;
    }
  }
  if (!valid0) {
    const err3 = {
      instancePath,
      schemaPath: '#/oneOf',
      keyword: 'oneOf',
      params: { passingSchemas: passing0 },
      message: 'must match exactly one schema in oneOf',
    };
    if (vErrors === null) {
      vErrors = [err3];
    } else {
      vErrors.push(err3);
    }
    errors++;
  } else {
    errors = _errs0;
    if (vErrors !== null) {
      if (_errs0) {
        vErrors.length = _errs0;
      } else {
        vErrors = null;
      }
    }
  }
  validate82.errors = vErrors;
  return errors === 0;
}
const schema36 = {
  title: 'Y Coordinate',
  description: 'Y coordinate of control point (can be any real number)',
  oneOf: [
    { type: 'number' },
    {
      $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/jsonPointerReferenceObject',
    },
  ],
};
function validate85(
  data,
  { instancePath = '', parentData, parentDataProperty, rootData = data } = {},
) {
  let vErrors = null;
  let errors = 0;
  const _errs0 = errors;
  let valid0 = false;
  let passing0 = null;
  const _errs1 = errors;
  if (!(typeof data == 'number')) {
    const err0 = {
      instancePath,
      schemaPath: '#/oneOf/0/type',
      keyword: 'type',
      params: { type: 'number' },
      message: 'must be number',
    };
    if (vErrors === null) {
      vErrors = [err0];
    } else {
      vErrors.push(err0);
    }
    errors++;
  }
  var _valid0 = _errs1 === errors;
  if (_valid0) {
    valid0 = true;
    passing0 = 0;
  }
  const _errs3 = errors;
  if (!validate15(data, { instancePath, parentData, parentDataProperty, rootData })) {
    vErrors = vErrors === null ? validate15.errors : vErrors.concat(validate15.errors);
    errors = vErrors.length;
  }
  var _valid0 = _errs3 === errors;
  if (_valid0 && valid0) {
    valid0 = false;
    passing0 = [passing0, 1];
  } else {
    if (_valid0) {
      valid0 = true;
      passing0 = 1;
    }
  }
  if (!valid0) {
    const err1 = {
      instancePath,
      schemaPath: '#/oneOf',
      keyword: 'oneOf',
      params: { passingSchemas: passing0 },
      message: 'must match exactly one schema in oneOf',
    };
    if (vErrors === null) {
      vErrors = [err1];
    } else {
      vErrors.push(err1);
    }
    errors++;
  } else {
    errors = _errs0;
    if (vErrors !== null) {
      if (_errs0) {
        vErrors.length = _errs0;
      } else {
        vErrors = null;
      }
    }
  }
  validate85.errors = vErrors;
  return errors === 0;
}
function validate81(
  data,
  { instancePath = '', parentData, parentDataProperty, rootData = data } = {},
) {
  /*# sourceURL="https://www.designtokens.org/schemas/2025.10/format/values/cubicBezier.json" */ let vErrors =
    null;
  let errors = 0;
  if (Array.isArray(data)) {
    if (data.length > 4) {
      const err0 = {
        instancePath,
        schemaPath: '#/maxItems',
        keyword: 'maxItems',
        params: { limit: 4 },
        message: 'must NOT have more than 4 items',
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.length < 4) {
      const err1 = {
        instancePath,
        schemaPath: '#/minItems',
        keyword: 'minItems',
        params: { limit: 4 },
        message: 'must NOT have fewer than 4 items',
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    const len0 = data.length;
    if (!(len0 <= 4)) {
      const err2 = {
        instancePath,
        schemaPath: '#/additionalItems',
        keyword: 'additionalItems',
        params: { limit: 4 },
        message: 'must NOT have more than 4 items',
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    const len1 = data.length;
    if (len1 > 0) {
      if (
        !validate82(data[0], {
          instancePath: instancePath + '/0',
          parentData: data,
          parentDataProperty: 0,
          rootData,
        })
      ) {
        vErrors = vErrors === null ? validate82.errors : vErrors.concat(validate82.errors);
        errors = vErrors.length;
      }
    }
    if (len1 > 1) {
      if (
        !validate85(data[1], {
          instancePath: instancePath + '/1',
          parentData: data,
          parentDataProperty: 1,
          rootData,
        })
      ) {
        vErrors = vErrors === null ? validate85.errors : vErrors.concat(validate85.errors);
        errors = vErrors.length;
      }
    }
    if (len1 > 2) {
      if (
        !validate82(data[2], {
          instancePath: instancePath + '/2',
          parentData: data,
          parentDataProperty: 2,
          rootData,
        })
      ) {
        vErrors = vErrors === null ? validate82.errors : vErrors.concat(validate82.errors);
        errors = vErrors.length;
      }
    }
    if (len1 > 3) {
      if (
        !validate85(data[3], {
          instancePath: instancePath + '/3',
          parentData: data,
          parentDataProperty: 3,
          rootData,
        })
      ) {
        vErrors = vErrors === null ? validate85.errors : vErrors.concat(validate85.errors);
        errors = vErrors.length;
      }
    }
  } else {
    const err3 = {
      instancePath,
      schemaPath: '#/type',
      keyword: 'type',
      params: { type: 'array' },
      message: 'must be array',
    };
    if (vErrors === null) {
      vErrors = [err3];
    } else {
      vErrors.push(err3);
    }
    errors++;
  }
  validate81.errors = vErrors;
  return errors === 0;
}
const schema38 = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'https://www.designtokens.org/schemas/2025.10/format/values/strokeStyle.json',
  title: 'Stroke Style Value',
  description:
    'Value schema for strokeStyle type tokens. Represents the style applied to lines or borders.',
  oneOf: [
    {
      type: 'string',
      enum: ['solid', 'dashed', 'dotted', 'double', 'groove', 'ridge', 'outset', 'inset'],
      description: 'Pre-defined stroke style values with the same meaning as CSS line style values',
    },
    {
      type: 'object',
      properties: {
        dashArray: {
          description:
            'Array of dimension values specifying lengths of alternating dashes and gaps',
          oneOf: [
            {
              type: 'array',
              items: {
                oneOf: [
                  {
                    $ref: 'https://www.designtokens.org/schemas/2025.10/format/values/dimension.json',
                  },
                  {
                    $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/tokenValueReference',
                  },
                ],
              },
              minItems: 1,
            },
            {
              $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/jsonPointerReferenceObject',
            },
          ],
        },
        lineCap: {
          description: 'Line cap style, same meaning as SVG stroke-linecap attribute',
          oneOf: [
            { type: 'string', enum: ['round', 'butt', 'square'] },
            {
              $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/jsonPointerReferenceObject',
            },
          ],
        },
      },
      required: ['dashArray', 'lineCap'],
      additionalProperties: false,
    },
  ],
};
function validate93(
  data,
  { instancePath = '', parentData, parentDataProperty, rootData = data } = {},
) {
  /*# sourceURL="https://www.designtokens.org/schemas/2025.10/format/values/strokeStyle.json" */ let vErrors =
    null;
  let errors = 0;
  const _errs0 = errors;
  let valid0 = false;
  let passing0 = null;
  const _errs1 = errors;
  if (typeof data !== 'string') {
    const err0 = {
      instancePath,
      schemaPath: '#/oneOf/0/type',
      keyword: 'type',
      params: { type: 'string' },
      message: 'must be string',
    };
    if (vErrors === null) {
      vErrors = [err0];
    } else {
      vErrors.push(err0);
    }
    errors++;
  }
  if (!(
    data === 'solid' ||
    data === 'dashed' ||
    data === 'dotted' ||
    data === 'double' ||
    data === 'groove' ||
    data === 'ridge' ||
    data === 'outset' ||
    data === 'inset'
  )) {
    const err1 = {
      instancePath,
      schemaPath: '#/oneOf/0/enum',
      keyword: 'enum',
      params: { allowedValues: schema38.oneOf[0].enum },
      message: 'must be equal to one of the allowed values',
    };
    if (vErrors === null) {
      vErrors = [err1];
    } else {
      vErrors.push(err1);
    }
    errors++;
  }
  var _valid0 = _errs1 === errors;
  if (_valid0) {
    valid0 = true;
    passing0 = 0;
  }
  const _errs3 = errors;
  if (data && typeof data == 'object' && !Array.isArray(data)) {
    if (data.dashArray === undefined) {
      const err2 = {
        instancePath,
        schemaPath: '#/oneOf/1/required',
        keyword: 'required',
        params: { missingProperty: 'dashArray' },
        message: "must have required property '" + 'dashArray' + "'",
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.lineCap === undefined) {
      const err3 = {
        instancePath,
        schemaPath: '#/oneOf/1/required',
        keyword: 'required',
        params: { missingProperty: 'lineCap' },
        message: "must have required property '" + 'lineCap' + "'",
      };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === 'dashArray' || key0 === 'lineCap')) {
        const err4 = {
          instancePath,
          schemaPath: '#/oneOf/1/additionalProperties',
          keyword: 'additionalProperties',
          params: { additionalProperty: key0 },
          message: 'must NOT have additional properties',
        };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      }
    }
    if (data.dashArray !== undefined) {
      let data0 = data.dashArray;
      const _errs7 = errors;
      let valid2 = false;
      let passing1 = null;
      const _errs8 = errors;
      if (Array.isArray(data0)) {
        if (data0.length < 1) {
          const err5 = {
            instancePath: instancePath + '/dashArray',
            schemaPath: '#/oneOf/1/properties/dashArray/oneOf/0/minItems',
            keyword: 'minItems',
            params: { limit: 1 },
            message: 'must NOT have fewer than 1 items',
          };
          if (vErrors === null) {
            vErrors = [err5];
          } else {
            vErrors.push(err5);
          }
          errors++;
        }
        const len0 = data0.length;
        for (let i0 = 0; i0 < len0; i0++) {
          let data1 = data0[i0];
          const _errs11 = errors;
          let valid5 = false;
          let passing2 = null;
          const _errs12 = errors;
          if (
            !validate66(data1, {
              instancePath: instancePath + '/dashArray/' + i0,
              parentData: data0,
              parentDataProperty: i0,
              rootData,
            })
          ) {
            vErrors = vErrors === null ? validate66.errors : vErrors.concat(validate66.errors);
            errors = vErrors.length;
          }
          var _valid2 = _errs12 === errors;
          if (_valid2) {
            valid5 = true;
            passing2 = 0;
          }
          const _errs13 = errors;
          if (
            !validate63(data1, {
              instancePath: instancePath + '/dashArray/' + i0,
              parentData: data0,
              parentDataProperty: i0,
              rootData,
            })
          ) {
            vErrors = vErrors === null ? validate63.errors : vErrors.concat(validate63.errors);
            errors = vErrors.length;
          }
          var _valid2 = _errs13 === errors;
          if (_valid2 && valid5) {
            valid5 = false;
            passing2 = [passing2, 1];
          } else {
            if (_valid2) {
              valid5 = true;
              passing2 = 1;
            }
          }
          if (!valid5) {
            const err6 = {
              instancePath: instancePath + '/dashArray/' + i0,
              schemaPath: '#/oneOf/1/properties/dashArray/oneOf/0/items/oneOf',
              keyword: 'oneOf',
              params: { passingSchemas: passing2 },
              message: 'must match exactly one schema in oneOf',
            };
            if (vErrors === null) {
              vErrors = [err6];
            } else {
              vErrors.push(err6);
            }
            errors++;
          } else {
            errors = _errs11;
            if (vErrors !== null) {
              if (_errs11) {
                vErrors.length = _errs11;
              } else {
                vErrors = null;
              }
            }
          }
        }
      } else {
        const err7 = {
          instancePath: instancePath + '/dashArray',
          schemaPath: '#/oneOf/1/properties/dashArray/oneOf/0/type',
          keyword: 'type',
          params: { type: 'array' },
          message: 'must be array',
        };
        if (vErrors === null) {
          vErrors = [err7];
        } else {
          vErrors.push(err7);
        }
        errors++;
      }
      var _valid1 = _errs8 === errors;
      if (_valid1) {
        valid2 = true;
        passing1 = 0;
      }
      const _errs14 = errors;
      if (
        !validate15(data0, {
          instancePath: instancePath + '/dashArray',
          parentData: data,
          parentDataProperty: 'dashArray',
          rootData,
        })
      ) {
        vErrors = vErrors === null ? validate15.errors : vErrors.concat(validate15.errors);
        errors = vErrors.length;
      }
      var _valid1 = _errs14 === errors;
      if (_valid1 && valid2) {
        valid2 = false;
        passing1 = [passing1, 1];
      } else {
        if (_valid1) {
          valid2 = true;
          passing1 = 1;
        }
      }
      if (!valid2) {
        const err8 = {
          instancePath: instancePath + '/dashArray',
          schemaPath: '#/oneOf/1/properties/dashArray/oneOf',
          keyword: 'oneOf',
          params: { passingSchemas: passing1 },
          message: 'must match exactly one schema in oneOf',
        };
        if (vErrors === null) {
          vErrors = [err8];
        } else {
          vErrors.push(err8);
        }
        errors++;
      } else {
        errors = _errs7;
        if (vErrors !== null) {
          if (_errs7) {
            vErrors.length = _errs7;
          } else {
            vErrors = null;
          }
        }
      }
    }
    if (data.lineCap !== undefined) {
      let data2 = data.lineCap;
      const _errs16 = errors;
      let valid6 = false;
      let passing3 = null;
      const _errs17 = errors;
      if (typeof data2 !== 'string') {
        const err9 = {
          instancePath: instancePath + '/lineCap',
          schemaPath: '#/oneOf/1/properties/lineCap/oneOf/0/type',
          keyword: 'type',
          params: { type: 'string' },
          message: 'must be string',
        };
        if (vErrors === null) {
          vErrors = [err9];
        } else {
          vErrors.push(err9);
        }
        errors++;
      }
      if (!(data2 === 'round' || data2 === 'butt' || data2 === 'square')) {
        const err10 = {
          instancePath: instancePath + '/lineCap',
          schemaPath: '#/oneOf/1/properties/lineCap/oneOf/0/enum',
          keyword: 'enum',
          params: { allowedValues: schema38.oneOf[1].properties.lineCap.oneOf[0].enum },
          message: 'must be equal to one of the allowed values',
        };
        if (vErrors === null) {
          vErrors = [err10];
        } else {
          vErrors.push(err10);
        }
        errors++;
      }
      var _valid3 = _errs17 === errors;
      if (_valid3) {
        valid6 = true;
        passing3 = 0;
      }
      const _errs19 = errors;
      if (
        !validate15(data2, {
          instancePath: instancePath + '/lineCap',
          parentData: data,
          parentDataProperty: 'lineCap',
          rootData,
        })
      ) {
        vErrors = vErrors === null ? validate15.errors : vErrors.concat(validate15.errors);
        errors = vErrors.length;
      }
      var _valid3 = _errs19 === errors;
      if (_valid3 && valid6) {
        valid6 = false;
        passing3 = [passing3, 1];
      } else {
        if (_valid3) {
          valid6 = true;
          passing3 = 1;
        }
      }
      if (!valid6) {
        const err11 = {
          instancePath: instancePath + '/lineCap',
          schemaPath: '#/oneOf/1/properties/lineCap/oneOf',
          keyword: 'oneOf',
          params: { passingSchemas: passing3 },
          message: 'must match exactly one schema in oneOf',
        };
        if (vErrors === null) {
          vErrors = [err11];
        } else {
          vErrors.push(err11);
        }
        errors++;
      } else {
        errors = _errs16;
        if (vErrors !== null) {
          if (_errs16) {
            vErrors.length = _errs16;
          } else {
            vErrors = null;
          }
        }
      }
    }
  } else {
    const err12 = {
      instancePath,
      schemaPath: '#/oneOf/1/type',
      keyword: 'type',
      params: { type: 'object' },
      message: 'must be object',
    };
    if (vErrors === null) {
      vErrors = [err12];
    } else {
      vErrors.push(err12);
    }
    errors++;
  }
  var _valid0 = _errs3 === errors;
  if (_valid0 && valid0) {
    valid0 = false;
    passing0 = [passing0, 1];
  } else {
    if (_valid0) {
      valid0 = true;
      passing0 = 1;
    }
  }
  if (!valid0) {
    const err13 = {
      instancePath,
      schemaPath: '#/oneOf',
      keyword: 'oneOf',
      params: { passingSchemas: passing0 },
      message: 'must match exactly one schema in oneOf',
    };
    if (vErrors === null) {
      vErrors = [err13];
    } else {
      vErrors.push(err13);
    }
    errors++;
  } else {
    errors = _errs0;
    if (vErrors !== null) {
      if (_errs0) {
        vErrors.length = _errs0;
      } else {
        vErrors = null;
      }
    }
  }
  validate93.errors = vErrors;
  return errors === 0;
}
const schema39 = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'https://www.designtokens.org/schemas/2025.10/format/values/border.json',
  title: 'Border Value',
  description: 'Value schema for border type tokens. Represents a border style.',
  type: 'object',
  properties: {
    color: {
      description: 'The color of the border',
      oneOf: [
        { $ref: 'https://www.designtokens.org/schemas/2025.10/format/values/color.json' },
        {
          $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/tokenValueReference',
        },
      ],
    },
    width: {
      description: 'The width or thickness of the border',
      oneOf: [
        { $ref: 'https://www.designtokens.org/schemas/2025.10/format/values/dimension.json' },
        {
          $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/tokenValueReference',
        },
      ],
    },
    style: {
      description: "The border's style",
      oneOf: [
        { $ref: 'https://www.designtokens.org/schemas/2025.10/format/values/strokeStyle.json' },
        {
          $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/tokenValueReference',
        },
      ],
    },
  },
  required: ['color', 'width', 'style'],
  additionalProperties: false,
};
function validate100(
  data,
  { instancePath = '', parentData, parentDataProperty, rootData = data } = {},
) {
  /*# sourceURL="https://www.designtokens.org/schemas/2025.10/format/values/border.json" */ let vErrors =
    null;
  let errors = 0;
  if (data && typeof data == 'object' && !Array.isArray(data)) {
    if (data.color === undefined) {
      const err0 = {
        instancePath,
        schemaPath: '#/required',
        keyword: 'required',
        params: { missingProperty: 'color' },
        message: "must have required property '" + 'color' + "'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.width === undefined) {
      const err1 = {
        instancePath,
        schemaPath: '#/required',
        keyword: 'required',
        params: { missingProperty: 'width' },
        message: "must have required property '" + 'width' + "'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.style === undefined) {
      const err2 = {
        instancePath,
        schemaPath: '#/required',
        keyword: 'required',
        params: { missingProperty: 'style' },
        message: "must have required property '" + 'style' + "'",
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === 'color' || key0 === 'width' || key0 === 'style')) {
        const err3 = {
          instancePath,
          schemaPath: '#/additionalProperties',
          keyword: 'additionalProperties',
          params: { additionalProperty: key0 },
          message: 'must NOT have additional properties',
        };
        if (vErrors === null) {
          vErrors = [err3];
        } else {
          vErrors.push(err3);
        }
        errors++;
      }
    }
    if (data.color !== undefined) {
      let data0 = data.color;
      const _errs3 = errors;
      let valid1 = false;
      let passing0 = null;
      const _errs4 = errors;
      if (
        !validate12(data0, {
          instancePath: instancePath + '/color',
          parentData: data,
          parentDataProperty: 'color',
          rootData,
        })
      ) {
        vErrors = vErrors === null ? validate12.errors : vErrors.concat(validate12.errors);
        errors = vErrors.length;
      }
      var _valid0 = _errs4 === errors;
      if (_valid0) {
        valid1 = true;
        passing0 = 0;
      }
      const _errs5 = errors;
      if (
        !validate63(data0, {
          instancePath: instancePath + '/color',
          parentData: data,
          parentDataProperty: 'color',
          rootData,
        })
      ) {
        vErrors = vErrors === null ? validate63.errors : vErrors.concat(validate63.errors);
        errors = vErrors.length;
      }
      var _valid0 = _errs5 === errors;
      if (_valid0 && valid1) {
        valid1 = false;
        passing0 = [passing0, 1];
      } else {
        if (_valid0) {
          valid1 = true;
          passing0 = 1;
        }
      }
      if (!valid1) {
        const err4 = {
          instancePath: instancePath + '/color',
          schemaPath: '#/properties/color/oneOf',
          keyword: 'oneOf',
          params: { passingSchemas: passing0 },
          message: 'must match exactly one schema in oneOf',
        };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      } else {
        errors = _errs3;
        if (vErrors !== null) {
          if (_errs3) {
            vErrors.length = _errs3;
          } else {
            vErrors = null;
          }
        }
      }
    }
    if (data.width !== undefined) {
      let data1 = data.width;
      const _errs7 = errors;
      let valid2 = false;
      let passing1 = null;
      const _errs8 = errors;
      if (
        !validate66(data1, {
          instancePath: instancePath + '/width',
          parentData: data,
          parentDataProperty: 'width',
          rootData,
        })
      ) {
        vErrors = vErrors === null ? validate66.errors : vErrors.concat(validate66.errors);
        errors = vErrors.length;
      }
      var _valid1 = _errs8 === errors;
      if (_valid1) {
        valid2 = true;
        passing1 = 0;
      }
      const _errs9 = errors;
      if (
        !validate63(data1, {
          instancePath: instancePath + '/width',
          parentData: data,
          parentDataProperty: 'width',
          rootData,
        })
      ) {
        vErrors = vErrors === null ? validate63.errors : vErrors.concat(validate63.errors);
        errors = vErrors.length;
      }
      var _valid1 = _errs9 === errors;
      if (_valid1 && valid2) {
        valid2 = false;
        passing1 = [passing1, 1];
      } else {
        if (_valid1) {
          valid2 = true;
          passing1 = 1;
        }
      }
      if (!valid2) {
        const err5 = {
          instancePath: instancePath + '/width',
          schemaPath: '#/properties/width/oneOf',
          keyword: 'oneOf',
          params: { passingSchemas: passing1 },
          message: 'must match exactly one schema in oneOf',
        };
        if (vErrors === null) {
          vErrors = [err5];
        } else {
          vErrors.push(err5);
        }
        errors++;
      } else {
        errors = _errs7;
        if (vErrors !== null) {
          if (_errs7) {
            vErrors.length = _errs7;
          } else {
            vErrors = null;
          }
        }
      }
    }
    if (data.style !== undefined) {
      let data2 = data.style;
      const _errs11 = errors;
      let valid3 = false;
      let passing2 = null;
      const _errs12 = errors;
      if (
        !validate93(data2, {
          instancePath: instancePath + '/style',
          parentData: data,
          parentDataProperty: 'style',
          rootData,
        })
      ) {
        vErrors = vErrors === null ? validate93.errors : vErrors.concat(validate93.errors);
        errors = vErrors.length;
      }
      var _valid2 = _errs12 === errors;
      if (_valid2) {
        valid3 = true;
        passing2 = 0;
      }
      const _errs13 = errors;
      if (
        !validate63(data2, {
          instancePath: instancePath + '/style',
          parentData: data,
          parentDataProperty: 'style',
          rootData,
        })
      ) {
        vErrors = vErrors === null ? validate63.errors : vErrors.concat(validate63.errors);
        errors = vErrors.length;
      }
      var _valid2 = _errs13 === errors;
      if (_valid2 && valid3) {
        valid3 = false;
        passing2 = [passing2, 1];
      } else {
        if (_valid2) {
          valid3 = true;
          passing2 = 1;
        }
      }
      if (!valid3) {
        const err6 = {
          instancePath: instancePath + '/style',
          schemaPath: '#/properties/style/oneOf',
          keyword: 'oneOf',
          params: { passingSchemas: passing2 },
          message: 'must match exactly one schema in oneOf',
        };
        if (vErrors === null) {
          vErrors = [err6];
        } else {
          vErrors.push(err6);
        }
        errors++;
      } else {
        errors = _errs11;
        if (vErrors !== null) {
          if (_errs11) {
            vErrors.length = _errs11;
          } else {
            vErrors = null;
          }
        }
      }
    }
  } else {
    const err7 = {
      instancePath,
      schemaPath: '#/type',
      keyword: 'type',
      params: { type: 'object' },
      message: 'must be object',
    };
    if (vErrors === null) {
      vErrors = [err7];
    } else {
      vErrors.push(err7);
    }
    errors++;
  }
  validate100.errors = vErrors;
  return errors === 0;
}
const schema40 = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'https://www.designtokens.org/schemas/2025.10/format/values/transition.json',
  title: 'Transition Value',
  description:
    'Value schema for transition type tokens. Represents an animated transition between two states.',
  type: 'object',
  properties: {
    duration: {
      description: 'The duration of the transition',
      oneOf: [
        { $ref: 'https://www.designtokens.org/schemas/2025.10/format/values/duration.json' },
        {
          $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/tokenValueReference',
        },
      ],
    },
    delay: {
      description: 'The time to wait before the transition begins',
      oneOf: [
        { $ref: 'https://www.designtokens.org/schemas/2025.10/format/values/duration.json' },
        {
          $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/tokenValueReference',
        },
      ],
    },
    timingFunction: {
      description: 'The timing function of the transition',
      oneOf: [
        { $ref: 'https://www.designtokens.org/schemas/2025.10/format/values/cubicBezier.json' },
        {
          $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/tokenValueReference',
        },
      ],
    },
  },
  required: ['duration', 'delay', 'timingFunction'],
  additionalProperties: false,
};
function validate109(
  data,
  { instancePath = '', parentData, parentDataProperty, rootData = data } = {},
) {
  /*# sourceURL="https://www.designtokens.org/schemas/2025.10/format/values/transition.json" */ let vErrors =
    null;
  let errors = 0;
  if (data && typeof data == 'object' && !Array.isArray(data)) {
    if (data.duration === undefined) {
      const err0 = {
        instancePath,
        schemaPath: '#/required',
        keyword: 'required',
        params: { missingProperty: 'duration' },
        message: "must have required property '" + 'duration' + "'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.delay === undefined) {
      const err1 = {
        instancePath,
        schemaPath: '#/required',
        keyword: 'required',
        params: { missingProperty: 'delay' },
        message: "must have required property '" + 'delay' + "'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.timingFunction === undefined) {
      const err2 = {
        instancePath,
        schemaPath: '#/required',
        keyword: 'required',
        params: { missingProperty: 'timingFunction' },
        message: "must have required property '" + 'timingFunction' + "'",
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === 'duration' || key0 === 'delay' || key0 === 'timingFunction')) {
        const err3 = {
          instancePath,
          schemaPath: '#/additionalProperties',
          keyword: 'additionalProperties',
          params: { additionalProperty: key0 },
          message: 'must NOT have additional properties',
        };
        if (vErrors === null) {
          vErrors = [err3];
        } else {
          vErrors.push(err3);
        }
        errors++;
      }
    }
    if (data.duration !== undefined) {
      let data0 = data.duration;
      const _errs3 = errors;
      let valid1 = false;
      let passing0 = null;
      const _errs4 = errors;
      if (
        !validate76(data0, {
          instancePath: instancePath + '/duration',
          parentData: data,
          parentDataProperty: 'duration',
          rootData,
        })
      ) {
        vErrors = vErrors === null ? validate76.errors : vErrors.concat(validate76.errors);
        errors = vErrors.length;
      }
      var _valid0 = _errs4 === errors;
      if (_valid0) {
        valid1 = true;
        passing0 = 0;
      }
      const _errs5 = errors;
      if (
        !validate63(data0, {
          instancePath: instancePath + '/duration',
          parentData: data,
          parentDataProperty: 'duration',
          rootData,
        })
      ) {
        vErrors = vErrors === null ? validate63.errors : vErrors.concat(validate63.errors);
        errors = vErrors.length;
      }
      var _valid0 = _errs5 === errors;
      if (_valid0 && valid1) {
        valid1 = false;
        passing0 = [passing0, 1];
      } else {
        if (_valid0) {
          valid1 = true;
          passing0 = 1;
        }
      }
      if (!valid1) {
        const err4 = {
          instancePath: instancePath + '/duration',
          schemaPath: '#/properties/duration/oneOf',
          keyword: 'oneOf',
          params: { passingSchemas: passing0 },
          message: 'must match exactly one schema in oneOf',
        };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      } else {
        errors = _errs3;
        if (vErrors !== null) {
          if (_errs3) {
            vErrors.length = _errs3;
          } else {
            vErrors = null;
          }
        }
      }
    }
    if (data.delay !== undefined) {
      let data1 = data.delay;
      const _errs7 = errors;
      let valid2 = false;
      let passing1 = null;
      const _errs8 = errors;
      if (
        !validate76(data1, {
          instancePath: instancePath + '/delay',
          parentData: data,
          parentDataProperty: 'delay',
          rootData,
        })
      ) {
        vErrors = vErrors === null ? validate76.errors : vErrors.concat(validate76.errors);
        errors = vErrors.length;
      }
      var _valid1 = _errs8 === errors;
      if (_valid1) {
        valid2 = true;
        passing1 = 0;
      }
      const _errs9 = errors;
      if (
        !validate63(data1, {
          instancePath: instancePath + '/delay',
          parentData: data,
          parentDataProperty: 'delay',
          rootData,
        })
      ) {
        vErrors = vErrors === null ? validate63.errors : vErrors.concat(validate63.errors);
        errors = vErrors.length;
      }
      var _valid1 = _errs9 === errors;
      if (_valid1 && valid2) {
        valid2 = false;
        passing1 = [passing1, 1];
      } else {
        if (_valid1) {
          valid2 = true;
          passing1 = 1;
        }
      }
      if (!valid2) {
        const err5 = {
          instancePath: instancePath + '/delay',
          schemaPath: '#/properties/delay/oneOf',
          keyword: 'oneOf',
          params: { passingSchemas: passing1 },
          message: 'must match exactly one schema in oneOf',
        };
        if (vErrors === null) {
          vErrors = [err5];
        } else {
          vErrors.push(err5);
        }
        errors++;
      } else {
        errors = _errs7;
        if (vErrors !== null) {
          if (_errs7) {
            vErrors.length = _errs7;
          } else {
            vErrors = null;
          }
        }
      }
    }
    if (data.timingFunction !== undefined) {
      let data2 = data.timingFunction;
      const _errs11 = errors;
      let valid3 = false;
      let passing2 = null;
      const _errs12 = errors;
      if (
        !validate81(data2, {
          instancePath: instancePath + '/timingFunction',
          parentData: data,
          parentDataProperty: 'timingFunction',
          rootData,
        })
      ) {
        vErrors = vErrors === null ? validate81.errors : vErrors.concat(validate81.errors);
        errors = vErrors.length;
      }
      var _valid2 = _errs12 === errors;
      if (_valid2) {
        valid3 = true;
        passing2 = 0;
      }
      const _errs13 = errors;
      if (
        !validate63(data2, {
          instancePath: instancePath + '/timingFunction',
          parentData: data,
          parentDataProperty: 'timingFunction',
          rootData,
        })
      ) {
        vErrors = vErrors === null ? validate63.errors : vErrors.concat(validate63.errors);
        errors = vErrors.length;
      }
      var _valid2 = _errs13 === errors;
      if (_valid2 && valid3) {
        valid3 = false;
        passing2 = [passing2, 1];
      } else {
        if (_valid2) {
          valid3 = true;
          passing2 = 1;
        }
      }
      if (!valid3) {
        const err6 = {
          instancePath: instancePath + '/timingFunction',
          schemaPath: '#/properties/timingFunction/oneOf',
          keyword: 'oneOf',
          params: { passingSchemas: passing2 },
          message: 'must match exactly one schema in oneOf',
        };
        if (vErrors === null) {
          vErrors = [err6];
        } else {
          vErrors.push(err6);
        }
        errors++;
      } else {
        errors = _errs11;
        if (vErrors !== null) {
          if (_errs11) {
            vErrors.length = _errs11;
          } else {
            vErrors = null;
          }
        }
      }
    }
  } else {
    const err7 = {
      instancePath,
      schemaPath: '#/type',
      keyword: 'type',
      params: { type: 'object' },
      message: 'must be object',
    };
    if (vErrors === null) {
      vErrors = [err7];
    } else {
      vErrors.push(err7);
    }
    errors++;
  }
  validate109.errors = vErrors;
  return errors === 0;
}
const schema41 = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'https://www.designtokens.org/schemas/2025.10/format/values/shadow.json',
  title: 'Shadow Value',
  description: 'Value schema for shadow type tokens. Represents a shadow style.',
  oneOf: [
    { $ref: '#/definitions/shadowObject' },
    {
      type: 'array',
      description: 'Array of shadow objects and/or references to shadow tokens',
      items: {
        oneOf: [
          { $ref: '#/definitions/shadowObject' },
          {
            $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/tokenValueReference',
          },
        ],
      },
      minItems: 1,
    },
  ],
  definitions: {
    shadowObject: {
      title: 'Shadow Object',
      type: 'object',
      properties: {
        color: {
          description: 'The color of the shadow',
          oneOf: [
            { $ref: 'https://www.designtokens.org/schemas/2025.10/format/values/color.json' },
            {
              $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/tokenValueReference',
            },
          ],
        },
        offsetX: {
          description: 'The horizontal offset that shadow has from the element it is applied to',
          oneOf: [
            { $ref: 'https://www.designtokens.org/schemas/2025.10/format/values/dimension.json' },
            {
              $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/tokenValueReference',
            },
          ],
        },
        offsetY: {
          description: 'The vertical offset that shadow has from the element it is applied to',
          oneOf: [
            { $ref: 'https://www.designtokens.org/schemas/2025.10/format/values/dimension.json' },
            {
              $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/tokenValueReference',
            },
          ],
        },
        blur: {
          description: 'The blur radius that is applied to the shadow',
          oneOf: [
            { $ref: 'https://www.designtokens.org/schemas/2025.10/format/values/dimension.json' },
            {
              $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/tokenValueReference',
            },
          ],
        },
        spread: {
          description: 'The amount by which to expand or contract the shadow',
          oneOf: [
            { $ref: 'https://www.designtokens.org/schemas/2025.10/format/values/dimension.json' },
            {
              $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/tokenValueReference',
            },
          ],
        },
        inset: {
          description:
            'Whether this shadow is inside the containing shape (inner shadow) rather than a drop shadow (default: false)',
          oneOf: [
            { type: 'boolean' },
            {
              $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/jsonPointerReferenceObject',
            },
          ],
        },
      },
      required: ['color', 'offsetX', 'offsetY', 'blur', 'spread'],
      additionalProperties: false,
    },
  },
};
const schema42 = {
  title: 'Shadow Object',
  type: 'object',
  properties: {
    color: {
      description: 'The color of the shadow',
      oneOf: [
        { $ref: 'https://www.designtokens.org/schemas/2025.10/format/values/color.json' },
        {
          $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/tokenValueReference',
        },
      ],
    },
    offsetX: {
      description: 'The horizontal offset that shadow has from the element it is applied to',
      oneOf: [
        { $ref: 'https://www.designtokens.org/schemas/2025.10/format/values/dimension.json' },
        {
          $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/tokenValueReference',
        },
      ],
    },
    offsetY: {
      description: 'The vertical offset that shadow has from the element it is applied to',
      oneOf: [
        { $ref: 'https://www.designtokens.org/schemas/2025.10/format/values/dimension.json' },
        {
          $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/tokenValueReference',
        },
      ],
    },
    blur: {
      description: 'The blur radius that is applied to the shadow',
      oneOf: [
        { $ref: 'https://www.designtokens.org/schemas/2025.10/format/values/dimension.json' },
        {
          $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/tokenValueReference',
        },
      ],
    },
    spread: {
      description: 'The amount by which to expand or contract the shadow',
      oneOf: [
        { $ref: 'https://www.designtokens.org/schemas/2025.10/format/values/dimension.json' },
        {
          $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/tokenValueReference',
        },
      ],
    },
    inset: {
      description:
        'Whether this shadow is inside the containing shape (inner shadow) rather than a drop shadow (default: false)',
      oneOf: [
        { type: 'boolean' },
        {
          $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/jsonPointerReferenceObject',
        },
      ],
    },
  },
  required: ['color', 'offsetX', 'offsetY', 'blur', 'spread'],
  additionalProperties: false,
};
function validate119(
  data,
  { instancePath = '', parentData, parentDataProperty, rootData = data } = {},
) {
  let vErrors = null;
  let errors = 0;
  if (data && typeof data == 'object' && !Array.isArray(data)) {
    if (data.color === undefined) {
      const err0 = {
        instancePath,
        schemaPath: '#/required',
        keyword: 'required',
        params: { missingProperty: 'color' },
        message: "must have required property '" + 'color' + "'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.offsetX === undefined) {
      const err1 = {
        instancePath,
        schemaPath: '#/required',
        keyword: 'required',
        params: { missingProperty: 'offsetX' },
        message: "must have required property '" + 'offsetX' + "'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.offsetY === undefined) {
      const err2 = {
        instancePath,
        schemaPath: '#/required',
        keyword: 'required',
        params: { missingProperty: 'offsetY' },
        message: "must have required property '" + 'offsetY' + "'",
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.blur === undefined) {
      const err3 = {
        instancePath,
        schemaPath: '#/required',
        keyword: 'required',
        params: { missingProperty: 'blur' },
        message: "must have required property '" + 'blur' + "'",
      };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    if (data.spread === undefined) {
      const err4 = {
        instancePath,
        schemaPath: '#/required',
        keyword: 'required',
        params: { missingProperty: 'spread' },
        message: "must have required property '" + 'spread' + "'",
      };
      if (vErrors === null) {
        vErrors = [err4];
      } else {
        vErrors.push(err4);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(
        key0 === 'color' ||
        key0 === 'offsetX' ||
        key0 === 'offsetY' ||
        key0 === 'blur' ||
        key0 === 'spread' ||
        key0 === 'inset'
      )) {
        const err5 = {
          instancePath,
          schemaPath: '#/additionalProperties',
          keyword: 'additionalProperties',
          params: { additionalProperty: key0 },
          message: 'must NOT have additional properties',
        };
        if (vErrors === null) {
          vErrors = [err5];
        } else {
          vErrors.push(err5);
        }
        errors++;
      }
    }
    if (data.color !== undefined) {
      let data0 = data.color;
      const _errs3 = errors;
      let valid1 = false;
      let passing0 = null;
      const _errs4 = errors;
      if (
        !validate12(data0, {
          instancePath: instancePath + '/color',
          parentData: data,
          parentDataProperty: 'color',
          rootData,
        })
      ) {
        vErrors = vErrors === null ? validate12.errors : vErrors.concat(validate12.errors);
        errors = vErrors.length;
      }
      var _valid0 = _errs4 === errors;
      if (_valid0) {
        valid1 = true;
        passing0 = 0;
      }
      const _errs5 = errors;
      if (
        !validate63(data0, {
          instancePath: instancePath + '/color',
          parentData: data,
          parentDataProperty: 'color',
          rootData,
        })
      ) {
        vErrors = vErrors === null ? validate63.errors : vErrors.concat(validate63.errors);
        errors = vErrors.length;
      }
      var _valid0 = _errs5 === errors;
      if (_valid0 && valid1) {
        valid1 = false;
        passing0 = [passing0, 1];
      } else {
        if (_valid0) {
          valid1 = true;
          passing0 = 1;
        }
      }
      if (!valid1) {
        const err6 = {
          instancePath: instancePath + '/color',
          schemaPath: '#/properties/color/oneOf',
          keyword: 'oneOf',
          params: { passingSchemas: passing0 },
          message: 'must match exactly one schema in oneOf',
        };
        if (vErrors === null) {
          vErrors = [err6];
        } else {
          vErrors.push(err6);
        }
        errors++;
      } else {
        errors = _errs3;
        if (vErrors !== null) {
          if (_errs3) {
            vErrors.length = _errs3;
          } else {
            vErrors = null;
          }
        }
      }
    }
    if (data.offsetX !== undefined) {
      let data1 = data.offsetX;
      const _errs7 = errors;
      let valid2 = false;
      let passing1 = null;
      const _errs8 = errors;
      if (
        !validate66(data1, {
          instancePath: instancePath + '/offsetX',
          parentData: data,
          parentDataProperty: 'offsetX',
          rootData,
        })
      ) {
        vErrors = vErrors === null ? validate66.errors : vErrors.concat(validate66.errors);
        errors = vErrors.length;
      }
      var _valid1 = _errs8 === errors;
      if (_valid1) {
        valid2 = true;
        passing1 = 0;
      }
      const _errs9 = errors;
      if (
        !validate63(data1, {
          instancePath: instancePath + '/offsetX',
          parentData: data,
          parentDataProperty: 'offsetX',
          rootData,
        })
      ) {
        vErrors = vErrors === null ? validate63.errors : vErrors.concat(validate63.errors);
        errors = vErrors.length;
      }
      var _valid1 = _errs9 === errors;
      if (_valid1 && valid2) {
        valid2 = false;
        passing1 = [passing1, 1];
      } else {
        if (_valid1) {
          valid2 = true;
          passing1 = 1;
        }
      }
      if (!valid2) {
        const err7 = {
          instancePath: instancePath + '/offsetX',
          schemaPath: '#/properties/offsetX/oneOf',
          keyword: 'oneOf',
          params: { passingSchemas: passing1 },
          message: 'must match exactly one schema in oneOf',
        };
        if (vErrors === null) {
          vErrors = [err7];
        } else {
          vErrors.push(err7);
        }
        errors++;
      } else {
        errors = _errs7;
        if (vErrors !== null) {
          if (_errs7) {
            vErrors.length = _errs7;
          } else {
            vErrors = null;
          }
        }
      }
    }
    if (data.offsetY !== undefined) {
      let data2 = data.offsetY;
      const _errs11 = errors;
      let valid3 = false;
      let passing2 = null;
      const _errs12 = errors;
      if (
        !validate66(data2, {
          instancePath: instancePath + '/offsetY',
          parentData: data,
          parentDataProperty: 'offsetY',
          rootData,
        })
      ) {
        vErrors = vErrors === null ? validate66.errors : vErrors.concat(validate66.errors);
        errors = vErrors.length;
      }
      var _valid2 = _errs12 === errors;
      if (_valid2) {
        valid3 = true;
        passing2 = 0;
      }
      const _errs13 = errors;
      if (
        !validate63(data2, {
          instancePath: instancePath + '/offsetY',
          parentData: data,
          parentDataProperty: 'offsetY',
          rootData,
        })
      ) {
        vErrors = vErrors === null ? validate63.errors : vErrors.concat(validate63.errors);
        errors = vErrors.length;
      }
      var _valid2 = _errs13 === errors;
      if (_valid2 && valid3) {
        valid3 = false;
        passing2 = [passing2, 1];
      } else {
        if (_valid2) {
          valid3 = true;
          passing2 = 1;
        }
      }
      if (!valid3) {
        const err8 = {
          instancePath: instancePath + '/offsetY',
          schemaPath: '#/properties/offsetY/oneOf',
          keyword: 'oneOf',
          params: { passingSchemas: passing2 },
          message: 'must match exactly one schema in oneOf',
        };
        if (vErrors === null) {
          vErrors = [err8];
        } else {
          vErrors.push(err8);
        }
        errors++;
      } else {
        errors = _errs11;
        if (vErrors !== null) {
          if (_errs11) {
            vErrors.length = _errs11;
          } else {
            vErrors = null;
          }
        }
      }
    }
    if (data.blur !== undefined) {
      let data3 = data.blur;
      const _errs15 = errors;
      let valid4 = false;
      let passing3 = null;
      const _errs16 = errors;
      if (
        !validate66(data3, {
          instancePath: instancePath + '/blur',
          parentData: data,
          parentDataProperty: 'blur',
          rootData,
        })
      ) {
        vErrors = vErrors === null ? validate66.errors : vErrors.concat(validate66.errors);
        errors = vErrors.length;
      }
      var _valid3 = _errs16 === errors;
      if (_valid3) {
        valid4 = true;
        passing3 = 0;
      }
      const _errs17 = errors;
      if (
        !validate63(data3, {
          instancePath: instancePath + '/blur',
          parentData: data,
          parentDataProperty: 'blur',
          rootData,
        })
      ) {
        vErrors = vErrors === null ? validate63.errors : vErrors.concat(validate63.errors);
        errors = vErrors.length;
      }
      var _valid3 = _errs17 === errors;
      if (_valid3 && valid4) {
        valid4 = false;
        passing3 = [passing3, 1];
      } else {
        if (_valid3) {
          valid4 = true;
          passing3 = 1;
        }
      }
      if (!valid4) {
        const err9 = {
          instancePath: instancePath + '/blur',
          schemaPath: '#/properties/blur/oneOf',
          keyword: 'oneOf',
          params: { passingSchemas: passing3 },
          message: 'must match exactly one schema in oneOf',
        };
        if (vErrors === null) {
          vErrors = [err9];
        } else {
          vErrors.push(err9);
        }
        errors++;
      } else {
        errors = _errs15;
        if (vErrors !== null) {
          if (_errs15) {
            vErrors.length = _errs15;
          } else {
            vErrors = null;
          }
        }
      }
    }
    if (data.spread !== undefined) {
      let data4 = data.spread;
      const _errs19 = errors;
      let valid5 = false;
      let passing4 = null;
      const _errs20 = errors;
      if (
        !validate66(data4, {
          instancePath: instancePath + '/spread',
          parentData: data,
          parentDataProperty: 'spread',
          rootData,
        })
      ) {
        vErrors = vErrors === null ? validate66.errors : vErrors.concat(validate66.errors);
        errors = vErrors.length;
      }
      var _valid4 = _errs20 === errors;
      if (_valid4) {
        valid5 = true;
        passing4 = 0;
      }
      const _errs21 = errors;
      if (
        !validate63(data4, {
          instancePath: instancePath + '/spread',
          parentData: data,
          parentDataProperty: 'spread',
          rootData,
        })
      ) {
        vErrors = vErrors === null ? validate63.errors : vErrors.concat(validate63.errors);
        errors = vErrors.length;
      }
      var _valid4 = _errs21 === errors;
      if (_valid4 && valid5) {
        valid5 = false;
        passing4 = [passing4, 1];
      } else {
        if (_valid4) {
          valid5 = true;
          passing4 = 1;
        }
      }
      if (!valid5) {
        const err10 = {
          instancePath: instancePath + '/spread',
          schemaPath: '#/properties/spread/oneOf',
          keyword: 'oneOf',
          params: { passingSchemas: passing4 },
          message: 'must match exactly one schema in oneOf',
        };
        if (vErrors === null) {
          vErrors = [err10];
        } else {
          vErrors.push(err10);
        }
        errors++;
      } else {
        errors = _errs19;
        if (vErrors !== null) {
          if (_errs19) {
            vErrors.length = _errs19;
          } else {
            vErrors = null;
          }
        }
      }
    }
    if (data.inset !== undefined) {
      let data5 = data.inset;
      const _errs23 = errors;
      let valid6 = false;
      let passing5 = null;
      const _errs24 = errors;
      if (typeof data5 !== 'boolean') {
        const err11 = {
          instancePath: instancePath + '/inset',
          schemaPath: '#/properties/inset/oneOf/0/type',
          keyword: 'type',
          params: { type: 'boolean' },
          message: 'must be boolean',
        };
        if (vErrors === null) {
          vErrors = [err11];
        } else {
          vErrors.push(err11);
        }
        errors++;
      }
      var _valid5 = _errs24 === errors;
      if (_valid5) {
        valid6 = true;
        passing5 = 0;
      }
      const _errs26 = errors;
      if (
        !validate15(data5, {
          instancePath: instancePath + '/inset',
          parentData: data,
          parentDataProperty: 'inset',
          rootData,
        })
      ) {
        vErrors = vErrors === null ? validate15.errors : vErrors.concat(validate15.errors);
        errors = vErrors.length;
      }
      var _valid5 = _errs26 === errors;
      if (_valid5 && valid6) {
        valid6 = false;
        passing5 = [passing5, 1];
      } else {
        if (_valid5) {
          valid6 = true;
          passing5 = 1;
        }
      }
      if (!valid6) {
        const err12 = {
          instancePath: instancePath + '/inset',
          schemaPath: '#/properties/inset/oneOf',
          keyword: 'oneOf',
          params: { passingSchemas: passing5 },
          message: 'must match exactly one schema in oneOf',
        };
        if (vErrors === null) {
          vErrors = [err12];
        } else {
          vErrors.push(err12);
        }
        errors++;
      } else {
        errors = _errs23;
        if (vErrors !== null) {
          if (_errs23) {
            vErrors.length = _errs23;
          } else {
            vErrors = null;
          }
        }
      }
    }
  } else {
    const err13 = {
      instancePath,
      schemaPath: '#/type',
      keyword: 'type',
      params: { type: 'object' },
      message: 'must be object',
    };
    if (vErrors === null) {
      vErrors = [err13];
    } else {
      vErrors.push(err13);
    }
    errors++;
  }
  validate119.errors = vErrors;
  return errors === 0;
}
function validate118(
  data,
  { instancePath = '', parentData, parentDataProperty, rootData = data } = {},
) {
  /*# sourceURL="https://www.designtokens.org/schemas/2025.10/format/values/shadow.json" */ let vErrors =
    null;
  let errors = 0;
  const _errs0 = errors;
  let valid0 = false;
  let passing0 = null;
  const _errs1 = errors;
  if (!validate119(data, { instancePath, parentData, parentDataProperty, rootData })) {
    vErrors = vErrors === null ? validate119.errors : vErrors.concat(validate119.errors);
    errors = vErrors.length;
  }
  var _valid0 = _errs1 === errors;
  if (_valid0) {
    valid0 = true;
    passing0 = 0;
  }
  const _errs2 = errors;
  if (Array.isArray(data)) {
    if (data.length < 1) {
      const err0 = {
        instancePath,
        schemaPath: '#/oneOf/1/minItems',
        keyword: 'minItems',
        params: { limit: 1 },
        message: 'must NOT have fewer than 1 items',
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    const len0 = data.length;
    for (let i0 = 0; i0 < len0; i0++) {
      let data0 = data[i0];
      const _errs5 = errors;
      let valid3 = false;
      let passing1 = null;
      const _errs6 = errors;
      if (
        !validate119(data0, {
          instancePath: instancePath + '/' + i0,
          parentData: data,
          parentDataProperty: i0,
          rootData,
        })
      ) {
        vErrors = vErrors === null ? validate119.errors : vErrors.concat(validate119.errors);
        errors = vErrors.length;
      }
      var _valid1 = _errs6 === errors;
      if (_valid1) {
        valid3 = true;
        passing1 = 0;
      }
      const _errs7 = errors;
      if (
        !validate63(data0, {
          instancePath: instancePath + '/' + i0,
          parentData: data,
          parentDataProperty: i0,
          rootData,
        })
      ) {
        vErrors = vErrors === null ? validate63.errors : vErrors.concat(validate63.errors);
        errors = vErrors.length;
      }
      var _valid1 = _errs7 === errors;
      if (_valid1 && valid3) {
        valid3 = false;
        passing1 = [passing1, 1];
      } else {
        if (_valid1) {
          valid3 = true;
          passing1 = 1;
        }
      }
      if (!valid3) {
        const err1 = {
          instancePath: instancePath + '/' + i0,
          schemaPath: '#/oneOf/1/items/oneOf',
          keyword: 'oneOf',
          params: { passingSchemas: passing1 },
          message: 'must match exactly one schema in oneOf',
        };
        if (vErrors === null) {
          vErrors = [err1];
        } else {
          vErrors.push(err1);
        }
        errors++;
      } else {
        errors = _errs5;
        if (vErrors !== null) {
          if (_errs5) {
            vErrors.length = _errs5;
          } else {
            vErrors = null;
          }
        }
      }
    }
  } else {
    const err2 = {
      instancePath,
      schemaPath: '#/oneOf/1/type',
      keyword: 'type',
      params: { type: 'array' },
      message: 'must be array',
    };
    if (vErrors === null) {
      vErrors = [err2];
    } else {
      vErrors.push(err2);
    }
    errors++;
  }
  var _valid0 = _errs2 === errors;
  if (_valid0 && valid0) {
    valid0 = false;
    passing0 = [passing0, 1];
  } else {
    if (_valid0) {
      valid0 = true;
      passing0 = 1;
    }
  }
  if (!valid0) {
    const err3 = {
      instancePath,
      schemaPath: '#/oneOf',
      keyword: 'oneOf',
      params: { passingSchemas: passing0 },
      message: 'must match exactly one schema in oneOf',
    };
    if (vErrors === null) {
      vErrors = [err3];
    } else {
      vErrors.push(err3);
    }
    errors++;
  } else {
    errors = _errs0;
    if (vErrors !== null) {
      if (_errs0) {
        vErrors.length = _errs0;
      } else {
        vErrors = null;
      }
    }
  }
  validate118.errors = vErrors;
  return errors === 0;
}
const schema43 = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'https://www.designtokens.org/schemas/2025.10/format/values/gradient.json',
  title: 'Gradient Value',
  description: 'Value schema for gradient type tokens. Represents a color gradient.',
  type: 'array',
  items: {
    oneOf: [
      { $ref: '#/definitions/gradientStop' },
      {
        $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/tokenValueReference',
      },
    ],
  },
  minItems: 1,
  definitions: {
    gradientStop: {
      title: 'Gradient Stop',
      type: 'object',
      properties: {
        color: {
          description: "The color value at the stop's position on the gradient",
          oneOf: [
            { $ref: 'https://www.designtokens.org/schemas/2025.10/format/values/color.json' },
            {
              $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/tokenValueReference',
            },
          ],
        },
        position: {
          description:
            "The position of the stop along the gradient's axis (range [0, 1]). Values outside this range are clamped.",
          oneOf: [
            { type: 'number', minimum: 0, maximum: 1 },
            {
              $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/tokenValueReference',
            },
          ],
        },
      },
      required: ['color', 'position'],
      additionalProperties: false,
    },
  },
};
const schema44 = {
  title: 'Gradient Stop',
  type: 'object',
  properties: {
    color: {
      description: "The color value at the stop's position on the gradient",
      oneOf: [
        { $ref: 'https://www.designtokens.org/schemas/2025.10/format/values/color.json' },
        {
          $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/tokenValueReference',
        },
      ],
    },
    position: {
      description:
        "The position of the stop along the gradient's axis (range [0, 1]). Values outside this range are clamped.",
      oneOf: [
        { type: 'number', minimum: 0, maximum: 1 },
        {
          $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/tokenValueReference',
        },
      ],
    },
  },
  required: ['color', 'position'],
  additionalProperties: false,
};
function validate137(
  data,
  { instancePath = '', parentData, parentDataProperty, rootData = data } = {},
) {
  let vErrors = null;
  let errors = 0;
  if (data && typeof data == 'object' && !Array.isArray(data)) {
    if (data.color === undefined) {
      const err0 = {
        instancePath,
        schemaPath: '#/required',
        keyword: 'required',
        params: { missingProperty: 'color' },
        message: "must have required property '" + 'color' + "'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.position === undefined) {
      const err1 = {
        instancePath,
        schemaPath: '#/required',
        keyword: 'required',
        params: { missingProperty: 'position' },
        message: "must have required property '" + 'position' + "'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === 'color' || key0 === 'position')) {
        const err2 = {
          instancePath,
          schemaPath: '#/additionalProperties',
          keyword: 'additionalProperties',
          params: { additionalProperty: key0 },
          message: 'must NOT have additional properties',
        };
        if (vErrors === null) {
          vErrors = [err2];
        } else {
          vErrors.push(err2);
        }
        errors++;
      }
    }
    if (data.color !== undefined) {
      let data0 = data.color;
      const _errs3 = errors;
      let valid1 = false;
      let passing0 = null;
      const _errs4 = errors;
      if (
        !validate12(data0, {
          instancePath: instancePath + '/color',
          parentData: data,
          parentDataProperty: 'color',
          rootData,
        })
      ) {
        vErrors = vErrors === null ? validate12.errors : vErrors.concat(validate12.errors);
        errors = vErrors.length;
      }
      var _valid0 = _errs4 === errors;
      if (_valid0) {
        valid1 = true;
        passing0 = 0;
      }
      const _errs5 = errors;
      if (
        !validate63(data0, {
          instancePath: instancePath + '/color',
          parentData: data,
          parentDataProperty: 'color',
          rootData,
        })
      ) {
        vErrors = vErrors === null ? validate63.errors : vErrors.concat(validate63.errors);
        errors = vErrors.length;
      }
      var _valid0 = _errs5 === errors;
      if (_valid0 && valid1) {
        valid1 = false;
        passing0 = [passing0, 1];
      } else {
        if (_valid0) {
          valid1 = true;
          passing0 = 1;
        }
      }
      if (!valid1) {
        const err3 = {
          instancePath: instancePath + '/color',
          schemaPath: '#/properties/color/oneOf',
          keyword: 'oneOf',
          params: { passingSchemas: passing0 },
          message: 'must match exactly one schema in oneOf',
        };
        if (vErrors === null) {
          vErrors = [err3];
        } else {
          vErrors.push(err3);
        }
        errors++;
      } else {
        errors = _errs3;
        if (vErrors !== null) {
          if (_errs3) {
            vErrors.length = _errs3;
          } else {
            vErrors = null;
          }
        }
      }
    }
    if (data.position !== undefined) {
      let data1 = data.position;
      const _errs7 = errors;
      let valid2 = false;
      let passing1 = null;
      const _errs8 = errors;
      if (typeof data1 == 'number') {
        if (data1 > 1 || isNaN(data1)) {
          const err4 = {
            instancePath: instancePath + '/position',
            schemaPath: '#/properties/position/oneOf/0/maximum',
            keyword: 'maximum',
            params: { comparison: '<=', limit: 1 },
            message: 'must be <= 1',
          };
          if (vErrors === null) {
            vErrors = [err4];
          } else {
            vErrors.push(err4);
          }
          errors++;
        }
        if (data1 < 0 || isNaN(data1)) {
          const err5 = {
            instancePath: instancePath + '/position',
            schemaPath: '#/properties/position/oneOf/0/minimum',
            keyword: 'minimum',
            params: { comparison: '>=', limit: 0 },
            message: 'must be >= 0',
          };
          if (vErrors === null) {
            vErrors = [err5];
          } else {
            vErrors.push(err5);
          }
          errors++;
        }
      } else {
        const err6 = {
          instancePath: instancePath + '/position',
          schemaPath: '#/properties/position/oneOf/0/type',
          keyword: 'type',
          params: { type: 'number' },
          message: 'must be number',
        };
        if (vErrors === null) {
          vErrors = [err6];
        } else {
          vErrors.push(err6);
        }
        errors++;
      }
      var _valid1 = _errs8 === errors;
      if (_valid1) {
        valid2 = true;
        passing1 = 0;
      }
      const _errs10 = errors;
      if (
        !validate63(data1, {
          instancePath: instancePath + '/position',
          parentData: data,
          parentDataProperty: 'position',
          rootData,
        })
      ) {
        vErrors = vErrors === null ? validate63.errors : vErrors.concat(validate63.errors);
        errors = vErrors.length;
      }
      var _valid1 = _errs10 === errors;
      if (_valid1 && valid2) {
        valid2 = false;
        passing1 = [passing1, 1];
      } else {
        if (_valid1) {
          valid2 = true;
          passing1 = 1;
        }
      }
      if (!valid2) {
        const err7 = {
          instancePath: instancePath + '/position',
          schemaPath: '#/properties/position/oneOf',
          keyword: 'oneOf',
          params: { passingSchemas: passing1 },
          message: 'must match exactly one schema in oneOf',
        };
        if (vErrors === null) {
          vErrors = [err7];
        } else {
          vErrors.push(err7);
        }
        errors++;
      } else {
        errors = _errs7;
        if (vErrors !== null) {
          if (_errs7) {
            vErrors.length = _errs7;
          } else {
            vErrors = null;
          }
        }
      }
    }
  } else {
    const err8 = {
      instancePath,
      schemaPath: '#/type',
      keyword: 'type',
      params: { type: 'object' },
      message: 'must be object',
    };
    if (vErrors === null) {
      vErrors = [err8];
    } else {
      vErrors.push(err8);
    }
    errors++;
  }
  validate137.errors = vErrors;
  return errors === 0;
}
function validate136(
  data,
  { instancePath = '', parentData, parentDataProperty, rootData = data } = {},
) {
  /*# sourceURL="https://www.designtokens.org/schemas/2025.10/format/values/gradient.json" */ let vErrors =
    null;
  let errors = 0;
  if (Array.isArray(data)) {
    if (data.length < 1) {
      const err0 = {
        instancePath,
        schemaPath: '#/minItems',
        keyword: 'minItems',
        params: { limit: 1 },
        message: 'must NOT have fewer than 1 items',
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    const len0 = data.length;
    for (let i0 = 0; i0 < len0; i0++) {
      let data0 = data[i0];
      const _errs2 = errors;
      let valid2 = false;
      let passing0 = null;
      const _errs3 = errors;
      if (
        !validate137(data0, {
          instancePath: instancePath + '/' + i0,
          parentData: data,
          parentDataProperty: i0,
          rootData,
        })
      ) {
        vErrors = vErrors === null ? validate137.errors : vErrors.concat(validate137.errors);
        errors = vErrors.length;
      }
      var _valid0 = _errs3 === errors;
      if (_valid0) {
        valid2 = true;
        passing0 = 0;
      }
      const _errs4 = errors;
      if (
        !validate63(data0, {
          instancePath: instancePath + '/' + i0,
          parentData: data,
          parentDataProperty: i0,
          rootData,
        })
      ) {
        vErrors = vErrors === null ? validate63.errors : vErrors.concat(validate63.errors);
        errors = vErrors.length;
      }
      var _valid0 = _errs4 === errors;
      if (_valid0 && valid2) {
        valid2 = false;
        passing0 = [passing0, 1];
      } else {
        if (_valid0) {
          valid2 = true;
          passing0 = 1;
        }
      }
      if (!valid2) {
        const err1 = {
          instancePath: instancePath + '/' + i0,
          schemaPath: '#/items/oneOf',
          keyword: 'oneOf',
          params: { passingSchemas: passing0 },
          message: 'must match exactly one schema in oneOf',
        };
        if (vErrors === null) {
          vErrors = [err1];
        } else {
          vErrors.push(err1);
        }
        errors++;
      } else {
        errors = _errs2;
        if (vErrors !== null) {
          if (_errs2) {
            vErrors.length = _errs2;
          } else {
            vErrors = null;
          }
        }
      }
    }
  } else {
    const err2 = {
      instancePath,
      schemaPath: '#/type',
      keyword: 'type',
      params: { type: 'array' },
      message: 'must be array',
    };
    if (vErrors === null) {
      vErrors = [err2];
    } else {
      vErrors.push(err2);
    }
    errors++;
  }
  validate136.errors = vErrors;
  return errors === 0;
}
const schema45 = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'https://www.designtokens.org/schemas/2025.10/format/values/typography.json',
  title: 'Typography Value',
  description: 'Value schema for typography type tokens. Represents a typographic style.',
  type: 'object',
  properties: {
    fontFamily: {
      description: "The typography's font",
      oneOf: [
        { $ref: 'https://www.designtokens.org/schemas/2025.10/format/values/fontFamily.json' },
        {
          $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/tokenValueReference',
        },
      ],
    },
    fontSize: {
      description: 'The size of the typography',
      oneOf: [
        { $ref: 'https://www.designtokens.org/schemas/2025.10/format/values/dimension.json' },
        {
          $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/tokenValueReference',
        },
      ],
    },
    fontWeight: {
      description: 'The weight of the typography',
      oneOf: [
        { $ref: 'https://www.designtokens.org/schemas/2025.10/format/values/fontWeight.json' },
        {
          $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/tokenValueReference',
        },
      ],
    },
    letterSpacing: {
      description: 'The horizontal spacing between characters',
      oneOf: [
        { $ref: 'https://www.designtokens.org/schemas/2025.10/format/values/dimension.json' },
        {
          $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/tokenValueReference',
        },
      ],
    },
    lineHeight: {
      description:
        'The vertical spacing between lines of typography (interpreted as a multiplier of fontSize)',
      oneOf: [
        { $ref: 'https://www.designtokens.org/schemas/2025.10/format/values/number.json' },
        {
          $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/tokenValueReference',
        },
      ],
    },
  },
  required: ['fontFamily', 'fontSize', 'fontWeight', 'letterSpacing', 'lineHeight'],
  additionalProperties: false,
};
function validate145(
  data,
  { instancePath = '', parentData, parentDataProperty, rootData = data } = {},
) {
  /*# sourceURL="https://www.designtokens.org/schemas/2025.10/format/values/typography.json" */ let vErrors =
    null;
  let errors = 0;
  if (data && typeof data == 'object' && !Array.isArray(data)) {
    if (data.fontFamily === undefined) {
      const err0 = {
        instancePath,
        schemaPath: '#/required',
        keyword: 'required',
        params: { missingProperty: 'fontFamily' },
        message: "must have required property '" + 'fontFamily' + "'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.fontSize === undefined) {
      const err1 = {
        instancePath,
        schemaPath: '#/required',
        keyword: 'required',
        params: { missingProperty: 'fontSize' },
        message: "must have required property '" + 'fontSize' + "'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.fontWeight === undefined) {
      const err2 = {
        instancePath,
        schemaPath: '#/required',
        keyword: 'required',
        params: { missingProperty: 'fontWeight' },
        message: "must have required property '" + 'fontWeight' + "'",
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.letterSpacing === undefined) {
      const err3 = {
        instancePath,
        schemaPath: '#/required',
        keyword: 'required',
        params: { missingProperty: 'letterSpacing' },
        message: "must have required property '" + 'letterSpacing' + "'",
      };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    if (data.lineHeight === undefined) {
      const err4 = {
        instancePath,
        schemaPath: '#/required',
        keyword: 'required',
        params: { missingProperty: 'lineHeight' },
        message: "must have required property '" + 'lineHeight' + "'",
      };
      if (vErrors === null) {
        vErrors = [err4];
      } else {
        vErrors.push(err4);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(
        key0 === 'fontFamily' ||
        key0 === 'fontSize' ||
        key0 === 'fontWeight' ||
        key0 === 'letterSpacing' ||
        key0 === 'lineHeight'
      )) {
        const err5 = {
          instancePath,
          schemaPath: '#/additionalProperties',
          keyword: 'additionalProperties',
          params: { additionalProperty: key0 },
          message: 'must NOT have additional properties',
        };
        if (vErrors === null) {
          vErrors = [err5];
        } else {
          vErrors.push(err5);
        }
        errors++;
      }
    }
    if (data.fontFamily !== undefined) {
      let data0 = data.fontFamily;
      const _errs3 = errors;
      let valid1 = false;
      let passing0 = null;
      const _errs4 = errors;
      if (
        !validate71(data0, {
          instancePath: instancePath + '/fontFamily',
          parentData: data,
          parentDataProperty: 'fontFamily',
          rootData,
        })
      ) {
        vErrors = vErrors === null ? validate71.errors : vErrors.concat(validate71.errors);
        errors = vErrors.length;
      }
      var _valid0 = _errs4 === errors;
      if (_valid0) {
        valid1 = true;
        passing0 = 0;
      }
      const _errs5 = errors;
      if (
        !validate63(data0, {
          instancePath: instancePath + '/fontFamily',
          parentData: data,
          parentDataProperty: 'fontFamily',
          rootData,
        })
      ) {
        vErrors = vErrors === null ? validate63.errors : vErrors.concat(validate63.errors);
        errors = vErrors.length;
      }
      var _valid0 = _errs5 === errors;
      if (_valid0 && valid1) {
        valid1 = false;
        passing0 = [passing0, 1];
      } else {
        if (_valid0) {
          valid1 = true;
          passing0 = 1;
        }
      }
      if (!valid1) {
        const err6 = {
          instancePath: instancePath + '/fontFamily',
          schemaPath: '#/properties/fontFamily/oneOf',
          keyword: 'oneOf',
          params: { passingSchemas: passing0 },
          message: 'must match exactly one schema in oneOf',
        };
        if (vErrors === null) {
          vErrors = [err6];
        } else {
          vErrors.push(err6);
        }
        errors++;
      } else {
        errors = _errs3;
        if (vErrors !== null) {
          if (_errs3) {
            vErrors.length = _errs3;
          } else {
            vErrors = null;
          }
        }
      }
    }
    if (data.fontSize !== undefined) {
      let data1 = data.fontSize;
      const _errs7 = errors;
      let valid2 = false;
      let passing1 = null;
      const _errs8 = errors;
      if (
        !validate66(data1, {
          instancePath: instancePath + '/fontSize',
          parentData: data,
          parentDataProperty: 'fontSize',
          rootData,
        })
      ) {
        vErrors = vErrors === null ? validate66.errors : vErrors.concat(validate66.errors);
        errors = vErrors.length;
      }
      var _valid1 = _errs8 === errors;
      if (_valid1) {
        valid2 = true;
        passing1 = 0;
      }
      const _errs9 = errors;
      if (
        !validate63(data1, {
          instancePath: instancePath + '/fontSize',
          parentData: data,
          parentDataProperty: 'fontSize',
          rootData,
        })
      ) {
        vErrors = vErrors === null ? validate63.errors : vErrors.concat(validate63.errors);
        errors = vErrors.length;
      }
      var _valid1 = _errs9 === errors;
      if (_valid1 && valid2) {
        valid2 = false;
        passing1 = [passing1, 1];
      } else {
        if (_valid1) {
          valid2 = true;
          passing1 = 1;
        }
      }
      if (!valid2) {
        const err7 = {
          instancePath: instancePath + '/fontSize',
          schemaPath: '#/properties/fontSize/oneOf',
          keyword: 'oneOf',
          params: { passingSchemas: passing1 },
          message: 'must match exactly one schema in oneOf',
        };
        if (vErrors === null) {
          vErrors = [err7];
        } else {
          vErrors.push(err7);
        }
        errors++;
      } else {
        errors = _errs7;
        if (vErrors !== null) {
          if (_errs7) {
            vErrors.length = _errs7;
          } else {
            vErrors = null;
          }
        }
      }
    }
    if (data.fontWeight !== undefined) {
      let data2 = data.fontWeight;
      const _errs11 = errors;
      let valid3 = false;
      let passing2 = null;
      const _errs12 = errors;
      const _errs14 = errors;
      let valid5 = false;
      let passing3 = null;
      const _errs15 = errors;
      if (typeof data2 == 'number') {
        if (data2 > 1000 || isNaN(data2)) {
          const err8 = {
            instancePath: instancePath + '/fontWeight',
            schemaPath:
              'https://www.designtokens.org/schemas/2025.10/format/values/fontWeight.json/oneOf/0/maximum',
            keyword: 'maximum',
            params: { comparison: '<=', limit: 1000 },
            message: 'must be <= 1000',
          };
          if (vErrors === null) {
            vErrors = [err8];
          } else {
            vErrors.push(err8);
          }
          errors++;
        }
        if (data2 < 1 || isNaN(data2)) {
          const err9 = {
            instancePath: instancePath + '/fontWeight',
            schemaPath:
              'https://www.designtokens.org/schemas/2025.10/format/values/fontWeight.json/oneOf/0/minimum',
            keyword: 'minimum',
            params: { comparison: '>=', limit: 1 },
            message: 'must be >= 1',
          };
          if (vErrors === null) {
            vErrors = [err9];
          } else {
            vErrors.push(err9);
          }
          errors++;
        }
      } else {
        const err10 = {
          instancePath: instancePath + '/fontWeight',
          schemaPath:
            'https://www.designtokens.org/schemas/2025.10/format/values/fontWeight.json/oneOf/0/type',
          keyword: 'type',
          params: { type: 'number' },
          message: 'must be number',
        };
        if (vErrors === null) {
          vErrors = [err10];
        } else {
          vErrors.push(err10);
        }
        errors++;
      }
      var _valid3 = _errs15 === errors;
      if (_valid3) {
        valid5 = true;
        passing3 = 0;
      }
      const _errs17 = errors;
      if (typeof data2 !== 'string') {
        const err11 = {
          instancePath: instancePath + '/fontWeight',
          schemaPath:
            'https://www.designtokens.org/schemas/2025.10/format/values/fontWeight.json/oneOf/1/type',
          keyword: 'type',
          params: { type: 'string' },
          message: 'must be string',
        };
        if (vErrors === null) {
          vErrors = [err11];
        } else {
          vErrors.push(err11);
        }
        errors++;
      }
      if (!(
        data2 === 'thin' ||
        data2 === 'hairline' ||
        data2 === 'extra-light' ||
        data2 === 'ultra-light' ||
        data2 === 'light' ||
        data2 === 'normal' ||
        data2 === 'regular' ||
        data2 === 'book' ||
        data2 === 'medium' ||
        data2 === 'semi-bold' ||
        data2 === 'demi-bold' ||
        data2 === 'bold' ||
        data2 === 'extra-bold' ||
        data2 === 'ultra-bold' ||
        data2 === 'black' ||
        data2 === 'heavy' ||
        data2 === 'extra-black' ||
        data2 === 'ultra-black'
      )) {
        const err12 = {
          instancePath: instancePath + '/fontWeight',
          schemaPath:
            'https://www.designtokens.org/schemas/2025.10/format/values/fontWeight.json/oneOf/1/enum',
          keyword: 'enum',
          params: { allowedValues: schema32.oneOf[1].enum },
          message: 'must be equal to one of the allowed values',
        };
        if (vErrors === null) {
          vErrors = [err12];
        } else {
          vErrors.push(err12);
        }
        errors++;
      }
      var _valid3 = _errs17 === errors;
      if (_valid3 && valid5) {
        valid5 = false;
        passing3 = [passing3, 1];
      } else {
        if (_valid3) {
          valid5 = true;
          passing3 = 1;
        }
      }
      if (!valid5) {
        const err13 = {
          instancePath: instancePath + '/fontWeight',
          schemaPath:
            'https://www.designtokens.org/schemas/2025.10/format/values/fontWeight.json/oneOf',
          keyword: 'oneOf',
          params: { passingSchemas: passing3 },
          message: 'must match exactly one schema in oneOf',
        };
        if (vErrors === null) {
          vErrors = [err13];
        } else {
          vErrors.push(err13);
        }
        errors++;
      } else {
        errors = _errs14;
        if (vErrors !== null) {
          if (_errs14) {
            vErrors.length = _errs14;
          } else {
            vErrors = null;
          }
        }
      }
      var _valid2 = _errs12 === errors;
      if (_valid2) {
        valid3 = true;
        passing2 = 0;
      }
      const _errs19 = errors;
      if (
        !validate63(data2, {
          instancePath: instancePath + '/fontWeight',
          parentData: data,
          parentDataProperty: 'fontWeight',
          rootData,
        })
      ) {
        vErrors = vErrors === null ? validate63.errors : vErrors.concat(validate63.errors);
        errors = vErrors.length;
      }
      var _valid2 = _errs19 === errors;
      if (_valid2 && valid3) {
        valid3 = false;
        passing2 = [passing2, 1];
      } else {
        if (_valid2) {
          valid3 = true;
          passing2 = 1;
        }
      }
      if (!valid3) {
        const err14 = {
          instancePath: instancePath + '/fontWeight',
          schemaPath: '#/properties/fontWeight/oneOf',
          keyword: 'oneOf',
          params: { passingSchemas: passing2 },
          message: 'must match exactly one schema in oneOf',
        };
        if (vErrors === null) {
          vErrors = [err14];
        } else {
          vErrors.push(err14);
        }
        errors++;
      } else {
        errors = _errs11;
        if (vErrors !== null) {
          if (_errs11) {
            vErrors.length = _errs11;
          } else {
            vErrors = null;
          }
        }
      }
    }
    if (data.letterSpacing !== undefined) {
      let data3 = data.letterSpacing;
      const _errs21 = errors;
      let valid6 = false;
      let passing4 = null;
      const _errs22 = errors;
      if (
        !validate66(data3, {
          instancePath: instancePath + '/letterSpacing',
          parentData: data,
          parentDataProperty: 'letterSpacing',
          rootData,
        })
      ) {
        vErrors = vErrors === null ? validate66.errors : vErrors.concat(validate66.errors);
        errors = vErrors.length;
      }
      var _valid4 = _errs22 === errors;
      if (_valid4) {
        valid6 = true;
        passing4 = 0;
      }
      const _errs23 = errors;
      if (
        !validate63(data3, {
          instancePath: instancePath + '/letterSpacing',
          parentData: data,
          parentDataProperty: 'letterSpacing',
          rootData,
        })
      ) {
        vErrors = vErrors === null ? validate63.errors : vErrors.concat(validate63.errors);
        errors = vErrors.length;
      }
      var _valid4 = _errs23 === errors;
      if (_valid4 && valid6) {
        valid6 = false;
        passing4 = [passing4, 1];
      } else {
        if (_valid4) {
          valid6 = true;
          passing4 = 1;
        }
      }
      if (!valid6) {
        const err15 = {
          instancePath: instancePath + '/letterSpacing',
          schemaPath: '#/properties/letterSpacing/oneOf',
          keyword: 'oneOf',
          params: { passingSchemas: passing4 },
          message: 'must match exactly one schema in oneOf',
        };
        if (vErrors === null) {
          vErrors = [err15];
        } else {
          vErrors.push(err15);
        }
        errors++;
      } else {
        errors = _errs21;
        if (vErrors !== null) {
          if (_errs21) {
            vErrors.length = _errs21;
          } else {
            vErrors = null;
          }
        }
      }
    }
    if (data.lineHeight !== undefined) {
      let data4 = data.lineHeight;
      const _errs25 = errors;
      let valid7 = false;
      let passing5 = null;
      const _errs26 = errors;
      if (!(typeof data4 == 'number')) {
        const err16 = {
          instancePath: instancePath + '/lineHeight',
          schemaPath: 'https://www.designtokens.org/schemas/2025.10/format/values/number.json/type',
          keyword: 'type',
          params: { type: 'number' },
          message: 'must be number',
        };
        if (vErrors === null) {
          vErrors = [err16];
        } else {
          vErrors.push(err16);
        }
        errors++;
      }
      var _valid5 = _errs26 === errors;
      if (_valid5) {
        valid7 = true;
        passing5 = 0;
      }
      const _errs29 = errors;
      if (
        !validate63(data4, {
          instancePath: instancePath + '/lineHeight',
          parentData: data,
          parentDataProperty: 'lineHeight',
          rootData,
        })
      ) {
        vErrors = vErrors === null ? validate63.errors : vErrors.concat(validate63.errors);
        errors = vErrors.length;
      }
      var _valid5 = _errs29 === errors;
      if (_valid5 && valid7) {
        valid7 = false;
        passing5 = [passing5, 1];
      } else {
        if (_valid5) {
          valid7 = true;
          passing5 = 1;
        }
      }
      if (!valid7) {
        const err17 = {
          instancePath: instancePath + '/lineHeight',
          schemaPath: '#/properties/lineHeight/oneOf',
          keyword: 'oneOf',
          params: { passingSchemas: passing5 },
          message: 'must match exactly one schema in oneOf',
        };
        if (vErrors === null) {
          vErrors = [err17];
        } else {
          vErrors.push(err17);
        }
        errors++;
      } else {
        errors = _errs25;
        if (vErrors !== null) {
          if (_errs25) {
            vErrors.length = _errs25;
          } else {
            vErrors = null;
          }
        }
      }
    }
  } else {
    const err18 = {
      instancePath,
      schemaPath: '#/type',
      keyword: 'type',
      params: { type: 'object' },
      message: 'must be object',
    };
    if (vErrors === null) {
      vErrors = [err18];
    } else {
      vErrors.push(err18);
    }
    errors++;
  }
  validate145.errors = vErrors;
  return errors === 0;
}
function validate11(
  data,
  { instancePath = '', parentData, parentDataProperty, rootData = data } = {},
) {
  /*# sourceURL="https://www.designtokens.org/schemas/2025.10/format/token.json" */ let vErrors =
    null;
  let errors = 0;
  const _errs2 = errors;
  let valid1 = true;
  const _errs3 = errors;
  if (data && typeof data == 'object' && !Array.isArray(data)) {
    let missing0;
    if (data.$value === undefined && (missing0 = '$value')) {
      const err0 = {};
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
  }
  var _valid0 = _errs3 === errors;
  errors = _errs2;
  if (vErrors !== null) {
    if (_errs2) {
      vErrors.length = _errs2;
    } else {
      vErrors = null;
    }
  }
  let ifClause0;
  if (_valid0) {
    const _errs4 = errors;
    const _errs5 = errors;
    const _errs6 = errors;
    if (data && typeof data == 'object' && !Array.isArray(data)) {
      let missing1;
      if (data.$ref === undefined && (missing1 = '$ref')) {
        const err1 = {};
        if (vErrors === null) {
          vErrors = [err1];
        } else {
          vErrors.push(err1);
        }
        errors++;
      }
    }
    var valid2 = _errs6 === errors;
    if (valid2) {
      const err2 = {
        instancePath,
        schemaPath: '#/allOf/0/then/not',
        keyword: 'not',
        params: {},
        message: 'must NOT be valid',
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    } else {
      errors = _errs5;
      if (vErrors !== null) {
        if (_errs5) {
          vErrors.length = _errs5;
        } else {
          vErrors = null;
        }
      }
    }
    var _valid0 = _errs4 === errors;
    valid1 = _valid0;
    ifClause0 = 'then';
  } else {
    const _errs7 = errors;
    if (data && typeof data == 'object' && !Array.isArray(data)) {
      if (data.$ref === undefined) {
        const err3 = {
          instancePath,
          schemaPath: '#/allOf/0/else/required',
          keyword: 'required',
          params: { missingProperty: '$ref' },
          message: "must have required property '" + '$ref' + "'",
        };
        if (vErrors === null) {
          vErrors = [err3];
        } else {
          vErrors.push(err3);
        }
        errors++;
      }
    }
    var _valid0 = _errs7 === errors;
    valid1 = _valid0;
    ifClause0 = 'else';
  }
  if (!valid1) {
    const err4 = {
      instancePath,
      schemaPath: '#/allOf/0/if',
      keyword: 'if',
      params: { failingKeyword: ifClause0 },
      message: 'must match "' + ifClause0 + '" schema',
    };
    if (vErrors === null) {
      vErrors = [err4];
    } else {
      vErrors.push(err4);
    }
    errors++;
  }
  const _errs9 = errors;
  let valid3 = true;
  const _errs10 = errors;
  if (data && typeof data == 'object' && !Array.isArray(data)) {
    let missing2;
    if (data.$type === undefined && (missing2 = '$type')) {
      const err5 = {};
      if (vErrors === null) {
        vErrors = [err5];
      } else {
        vErrors.push(err5);
      }
      errors++;
    } else {
      if (data.$type !== undefined) {
        if ('color' !== data.$type) {
          const err6 = {};
          if (vErrors === null) {
            vErrors = [err6];
          } else {
            vErrors.push(err6);
          }
          errors++;
        }
      }
    }
  }
  var _valid1 = _errs10 === errors;
  errors = _errs9;
  if (vErrors !== null) {
    if (_errs9) {
      vErrors.length = _errs9;
    } else {
      vErrors = null;
    }
  }
  if (_valid1) {
    const _errs12 = errors;
    if (data && typeof data == 'object' && !Array.isArray(data)) {
      if (data.$value !== undefined) {
        let data1 = data.$value;
        const _errs14 = errors;
        let valid6 = false;
        let passing0 = null;
        const _errs15 = errors;
        if (
          !validate12(data1, {
            instancePath: instancePath + '/$value',
            parentData: data,
            parentDataProperty: '$value',
            rootData,
          })
        ) {
          vErrors = vErrors === null ? validate12.errors : vErrors.concat(validate12.errors);
          errors = vErrors.length;
        }
        var _valid2 = _errs15 === errors;
        if (_valid2) {
          valid6 = true;
          passing0 = 0;
        }
        const _errs16 = errors;
        if (
          !validate63(data1, {
            instancePath: instancePath + '/$value',
            parentData: data,
            parentDataProperty: '$value',
            rootData,
          })
        ) {
          vErrors = vErrors === null ? validate63.errors : vErrors.concat(validate63.errors);
          errors = vErrors.length;
        }
        var _valid2 = _errs16 === errors;
        if (_valid2 && valid6) {
          valid6 = false;
          passing0 = [passing0, 1];
        } else {
          if (_valid2) {
            valid6 = true;
            passing0 = 1;
          }
        }
        if (!valid6) {
          const err7 = {
            instancePath: instancePath + '/$value',
            schemaPath: '#/allOf/1/then/properties/%24value/oneOf',
            keyword: 'oneOf',
            params: { passingSchemas: passing0 },
            message: 'must match exactly one schema in oneOf',
          };
          if (vErrors === null) {
            vErrors = [err7];
          } else {
            vErrors.push(err7);
          }
          errors++;
        } else {
          errors = _errs14;
          if (vErrors !== null) {
            if (_errs14) {
              vErrors.length = _errs14;
            } else {
              vErrors = null;
            }
          }
        }
      }
    }
    var _valid1 = _errs12 === errors;
    valid3 = _valid1;
  }
  if (!valid3) {
    const err8 = {
      instancePath,
      schemaPath: '#/allOf/1/if',
      keyword: 'if',
      params: { failingKeyword: 'then' },
      message: 'must match "then" schema',
    };
    if (vErrors === null) {
      vErrors = [err8];
    } else {
      vErrors.push(err8);
    }
    errors++;
  }
  const _errs18 = errors;
  let valid7 = true;
  const _errs19 = errors;
  if (data && typeof data == 'object' && !Array.isArray(data)) {
    let missing3;
    if (data.$type === undefined && (missing3 = '$type')) {
      const err9 = {};
      if (vErrors === null) {
        vErrors = [err9];
      } else {
        vErrors.push(err9);
      }
      errors++;
    } else {
      if (data.$type !== undefined) {
        if ('dimension' !== data.$type) {
          const err10 = {};
          if (vErrors === null) {
            vErrors = [err10];
          } else {
            vErrors.push(err10);
          }
          errors++;
        }
      }
    }
  }
  var _valid3 = _errs19 === errors;
  errors = _errs18;
  if (vErrors !== null) {
    if (_errs18) {
      vErrors.length = _errs18;
    } else {
      vErrors = null;
    }
  }
  if (_valid3) {
    const _errs21 = errors;
    if (data && typeof data == 'object' && !Array.isArray(data)) {
      if (data.$value !== undefined) {
        let data3 = data.$value;
        const _errs23 = errors;
        let valid10 = false;
        let passing1 = null;
        const _errs24 = errors;
        if (
          !validate66(data3, {
            instancePath: instancePath + '/$value',
            parentData: data,
            parentDataProperty: '$value',
            rootData,
          })
        ) {
          vErrors = vErrors === null ? validate66.errors : vErrors.concat(validate66.errors);
          errors = vErrors.length;
        }
        var _valid4 = _errs24 === errors;
        if (_valid4) {
          valid10 = true;
          passing1 = 0;
        }
        const _errs25 = errors;
        if (
          !validate63(data3, {
            instancePath: instancePath + '/$value',
            parentData: data,
            parentDataProperty: '$value',
            rootData,
          })
        ) {
          vErrors = vErrors === null ? validate63.errors : vErrors.concat(validate63.errors);
          errors = vErrors.length;
        }
        var _valid4 = _errs25 === errors;
        if (_valid4 && valid10) {
          valid10 = false;
          passing1 = [passing1, 1];
        } else {
          if (_valid4) {
            valid10 = true;
            passing1 = 1;
          }
        }
        if (!valid10) {
          const err11 = {
            instancePath: instancePath + '/$value',
            schemaPath: '#/allOf/2/then/properties/%24value/oneOf',
            keyword: 'oneOf',
            params: { passingSchemas: passing1 },
            message: 'must match exactly one schema in oneOf',
          };
          if (vErrors === null) {
            vErrors = [err11];
          } else {
            vErrors.push(err11);
          }
          errors++;
        } else {
          errors = _errs23;
          if (vErrors !== null) {
            if (_errs23) {
              vErrors.length = _errs23;
            } else {
              vErrors = null;
            }
          }
        }
      }
    }
    var _valid3 = _errs21 === errors;
    valid7 = _valid3;
  }
  if (!valid7) {
    const err12 = {
      instancePath,
      schemaPath: '#/allOf/2/if',
      keyword: 'if',
      params: { failingKeyword: 'then' },
      message: 'must match "then" schema',
    };
    if (vErrors === null) {
      vErrors = [err12];
    } else {
      vErrors.push(err12);
    }
    errors++;
  }
  const _errs27 = errors;
  let valid11 = true;
  const _errs28 = errors;
  if (data && typeof data == 'object' && !Array.isArray(data)) {
    let missing4;
    if (data.$type === undefined && (missing4 = '$type')) {
      const err13 = {};
      if (vErrors === null) {
        vErrors = [err13];
      } else {
        vErrors.push(err13);
      }
      errors++;
    } else {
      if (data.$type !== undefined) {
        if ('fontFamily' !== data.$type) {
          const err14 = {};
          if (vErrors === null) {
            vErrors = [err14];
          } else {
            vErrors.push(err14);
          }
          errors++;
        }
      }
    }
  }
  var _valid5 = _errs28 === errors;
  errors = _errs27;
  if (vErrors !== null) {
    if (_errs27) {
      vErrors.length = _errs27;
    } else {
      vErrors = null;
    }
  }
  if (_valid5) {
    const _errs30 = errors;
    if (data && typeof data == 'object' && !Array.isArray(data)) {
      if (data.$value !== undefined) {
        let data5 = data.$value;
        const _errs32 = errors;
        let valid14 = false;
        let passing2 = null;
        const _errs33 = errors;
        if (
          !validate71(data5, {
            instancePath: instancePath + '/$value',
            parentData: data,
            parentDataProperty: '$value',
            rootData,
          })
        ) {
          vErrors = vErrors === null ? validate71.errors : vErrors.concat(validate71.errors);
          errors = vErrors.length;
        }
        var _valid6 = _errs33 === errors;
        if (_valid6) {
          valid14 = true;
          passing2 = 0;
        }
        const _errs34 = errors;
        if (
          !validate63(data5, {
            instancePath: instancePath + '/$value',
            parentData: data,
            parentDataProperty: '$value',
            rootData,
          })
        ) {
          vErrors = vErrors === null ? validate63.errors : vErrors.concat(validate63.errors);
          errors = vErrors.length;
        }
        var _valid6 = _errs34 === errors;
        if (_valid6 && valid14) {
          valid14 = false;
          passing2 = [passing2, 1];
        } else {
          if (_valid6) {
            valid14 = true;
            passing2 = 1;
          }
        }
        if (!valid14) {
          const err15 = {
            instancePath: instancePath + '/$value',
            schemaPath: '#/allOf/3/then/properties/%24value/oneOf',
            keyword: 'oneOf',
            params: { passingSchemas: passing2 },
            message: 'must match exactly one schema in oneOf',
          };
          if (vErrors === null) {
            vErrors = [err15];
          } else {
            vErrors.push(err15);
          }
          errors++;
        } else {
          errors = _errs32;
          if (vErrors !== null) {
            if (_errs32) {
              vErrors.length = _errs32;
            } else {
              vErrors = null;
            }
          }
        }
      }
    }
    var _valid5 = _errs30 === errors;
    valid11 = _valid5;
  }
  if (!valid11) {
    const err16 = {
      instancePath,
      schemaPath: '#/allOf/3/if',
      keyword: 'if',
      params: { failingKeyword: 'then' },
      message: 'must match "then" schema',
    };
    if (vErrors === null) {
      vErrors = [err16];
    } else {
      vErrors.push(err16);
    }
    errors++;
  }
  const _errs36 = errors;
  let valid15 = true;
  const _errs37 = errors;
  if (data && typeof data == 'object' && !Array.isArray(data)) {
    let missing5;
    if (data.$type === undefined && (missing5 = '$type')) {
      const err17 = {};
      if (vErrors === null) {
        vErrors = [err17];
      } else {
        vErrors.push(err17);
      }
      errors++;
    } else {
      if (data.$type !== undefined) {
        if ('fontWeight' !== data.$type) {
          const err18 = {};
          if (vErrors === null) {
            vErrors = [err18];
          } else {
            vErrors.push(err18);
          }
          errors++;
        }
      }
    }
  }
  var _valid7 = _errs37 === errors;
  errors = _errs36;
  if (vErrors !== null) {
    if (_errs36) {
      vErrors.length = _errs36;
    } else {
      vErrors = null;
    }
  }
  if (_valid7) {
    const _errs39 = errors;
    if (data && typeof data == 'object' && !Array.isArray(data)) {
      if (data.$value !== undefined) {
        let data7 = data.$value;
        const _errs41 = errors;
        let valid18 = false;
        let passing3 = null;
        const _errs42 = errors;
        const _errs44 = errors;
        let valid20 = false;
        let passing4 = null;
        const _errs45 = errors;
        if (typeof data7 == 'number') {
          if (data7 > 1000 || isNaN(data7)) {
            const err19 = {
              instancePath: instancePath + '/$value',
              schemaPath:
                'https://www.designtokens.org/schemas/2025.10/format/values/fontWeight.json/oneOf/0/maximum',
              keyword: 'maximum',
              params: { comparison: '<=', limit: 1000 },
              message: 'must be <= 1000',
            };
            if (vErrors === null) {
              vErrors = [err19];
            } else {
              vErrors.push(err19);
            }
            errors++;
          }
          if (data7 < 1 || isNaN(data7)) {
            const err20 = {
              instancePath: instancePath + '/$value',
              schemaPath:
                'https://www.designtokens.org/schemas/2025.10/format/values/fontWeight.json/oneOf/0/minimum',
              keyword: 'minimum',
              params: { comparison: '>=', limit: 1 },
              message: 'must be >= 1',
            };
            if (vErrors === null) {
              vErrors = [err20];
            } else {
              vErrors.push(err20);
            }
            errors++;
          }
        } else {
          const err21 = {
            instancePath: instancePath + '/$value',
            schemaPath:
              'https://www.designtokens.org/schemas/2025.10/format/values/fontWeight.json/oneOf/0/type',
            keyword: 'type',
            params: { type: 'number' },
            message: 'must be number',
          };
          if (vErrors === null) {
            vErrors = [err21];
          } else {
            vErrors.push(err21);
          }
          errors++;
        }
        var _valid9 = _errs45 === errors;
        if (_valid9) {
          valid20 = true;
          passing4 = 0;
        }
        const _errs47 = errors;
        if (typeof data7 !== 'string') {
          const err22 = {
            instancePath: instancePath + '/$value',
            schemaPath:
              'https://www.designtokens.org/schemas/2025.10/format/values/fontWeight.json/oneOf/1/type',
            keyword: 'type',
            params: { type: 'string' },
            message: 'must be string',
          };
          if (vErrors === null) {
            vErrors = [err22];
          } else {
            vErrors.push(err22);
          }
          errors++;
        }
        if (!(
          data7 === 'thin' ||
          data7 === 'hairline' ||
          data7 === 'extra-light' ||
          data7 === 'ultra-light' ||
          data7 === 'light' ||
          data7 === 'normal' ||
          data7 === 'regular' ||
          data7 === 'book' ||
          data7 === 'medium' ||
          data7 === 'semi-bold' ||
          data7 === 'demi-bold' ||
          data7 === 'bold' ||
          data7 === 'extra-bold' ||
          data7 === 'ultra-bold' ||
          data7 === 'black' ||
          data7 === 'heavy' ||
          data7 === 'extra-black' ||
          data7 === 'ultra-black'
        )) {
          const err23 = {
            instancePath: instancePath + '/$value',
            schemaPath:
              'https://www.designtokens.org/schemas/2025.10/format/values/fontWeight.json/oneOf/1/enum',
            keyword: 'enum',
            params: { allowedValues: schema32.oneOf[1].enum },
            message: 'must be equal to one of the allowed values',
          };
          if (vErrors === null) {
            vErrors = [err23];
          } else {
            vErrors.push(err23);
          }
          errors++;
        }
        var _valid9 = _errs47 === errors;
        if (_valid9 && valid20) {
          valid20 = false;
          passing4 = [passing4, 1];
        } else {
          if (_valid9) {
            valid20 = true;
            passing4 = 1;
          }
        }
        if (!valid20) {
          const err24 = {
            instancePath: instancePath + '/$value',
            schemaPath:
              'https://www.designtokens.org/schemas/2025.10/format/values/fontWeight.json/oneOf',
            keyword: 'oneOf',
            params: { passingSchemas: passing4 },
            message: 'must match exactly one schema in oneOf',
          };
          if (vErrors === null) {
            vErrors = [err24];
          } else {
            vErrors.push(err24);
          }
          errors++;
        } else {
          errors = _errs44;
          if (vErrors !== null) {
            if (_errs44) {
              vErrors.length = _errs44;
            } else {
              vErrors = null;
            }
          }
        }
        var _valid8 = _errs42 === errors;
        if (_valid8) {
          valid18 = true;
          passing3 = 0;
        }
        const _errs49 = errors;
        if (
          !validate63(data7, {
            instancePath: instancePath + '/$value',
            parentData: data,
            parentDataProperty: '$value',
            rootData,
          })
        ) {
          vErrors = vErrors === null ? validate63.errors : vErrors.concat(validate63.errors);
          errors = vErrors.length;
        }
        var _valid8 = _errs49 === errors;
        if (_valid8 && valid18) {
          valid18 = false;
          passing3 = [passing3, 1];
        } else {
          if (_valid8) {
            valid18 = true;
            passing3 = 1;
          }
        }
        if (!valid18) {
          const err25 = {
            instancePath: instancePath + '/$value',
            schemaPath: '#/allOf/4/then/properties/%24value/oneOf',
            keyword: 'oneOf',
            params: { passingSchemas: passing3 },
            message: 'must match exactly one schema in oneOf',
          };
          if (vErrors === null) {
            vErrors = [err25];
          } else {
            vErrors.push(err25);
          }
          errors++;
        } else {
          errors = _errs41;
          if (vErrors !== null) {
            if (_errs41) {
              vErrors.length = _errs41;
            } else {
              vErrors = null;
            }
          }
        }
      }
    }
    var _valid7 = _errs39 === errors;
    valid15 = _valid7;
  }
  if (!valid15) {
    const err26 = {
      instancePath,
      schemaPath: '#/allOf/4/if',
      keyword: 'if',
      params: { failingKeyword: 'then' },
      message: 'must match "then" schema',
    };
    if (vErrors === null) {
      vErrors = [err26];
    } else {
      vErrors.push(err26);
    }
    errors++;
  }
  const _errs51 = errors;
  let valid21 = true;
  const _errs52 = errors;
  if (data && typeof data == 'object' && !Array.isArray(data)) {
    let missing6;
    if (data.$type === undefined && (missing6 = '$type')) {
      const err27 = {};
      if (vErrors === null) {
        vErrors = [err27];
      } else {
        vErrors.push(err27);
      }
      errors++;
    } else {
      if (data.$type !== undefined) {
        if ('duration' !== data.$type) {
          const err28 = {};
          if (vErrors === null) {
            vErrors = [err28];
          } else {
            vErrors.push(err28);
          }
          errors++;
        }
      }
    }
  }
  var _valid10 = _errs52 === errors;
  errors = _errs51;
  if (vErrors !== null) {
    if (_errs51) {
      vErrors.length = _errs51;
    } else {
      vErrors = null;
    }
  }
  if (_valid10) {
    const _errs54 = errors;
    if (data && typeof data == 'object' && !Array.isArray(data)) {
      if (data.$value !== undefined) {
        let data9 = data.$value;
        const _errs56 = errors;
        let valid24 = false;
        let passing5 = null;
        const _errs57 = errors;
        if (
          !validate76(data9, {
            instancePath: instancePath + '/$value',
            parentData: data,
            parentDataProperty: '$value',
            rootData,
          })
        ) {
          vErrors = vErrors === null ? validate76.errors : vErrors.concat(validate76.errors);
          errors = vErrors.length;
        }
        var _valid11 = _errs57 === errors;
        if (_valid11) {
          valid24 = true;
          passing5 = 0;
        }
        const _errs58 = errors;
        if (
          !validate63(data9, {
            instancePath: instancePath + '/$value',
            parentData: data,
            parentDataProperty: '$value',
            rootData,
          })
        ) {
          vErrors = vErrors === null ? validate63.errors : vErrors.concat(validate63.errors);
          errors = vErrors.length;
        }
        var _valid11 = _errs58 === errors;
        if (_valid11 && valid24) {
          valid24 = false;
          passing5 = [passing5, 1];
        } else {
          if (_valid11) {
            valid24 = true;
            passing5 = 1;
          }
        }
        if (!valid24) {
          const err29 = {
            instancePath: instancePath + '/$value',
            schemaPath: '#/allOf/5/then/properties/%24value/oneOf',
            keyword: 'oneOf',
            params: { passingSchemas: passing5 },
            message: 'must match exactly one schema in oneOf',
          };
          if (vErrors === null) {
            vErrors = [err29];
          } else {
            vErrors.push(err29);
          }
          errors++;
        } else {
          errors = _errs56;
          if (vErrors !== null) {
            if (_errs56) {
              vErrors.length = _errs56;
            } else {
              vErrors = null;
            }
          }
        }
      }
    }
    var _valid10 = _errs54 === errors;
    valid21 = _valid10;
  }
  if (!valid21) {
    const err30 = {
      instancePath,
      schemaPath: '#/allOf/5/if',
      keyword: 'if',
      params: { failingKeyword: 'then' },
      message: 'must match "then" schema',
    };
    if (vErrors === null) {
      vErrors = [err30];
    } else {
      vErrors.push(err30);
    }
    errors++;
  }
  const _errs60 = errors;
  let valid25 = true;
  const _errs61 = errors;
  if (data && typeof data == 'object' && !Array.isArray(data)) {
    let missing7;
    if (data.$type === undefined && (missing7 = '$type')) {
      const err31 = {};
      if (vErrors === null) {
        vErrors = [err31];
      } else {
        vErrors.push(err31);
      }
      errors++;
    } else {
      if (data.$type !== undefined) {
        if ('cubicBezier' !== data.$type) {
          const err32 = {};
          if (vErrors === null) {
            vErrors = [err32];
          } else {
            vErrors.push(err32);
          }
          errors++;
        }
      }
    }
  }
  var _valid12 = _errs61 === errors;
  errors = _errs60;
  if (vErrors !== null) {
    if (_errs60) {
      vErrors.length = _errs60;
    } else {
      vErrors = null;
    }
  }
  if (_valid12) {
    const _errs63 = errors;
    if (data && typeof data == 'object' && !Array.isArray(data)) {
      if (data.$value !== undefined) {
        let data11 = data.$value;
        const _errs65 = errors;
        let valid28 = false;
        let passing6 = null;
        const _errs66 = errors;
        if (
          !validate81(data11, {
            instancePath: instancePath + '/$value',
            parentData: data,
            parentDataProperty: '$value',
            rootData,
          })
        ) {
          vErrors = vErrors === null ? validate81.errors : vErrors.concat(validate81.errors);
          errors = vErrors.length;
        }
        var _valid13 = _errs66 === errors;
        if (_valid13) {
          valid28 = true;
          passing6 = 0;
        }
        const _errs67 = errors;
        if (
          !validate63(data11, {
            instancePath: instancePath + '/$value',
            parentData: data,
            parentDataProperty: '$value',
            rootData,
          })
        ) {
          vErrors = vErrors === null ? validate63.errors : vErrors.concat(validate63.errors);
          errors = vErrors.length;
        }
        var _valid13 = _errs67 === errors;
        if (_valid13 && valid28) {
          valid28 = false;
          passing6 = [passing6, 1];
        } else {
          if (_valid13) {
            valid28 = true;
            passing6 = 1;
          }
        }
        if (!valid28) {
          const err33 = {
            instancePath: instancePath + '/$value',
            schemaPath: '#/allOf/6/then/properties/%24value/oneOf',
            keyword: 'oneOf',
            params: { passingSchemas: passing6 },
            message: 'must match exactly one schema in oneOf',
          };
          if (vErrors === null) {
            vErrors = [err33];
          } else {
            vErrors.push(err33);
          }
          errors++;
        } else {
          errors = _errs65;
          if (vErrors !== null) {
            if (_errs65) {
              vErrors.length = _errs65;
            } else {
              vErrors = null;
            }
          }
        }
      }
    }
    var _valid12 = _errs63 === errors;
    valid25 = _valid12;
  }
  if (!valid25) {
    const err34 = {
      instancePath,
      schemaPath: '#/allOf/6/if',
      keyword: 'if',
      params: { failingKeyword: 'then' },
      message: 'must match "then" schema',
    };
    if (vErrors === null) {
      vErrors = [err34];
    } else {
      vErrors.push(err34);
    }
    errors++;
  }
  const _errs69 = errors;
  let valid29 = true;
  const _errs70 = errors;
  if (data && typeof data == 'object' && !Array.isArray(data)) {
    let missing8;
    if (data.$type === undefined && (missing8 = '$type')) {
      const err35 = {};
      if (vErrors === null) {
        vErrors = [err35];
      } else {
        vErrors.push(err35);
      }
      errors++;
    } else {
      if (data.$type !== undefined) {
        if ('number' !== data.$type) {
          const err36 = {};
          if (vErrors === null) {
            vErrors = [err36];
          } else {
            vErrors.push(err36);
          }
          errors++;
        }
      }
    }
  }
  var _valid14 = _errs70 === errors;
  errors = _errs69;
  if (vErrors !== null) {
    if (_errs69) {
      vErrors.length = _errs69;
    } else {
      vErrors = null;
    }
  }
  if (_valid14) {
    const _errs72 = errors;
    if (data && typeof data == 'object' && !Array.isArray(data)) {
      if (data.$value !== undefined) {
        let data13 = data.$value;
        const _errs74 = errors;
        let valid32 = false;
        let passing7 = null;
        const _errs75 = errors;
        if (!(typeof data13 == 'number')) {
          const err37 = {
            instancePath: instancePath + '/$value',
            schemaPath:
              'https://www.designtokens.org/schemas/2025.10/format/values/number.json/type',
            keyword: 'type',
            params: { type: 'number' },
            message: 'must be number',
          };
          if (vErrors === null) {
            vErrors = [err37];
          } else {
            vErrors.push(err37);
          }
          errors++;
        }
        var _valid15 = _errs75 === errors;
        if (_valid15) {
          valid32 = true;
          passing7 = 0;
        }
        const _errs78 = errors;
        if (
          !validate63(data13, {
            instancePath: instancePath + '/$value',
            parentData: data,
            parentDataProperty: '$value',
            rootData,
          })
        ) {
          vErrors = vErrors === null ? validate63.errors : vErrors.concat(validate63.errors);
          errors = vErrors.length;
        }
        var _valid15 = _errs78 === errors;
        if (_valid15 && valid32) {
          valid32 = false;
          passing7 = [passing7, 1];
        } else {
          if (_valid15) {
            valid32 = true;
            passing7 = 1;
          }
        }
        if (!valid32) {
          const err38 = {
            instancePath: instancePath + '/$value',
            schemaPath: '#/allOf/7/then/properties/%24value/oneOf',
            keyword: 'oneOf',
            params: { passingSchemas: passing7 },
            message: 'must match exactly one schema in oneOf',
          };
          if (vErrors === null) {
            vErrors = [err38];
          } else {
            vErrors.push(err38);
          }
          errors++;
        } else {
          errors = _errs74;
          if (vErrors !== null) {
            if (_errs74) {
              vErrors.length = _errs74;
            } else {
              vErrors = null;
            }
          }
        }
      }
    }
    var _valid14 = _errs72 === errors;
    valid29 = _valid14;
  }
  if (!valid29) {
    const err39 = {
      instancePath,
      schemaPath: '#/allOf/7/if',
      keyword: 'if',
      params: { failingKeyword: 'then' },
      message: 'must match "then" schema',
    };
    if (vErrors === null) {
      vErrors = [err39];
    } else {
      vErrors.push(err39);
    }
    errors++;
  }
  const _errs80 = errors;
  let valid34 = true;
  const _errs81 = errors;
  if (data && typeof data == 'object' && !Array.isArray(data)) {
    let missing9;
    if (data.$type === undefined && (missing9 = '$type')) {
      const err40 = {};
      if (vErrors === null) {
        vErrors = [err40];
      } else {
        vErrors.push(err40);
      }
      errors++;
    } else {
      if (data.$type !== undefined) {
        if ('strokeStyle' !== data.$type) {
          const err41 = {};
          if (vErrors === null) {
            vErrors = [err41];
          } else {
            vErrors.push(err41);
          }
          errors++;
        }
      }
    }
  }
  var _valid16 = _errs81 === errors;
  errors = _errs80;
  if (vErrors !== null) {
    if (_errs80) {
      vErrors.length = _errs80;
    } else {
      vErrors = null;
    }
  }
  if (_valid16) {
    const _errs83 = errors;
    if (data && typeof data == 'object' && !Array.isArray(data)) {
      if (data.$value !== undefined) {
        let data15 = data.$value;
        const _errs85 = errors;
        let valid37 = false;
        let passing8 = null;
        const _errs86 = errors;
        if (
          !validate93(data15, {
            instancePath: instancePath + '/$value',
            parentData: data,
            parentDataProperty: '$value',
            rootData,
          })
        ) {
          vErrors = vErrors === null ? validate93.errors : vErrors.concat(validate93.errors);
          errors = vErrors.length;
        }
        var _valid17 = _errs86 === errors;
        if (_valid17) {
          valid37 = true;
          passing8 = 0;
        }
        const _errs87 = errors;
        if (
          !validate63(data15, {
            instancePath: instancePath + '/$value',
            parentData: data,
            parentDataProperty: '$value',
            rootData,
          })
        ) {
          vErrors = vErrors === null ? validate63.errors : vErrors.concat(validate63.errors);
          errors = vErrors.length;
        }
        var _valid17 = _errs87 === errors;
        if (_valid17 && valid37) {
          valid37 = false;
          passing8 = [passing8, 1];
        } else {
          if (_valid17) {
            valid37 = true;
            passing8 = 1;
          }
        }
        if (!valid37) {
          const err42 = {
            instancePath: instancePath + '/$value',
            schemaPath: '#/allOf/8/then/properties/%24value/oneOf',
            keyword: 'oneOf',
            params: { passingSchemas: passing8 },
            message: 'must match exactly one schema in oneOf',
          };
          if (vErrors === null) {
            vErrors = [err42];
          } else {
            vErrors.push(err42);
          }
          errors++;
        } else {
          errors = _errs85;
          if (vErrors !== null) {
            if (_errs85) {
              vErrors.length = _errs85;
            } else {
              vErrors = null;
            }
          }
        }
      }
    }
    var _valid16 = _errs83 === errors;
    valid34 = _valid16;
  }
  if (!valid34) {
    const err43 = {
      instancePath,
      schemaPath: '#/allOf/8/if',
      keyword: 'if',
      params: { failingKeyword: 'then' },
      message: 'must match "then" schema',
    };
    if (vErrors === null) {
      vErrors = [err43];
    } else {
      vErrors.push(err43);
    }
    errors++;
  }
  const _errs89 = errors;
  let valid38 = true;
  const _errs90 = errors;
  if (data && typeof data == 'object' && !Array.isArray(data)) {
    let missing10;
    if (data.$type === undefined && (missing10 = '$type')) {
      const err44 = {};
      if (vErrors === null) {
        vErrors = [err44];
      } else {
        vErrors.push(err44);
      }
      errors++;
    } else {
      if (data.$type !== undefined) {
        if ('border' !== data.$type) {
          const err45 = {};
          if (vErrors === null) {
            vErrors = [err45];
          } else {
            vErrors.push(err45);
          }
          errors++;
        }
      }
    }
  }
  var _valid18 = _errs90 === errors;
  errors = _errs89;
  if (vErrors !== null) {
    if (_errs89) {
      vErrors.length = _errs89;
    } else {
      vErrors = null;
    }
  }
  if (_valid18) {
    const _errs92 = errors;
    if (data && typeof data == 'object' && !Array.isArray(data)) {
      if (data.$value !== undefined) {
        let data17 = data.$value;
        const _errs94 = errors;
        let valid41 = false;
        let passing9 = null;
        const _errs95 = errors;
        if (
          !validate100(data17, {
            instancePath: instancePath + '/$value',
            parentData: data,
            parentDataProperty: '$value',
            rootData,
          })
        ) {
          vErrors = vErrors === null ? validate100.errors : vErrors.concat(validate100.errors);
          errors = vErrors.length;
        }
        var _valid19 = _errs95 === errors;
        if (_valid19) {
          valid41 = true;
          passing9 = 0;
        }
        const _errs96 = errors;
        if (
          !validate63(data17, {
            instancePath: instancePath + '/$value',
            parentData: data,
            parentDataProperty: '$value',
            rootData,
          })
        ) {
          vErrors = vErrors === null ? validate63.errors : vErrors.concat(validate63.errors);
          errors = vErrors.length;
        }
        var _valid19 = _errs96 === errors;
        if (_valid19 && valid41) {
          valid41 = false;
          passing9 = [passing9, 1];
        } else {
          if (_valid19) {
            valid41 = true;
            passing9 = 1;
          }
        }
        if (!valid41) {
          const err46 = {
            instancePath: instancePath + '/$value',
            schemaPath: '#/allOf/9/then/properties/%24value/oneOf',
            keyword: 'oneOf',
            params: { passingSchemas: passing9 },
            message: 'must match exactly one schema in oneOf',
          };
          if (vErrors === null) {
            vErrors = [err46];
          } else {
            vErrors.push(err46);
          }
          errors++;
        } else {
          errors = _errs94;
          if (vErrors !== null) {
            if (_errs94) {
              vErrors.length = _errs94;
            } else {
              vErrors = null;
            }
          }
        }
      }
    }
    var _valid18 = _errs92 === errors;
    valid38 = _valid18;
  }
  if (!valid38) {
    const err47 = {
      instancePath,
      schemaPath: '#/allOf/9/if',
      keyword: 'if',
      params: { failingKeyword: 'then' },
      message: 'must match "then" schema',
    };
    if (vErrors === null) {
      vErrors = [err47];
    } else {
      vErrors.push(err47);
    }
    errors++;
  }
  const _errs98 = errors;
  let valid42 = true;
  const _errs99 = errors;
  if (data && typeof data == 'object' && !Array.isArray(data)) {
    let missing11;
    if (data.$type === undefined && (missing11 = '$type')) {
      const err48 = {};
      if (vErrors === null) {
        vErrors = [err48];
      } else {
        vErrors.push(err48);
      }
      errors++;
    } else {
      if (data.$type !== undefined) {
        if ('transition' !== data.$type) {
          const err49 = {};
          if (vErrors === null) {
            vErrors = [err49];
          } else {
            vErrors.push(err49);
          }
          errors++;
        }
      }
    }
  }
  var _valid20 = _errs99 === errors;
  errors = _errs98;
  if (vErrors !== null) {
    if (_errs98) {
      vErrors.length = _errs98;
    } else {
      vErrors = null;
    }
  }
  if (_valid20) {
    const _errs101 = errors;
    if (data && typeof data == 'object' && !Array.isArray(data)) {
      if (data.$value !== undefined) {
        let data19 = data.$value;
        const _errs103 = errors;
        let valid45 = false;
        let passing10 = null;
        const _errs104 = errors;
        if (
          !validate109(data19, {
            instancePath: instancePath + '/$value',
            parentData: data,
            parentDataProperty: '$value',
            rootData,
          })
        ) {
          vErrors = vErrors === null ? validate109.errors : vErrors.concat(validate109.errors);
          errors = vErrors.length;
        }
        var _valid21 = _errs104 === errors;
        if (_valid21) {
          valid45 = true;
          passing10 = 0;
        }
        const _errs105 = errors;
        if (
          !validate63(data19, {
            instancePath: instancePath + '/$value',
            parentData: data,
            parentDataProperty: '$value',
            rootData,
          })
        ) {
          vErrors = vErrors === null ? validate63.errors : vErrors.concat(validate63.errors);
          errors = vErrors.length;
        }
        var _valid21 = _errs105 === errors;
        if (_valid21 && valid45) {
          valid45 = false;
          passing10 = [passing10, 1];
        } else {
          if (_valid21) {
            valid45 = true;
            passing10 = 1;
          }
        }
        if (!valid45) {
          const err50 = {
            instancePath: instancePath + '/$value',
            schemaPath: '#/allOf/10/then/properties/%24value/oneOf',
            keyword: 'oneOf',
            params: { passingSchemas: passing10 },
            message: 'must match exactly one schema in oneOf',
          };
          if (vErrors === null) {
            vErrors = [err50];
          } else {
            vErrors.push(err50);
          }
          errors++;
        } else {
          errors = _errs103;
          if (vErrors !== null) {
            if (_errs103) {
              vErrors.length = _errs103;
            } else {
              vErrors = null;
            }
          }
        }
      }
    }
    var _valid20 = _errs101 === errors;
    valid42 = _valid20;
  }
  if (!valid42) {
    const err51 = {
      instancePath,
      schemaPath: '#/allOf/10/if',
      keyword: 'if',
      params: { failingKeyword: 'then' },
      message: 'must match "then" schema',
    };
    if (vErrors === null) {
      vErrors = [err51];
    } else {
      vErrors.push(err51);
    }
    errors++;
  }
  const _errs107 = errors;
  let valid46 = true;
  const _errs108 = errors;
  if (data && typeof data == 'object' && !Array.isArray(data)) {
    let missing12;
    if (data.$type === undefined && (missing12 = '$type')) {
      const err52 = {};
      if (vErrors === null) {
        vErrors = [err52];
      } else {
        vErrors.push(err52);
      }
      errors++;
    } else {
      if (data.$type !== undefined) {
        if ('shadow' !== data.$type) {
          const err53 = {};
          if (vErrors === null) {
            vErrors = [err53];
          } else {
            vErrors.push(err53);
          }
          errors++;
        }
      }
    }
  }
  var _valid22 = _errs108 === errors;
  errors = _errs107;
  if (vErrors !== null) {
    if (_errs107) {
      vErrors.length = _errs107;
    } else {
      vErrors = null;
    }
  }
  if (_valid22) {
    const _errs110 = errors;
    if (data && typeof data == 'object' && !Array.isArray(data)) {
      if (data.$value !== undefined) {
        let data21 = data.$value;
        const _errs112 = errors;
        let valid49 = false;
        let passing11 = null;
        const _errs113 = errors;
        if (
          !validate118(data21, {
            instancePath: instancePath + '/$value',
            parentData: data,
            parentDataProperty: '$value',
            rootData,
          })
        ) {
          vErrors = vErrors === null ? validate118.errors : vErrors.concat(validate118.errors);
          errors = vErrors.length;
        }
        var _valid23 = _errs113 === errors;
        if (_valid23) {
          valid49 = true;
          passing11 = 0;
        }
        const _errs114 = errors;
        if (
          !validate63(data21, {
            instancePath: instancePath + '/$value',
            parentData: data,
            parentDataProperty: '$value',
            rootData,
          })
        ) {
          vErrors = vErrors === null ? validate63.errors : vErrors.concat(validate63.errors);
          errors = vErrors.length;
        }
        var _valid23 = _errs114 === errors;
        if (_valid23 && valid49) {
          valid49 = false;
          passing11 = [passing11, 1];
        } else {
          if (_valid23) {
            valid49 = true;
            passing11 = 1;
          }
        }
        if (!valid49) {
          const err54 = {
            instancePath: instancePath + '/$value',
            schemaPath: '#/allOf/11/then/properties/%24value/oneOf',
            keyword: 'oneOf',
            params: { passingSchemas: passing11 },
            message: 'must match exactly one schema in oneOf',
          };
          if (vErrors === null) {
            vErrors = [err54];
          } else {
            vErrors.push(err54);
          }
          errors++;
        } else {
          errors = _errs112;
          if (vErrors !== null) {
            if (_errs112) {
              vErrors.length = _errs112;
            } else {
              vErrors = null;
            }
          }
        }
      }
    }
    var _valid22 = _errs110 === errors;
    valid46 = _valid22;
  }
  if (!valid46) {
    const err55 = {
      instancePath,
      schemaPath: '#/allOf/11/if',
      keyword: 'if',
      params: { failingKeyword: 'then' },
      message: 'must match "then" schema',
    };
    if (vErrors === null) {
      vErrors = [err55];
    } else {
      vErrors.push(err55);
    }
    errors++;
  }
  const _errs116 = errors;
  let valid50 = true;
  const _errs117 = errors;
  if (data && typeof data == 'object' && !Array.isArray(data)) {
    let missing13;
    if (data.$type === undefined && (missing13 = '$type')) {
      const err56 = {};
      if (vErrors === null) {
        vErrors = [err56];
      } else {
        vErrors.push(err56);
      }
      errors++;
    } else {
      if (data.$type !== undefined) {
        if ('gradient' !== data.$type) {
          const err57 = {};
          if (vErrors === null) {
            vErrors = [err57];
          } else {
            vErrors.push(err57);
          }
          errors++;
        }
      }
    }
  }
  var _valid24 = _errs117 === errors;
  errors = _errs116;
  if (vErrors !== null) {
    if (_errs116) {
      vErrors.length = _errs116;
    } else {
      vErrors = null;
    }
  }
  if (_valid24) {
    const _errs119 = errors;
    if (data && typeof data == 'object' && !Array.isArray(data)) {
      if (data.$value !== undefined) {
        let data23 = data.$value;
        const _errs121 = errors;
        let valid53 = false;
        let passing12 = null;
        const _errs122 = errors;
        if (
          !validate136(data23, {
            instancePath: instancePath + '/$value',
            parentData: data,
            parentDataProperty: '$value',
            rootData,
          })
        ) {
          vErrors = vErrors === null ? validate136.errors : vErrors.concat(validate136.errors);
          errors = vErrors.length;
        }
        var _valid25 = _errs122 === errors;
        if (_valid25) {
          valid53 = true;
          passing12 = 0;
        }
        const _errs123 = errors;
        if (
          !validate63(data23, {
            instancePath: instancePath + '/$value',
            parentData: data,
            parentDataProperty: '$value',
            rootData,
          })
        ) {
          vErrors = vErrors === null ? validate63.errors : vErrors.concat(validate63.errors);
          errors = vErrors.length;
        }
        var _valid25 = _errs123 === errors;
        if (_valid25 && valid53) {
          valid53 = false;
          passing12 = [passing12, 1];
        } else {
          if (_valid25) {
            valid53 = true;
            passing12 = 1;
          }
        }
        if (!valid53) {
          const err58 = {
            instancePath: instancePath + '/$value',
            schemaPath: '#/allOf/12/then/properties/%24value/oneOf',
            keyword: 'oneOf',
            params: { passingSchemas: passing12 },
            message: 'must match exactly one schema in oneOf',
          };
          if (vErrors === null) {
            vErrors = [err58];
          } else {
            vErrors.push(err58);
          }
          errors++;
        } else {
          errors = _errs121;
          if (vErrors !== null) {
            if (_errs121) {
              vErrors.length = _errs121;
            } else {
              vErrors = null;
            }
          }
        }
      }
    }
    var _valid24 = _errs119 === errors;
    valid50 = _valid24;
  }
  if (!valid50) {
    const err59 = {
      instancePath,
      schemaPath: '#/allOf/12/if',
      keyword: 'if',
      params: { failingKeyword: 'then' },
      message: 'must match "then" schema',
    };
    if (vErrors === null) {
      vErrors = [err59];
    } else {
      vErrors.push(err59);
    }
    errors++;
  }
  const _errs125 = errors;
  let valid54 = true;
  const _errs126 = errors;
  if (data && typeof data == 'object' && !Array.isArray(data)) {
    let missing14;
    if (data.$type === undefined && (missing14 = '$type')) {
      const err60 = {};
      if (vErrors === null) {
        vErrors = [err60];
      } else {
        vErrors.push(err60);
      }
      errors++;
    } else {
      if (data.$type !== undefined) {
        if ('typography' !== data.$type) {
          const err61 = {};
          if (vErrors === null) {
            vErrors = [err61];
          } else {
            vErrors.push(err61);
          }
          errors++;
        }
      }
    }
  }
  var _valid26 = _errs126 === errors;
  errors = _errs125;
  if (vErrors !== null) {
    if (_errs125) {
      vErrors.length = _errs125;
    } else {
      vErrors = null;
    }
  }
  if (_valid26) {
    const _errs128 = errors;
    if (data && typeof data == 'object' && !Array.isArray(data)) {
      if (data.$value !== undefined) {
        let data25 = data.$value;
        const _errs130 = errors;
        let valid57 = false;
        let passing13 = null;
        const _errs131 = errors;
        if (
          !validate145(data25, {
            instancePath: instancePath + '/$value',
            parentData: data,
            parentDataProperty: '$value',
            rootData,
          })
        ) {
          vErrors = vErrors === null ? validate145.errors : vErrors.concat(validate145.errors);
          errors = vErrors.length;
        }
        var _valid27 = _errs131 === errors;
        if (_valid27) {
          valid57 = true;
          passing13 = 0;
        }
        const _errs132 = errors;
        if (
          !validate63(data25, {
            instancePath: instancePath + '/$value',
            parentData: data,
            parentDataProperty: '$value',
            rootData,
          })
        ) {
          vErrors = vErrors === null ? validate63.errors : vErrors.concat(validate63.errors);
          errors = vErrors.length;
        }
        var _valid27 = _errs132 === errors;
        if (_valid27 && valid57) {
          valid57 = false;
          passing13 = [passing13, 1];
        } else {
          if (_valid27) {
            valid57 = true;
            passing13 = 1;
          }
        }
        if (!valid57) {
          const err62 = {
            instancePath: instancePath + '/$value',
            schemaPath: '#/allOf/13/then/properties/%24value/oneOf',
            keyword: 'oneOf',
            params: { passingSchemas: passing13 },
            message: 'must match exactly one schema in oneOf',
          };
          if (vErrors === null) {
            vErrors = [err62];
          } else {
            vErrors.push(err62);
          }
          errors++;
        } else {
          errors = _errs130;
          if (vErrors !== null) {
            if (_errs130) {
              vErrors.length = _errs130;
            } else {
              vErrors = null;
            }
          }
        }
      }
    }
    var _valid26 = _errs128 === errors;
    valid54 = _valid26;
  }
  if (!valid54) {
    const err63 = {
      instancePath,
      schemaPath: '#/allOf/13/if',
      keyword: 'if',
      params: { failingKeyword: 'then' },
      message: 'must match "then" schema',
    };
    if (vErrors === null) {
      vErrors = [err63];
    } else {
      vErrors.push(err63);
    }
    errors++;
  }
  const _errs134 = errors;
  let valid58 = true;
  const _errs135 = errors;
  const _errs136 = errors;
  const _errs137 = errors;
  const _errs138 = errors;
  if (data && typeof data == 'object' && !Array.isArray(data)) {
    let missing15;
    if (data.$type === undefined && (missing15 = '$type')) {
      const err64 = {};
      if (vErrors === null) {
        vErrors = [err64];
      } else {
        vErrors.push(err64);
      }
      errors++;
    }
  }
  var valid60 = _errs138 === errors;
  if (valid60) {
    const err65 = {};
    if (vErrors === null) {
      vErrors = [err65];
    } else {
      vErrors.push(err65);
    }
    errors++;
  } else {
    errors = _errs137;
    if (vErrors !== null) {
      if (_errs137) {
        vErrors.length = _errs137;
      } else {
        vErrors = null;
      }
    }
  }
  var valid59 = _errs136 === errors;
  if (valid59) {
    const _errs139 = errors;
    if (data && typeof data == 'object' && !Array.isArray(data)) {
      let missing16;
      if (data.$value === undefined && (missing16 = '$value')) {
        const err66 = {};
        if (vErrors === null) {
          vErrors = [err66];
        } else {
          vErrors.push(err66);
        }
        errors++;
      }
    }
    var valid59 = _errs139 === errors;
    if (valid59) {
      const _errs140 = errors;
      if (data && typeof data == 'object' && !Array.isArray(data)) {
        if (data.$value !== undefined) {
          const _errs142 = errors;
          const _errs143 = errors;
          if (
            !validate63(data.$value, {
              instancePath: instancePath + '/$value',
              parentData: data,
              parentDataProperty: '$value',
              rootData,
            })
          ) {
            vErrors = vErrors === null ? validate63.errors : vErrors.concat(validate63.errors);
            errors = vErrors.length;
          }
          var valid62 = _errs143 === errors;
          if (valid62) {
            const err67 = {};
            if (vErrors === null) {
              vErrors = [err67];
            } else {
              vErrors.push(err67);
            }
            errors++;
          } else {
            errors = _errs142;
            if (vErrors !== null) {
              if (_errs142) {
                vErrors.length = _errs142;
              } else {
                vErrors = null;
              }
            }
          }
        }
      }
      var valid59 = _errs140 === errors;
    }
  }
  var _valid28 = _errs135 === errors;
  errors = _errs134;
  if (vErrors !== null) {
    if (_errs134) {
      vErrors.length = _errs134;
    } else {
      vErrors = null;
    }
  }
  if (_valid28) {
    const _errs144 = errors;
    if (data && typeof data == 'object' && !Array.isArray(data)) {
      if (data.$value !== undefined) {
        let data27 = data.$value;
        const _errs146 = errors;
        let valid64 = false;
        let passing14 = null;
        const _errs147 = errors;
        if (
          !validate12(data27, {
            instancePath: instancePath + '/$value',
            parentData: data,
            parentDataProperty: '$value',
            rootData,
          })
        ) {
          vErrors = vErrors === null ? validate12.errors : vErrors.concat(validate12.errors);
          errors = vErrors.length;
        }
        var _valid29 = _errs147 === errors;
        if (_valid29) {
          valid64 = true;
          passing14 = 0;
        }
        const _errs148 = errors;
        if (
          !validate66(data27, {
            instancePath: instancePath + '/$value',
            parentData: data,
            parentDataProperty: '$value',
            rootData,
          })
        ) {
          vErrors = vErrors === null ? validate66.errors : vErrors.concat(validate66.errors);
          errors = vErrors.length;
        }
        var _valid29 = _errs148 === errors;
        if (_valid29 && valid64) {
          valid64 = false;
          passing14 = [passing14, 1];
        } else {
          if (_valid29) {
            valid64 = true;
            passing14 = 1;
          }
          const _errs149 = errors;
          if (
            !validate71(data27, {
              instancePath: instancePath + '/$value',
              parentData: data,
              parentDataProperty: '$value',
              rootData,
            })
          ) {
            vErrors = vErrors === null ? validate71.errors : vErrors.concat(validate71.errors);
            errors = vErrors.length;
          }
          var _valid29 = _errs149 === errors;
          if (_valid29 && valid64) {
            valid64 = false;
            passing14 = [passing14, 2];
          } else {
            if (_valid29) {
              valid64 = true;
              passing14 = 2;
            }
            const _errs150 = errors;
            if (
              !validate76(data27, {
                instancePath: instancePath + '/$value',
                parentData: data,
                parentDataProperty: '$value',
                rootData,
              })
            ) {
              vErrors = vErrors === null ? validate76.errors : vErrors.concat(validate76.errors);
              errors = vErrors.length;
            }
            var _valid29 = _errs150 === errors;
            if (_valid29 && valid64) {
              valid64 = false;
              passing14 = [passing14, 3];
            } else {
              if (_valid29) {
                valid64 = true;
                passing14 = 3;
              }
              const _errs151 = errors;
              if (
                !validate81(data27, {
                  instancePath: instancePath + '/$value',
                  parentData: data,
                  parentDataProperty: '$value',
                  rootData,
                })
              ) {
                vErrors = vErrors === null ? validate81.errors : vErrors.concat(validate81.errors);
                errors = vErrors.length;
              }
              var _valid29 = _errs151 === errors;
              if (_valid29 && valid64) {
                valid64 = false;
                passing14 = [passing14, 4];
              } else {
                if (_valid29) {
                  valid64 = true;
                  passing14 = 4;
                }
                const _errs152 = errors;
                if (
                  !validate93(data27, {
                    instancePath: instancePath + '/$value',
                    parentData: data,
                    parentDataProperty: '$value',
                    rootData,
                  })
                ) {
                  vErrors =
                    vErrors === null ? validate93.errors : vErrors.concat(validate93.errors);
                  errors = vErrors.length;
                }
                var _valid29 = _errs152 === errors;
                if (_valid29 && valid64) {
                  valid64 = false;
                  passing14 = [passing14, 5];
                } else {
                  if (_valid29) {
                    valid64 = true;
                    passing14 = 5;
                  }
                  const _errs153 = errors;
                  if (
                    !validate100(data27, {
                      instancePath: instancePath + '/$value',
                      parentData: data,
                      parentDataProperty: '$value',
                      rootData,
                    })
                  ) {
                    vErrors =
                      vErrors === null ? validate100.errors : vErrors.concat(validate100.errors);
                    errors = vErrors.length;
                  }
                  var _valid29 = _errs153 === errors;
                  if (_valid29 && valid64) {
                    valid64 = false;
                    passing14 = [passing14, 6];
                  } else {
                    if (_valid29) {
                      valid64 = true;
                      passing14 = 6;
                    }
                    const _errs154 = errors;
                    if (
                      !validate109(data27, {
                        instancePath: instancePath + '/$value',
                        parentData: data,
                        parentDataProperty: '$value',
                        rootData,
                      })
                    ) {
                      vErrors =
                        vErrors === null ? validate109.errors : vErrors.concat(validate109.errors);
                      errors = vErrors.length;
                    }
                    var _valid29 = _errs154 === errors;
                    if (_valid29 && valid64) {
                      valid64 = false;
                      passing14 = [passing14, 7];
                    } else {
                      if (_valid29) {
                        valid64 = true;
                        passing14 = 7;
                      }
                      const _errs155 = errors;
                      if (
                        !validate118(data27, {
                          instancePath: instancePath + '/$value',
                          parentData: data,
                          parentDataProperty: '$value',
                          rootData,
                        })
                      ) {
                        vErrors =
                          vErrors === null
                            ? validate118.errors
                            : vErrors.concat(validate118.errors);
                        errors = vErrors.length;
                      }
                      var _valid29 = _errs155 === errors;
                      if (_valid29 && valid64) {
                        valid64 = false;
                        passing14 = [passing14, 8];
                      } else {
                        if (_valid29) {
                          valid64 = true;
                          passing14 = 8;
                        }
                        const _errs156 = errors;
                        if (
                          !validate136(data27, {
                            instancePath: instancePath + '/$value',
                            parentData: data,
                            parentDataProperty: '$value',
                            rootData,
                          })
                        ) {
                          vErrors =
                            vErrors === null
                              ? validate136.errors
                              : vErrors.concat(validate136.errors);
                          errors = vErrors.length;
                        }
                        var _valid29 = _errs156 === errors;
                        if (_valid29 && valid64) {
                          valid64 = false;
                          passing14 = [passing14, 9];
                        } else {
                          if (_valid29) {
                            valid64 = true;
                            passing14 = 9;
                          }
                          const _errs157 = errors;
                          if (
                            !validate145(data27, {
                              instancePath: instancePath + '/$value',
                              parentData: data,
                              parentDataProperty: '$value',
                              rootData,
                            })
                          ) {
                            vErrors =
                              vErrors === null
                                ? validate145.errors
                                : vErrors.concat(validate145.errors);
                            errors = vErrors.length;
                          }
                          var _valid29 = _errs157 === errors;
                          if (_valid29 && valid64) {
                            valid64 = false;
                            passing14 = [passing14, 10];
                          } else {
                            if (_valid29) {
                              valid64 = true;
                              passing14 = 10;
                            }
                            const _errs158 = errors;
                            const _errs159 = errors;
                            let valid65 = false;
                            const _errs160 = errors;
                            if (!(typeof data27 == 'number')) {
                              const err68 = {
                                instancePath: instancePath + '/$value',
                                schemaPath:
                                  'https://www.designtokens.org/schemas/2025.10/format/values/number.json/type',
                                keyword: 'type',
                                params: { type: 'number' },
                                message: 'must be number',
                              };
                              if (vErrors === null) {
                                vErrors = [err68];
                              } else {
                                vErrors.push(err68);
                              }
                              errors++;
                            }
                            var _valid30 = _errs160 === errors;
                            valid65 = valid65 || _valid30;
                            if (!valid65) {
                              const _errs163 = errors;
                              const _errs165 = errors;
                              let valid68 = false;
                              let passing15 = null;
                              const _errs166 = errors;
                              if (typeof data27 == 'number') {
                                if (data27 > 1000 || isNaN(data27)) {
                                  const err69 = {
                                    instancePath: instancePath + '/$value',
                                    schemaPath:
                                      'https://www.designtokens.org/schemas/2025.10/format/values/fontWeight.json/oneOf/0/maximum',
                                    keyword: 'maximum',
                                    params: { comparison: '<=', limit: 1000 },
                                    message: 'must be <= 1000',
                                  };
                                  if (vErrors === null) {
                                    vErrors = [err69];
                                  } else {
                                    vErrors.push(err69);
                                  }
                                  errors++;
                                }
                                if (data27 < 1 || isNaN(data27)) {
                                  const err70 = {
                                    instancePath: instancePath + '/$value',
                                    schemaPath:
                                      'https://www.designtokens.org/schemas/2025.10/format/values/fontWeight.json/oneOf/0/minimum',
                                    keyword: 'minimum',
                                    params: { comparison: '>=', limit: 1 },
                                    message: 'must be >= 1',
                                  };
                                  if (vErrors === null) {
                                    vErrors = [err70];
                                  } else {
                                    vErrors.push(err70);
                                  }
                                  errors++;
                                }
                              } else {
                                const err71 = {
                                  instancePath: instancePath + '/$value',
                                  schemaPath:
                                    'https://www.designtokens.org/schemas/2025.10/format/values/fontWeight.json/oneOf/0/type',
                                  keyword: 'type',
                                  params: { type: 'number' },
                                  message: 'must be number',
                                };
                                if (vErrors === null) {
                                  vErrors = [err71];
                                } else {
                                  vErrors.push(err71);
                                }
                                errors++;
                              }
                              var _valid31 = _errs166 === errors;
                              if (_valid31) {
                                valid68 = true;
                                passing15 = 0;
                              }
                              const _errs168 = errors;
                              if (typeof data27 !== 'string') {
                                const err72 = {
                                  instancePath: instancePath + '/$value',
                                  schemaPath:
                                    'https://www.designtokens.org/schemas/2025.10/format/values/fontWeight.json/oneOf/1/type',
                                  keyword: 'type',
                                  params: { type: 'string' },
                                  message: 'must be string',
                                };
                                if (vErrors === null) {
                                  vErrors = [err72];
                                } else {
                                  vErrors.push(err72);
                                }
                                errors++;
                              }
                              if (!(
                                data27 === 'thin' ||
                                data27 === 'hairline' ||
                                data27 === 'extra-light' ||
                                data27 === 'ultra-light' ||
                                data27 === 'light' ||
                                data27 === 'normal' ||
                                data27 === 'regular' ||
                                data27 === 'book' ||
                                data27 === 'medium' ||
                                data27 === 'semi-bold' ||
                                data27 === 'demi-bold' ||
                                data27 === 'bold' ||
                                data27 === 'extra-bold' ||
                                data27 === 'ultra-bold' ||
                                data27 === 'black' ||
                                data27 === 'heavy' ||
                                data27 === 'extra-black' ||
                                data27 === 'ultra-black'
                              )) {
                                const err73 = {
                                  instancePath: instancePath + '/$value',
                                  schemaPath:
                                    'https://www.designtokens.org/schemas/2025.10/format/values/fontWeight.json/oneOf/1/enum',
                                  keyword: 'enum',
                                  params: { allowedValues: schema32.oneOf[1].enum },
                                  message: 'must be equal to one of the allowed values',
                                };
                                if (vErrors === null) {
                                  vErrors = [err73];
                                } else {
                                  vErrors.push(err73);
                                }
                                errors++;
                              }
                              var _valid31 = _errs168 === errors;
                              if (_valid31 && valid68) {
                                valid68 = false;
                                passing15 = [passing15, 1];
                              } else {
                                if (_valid31) {
                                  valid68 = true;
                                  passing15 = 1;
                                }
                              }
                              if (!valid68) {
                                const err74 = {
                                  instancePath: instancePath + '/$value',
                                  schemaPath:
                                    'https://www.designtokens.org/schemas/2025.10/format/values/fontWeight.json/oneOf',
                                  keyword: 'oneOf',
                                  params: { passingSchemas: passing15 },
                                  message: 'must match exactly one schema in oneOf',
                                };
                                if (vErrors === null) {
                                  vErrors = [err74];
                                } else {
                                  vErrors.push(err74);
                                }
                                errors++;
                              } else {
                                errors = _errs165;
                                if (vErrors !== null) {
                                  if (_errs165) {
                                    vErrors.length = _errs165;
                                  } else {
                                    vErrors = null;
                                  }
                                }
                              }
                              var _valid30 = _errs163 === errors;
                              valid65 = valid65 || _valid30;
                            }
                            if (!valid65) {
                              const err75 = {
                                instancePath: instancePath + '/$value',
                                schemaPath: '#/allOf/14/then/properties/%24value/oneOf/11/anyOf',
                                keyword: 'anyOf',
                                params: {},
                                message: 'must match a schema in anyOf',
                              };
                              if (vErrors === null) {
                                vErrors = [err75];
                              } else {
                                vErrors.push(err75);
                              }
                              errors++;
                            } else {
                              errors = _errs159;
                              if (vErrors !== null) {
                                if (_errs159) {
                                  vErrors.length = _errs159;
                                } else {
                                  vErrors = null;
                                }
                              }
                            }
                            var _valid29 = _errs158 === errors;
                            if (_valid29 && valid64) {
                              valid64 = false;
                              passing14 = [passing14, 11];
                            } else {
                              if (_valid29) {
                                valid64 = true;
                                passing14 = 11;
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
        if (!valid64) {
          const err76 = {
            instancePath: instancePath + '/$value',
            schemaPath: '#/allOf/14/then/properties/%24value/oneOf',
            keyword: 'oneOf',
            params: { passingSchemas: passing14 },
            message: 'must match exactly one schema in oneOf',
          };
          if (vErrors === null) {
            vErrors = [err76];
          } else {
            vErrors.push(err76);
          }
          errors++;
        } else {
          errors = _errs146;
          if (vErrors !== null) {
            if (_errs146) {
              vErrors.length = _errs146;
            } else {
              vErrors = null;
            }
          }
        }
      }
    }
    var _valid28 = _errs144 === errors;
    valid58 = _valid28;
  }
  if (!valid58) {
    const err77 = {
      instancePath,
      schemaPath: '#/allOf/14/if',
      keyword: 'if',
      params: { failingKeyword: 'then' },
      message: 'must match "then" schema',
    };
    if (vErrors === null) {
      vErrors = [err77];
    } else {
      vErrors.push(err77);
    }
    errors++;
  }
  if (data && typeof data == 'object' && !Array.isArray(data)) {
    for (const key0 in data) {
      if (!(
        key0 === '$value' ||
        key0 === '$type' ||
        key0 === '$ref' ||
        key0 === '$description' ||
        key0 === '$extensions' ||
        key0 === '$deprecated'
      )) {
        const err78 = {
          instancePath,
          schemaPath: '#/additionalProperties',
          keyword: 'additionalProperties',
          params: { additionalProperty: key0 },
          message: 'must NOT have additional properties',
        };
        if (vErrors === null) {
          vErrors = [err78];
        } else {
          vErrors.push(err78);
        }
        errors++;
      }
    }
    if (data.$type !== undefined) {
      let data28 = data.$type;
      if (typeof data28 !== 'string') {
        const err79 = {
          instancePath: instancePath + '/$type',
          schemaPath: 'https://www.designtokens.org/schemas/2025.10/format/tokenType.json/type',
          keyword: 'type',
          params: { type: 'string' },
          message: 'must be string',
        };
        if (vErrors === null) {
          vErrors = [err79];
        } else {
          vErrors.push(err79);
        }
        errors++;
      }
      if (!(
        data28 === 'color' ||
        data28 === 'dimension' ||
        data28 === 'fontFamily' ||
        data28 === 'fontWeight' ||
        data28 === 'duration' ||
        data28 === 'cubicBezier' ||
        data28 === 'number' ||
        data28 === 'strokeStyle' ||
        data28 === 'border' ||
        data28 === 'transition' ||
        data28 === 'shadow' ||
        data28 === 'gradient' ||
        data28 === 'typography'
      )) {
        const err80 = {
          instancePath: instancePath + '/$type',
          schemaPath: 'https://www.designtokens.org/schemas/2025.10/format/tokenType.json/enum',
          keyword: 'enum',
          params: { allowedValues: schema12.enum },
          message: 'must be equal to one of the allowed values',
        };
        if (vErrors === null) {
          vErrors = [err80];
        } else {
          vErrors.push(err80);
        }
        errors++;
      }
    }
    if (data.$ref !== undefined) {
      let data29 = data.$ref;
      if (typeof data29 === 'string') {
        if (!pattern2.test(data29)) {
          const err81 = {
            instancePath: instancePath + '/$ref',
            schemaPath:
              'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/jsonPointerReference/pattern',
            keyword: 'pattern',
            params: { pattern: '^#/' },
            message: 'must match pattern "' + '^#/' + '"',
          };
          if (vErrors === null) {
            vErrors = [err81];
          } else {
            vErrors.push(err81);
          }
          errors++;
        }
        if (!formats2.test(data29)) {
          const err82 = {
            instancePath: instancePath + '/$ref',
            schemaPath:
              'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/jsonPointerReference/format',
            keyword: 'format',
            params: { format: 'json-pointer-uri-fragment' },
            message: 'must match format "' + 'json-pointer-uri-fragment' + '"',
          };
          if (vErrors === null) {
            vErrors = [err82];
          } else {
            vErrors.push(err82);
          }
          errors++;
        }
      } else {
        const err83 = {
          instancePath: instancePath + '/$ref',
          schemaPath:
            'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/jsonPointerReference/type',
          keyword: 'type',
          params: { type: 'string' },
          message: 'must be string',
        };
        if (vErrors === null) {
          vErrors = [err83];
        } else {
          vErrors.push(err83);
        }
        errors++;
      }
    }
    if (data.$description !== undefined) {
      if (typeof data.$description !== 'string') {
        const err84 = {
          instancePath: instancePath + '/$description',
          schemaPath: '#/properties/%24description/type',
          keyword: 'type',
          params: { type: 'string' },
          message: 'must be string',
        };
        if (vErrors === null) {
          vErrors = [err84];
        } else {
          vErrors.push(err84);
        }
        errors++;
      }
    }
    if (data.$extensions !== undefined) {
      let data31 = data.$extensions;
      if (!(data31 && typeof data31 == 'object' && !Array.isArray(data31))) {
        const err85 = {
          instancePath: instancePath + '/$extensions',
          schemaPath: '#/properties/%24extensions/type',
          keyword: 'type',
          params: { type: 'object' },
          message: 'must be object',
        };
        if (vErrors === null) {
          vErrors = [err85];
        } else {
          vErrors.push(err85);
        }
        errors++;
      }
    }
    if (data.$deprecated !== undefined) {
      let data32 = data.$deprecated;
      const _errs182 = errors;
      let valid72 = false;
      let passing16 = null;
      const _errs183 = errors;
      if (typeof data32 !== 'boolean') {
        const err86 = {
          instancePath: instancePath + '/$deprecated',
          schemaPath: '#/properties/%24deprecated/oneOf/0/type',
          keyword: 'type',
          params: { type: 'boolean' },
          message: 'must be boolean',
        };
        if (vErrors === null) {
          vErrors = [err86];
        } else {
          vErrors.push(err86);
        }
        errors++;
      }
      var _valid32 = _errs183 === errors;
      if (_valid32) {
        valid72 = true;
        passing16 = 0;
      }
      const _errs185 = errors;
      if (typeof data32 !== 'string') {
        const err87 = {
          instancePath: instancePath + '/$deprecated',
          schemaPath: '#/properties/%24deprecated/oneOf/1/type',
          keyword: 'type',
          params: { type: 'string' },
          message: 'must be string',
        };
        if (vErrors === null) {
          vErrors = [err87];
        } else {
          vErrors.push(err87);
        }
        errors++;
      }
      var _valid32 = _errs185 === errors;
      if (_valid32 && valid72) {
        valid72 = false;
        passing16 = [passing16, 1];
      } else {
        if (_valid32) {
          valid72 = true;
          passing16 = 1;
        }
      }
      if (!valid72) {
        const err88 = {
          instancePath: instancePath + '/$deprecated',
          schemaPath: '#/properties/%24deprecated/oneOf',
          keyword: 'oneOf',
          params: { passingSchemas: passing16 },
          message: 'must match exactly one schema in oneOf',
        };
        if (vErrors === null) {
          vErrors = [err88];
        } else {
          vErrors.push(err88);
        }
        errors++;
      } else {
        errors = _errs182;
        if (vErrors !== null) {
          if (_errs182) {
            vErrors.length = _errs182;
          } else {
            vErrors = null;
          }
        }
      }
    }
  } else {
    const err89 = {
      instancePath,
      schemaPath: '#/type',
      keyword: 'type',
      params: { type: 'object' },
      message: 'must be object',
    };
    if (vErrors === null) {
      vErrors = [err89];
    } else {
      vErrors.push(err89);
    }
    errors++;
  }
  validate11.errors = vErrors;
  return errors === 0;
}
const schema52 = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'https://www.designtokens.org/schemas/2025.10/format/groupOrToken.json',
  title: 'Group or Token',
  description:
    'A group or a token in the DTCG specification. A token is identified by the presence of a $value property, while a group is any object without a $value property.',
  oneOf: [
    { $ref: 'https://www.designtokens.org/schemas/2025.10/format/group.json' },
    { $ref: 'https://www.designtokens.org/schemas/2025.10/format/token.json' },
  ],
};
const schema53 = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'https://www.designtokens.org/schemas/2025.10/format/group.json',
  title: 'Group',
  description: 'A group in the DTCG specification',
  type: 'object',
  properties: {
    $type: { $ref: 'https://www.designtokens.org/schemas/2025.10/format/tokenType.json' },
    $description: { type: 'string', description: 'A plain text description of the group' },
    $extensions: { type: 'object', description: 'Vendor-specific extensions' },
    $extends: {
      oneOf: [
        {
          $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/curlyBraceReference',
        },
        {
          $ref: 'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/jsonPointerReference',
        },
      ],
      description: 'Reference to another group to inherit tokens and properties from',
    },
    $deprecated: {
      oneOf: [{ type: 'boolean' }, { type: 'string' }],
      description: 'Whether this group is deprecated',
    },
    $root: { $ref: 'https://www.designtokens.org/schemas/2025.10/format/token.json' },
  },
  patternProperties: {
    '^[^${}.][^{}.]*$': {
      $ref: 'https://www.designtokens.org/schemas/2025.10/format/groupOrToken.json',
    },
  },
  additionalProperties: false,
};
const wrapper0 = { validate: validate169 };
function validate170(
  data,
  { instancePath = '', parentData, parentDataProperty, rootData = data } = {},
) {
  /*# sourceURL="https://www.designtokens.org/schemas/2025.10/format/group.json" */ let vErrors =
    null;
  let errors = 0;
  if (data && typeof data == 'object' && !Array.isArray(data)) {
    for (const key0 in data) {
      if (!(
        key0 === '$type' ||
        key0 === '$description' ||
        key0 === '$extensions' ||
        key0 === '$extends' ||
        key0 === '$deprecated' ||
        key0 === '$root' ||
        pattern0.test(key0)
      )) {
        const err0 = {
          instancePath,
          schemaPath: '#/additionalProperties',
          keyword: 'additionalProperties',
          params: { additionalProperty: key0 },
          message: 'must NOT have additional properties',
        };
        if (vErrors === null) {
          vErrors = [err0];
        } else {
          vErrors.push(err0);
        }
        errors++;
      }
    }
    if (data.$type !== undefined) {
      let data0 = data.$type;
      if (typeof data0 !== 'string') {
        const err1 = {
          instancePath: instancePath + '/$type',
          schemaPath: 'https://www.designtokens.org/schemas/2025.10/format/tokenType.json/type',
          keyword: 'type',
          params: { type: 'string' },
          message: 'must be string',
        };
        if (vErrors === null) {
          vErrors = [err1];
        } else {
          vErrors.push(err1);
        }
        errors++;
      }
      if (!(
        data0 === 'color' ||
        data0 === 'dimension' ||
        data0 === 'fontFamily' ||
        data0 === 'fontWeight' ||
        data0 === 'duration' ||
        data0 === 'cubicBezier' ||
        data0 === 'number' ||
        data0 === 'strokeStyle' ||
        data0 === 'border' ||
        data0 === 'transition' ||
        data0 === 'shadow' ||
        data0 === 'gradient' ||
        data0 === 'typography'
      )) {
        const err2 = {
          instancePath: instancePath + '/$type',
          schemaPath: 'https://www.designtokens.org/schemas/2025.10/format/tokenType.json/enum',
          keyword: 'enum',
          params: { allowedValues: schema12.enum },
          message: 'must be equal to one of the allowed values',
        };
        if (vErrors === null) {
          vErrors = [err2];
        } else {
          vErrors.push(err2);
        }
        errors++;
      }
    }
    if (data.$description !== undefined) {
      if (typeof data.$description !== 'string') {
        const err3 = {
          instancePath: instancePath + '/$description',
          schemaPath: '#/properties/%24description/type',
          keyword: 'type',
          params: { type: 'string' },
          message: 'must be string',
        };
        if (vErrors === null) {
          vErrors = [err3];
        } else {
          vErrors.push(err3);
        }
        errors++;
      }
    }
    if (data.$extensions !== undefined) {
      let data2 = data.$extensions;
      if (!(data2 && typeof data2 == 'object' && !Array.isArray(data2))) {
        const err4 = {
          instancePath: instancePath + '/$extensions',
          schemaPath: '#/properties/%24extensions/type',
          keyword: 'type',
          params: { type: 'object' },
          message: 'must be object',
        };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      }
    }
    if (data.$extends !== undefined) {
      let data3 = data.$extends;
      const _errs10 = errors;
      let valid2 = false;
      let passing0 = null;
      const _errs11 = errors;
      if (typeof data3 === 'string') {
        if (!pattern1.test(data3)) {
          const err5 = {
            instancePath: instancePath + '/$extends',
            schemaPath:
              'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/curlyBraceReference/pattern',
            keyword: 'pattern',
            params: { pattern: '^\\{[^${}.][^{}.]*(\\.[^${}.][^{}.]*)*\\}$' },
            message: 'must match pattern "' + '^\\{[^${}.][^{}.]*(\\.[^${}.][^{}.]*)*\\}$' + '"',
          };
          if (vErrors === null) {
            vErrors = [err5];
          } else {
            vErrors.push(err5);
          }
          errors++;
        }
      } else {
        const err6 = {
          instancePath: instancePath + '/$extends',
          schemaPath:
            'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/curlyBraceReference/type',
          keyword: 'type',
          params: { type: 'string' },
          message: 'must be string',
        };
        if (vErrors === null) {
          vErrors = [err6];
        } else {
          vErrors.push(err6);
        }
        errors++;
      }
      var _valid0 = _errs11 === errors;
      if (_valid0) {
        valid2 = true;
        passing0 = 0;
      }
      const _errs14 = errors;
      if (typeof data3 === 'string') {
        if (!pattern2.test(data3)) {
          const err7 = {
            instancePath: instancePath + '/$extends',
            schemaPath:
              'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/jsonPointerReference/pattern',
            keyword: 'pattern',
            params: { pattern: '^#/' },
            message: 'must match pattern "' + '^#/' + '"',
          };
          if (vErrors === null) {
            vErrors = [err7];
          } else {
            vErrors.push(err7);
          }
          errors++;
        }
        if (!formats2.test(data3)) {
          const err8 = {
            instancePath: instancePath + '/$extends',
            schemaPath:
              'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/jsonPointerReference/format',
            keyword: 'format',
            params: { format: 'json-pointer-uri-fragment' },
            message: 'must match format "' + 'json-pointer-uri-fragment' + '"',
          };
          if (vErrors === null) {
            vErrors = [err8];
          } else {
            vErrors.push(err8);
          }
          errors++;
        }
      } else {
        const err9 = {
          instancePath: instancePath + '/$extends',
          schemaPath:
            'https://www.designtokens.org/schemas/2025.10/format.json#/definitions/jsonPointerReference/type',
          keyword: 'type',
          params: { type: 'string' },
          message: 'must be string',
        };
        if (vErrors === null) {
          vErrors = [err9];
        } else {
          vErrors.push(err9);
        }
        errors++;
      }
      var _valid0 = _errs14 === errors;
      if (_valid0 && valid2) {
        valid2 = false;
        passing0 = [passing0, 1];
      } else {
        if (_valid0) {
          valid2 = true;
          passing0 = 1;
        }
      }
      if (!valid2) {
        const err10 = {
          instancePath: instancePath + '/$extends',
          schemaPath: '#/properties/%24extends/oneOf',
          keyword: 'oneOf',
          params: { passingSchemas: passing0 },
          message: 'must match exactly one schema in oneOf',
        };
        if (vErrors === null) {
          vErrors = [err10];
        } else {
          vErrors.push(err10);
        }
        errors++;
      } else {
        errors = _errs10;
        if (vErrors !== null) {
          if (_errs10) {
            vErrors.length = _errs10;
          } else {
            vErrors = null;
          }
        }
      }
    }
    if (data.$deprecated !== undefined) {
      let data4 = data.$deprecated;
      const _errs18 = errors;
      let valid5 = false;
      let passing1 = null;
      const _errs19 = errors;
      if (typeof data4 !== 'boolean') {
        const err11 = {
          instancePath: instancePath + '/$deprecated',
          schemaPath: '#/properties/%24deprecated/oneOf/0/type',
          keyword: 'type',
          params: { type: 'boolean' },
          message: 'must be boolean',
        };
        if (vErrors === null) {
          vErrors = [err11];
        } else {
          vErrors.push(err11);
        }
        errors++;
      }
      var _valid1 = _errs19 === errors;
      if (_valid1) {
        valid5 = true;
        passing1 = 0;
      }
      const _errs21 = errors;
      if (typeof data4 !== 'string') {
        const err12 = {
          instancePath: instancePath + '/$deprecated',
          schemaPath: '#/properties/%24deprecated/oneOf/1/type',
          keyword: 'type',
          params: { type: 'string' },
          message: 'must be string',
        };
        if (vErrors === null) {
          vErrors = [err12];
        } else {
          vErrors.push(err12);
        }
        errors++;
      }
      var _valid1 = _errs21 === errors;
      if (_valid1 && valid5) {
        valid5 = false;
        passing1 = [passing1, 1];
      } else {
        if (_valid1) {
          valid5 = true;
          passing1 = 1;
        }
      }
      if (!valid5) {
        const err13 = {
          instancePath: instancePath + '/$deprecated',
          schemaPath: '#/properties/%24deprecated/oneOf',
          keyword: 'oneOf',
          params: { passingSchemas: passing1 },
          message: 'must match exactly one schema in oneOf',
        };
        if (vErrors === null) {
          vErrors = [err13];
        } else {
          vErrors.push(err13);
        }
        errors++;
      } else {
        errors = _errs18;
        if (vErrors !== null) {
          if (_errs18) {
            vErrors.length = _errs18;
          } else {
            vErrors = null;
          }
        }
      }
    }
    if (data.$root !== undefined) {
      if (
        !validate11(data.$root, {
          instancePath: instancePath + '/$root',
          parentData: data,
          parentDataProperty: '$root',
          rootData,
        })
      ) {
        vErrors = vErrors === null ? validate11.errors : vErrors.concat(validate11.errors);
        errors = vErrors.length;
      }
    }
    for (const key1 in data) {
      if (pattern0.test(key1)) {
        if (
          !wrapper0.validate(data[key1], {
            instancePath: instancePath + '/' + key1.replace(/~/g, '~0').replace(/\//g, '~1'),
            parentData: data,
            parentDataProperty: key1,
            rootData,
          })
        ) {
          vErrors =
            vErrors === null ? wrapper0.validate.errors : vErrors.concat(wrapper0.validate.errors);
          errors = vErrors.length;
        }
      }
    }
  } else {
    const err14 = {
      instancePath,
      schemaPath: '#/type',
      keyword: 'type',
      params: { type: 'object' },
      message: 'must be object',
    };
    if (vErrors === null) {
      vErrors = [err14];
    } else {
      vErrors.push(err14);
    }
    errors++;
  }
  validate170.errors = vErrors;
  return errors === 0;
}
function validate169(
  data,
  { instancePath = '', parentData, parentDataProperty, rootData = data } = {},
) {
  /*# sourceURL="https://www.designtokens.org/schemas/2025.10/format/groupOrToken.json" */ let vErrors =
    null;
  let errors = 0;
  const _errs0 = errors;
  let valid0 = false;
  let passing0 = null;
  const _errs1 = errors;
  if (!validate170(data, { instancePath, parentData, parentDataProperty, rootData })) {
    vErrors = vErrors === null ? validate170.errors : vErrors.concat(validate170.errors);
    errors = vErrors.length;
  }
  var _valid0 = _errs1 === errors;
  if (_valid0) {
    valid0 = true;
    passing0 = 0;
  }
  const _errs2 = errors;
  if (!validate11(data, { instancePath, parentData, parentDataProperty, rootData })) {
    vErrors = vErrors === null ? validate11.errors : vErrors.concat(validate11.errors);
    errors = vErrors.length;
  }
  var _valid0 = _errs2 === errors;
  if (_valid0 && valid0) {
    valid0 = false;
    passing0 = [passing0, 1];
  } else {
    if (_valid0) {
      valid0 = true;
      passing0 = 1;
    }
  }
  if (!valid0) {
    const err0 = {
      instancePath,
      schemaPath: '#/oneOf',
      keyword: 'oneOf',
      params: { passingSchemas: passing0 },
      message: 'must match exactly one schema in oneOf',
    };
    if (vErrors === null) {
      vErrors = [err0];
    } else {
      vErrors.push(err0);
    }
    errors++;
  } else {
    errors = _errs0;
    if (vErrors !== null) {
      if (_errs0) {
        vErrors.length = _errs0;
      } else {
        vErrors = null;
      }
    }
  }
  validate169.errors = vErrors;
  return errors === 0;
}
function validate10(
  data,
  { instancePath = '', parentData, parentDataProperty, rootData = data } = {},
) {
  /*# sourceURL="https://www.designtokens.org/schemas/2025.10/format.json" */ let vErrors = null;
  let errors = 0;
  if (data && typeof data == 'object' && !Array.isArray(data)) {
    for (const key0 in data) {
      if (!(
        key0 === '$schema' ||
        key0 === '$type' ||
        key0 === '$description' ||
        key0 === '$extensions' ||
        key0 === '$extends' ||
        key0 === '$deprecated' ||
        key0 === '$root' ||
        pattern0.test(key0)
      )) {
        const err0 = {
          instancePath,
          schemaPath: '#/additionalProperties',
          keyword: 'additionalProperties',
          params: { additionalProperty: key0 },
          message: 'must NOT have additional properties',
        };
        if (vErrors === null) {
          vErrors = [err0];
        } else {
          vErrors.push(err0);
        }
        errors++;
      }
    }
    if (data.$schema !== undefined) {
      let data0 = data.$schema;
      if (typeof data0 === 'string') {
        if (!formats0.test(data0)) {
          const err1 = {
            instancePath: instancePath + '/$schema',
            schemaPath: '#/properties/%24schema/format',
            keyword: 'format',
            params: { format: 'uri-reference' },
            message: 'must match format "' + 'uri-reference' + '"',
          };
          if (vErrors === null) {
            vErrors = [err1];
          } else {
            vErrors.push(err1);
          }
          errors++;
        }
      } else {
        const err2 = {
          instancePath: instancePath + '/$schema',
          schemaPath: '#/properties/%24schema/type',
          keyword: 'type',
          params: { type: 'string' },
          message: 'must be string',
        };
        if (vErrors === null) {
          vErrors = [err2];
        } else {
          vErrors.push(err2);
        }
        errors++;
      }
    }
    if (data.$type !== undefined) {
      let data1 = data.$type;
      if (typeof data1 !== 'string') {
        const err3 = {
          instancePath: instancePath + '/$type',
          schemaPath: 'https://www.designtokens.org/schemas/2025.10/format/tokenType.json/type',
          keyword: 'type',
          params: { type: 'string' },
          message: 'must be string',
        };
        if (vErrors === null) {
          vErrors = [err3];
        } else {
          vErrors.push(err3);
        }
        errors++;
      }
      if (!(
        data1 === 'color' ||
        data1 === 'dimension' ||
        data1 === 'fontFamily' ||
        data1 === 'fontWeight' ||
        data1 === 'duration' ||
        data1 === 'cubicBezier' ||
        data1 === 'number' ||
        data1 === 'strokeStyle' ||
        data1 === 'border' ||
        data1 === 'transition' ||
        data1 === 'shadow' ||
        data1 === 'gradient' ||
        data1 === 'typography'
      )) {
        const err4 = {
          instancePath: instancePath + '/$type',
          schemaPath: 'https://www.designtokens.org/schemas/2025.10/format/tokenType.json/enum',
          keyword: 'enum',
          params: { allowedValues: schema12.enum },
          message: 'must be equal to one of the allowed values',
        };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      }
    }
    if (data.$description !== undefined) {
      if (typeof data.$description !== 'string') {
        const err5 = {
          instancePath: instancePath + '/$description',
          schemaPath: '#/properties/%24description/type',
          keyword: 'type',
          params: { type: 'string' },
          message: 'must be string',
        };
        if (vErrors === null) {
          vErrors = [err5];
        } else {
          vErrors.push(err5);
        }
        errors++;
      }
    }
    if (data.$extensions !== undefined) {
      let data3 = data.$extensions;
      if (!(data3 && typeof data3 == 'object' && !Array.isArray(data3))) {
        const err6 = {
          instancePath: instancePath + '/$extensions',
          schemaPath: '#/properties/%24extensions/type',
          keyword: 'type',
          params: { type: 'object' },
          message: 'must be object',
        };
        if (vErrors === null) {
          vErrors = [err6];
        } else {
          vErrors.push(err6);
        }
        errors++;
      }
    }
    if (data.$extends !== undefined) {
      let data4 = data.$extends;
      const _errs13 = errors;
      let valid2 = false;
      let passing0 = null;
      const _errs14 = errors;
      if (typeof data4 === 'string') {
        if (!pattern1.test(data4)) {
          const err7 = {
            instancePath: instancePath + '/$extends',
            schemaPath: '#/definitions/curlyBraceReference/pattern',
            keyword: 'pattern',
            params: { pattern: '^\\{[^${}.][^{}.]*(\\.[^${}.][^{}.]*)*\\}$' },
            message: 'must match pattern "' + '^\\{[^${}.][^{}.]*(\\.[^${}.][^{}.]*)*\\}$' + '"',
          };
          if (vErrors === null) {
            vErrors = [err7];
          } else {
            vErrors.push(err7);
          }
          errors++;
        }
      } else {
        const err8 = {
          instancePath: instancePath + '/$extends',
          schemaPath: '#/definitions/curlyBraceReference/type',
          keyword: 'type',
          params: { type: 'string' },
          message: 'must be string',
        };
        if (vErrors === null) {
          vErrors = [err8];
        } else {
          vErrors.push(err8);
        }
        errors++;
      }
      var _valid0 = _errs14 === errors;
      if (_valid0) {
        valid2 = true;
        passing0 = 0;
      }
      const _errs17 = errors;
      if (typeof data4 === 'string') {
        if (!pattern2.test(data4)) {
          const err9 = {
            instancePath: instancePath + '/$extends',
            schemaPath: '#/definitions/jsonPointerReference/pattern',
            keyword: 'pattern',
            params: { pattern: '^#/' },
            message: 'must match pattern "' + '^#/' + '"',
          };
          if (vErrors === null) {
            vErrors = [err9];
          } else {
            vErrors.push(err9);
          }
          errors++;
        }
        if (!formats2.test(data4)) {
          const err10 = {
            instancePath: instancePath + '/$extends',
            schemaPath: '#/definitions/jsonPointerReference/format',
            keyword: 'format',
            params: { format: 'json-pointer-uri-fragment' },
            message: 'must match format "' + 'json-pointer-uri-fragment' + '"',
          };
          if (vErrors === null) {
            vErrors = [err10];
          } else {
            vErrors.push(err10);
          }
          errors++;
        }
      } else {
        const err11 = {
          instancePath: instancePath + '/$extends',
          schemaPath: '#/definitions/jsonPointerReference/type',
          keyword: 'type',
          params: { type: 'string' },
          message: 'must be string',
        };
        if (vErrors === null) {
          vErrors = [err11];
        } else {
          vErrors.push(err11);
        }
        errors++;
      }
      var _valid0 = _errs17 === errors;
      if (_valid0 && valid2) {
        valid2 = false;
        passing0 = [passing0, 1];
      } else {
        if (_valid0) {
          valid2 = true;
          passing0 = 1;
        }
      }
      if (!valid2) {
        const err12 = {
          instancePath: instancePath + '/$extends',
          schemaPath: '#/properties/%24extends/oneOf',
          keyword: 'oneOf',
          params: { passingSchemas: passing0 },
          message: 'must match exactly one schema in oneOf',
        };
        if (vErrors === null) {
          vErrors = [err12];
        } else {
          vErrors.push(err12);
        }
        errors++;
      } else {
        errors = _errs13;
        if (vErrors !== null) {
          if (_errs13) {
            vErrors.length = _errs13;
          } else {
            vErrors = null;
          }
        }
      }
    }
    if (data.$deprecated !== undefined) {
      let data5 = data.$deprecated;
      const _errs21 = errors;
      let valid5 = false;
      let passing1 = null;
      const _errs22 = errors;
      if (typeof data5 !== 'boolean') {
        const err13 = {
          instancePath: instancePath + '/$deprecated',
          schemaPath: '#/properties/%24deprecated/oneOf/0/type',
          keyword: 'type',
          params: { type: 'boolean' },
          message: 'must be boolean',
        };
        if (vErrors === null) {
          vErrors = [err13];
        } else {
          vErrors.push(err13);
        }
        errors++;
      }
      var _valid1 = _errs22 === errors;
      if (_valid1) {
        valid5 = true;
        passing1 = 0;
      }
      const _errs24 = errors;
      if (typeof data5 !== 'string') {
        const err14 = {
          instancePath: instancePath + '/$deprecated',
          schemaPath: '#/properties/%24deprecated/oneOf/1/type',
          keyword: 'type',
          params: { type: 'string' },
          message: 'must be string',
        };
        if (vErrors === null) {
          vErrors = [err14];
        } else {
          vErrors.push(err14);
        }
        errors++;
      }
      var _valid1 = _errs24 === errors;
      if (_valid1 && valid5) {
        valid5 = false;
        passing1 = [passing1, 1];
      } else {
        if (_valid1) {
          valid5 = true;
          passing1 = 1;
        }
      }
      if (!valid5) {
        const err15 = {
          instancePath: instancePath + '/$deprecated',
          schemaPath: '#/properties/%24deprecated/oneOf',
          keyword: 'oneOf',
          params: { passingSchemas: passing1 },
          message: 'must match exactly one schema in oneOf',
        };
        if (vErrors === null) {
          vErrors = [err15];
        } else {
          vErrors.push(err15);
        }
        errors++;
      } else {
        errors = _errs21;
        if (vErrors !== null) {
          if (_errs21) {
            vErrors.length = _errs21;
          } else {
            vErrors = null;
          }
        }
      }
    }
    if (data.$root !== undefined) {
      if (
        !validate11(data.$root, {
          instancePath: instancePath + '/$root',
          parentData: data,
          parentDataProperty: '$root',
          rootData,
        })
      ) {
        vErrors = vErrors === null ? validate11.errors : vErrors.concat(validate11.errors);
        errors = vErrors.length;
      }
    }
    for (const key1 in data) {
      if (pattern0.test(key1)) {
        if (
          !validate169(data[key1], {
            instancePath: instancePath + '/' + key1.replace(/~/g, '~0').replace(/\//g, '~1'),
            parentData: data,
            parentDataProperty: key1,
            rootData,
          })
        ) {
          vErrors = vErrors === null ? validate169.errors : vErrors.concat(validate169.errors);
          errors = vErrors.length;
        }
      }
    }
  } else {
    const err16 = {
      instancePath,
      schemaPath: '#/type',
      keyword: 'type',
      params: { type: 'object' },
      message: 'must be object',
    };
    if (vErrors === null) {
      vErrors = [err16];
    } else {
      vErrors.push(err16);
    }
    errors++;
  }
  validate10.errors = vErrors;
  return errors === 0;
}
