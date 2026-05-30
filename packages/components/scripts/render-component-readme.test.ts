import { describe, expect, test } from 'bun:test';

import type { ComponentSchemaOutput } from './generate-component-schema.ts';
import { renderComponentReadme } from './render-component-readme.ts';

describe('renderComponentReadme', () => {
  test('groups enum union array item types in generated prop tables', () => {
    const existingReadme = [
      '# Example',
      '',
      '<!-- generated:props:start -->',
      'old props',
      '<!-- generated:props:end -->',
      '<!-- generated:variables:start -->',
      'old variables',
      '<!-- generated:variables:end -->',
    ].join('\n');

    const schema: ComponentSchemaOutput = {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      properties: {
        formats: {
          type: 'array',
          items: {
            enum: ['hex', 'rgb', 'hsl'],
          },
          description: 'Accepted formats.',
        },
      },
      additionalProperties: false,
    };

    const readme = renderComponentReadme({
      existingReadme,
      schema,
      variables: [],
    });

    expect(readme).toContain(
      '| `formats` | (`"hex"` \\| `"rgb"` \\| `"hsl"`)[] | no | — | Accepted formats. |',
    );
  });

  test('renders unsupported props with `no` required and prose, not the raw reason token', () => {
    const existingReadme = [
      '# Example',
      '',
      '<!-- generated:props:start -->',
      'old props',
      '<!-- generated:props:end -->',
    ].join('\n');

    const schema: ComponentSchemaOutput = {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      properties: {},
      additionalProperties: false,
      metadata: {
        unsupportedProps: [{ name: 'highlighter', reason: 'function-or-snippet' }],
      },
    };

    const readme = renderComponentReadme({
      existingReadme,
      schema,
      variables: [],
    });

    expect(readme).toContain(
      '| `highlighter` | `(opaque)` | no | — | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |',
    );
    // The raw reason token must never appear as the description.
    expect(readme).not.toContain('| `highlighter` | `(opaque)` | — | — | function-or-snippet |');
  });
});
