import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    direction: {
      enum: ['vertical', 'horizontal', 'both'],
      description: "Axis to allow scrolling on. Defaults to `'vertical'`.",
    },
    maxHeight: {
      type: 'string',
      description: 'Maximum block size of the scroll viewport (any valid CSS length).',
    },
    maxWidth: {
      type: 'string',
      description: 'Maximum inline size of the scroll viewport (any valid CSS length).',
    },
    ariaLabel: {
      type: 'string',
      description:
        'Accessible name for the scroll region. When provided on neutral\ncontainers, the container also gets `role="region"` so assistive\ntechnology treats it as a landmark. Semantic tags keep their native\nroles. Provide this when the scroll area represents a meaningful section\n(a chat transcript, a code panel) — omit it for purely decorative\nscrolling chrome. This is the single source of truth for the accessible\nname; pass it through this prop rather than the raw `aria-label` HTML\nattribute so the landmark role and label stay coupled.',
    },
    tabindex: {
      type: 'number',
      description:
        'Override the default focus behavior. The component sets `tabindex="0"`\nby default so keyboard users can reach the viewport for arrow-key\nscrolling. Pass `tabindex={-1}` when the viewport should be programmatically\nfocusable without entering the tab order.',
    },
    as: {
      enum: ['article', 'aside', 'div', 'li', 'main', 'nav', 'ol', 'pre', 'section', 'ul'],
      description: "Element tag to render. Defaults to `'div'`.",
    },
    class: {
      type: 'string',
      description: 'Additional classes merged onto the scroll viewport.',
    },
  },
  additionalProperties: false,
  metadata: {
    unsupportedProps: [
      {
        name: 'children',
        reason: 'function-or-snippet',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
