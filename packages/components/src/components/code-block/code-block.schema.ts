import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    code: {
      type: 'string',
      description: 'The code to render.',
    },
    language: {
      type: 'string',
      description:
        'Optional language label rendered in the header; also selects the grammar for highlighting.',
    },
    highlight: {
      type: 'boolean',
      description:
        'Whether to highlight. Defaults to `true` whenever `language` is set.\n\n`highlight={false}` is an absolute off switch: it disables ALL\nhighlighting — including an explicit `highlighter` prop — and triggers no\nShiki import. The block renders the escaped plain `<pre><code>` fallback\nwhile keeping the `language` header label.',
    },
    copyable: {
      type: 'boolean',
      description: 'When true, render a copy button in the header.',
    },
    class: {
      type: 'string',
      description: 'Additional class names merged with `.cinder-code-block`.',
    },
  },
  additionalProperties: false,
  required: ['code'],
  metadata: {
    unsupportedProps: [
      {
        name: 'highlighter',
        reason: 'function-or-snippet',
        description:
          'Custom highlighter for this instance, used in place of the bundled Shiki\ndefault. Receives `(code, language)` and returns an HTML string (sync or\nasync). When provided, the default highlighter is never imported.',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
