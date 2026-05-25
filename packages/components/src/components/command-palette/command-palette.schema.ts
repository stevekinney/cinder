import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    open: {
      type: 'boolean',
      description:
        'Bindable open state. The component mutates `open = false` on Escape,\nbackdrop click, or any explicit close path, then fires `onclose`.',
    },
    placeholder: {
      type: 'string',
      description: 'Placeholder rendered inside the search input.',
    },
    label: {
      type: 'string',
      description: 'Accessible name for the dialog, wired via `aria-label`.',
    },
    query: {
      type: 'string',
      description:
        "Bindable search query. Mutated by the input's oninput handler.\nExposed to the items snippet so consumers can filter.\nNote: query is NOT reset on close — consumers who want a fresh query on\neach open should reset it in their `onclose` callback.",
    },
    class: {
      type: 'string',
      description: 'Class merged onto the palette panel.',
    },
  },
  additionalProperties: false,
  required: ['open'],
  metadata: {
    unsupportedProps: [
      {
        name: 'empty',
        reason: 'function-or-snippet',
      },
      {
        name: 'footer',
        reason: 'function-or-snippet',
      },
      {
        name: 'items',
        reason: 'function-or-snippet',
      },
      {
        name: 'onclose',
        reason: 'function-or-snippet',
      },
      {
        name: 'triggerRef',
        reason: 'unknown-shape',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
