import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    activeIndex: {
      type: 'number',
      description: 'Zero-based active index (bindable).',
    },
    autoplay: {
      type: 'boolean',
      description: 'Enables interval-based auto-advance.',
    },
    autoplayInterval: {
      type: 'number',
      description: 'Milliseconds between auto-advance ticks.',
    },
    loop: {
      type: 'boolean',
      description:
        'Wraps navigation past the first/last slide back around. Default `false`:\n`Previous`/`Next` clamp and disable at the ends instead of wrapping.',
    },
    label: {
      type: 'string',
      description: 'Accessible name for the carousel region.',
    },
    description: {
      type: 'string',
      description: 'Optional accessible description linked to the region.',
    },
    indicators: {
      enum: ['dots', 'counter', 'none'],
      description:
        "How the slide picker is rendered. `'dots'` below `indicatorLimit`\ndegrades automatically to `'counter'` above it when left unset.",
    },
    indicatorLimit: {
      type: 'number',
      description:
        'Slide count above which the auto-resolved picker switches to a counter. Default `8`.',
    },
    slidesPerView: {
      anyOf: [
        {
          type: 'number',
        },
        {
          const: 'auto',
        },
      ],
      description:
        "How many slides are visible at once. A fraction (e.g. `1.2`) peeks the\nnext slide. `'auto'` lets each slide size itself via its own CSS.\nDefault `1`. Not supported together with `loop` — `loop` is ignored\n(with a dev warning) while this is set above `1`.",
    },
    gap: {
      type: 'string',
      description:
        "Gap between slides, as a CSS length (e.g. `'1rem'`). Only applied when `slidesPerView` is not `1`.",
    },
    align: {
      enum: ['start', 'center'],
      description: "Snap alignment of the active slide(s) within the viewport. Default `'start'`.",
    },
    class: {
      type: 'string',
      description: 'Additional classes merged onto the root element.',
    },
  },
  additionalProperties: false,
  metadata: {
    unsupportedProps: [
      {
        name: 'controlLabels',
        reason: 'unknown-shape',
        description: 'Override labels for controls and picker.',
      },
      {
        name: 'onSlideChange',
        reason: 'function-or-snippet',
        description:
          "Called after the active slide changes as a result of the carousel's own navigation (never for a parent-driven `activeIndex` update).",
      },
      {
        name: 'slide',
        reason: 'function-or-snippet',
        description:
          "Renders inside each slide's `<article>`, replacing the built-in\nimage/title/description/link body. `slides` remains the identity and\naccessible-labeling source of truth — this only replaces slide content.",
      },
      {
        name: 'slides',
        reason: 'generic-type-parameter',
        required: true,
        description: 'Ordered list of slides.',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
