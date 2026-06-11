import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    title: {
      type: 'string',
      description: 'Section title text. Rendered inside the dynamic heading element.',
    },
    description: {
      type: 'string',
      description:
        'Optional supporting description. Supplementary body text, not a heading\n subtitle — rendered after the heading but outside `<hgroup>`.',
    },
    level: {
      enum: [2, 3, 4],
      description:
        "Heading level for the title element. Defaults to `2`. The correct level\n relative to the surrounding document outline is the consumer's responsibility.",
    },
    class: {
      type: 'string',
      description: 'Additional class names merged onto the root `<div>`.',
    },
  },
  additionalProperties: false,
  required: ['title'],
  metadata: {
    unsupportedProps: [
      {
        name: 'actions',
        reason: 'function-or-snippet',
        description:
          'Optional trailing actions (buttons, menus). Rendered on the same row\n as the title at wide viewports.',
      },
      {
        name: 'label',
        reason: 'function-or-snippet',
        description:
          'Optional small uppercase "eyebrow" label. When present, the label is\n rendered as a `<p>` inside an `<hgroup>` that also contains the heading.\n\n The `<hgroup>` content model only permits `<p>` elements plus one\n heading element, so the snippet **must render phrasing content only** —\n plain text, `<span>`, `<strong>`, `<em>`, `<a>`, icons, etc. Do not\n render block elements (`<div>`, `<nav>`, `<button>` wrappers, additional\n headings) into this snippet; doing so produces invalid HTML inside\n `<hgroup>`.',
      },
      {
        name: 'tabs',
        reason: 'function-or-snippet',
        description:
          'Optional tablist. When both `actions` and `tabs` are present, `tabs`\n sits on a second row inside the shared root container.',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
