import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    ariaLabel: {
      type: 'string',
      description:
        'Accessible name for the <nav> landmark. Required, non-empty, distinct from other navs on the page.',
    },
  },
  additionalProperties: false,
  required: ['ariaLabel'],
  metadata: {
    unsupportedProps: [
      {
        name: 'children',
        reason: 'function-or-snippet',
        required: true,
        description: 'Must be <li> elements containing NavigationItem and/or SideNavigationGroup.',
      },
      {
        name: 'class',
        reason: 'unknown-shape',
        description: 'Additional CSS class merged with `.cinder-side-navigation`.',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
