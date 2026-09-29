import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    id: {
      type: 'string',
      description:
        "Stable id forwarded into `FormField` context, which associates the\ngenerated `<label for={id}>` with it. Only a control that opts into\nand reads that context receives `id` automatically—for a native\nelement or a third-party component that doesn't, the label is\nunassociated unless the host also applies `id` to that control\ndirectly, the same qualification as `required` and `disabled`.",
    },
    label: {
      type: 'string',
      description: 'Visible setting label.',
    },
    description: {
      type: 'string',
      description: 'Guidance text describing the setting.',
    },
    warning: {
      type: 'string',
      description:
        'Advisory message. `FormField` renders this text itself, as a sibling\nof the control, not through context—a custom `control` that reads\n`FormField` context sees only the derived `warningId` (and the\ncomposed `describedBy`) to associate with, never the message string\nitself.',
    },
    error: {
      type: 'string',
      description:
        'Corrective error message. `FormField` renders this text itself, as a\nsibling of the control, not through context—a custom `control` that\nreads `FormField` context sees only the derived `errorId`, `invalid`,\nand the composed `describedBy`, never the message string itself.',
    },
    required: {
      type: 'boolean',
      description:
        "Renders the required marker and forwards `required` into `FormField`\ncontext. Only takes effect for a control that opts into and reads that\ncontext—it never adds a native `required` attribute, so a control that\ndoesn't consume the context still passes browser constraint validation\nand must receive `required` directly. `SettingRow` forwards `undefined`\nwhen omitted; `FormField` normalizes that to `false`. Defaults to\n`false`.",
      default: false,
    },
    disabled: {
      type: 'boolean',
      description:
        "Forwards a disabled state into `FormField` context for the row's\ncontrol. Only takes effect for a control that opts into and reads that\ncontext—a native element or a third-party component that doesn't\nconsume it stays interactive and must receive `disabled` directly.\nDoes not disable automatically while saving. `SettingRow` forwards\n`undefined` when omitted; `FormField` normalizes that to `false`.\nDefaults to `false`.",
      default: false,
    },
    managed: {
      type: 'object',
      properties: {
        by: {
          type: 'string',
          description: 'Policy or administrator that owns the value.',
        },
        reason: {
          type: 'string',
          description: 'Human-readable explanation for the constraint.',
        },
      },
      additionalProperties: false,
      description: 'Renders a managed-policy indicator; pair with `PolicyLock`.',
    },
    class: {
      type: 'string',
      description: "Additional class merged with the component's root class.",
    },
  },
  additionalProperties: false,
  required: ['id', 'label'],
  metadata: {
    unsupportedProps: [
      {
        name: 'control',
        reason: 'function-or-snippet',
        required: true,
        description: "The setting's control, rendered with `FormField` context applied.",
      },
      {
        name: 'disclosure',
        reason: 'function-or-snippet',
        description: 'Optional disclosure content rendered beneath the row.',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
