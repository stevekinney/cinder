import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    label: {
      type: 'string',
      description: 'Accessible label for the timeline list.',
    },
    class: {
      type: 'string',
      description: 'Additional CSS classes applied to the root element.',
    },
    steps: {
      type: 'array',
      items: {
        anyOf: [
          {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                description: 'Stable identity; used as the keyed list identity.',
              },
              label: {
                type: 'string',
                description: 'Display label for this step.',
              },
              status: {
                enum: [
                  'pending',
                  'running',
                  'succeeded',
                  'failed',
                  'cancelled',
                  'skipped',
                  'retrying',
                  'waiting_approval',
                ],
                description: 'Generic execution state.',
              },
              startTime: {
                type: 'string',
                description: 'ISO datetime string for when this step started.',
              },
              endTime: {
                type: 'string',
                description: 'ISO datetime string for when this step ended.',
              },
              duration: {
                type: 'string',
                description: 'Human-readable duration string, e.g. "1m 23s".',
              },
              attemptCount: {
                type: 'number',
                description: 'Number of attempts made so far, including any retries.',
              },
              actionsCount: {
                type: 'number',
                description: 'Number of actions associated with this step.',
              },
              progress: {
                type: 'number',
                description: 'Optional determinate progress value between 0 and `progressMax`.',
              },
              progressMax: {
                type: 'number',
                description: 'Maximum value for the progress bar. Defaults to 100.',
              },
              details: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: {
                      type: 'string',
                      description: 'Stable identity for this detail panel.',
                    },
                    label: {
                      type: 'string',
                      description: 'Trigger label rendered on the Collapsible header.',
                    },
                    content: {
                      type: 'string',
                      description: 'Pre-formatted content shown inside the panel.',
                    },
                  },
                  additionalProperties: false,
                  required: ['content', 'id', 'label'],
                },
                description: 'Expandable detail panels (logs, payloads, errors) shown inline.',
              },
              link: {
                type: 'object',
                properties: {
                  href: {
                    type: 'string',
                    description: 'Destination URL for the step link.',
                  },
                  label: {
                    type: 'string',
                    description: 'Visible text for the step link.',
                  },
                },
                additionalProperties: false,
                required: ['href', 'label'],
                description: 'Optional link to logs, traces, or a step detail route.',
              },
              rewound: {
                type: 'boolean',
                description:
                  'Marks a step that was speculatively executed and then unwound (rolled back).',
              },
              compensates: {
                type: 'string',
                description: 'Id of the forward step that this step compensates (reverses).',
              },
              children: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: {
                      type: 'string',
                      description: 'Stable identity; used as the keyed list identity.',
                    },
                    label: {
                      type: 'string',
                      description: 'Display label for this step.',
                    },
                    status: {
                      enum: [
                        'pending',
                        'running',
                        'succeeded',
                        'failed',
                        'cancelled',
                        'skipped',
                        'retrying',
                        'waiting_approval',
                      ],
                      description: 'Generic execution state.',
                    },
                    startTime: {
                      type: 'string',
                      description: 'ISO datetime string for when this step started.',
                    },
                    endTime: {
                      type: 'string',
                      description: 'ISO datetime string for when this step ended.',
                    },
                    duration: {
                      type: 'string',
                      description: 'Human-readable duration string, e.g. "1m 23s".',
                    },
                    attemptCount: {
                      type: 'number',
                      description: 'Number of attempts made so far, including any retries.',
                    },
                    actionsCount: {
                      type: 'number',
                      description: 'Number of actions associated with this step.',
                    },
                    progress: {
                      type: 'number',
                      description:
                        'Optional determinate progress value between 0 and `progressMax`.',
                    },
                    progressMax: {
                      type: 'number',
                      description: 'Maximum value for the progress bar. Defaults to 100.',
                    },
                    details: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: {
                            type: 'string',
                            description: 'Stable identity for this detail panel.',
                          },
                          label: {
                            type: 'string',
                            description: 'Trigger label rendered on the Collapsible header.',
                          },
                          content: {
                            type: 'string',
                            description: 'Pre-formatted content shown inside the panel.',
                          },
                        },
                        additionalProperties: false,
                        required: ['content', 'id', 'label'],
                      },
                      description:
                        'Expandable detail panels (logs, payloads, errors) shown inline.',
                    },
                    link: {
                      type: 'object',
                      properties: {
                        href: {
                          type: 'string',
                          description: 'Destination URL for the step link.',
                        },
                        label: {
                          type: 'string',
                          description: 'Visible text for the step link.',
                        },
                      },
                      additionalProperties: false,
                      required: ['href', 'label'],
                      description: 'Optional link to logs, traces, or a step detail route.',
                    },
                    rewound: {
                      type: 'boolean',
                      description:
                        'Marks a step that was speculatively executed and then unwound (rolled back).',
                    },
                    compensates: {
                      type: 'string',
                      description: 'Id of the forward step that this step compensates (reverses).',
                    },
                    children: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: {
                            type: 'string',
                            description: 'Stable identity; used as the keyed list identity.',
                          },
                          label: {
                            type: 'string',
                            description: 'Display label for this step.',
                          },
                          status: {
                            enum: [
                              'pending',
                              'running',
                              'succeeded',
                              'failed',
                              'cancelled',
                              'skipped',
                              'retrying',
                              'waiting_approval',
                            ],
                            description: 'Generic execution state.',
                          },
                          startTime: {
                            type: 'string',
                            description: 'ISO datetime string for when this step started.',
                          },
                          endTime: {
                            type: 'string',
                            description: 'ISO datetime string for when this step ended.',
                          },
                          duration: {
                            type: 'string',
                            description: 'Human-readable duration string, e.g. "1m 23s".',
                          },
                          attemptCount: {
                            type: 'number',
                            description: 'Number of attempts made so far, including any retries.',
                          },
                          actionsCount: {
                            type: 'number',
                            description: 'Number of actions associated with this step.',
                          },
                          progress: {
                            type: 'number',
                            description:
                              'Optional determinate progress value between 0 and `progressMax`.',
                          },
                          progressMax: {
                            type: 'number',
                            description: 'Maximum value for the progress bar. Defaults to 100.',
                          },
                          details: {
                            type: 'array',
                            items: {
                              type: 'object',
                              properties: {
                                id: {
                                  type: 'string',
                                  description: 'Stable identity for this detail panel.',
                                },
                                label: {
                                  type: 'string',
                                  description: 'Trigger label rendered on the Collapsible header.',
                                },
                                content: {
                                  type: 'string',
                                  description: 'Pre-formatted content shown inside the panel.',
                                },
                              },
                              additionalProperties: false,
                              required: ['content', 'id', 'label'],
                            },
                            description:
                              'Expandable detail panels (logs, payloads, errors) shown inline.',
                          },
                          link: {
                            type: 'object',
                            properties: {
                              href: {
                                type: 'string',
                                description: 'Destination URL for the step link.',
                              },
                              label: {
                                type: 'string',
                                description: 'Visible text for the step link.',
                              },
                            },
                            additionalProperties: false,
                            required: ['href', 'label'],
                            description: 'Optional link to logs, traces, or a step detail route.',
                          },
                          rewound: {
                            type: 'boolean',
                            description:
                              'Marks a step that was speculatively executed and then unwound (rolled back).',
                          },
                          compensates: {
                            type: 'string',
                            description:
                              'Id of the forward step that this step compensates (reverses).',
                          },
                          children: {
                            type: 'array',
                            items: {
                              type: 'object',
                              properties: {
                                id: {
                                  type: 'string',
                                  description: 'Stable identity; used as the keyed list identity.',
                                },
                                label: {
                                  type: 'string',
                                  description: 'Display label for this step.',
                                },
                                status: {
                                  enum: [
                                    'pending',
                                    'running',
                                    'succeeded',
                                    'failed',
                                    'cancelled',
                                    'skipped',
                                    'retrying',
                                    'waiting_approval',
                                  ],
                                  description: 'Generic execution state.',
                                },
                                startTime: {
                                  type: 'string',
                                  description: 'ISO datetime string for when this step started.',
                                },
                                endTime: {
                                  type: 'string',
                                  description: 'ISO datetime string for when this step ended.',
                                },
                                duration: {
                                  type: 'string',
                                  description: 'Human-readable duration string, e.g. "1m 23s".',
                                },
                                attemptCount: {
                                  type: 'number',
                                  description:
                                    'Number of attempts made so far, including any retries.',
                                },
                                actionsCount: {
                                  type: 'number',
                                  description: 'Number of actions associated with this step.',
                                },
                                progress: {
                                  type: 'number',
                                  description:
                                    'Optional determinate progress value between 0 and `progressMax`.',
                                },
                                progressMax: {
                                  type: 'number',
                                  description:
                                    'Maximum value for the progress bar. Defaults to 100.',
                                },
                                details: {
                                  type: 'array',
                                  items: {
                                    type: 'object',
                                    properties: {
                                      id: {
                                        type: 'string',
                                        description: 'Stable identity for this detail panel.',
                                      },
                                      label: {
                                        type: 'string',
                                        description:
                                          'Trigger label rendered on the Collapsible header.',
                                      },
                                      content: {
                                        type: 'string',
                                        description:
                                          'Pre-formatted content shown inside the panel.',
                                      },
                                    },
                                    additionalProperties: false,
                                    required: ['content', 'id', 'label'],
                                  },
                                  description:
                                    'Expandable detail panels (logs, payloads, errors) shown inline.',
                                },
                                link: {
                                  type: 'object',
                                  properties: {
                                    href: {
                                      type: 'string',
                                      description: 'Destination URL for the step link.',
                                    },
                                    label: {
                                      type: 'string',
                                      description: 'Visible text for the step link.',
                                    },
                                  },
                                  additionalProperties: false,
                                  required: ['href', 'label'],
                                  description:
                                    'Optional link to logs, traces, or a step detail route.',
                                },
                                rewound: {
                                  type: 'boolean',
                                  description:
                                    'Marks a step that was speculatively executed and then unwound (rolled back).',
                                },
                                compensates: {
                                  type: 'string',
                                  description:
                                    'Id of the forward step that this step compensates (reverses).',
                                },
                                children: {
                                  type: 'array',
                                  items: {
                                    type: 'object',
                                    additionalProperties: true,
                                  },
                                  description:
                                    'Descendants beyond the rendered depth cap; summarized as a depth-limit row.',
                                },
                              },
                              additionalProperties: false,
                              required: ['id', 'label', 'status'],
                            },
                            description: 'Nested child-workflow steps rendered at depth 3.',
                          },
                        },
                        additionalProperties: false,
                        required: ['id', 'label', 'status'],
                      },
                      description: 'Nested child-workflow steps rendered at depth 2.',
                    },
                  },
                  additionalProperties: false,
                  required: ['id', 'label', 'status'],
                },
                description: 'Schema-bounded nested child-workflow steps.',
              },
            },
            additionalProperties: false,
            required: ['id', 'label', 'status'],
          },
          {
            type: 'object',
            properties: {
              kind: {
                const: 'branch',
                description: 'Discriminator identifying a branch-group entry.',
              },
              id: {
                type: 'string',
                description: 'Stable identity; used as the keyed list identity.',
              },
              label: {
                type: 'string',
                description: 'Display label for the branch group.',
              },
              lanes: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: {
                      type: 'string',
                      description:
                        'Stable identity; used as the keyed list identity within the group.',
                    },
                    label: {
                      type: 'string',
                      description: 'Optional display label for the lane.',
                    },
                    outcome: {
                      enum: ['won', 'lost', 'settled'],
                      description:
                        'Competitive outcome for the lane. Omit while the branch is still racing.',
                    },
                    steps: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: {
                            type: 'string',
                            description: 'Stable identity; used as the keyed list identity.',
                          },
                          label: {
                            type: 'string',
                            description: 'Display label for this step.',
                          },
                          status: {
                            enum: [
                              'pending',
                              'running',
                              'succeeded',
                              'failed',
                              'cancelled',
                              'skipped',
                              'retrying',
                              'waiting_approval',
                            ],
                            description: 'Generic execution state.',
                          },
                          startTime: {
                            type: 'string',
                            description: 'ISO datetime string for when this step started.',
                          },
                          endTime: {
                            type: 'string',
                            description: 'ISO datetime string for when this step ended.',
                          },
                          duration: {
                            type: 'string',
                            description: 'Human-readable duration string, e.g. "1m 23s".',
                          },
                          attemptCount: {
                            type: 'number',
                            description: 'Number of attempts made so far, including any retries.',
                          },
                          actionsCount: {
                            type: 'number',
                            description: 'Number of actions associated with this step.',
                          },
                          progress: {
                            type: 'number',
                            description:
                              'Optional determinate progress value between 0 and `progressMax`.',
                          },
                          progressMax: {
                            type: 'number',
                            description: 'Maximum value for the progress bar. Defaults to 100.',
                          },
                          details: {
                            type: 'array',
                            items: {
                              type: 'object',
                              properties: {
                                id: {
                                  type: 'string',
                                  description: 'Stable identity for this detail panel.',
                                },
                                label: {
                                  type: 'string',
                                  description: 'Trigger label rendered on the Collapsible header.',
                                },
                                content: {
                                  type: 'string',
                                  description: 'Pre-formatted content shown inside the panel.',
                                },
                              },
                              additionalProperties: false,
                              required: ['content', 'id', 'label'],
                            },
                            description:
                              'Expandable detail panels (logs, payloads, errors) shown inline.',
                          },
                          link: {
                            type: 'object',
                            properties: {
                              href: {
                                type: 'string',
                                description: 'Destination URL for the step link.',
                              },
                              label: {
                                type: 'string',
                                description: 'Visible text for the step link.',
                              },
                            },
                            additionalProperties: false,
                            required: ['href', 'label'],
                            description: 'Optional link to logs, traces, or a step detail route.',
                          },
                          rewound: {
                            type: 'boolean',
                            description:
                              'Marks a step that was speculatively executed and then unwound (rolled back).',
                          },
                          compensates: {
                            type: 'string',
                            description:
                              'Id of the forward step that this step compensates (reverses).',
                          },
                        },
                        additionalProperties: false,
                        required: ['id', 'label', 'status'],
                      },
                      description: 'Ordered steps that ran within this lane.',
                    },
                  },
                  additionalProperties: false,
                  required: ['id', 'steps'],
                },
                description: 'The parallel sub-lanes.',
              },
              collapseThreshold: {
                type: 'number',
                description:
                  'Collapse the group by default once the lane count reaches this threshold. Defaults to 3.',
              },
              collapsed: {
                type: 'boolean',
                description: 'Force the initial collapsed (`true`) or expanded (`false`) state.',
              },
            },
            additionalProperties: false,
            required: ['id', 'kind', 'label', 'lanes'],
          },
        ],
      },
      description:
        'Ordered list of timeline entries to render — either steps or branch/coordination groups.',
    },
  },
  additionalProperties: false,
  metadata: {
    unsupportedProps: [
      {
        name: 'children',
        reason: 'function-or-snippet',
        description: 'Optional per-step body content rendered after the step metadata.',
      },
    ],
  },
  required: ['steps'],
} satisfies ComponentSchema;

export default schema as ComponentSchema;
