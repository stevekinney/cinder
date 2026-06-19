export default [
  {
    name: 'representative',
    props: {
      id: 'schema-form-representative',
      submitLabel: 'Create payload',
      schema: {
        type: 'object',
        title: 'Workflow input',
        properties: {
          name: {
            type: 'string',
            title: 'Name',
            minLength: 1,
          },
          count: {
            type: 'integer',
            title: 'Count',
            minimum: 1,
          },
          enabled: {
            type: 'boolean',
            title: 'Enabled',
          },
          mode: {
            type: 'string',
            title: 'Mode',
            enum: ['fast', 'safe'],
          },
          metadata: {
            type: 'object',
            title: 'Metadata',
            properties: {
              owner: { type: 'string', title: 'Owner' },
            },
            required: ['owner'],
          },
        },
        required: ['name', 'count', 'enabled', 'mode', 'metadata'],
      },
      value: {
        name: 'Import customers',
        count: 3,
        enabled: true,
        mode: 'safe',
        metadata: { owner: 'Operations' },
      },
    },
  },
];
