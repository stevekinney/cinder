import { defineConstraints } from '../../_internal/constraints.ts';

export default defineConstraints({
  component: 'button',
  summary:
    'Button requires exactly one visual content source and, when rendered icon-only, an accessible name from aria-label, aria-labelledby, or a non-empty label prop.',
  rules: [
    {
      id: 'visual-content-source',
      severity: 'error',
      description:
        'Button must have exactly one visual content source: a visible label (label + iconOnly false), children content (children + iconOnly false), or icon-only mode (iconOnly true with at least one icon or children)',
      kind: 'exactlyOne',
      of: [
        // Branch 1: visible label text; iconOnly is false (default). Callers normalize the
        // default value to false before evaluation — absent iconOnly is treated as false.
        {
          allOf: [
            { prop: 'label', nonEmpty: true },
            { prop: 'iconOnly', equals: false },
          ],
        },
        // Branch 2: children snippet; iconOnly is false (default).
        {
          allOf: [{ snippet: 'children' }, { prop: 'iconOnly', equals: false }],
        },
        // Branch 3: icon-only mode — iconOnly must be true and at least one visual source present.
        {
          allOf: [
            { prop: 'iconOnly', equals: true },
            {
              anyOf: [
                { prop: 'leadingIcon', exists: true },
                { prop: 'trailingIcon', exists: true },
                { snippet: 'children' },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 'accessible-name',
      severity: 'error',
      description:
        'Icon-only buttons must have an accessible name via aria-label, aria-labelledby, or a non-empty label prop',
      kind: 'anyOf',
      when: { prop: 'iconOnly', equals: true },
      of: [
        { prop: 'aria-label', nonEmpty: true },
        { prop: 'aria-labelledby', nonEmpty: true },
        { prop: 'label', nonEmpty: true },
      ],
    },
  ],
  examples: {
    valid: [
      {
        title: 'Visible label',
        code: '<Button label="Save" />',
      },
      {
        title: 'Children as content',
        code: '<Button><span>Save</span></Button>',
      },
      {
        title: 'Icon-only with label as accessible name',
        code: '<Button iconOnly={true} label="Close">{@render closeIcon()}</Button>',
      },
      {
        title: 'Icon-only with aria-label',
        code: '<Button iconOnly={true} aria-label="Close">{@render closeIcon()}</Button>',
      },
      {
        title: 'Icon-only with leadingIcon and label',
        code: '<Button iconOnly={true} label="Settings">{@render settingsIcon()}</Button>',
      },
    ],
    invalid: [
      {
        title: 'Icon-only with no accessible name',
        code: '<Button iconOnly={true}>{@render closeIcon()}</Button>',
        violates: 'accessible-name',
      },
      {
        title: 'Both label and children as visual content',
        code: '<Button label="Save"><span>Also save</span></Button>',
        violates: 'visual-content-source',
      },
      {
        title: 'No visual content at all',
        code: '<Button />',
        violates: 'visual-content-source',
      },
      {
        title: 'Icon-only with no icon source',
        code: '<Button iconOnly={true} label="Close" />',
        violates: 'visual-content-source',
      },
    ],
  },
});
