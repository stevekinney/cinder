import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    id: {
      type: 'string',
      description:
        'HTML `id` for the underlying input, used to associate the `<label>` and ARIA attributes.',
    },
    value: {
      type: 'string',
      description: 'Bindable current text value of the input.',
    },
    label: {
      type: 'string',
      description: 'Visible label text rendered above the input and linked via `for`/`id`.',
    },
    description: {
      type: 'string',
      description: 'Helper text rendered below the input and associated via `aria-describedby`.',
    },
    error: {
      type: 'string',
      description: 'Error message rendered below the input; also sets `aria-invalid` on the input.',
    },
    minQueryLength: {
      type: 'number',
      description:
        'Minimum number of characters the user must type before suggestions are requested. Default `1`.',
    },
    maxVisibleSuggestions: {
      type: 'number',
      description: 'Maximum number of suggestions rendered in the listbox at once. Default `50`.',
    },
    placeholder: {
      type: 'string',
      description: 'Placeholder text shown inside the input when it is empty.',
    },
    disabled: {
      type: 'boolean',
      description:
        'When true, disables the input and prevents interaction, matching the native `disabled` attribute.',
    },
    required: {
      type: 'boolean',
      description:
        'Marks the input as required for form validation, matching the native `required` attribute.',
    },
    readonly: {
      type: 'boolean',
      description:
        'When true, the input value cannot be changed by the user, matching the native `readonly` attribute.',
    },
    emptyMessage: {
      type: 'string',
      description:
        'Message shown in the listbox when the suggestion source returns no results. Default `"No suggestions"`.',
    },
    loadingMessage: {
      type: 'string',
      description:
        'Message shown in the listbox while the suggestion source is fetching results. Default `"Loading suggestions"`.',
    },
    class: {
      type: 'string',
      description: 'Additional class names merged onto the root wrapper element.',
    },
  },
  additionalProperties: false,
  metadata: {
    unsupportedProps: [
      {
        name: 'oncomplete',
        reason: 'function-or-snippet',
      },
      {
        name: 'oninput',
        reason: 'function-or-snippet',
      },
      {
        name: 'suggestionSource',
        reason: 'function-or-snippet',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
