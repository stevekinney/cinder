/**
 * Machine-readable component API contract.
 *
 * This module is the source of truth that `src/api-contract.test.ts` validates
 * each component's exported Props type against. If a component's Props diverge
 * from this table — wrong prop name, wrong optionality, wrong default — the test
 * fails with a named error.
 *
 * Shape definitions mirror §Canonical Props shape in the plan:
 *   'literal'      — TSTypeLiteral (Shape A, no ...rest)
 *   'intersection' — TSIntersectionType (Shape B, has ...rest: SomeHTMLAttributes)
 *   'union'        — TSUnionType (Shape C, discriminated arms)
 *
 * Default definitions:
 *   { kind: 'literal',       value: <V> }      — plain default
 *   { kind: 'bindable',      value: <V> }      — $bindable(<V>) with a value
 *   { kind: 'bindable-empty' }                 — $bindable() with no argument
 *   undefined                                  — required, no default
 */

export type DefaultSpec =
  | { kind: 'literal'; value: unknown }
  | { kind: 'bindable'; value: unknown }
  | { kind: 'bindable-empty' }
  | undefined;

export type SnippetSpec =
  | { kind: 'zero-arg'; optional: boolean }
  | { kind: 'parameterized'; tupleArity: number; optional: boolean };

export type PropSpec = {
  optional: boolean;
  type_kind:
    | 'TSStringKeyword'
    | 'TSBooleanKeyword'
    | 'TSNumberKeyword'
    | 'TSLiteralType'
    | 'TSUnionType'
    | 'TSTypeReference'
    | 'TSArrayType'
    | 'TSFunctionType'
    | 'TSTypeOperator';
  default?: DefaultSpec;
};

export type ContractArm = {
  kind: 'literal' | 'intersection';
  html_attrs?: string;
  props: Record<string, PropSpec>;
  snippets: Record<string, SnippetSpec>;
};

export type ComponentContract = {
  kind: 'literal' | 'intersection' | 'union';
  html_attrs?: string;
  props?: Record<string, PropSpec>;
  snippets?: Record<string, SnippetSpec>;
  arms?: ContractArm[];
  generics?: Array<{ name: string; constraint?: string }>;
};

const L = (value: unknown): DefaultSpec => ({ kind: 'literal', value });
const B = (value: unknown): DefaultSpec => ({ kind: 'bindable', value });
const BE: DefaultSpec = { kind: 'bindable-empty' };
const REQUIRED: DefaultSpec = undefined; // required prop — caller must supply, no default in $props()
const NO_DEFAULT: DefaultSpec = undefined; // optional prop — present in $props() destructuring but no default expression

const s0 = (optional: boolean): SnippetSpec => ({ kind: 'zero-arg', optional });
const sp = (tupleArity: number, optional: boolean): SnippetSpec => ({
  kind: 'parameterized',
  tupleArity,
  optional,
});

export const CONTRACT: Record<string, ComponentContract> = {
  accordion: {
    kind: 'literal',
    props: {
      multiple: { optional: true, type_kind: 'TSBooleanKeyword', default: L(false) },
      expandedIds: { optional: false, type_kind: 'TSArrayType', default: B([]) },
      class: { optional: true, type_kind: 'TSStringKeyword', default: L(undefined) },
    },
    snippets: {
      children: s0(false),
    },
  },

  'accordion-item': {
    kind: 'literal',
    props: {
      id: { optional: false, type_kind: 'TSStringKeyword', default: REQUIRED },
      title: { optional: false, type_kind: 'TSStringKeyword', default: REQUIRED },
      disabled: { optional: true, type_kind: 'TSBooleanKeyword', default: L(false) },
      class: { optional: true, type_kind: 'TSStringKeyword', default: L(undefined) },
    },
    snippets: {
      children: s0(false),
    },
  },

  alert: {
    kind: 'intersection',
    html_attrs: 'HTMLAttributes',
    props: {
      variant: { optional: true, type_kind: 'TSTypeReference', default: L('info') },
      dismissible: { optional: true, type_kind: 'TSBooleanKeyword', default: L(false) },
      onDismiss: { optional: true, type_kind: 'TSFunctionType', default: NO_DEFAULT },
      class: { optional: true, type_kind: 'TSStringKeyword', default: L(undefined) },
    },
    snippets: {
      children: s0(false),
      icon: s0(true),
    },
  },

  badge: {
    kind: 'intersection',
    html_attrs: 'HTMLAttributes',
    props: {
      variant: { optional: true, type_kind: 'TSTypeReference', default: L('neutral') },
      size: { optional: true, type_kind: 'TSTypeReference', default: L('md') },
      class: { optional: true, type_kind: 'TSStringKeyword', default: L(undefined) },
    },
    snippets: {
      children: s0(false),
    },
  },

  button: {
    kind: 'union',
    arms: [
      {
        kind: 'intersection',
        html_attrs: 'HTMLButtonAttributes',
        props: {
          variant: { optional: true, type_kind: 'TSUnionType', default: L('secondary') },
          size: { optional: true, type_kind: 'TSUnionType', default: L('md') },
          fullWidth: { optional: true, type_kind: 'TSBooleanKeyword', default: L(false) },
          loading: { optional: true, type_kind: 'TSBooleanKeyword', default: L(false) },
          class: { optional: true, type_kind: 'TSStringKeyword', default: L(undefined) },
        },
        snippets: { children: s0(true) },
      },
      {
        kind: 'intersection',
        html_attrs: 'HTMLAnchorAttributes',
        props: {
          variant: { optional: true, type_kind: 'TSUnionType', default: L('secondary') },
          size: { optional: true, type_kind: 'TSUnionType', default: L('md') },
          fullWidth: { optional: true, type_kind: 'TSBooleanKeyword', default: L(false) },
          loading: { optional: true, type_kind: 'TSBooleanKeyword', default: L(false) },
          class: { optional: true, type_kind: 'TSStringKeyword', default: L(undefined) },
          href: { optional: false, type_kind: 'TSStringKeyword', default: REQUIRED },
        },
        snippets: { children: s0(true) },
      },
    ],
  },

  card: {
    kind: 'union',
    arms: [
      {
        kind: 'intersection',
        html_attrs: 'HTMLAttributes',
        props: { class: { optional: true, type_kind: 'TSStringKeyword', default: L(undefined) } },
        snippets: { header: s0(false), children: s0(false), footer: s0(true) },
      },
      {
        kind: 'intersection',
        html_attrs: 'HTMLAttributes',
        props: {
          title: { optional: false, type_kind: 'TSStringKeyword', default: REQUIRED },
          description: { optional: true, type_kind: 'TSStringKeyword', default: NO_DEFAULT },
          class: { optional: true, type_kind: 'TSStringKeyword', default: L(undefined) },
        },
        snippets: { children: s0(false), footer: s0(true) },
      },
    ],
  },

  'data-list': {
    kind: 'literal',
    generics: [{ name: 'T' }],
    props: {
      items: { optional: false, type_kind: 'TSArrayType', default: REQUIRED },
      class: { optional: true, type_kind: 'TSStringKeyword', default: L(undefined) },
    },
    snippets: {
      children: sp(1, false),
      empty: s0(true),
    },
  },

  dropdown: {
    kind: 'union',
    arms: [
      {
        kind: 'intersection',
        html_attrs: 'HTMLAttributes',
        props: {
          open: { optional: false, type_kind: 'TSBooleanKeyword', default: B(false) },
          placement: { optional: true, type_kind: 'TSTypeReference', default: L('bottom-start') },
          class: { optional: true, type_kind: 'TSStringKeyword', default: L(undefined) },
        },
        snippets: {
          trigger: s0(false),
          children: s0(false),
        },
      },
      {
        kind: 'intersection',
        html_attrs: 'HTMLAttributes',
        props: {
          id: { optional: false, type_kind: 'TSStringKeyword', default: REQUIRED },
          class: { optional: true, type_kind: 'TSStringKeyword', default: L(undefined) },
        },
        snippets: {
          children: s0(true),
        },
      },
    ],
  },

  'empty-state': {
    kind: 'literal',
    props: {
      title: { optional: false, type_kind: 'TSStringKeyword', default: REQUIRED },
      description: { optional: true, type_kind: 'TSStringKeyword', default: NO_DEFAULT },
      class: { optional: true, type_kind: 'TSStringKeyword', default: L(undefined) },
    },
    snippets: {
      icon: s0(true),
      action: s0(true),
    },
  },

  input: {
    kind: 'intersection',
    html_attrs: 'HTMLInputAttributes',
    props: {
      id: { optional: false, type_kind: 'TSStringKeyword', default: REQUIRED },
      value: { optional: false, type_kind: 'TSStringKeyword', default: B('') },
      label: { optional: true, type_kind: 'TSStringKeyword', default: NO_DEFAULT },
      description: { optional: true, type_kind: 'TSStringKeyword', default: NO_DEFAULT },
      error: { optional: true, type_kind: 'TSStringKeyword', default: NO_DEFAULT },
      disabled: { optional: true, type_kind: 'TSBooleanKeyword', default: L(false) },
      type: { optional: true, type_kind: 'TSTypeReference', default: L('text') },
      class: { optional: true, type_kind: 'TSStringKeyword', default: L(undefined) },
    },
    snippets: {},
  },

  modal: {
    kind: 'literal',
    props: {
      open: { optional: false, type_kind: 'TSBooleanKeyword', default: B(false) },
      title: { optional: false, type_kind: 'TSStringKeyword', default: REQUIRED },
      class: { optional: true, type_kind: 'TSStringKeyword', default: L(undefined) },
      // triggerRef: optional escape-hatch for focus restoration; TSTypeReference to HTMLElement|null.
      // Excluded from strict contract validation — it is a lifecycle prop, not a data prop.
      // Phase 4 ts-morph will cover the full type check.
    },
    snippets: {
      children: s0(false),
      footer: s0(true),
    },
  },

  'navigation-bar': {
    kind: 'intersection',
    html_attrs: 'HTMLAttributes',
    props: {
      class: { optional: true, type_kind: 'TSStringKeyword', default: L(undefined) },
    },
    snippets: {
      brand: s0(true),
      items: s0(false),
      actions: s0(true),
    },
  },

  'navigation-item': {
    // NavigationItemProps = LinkArm | ButtonArm where arms are named type aliases.
    // The AST-only test cannot resolve named type references into their member shapes —
    // that requires ts-morph (Phase 4). We verify only that the Props is a union of
    // the correct arity (2 arms). Per-arm prop names are validated in Phase 4.
    kind: 'union',
    arms: [
      { kind: 'literal', props: {}, snippets: {} }, // LinkArm placeholder
      { kind: 'literal', props: {}, snippets: {} }, // ButtonArm placeholder
    ],
  },

  'page-layout': {
    kind: 'literal',
    props: {
      title: { optional: false, type_kind: 'TSStringKeyword', default: REQUIRED },
      class: { optional: true, type_kind: 'TSStringKeyword', default: L(undefined) },
    },
    snippets: {
      actions: s0(true),
      children: s0(false),
    },
  },

  pagination: {
    kind: 'literal',
    props: {
      currentPage: { optional: false, type_kind: 'TSNumberKeyword', default: B(1) },
      totalPages: { optional: false, type_kind: 'TSNumberKeyword', default: REQUIRED },
      totalCount: { optional: true, type_kind: 'TSNumberKeyword', default: NO_DEFAULT },
      class: { optional: true, type_kind: 'TSStringKeyword', default: L(undefined) },
    },
    snippets: {},
  },

  select: {
    kind: 'intersection',
    html_attrs: 'HTMLSelectAttributes',
    props: {
      id: { optional: false, type_kind: 'TSStringKeyword', default: REQUIRED },
      value: { optional: false, type_kind: 'TSStringKeyword', default: BE },
      options: { optional: false, type_kind: 'TSArrayType', default: REQUIRED },
      label: { optional: true, type_kind: 'TSStringKeyword', default: NO_DEFAULT },
      disabled: { optional: true, type_kind: 'TSBooleanKeyword', default: L(false) },
      class: { optional: true, type_kind: 'TSStringKeyword', default: L(undefined) },
    },
    snippets: {},
  },

  skeleton: {
    kind: 'literal',
    props: {
      width: { optional: true, type_kind: 'TSStringKeyword', default: NO_DEFAULT },
      height: { optional: true, type_kind: 'TSStringKeyword', default: NO_DEFAULT },
      radius: { optional: true, type_kind: 'TSStringKeyword', default: NO_DEFAULT },
      class: { optional: true, type_kind: 'TSStringKeyword', default: L(undefined) },
    },
    snippets: {},
  },

  spinner: {
    kind: 'literal',
    props: {
      size: { optional: true, type_kind: 'TSTypeReference', default: L('md') },
      label: { optional: true, type_kind: 'TSStringKeyword', default: L('Loading...') },
      class: { optional: true, type_kind: 'TSStringKeyword', default: L(undefined) },
    },
    snippets: {},
  },

  textarea: {
    kind: 'intersection',
    html_attrs: 'HTMLTextareaAttributes',
    props: {
      id: { optional: false, type_kind: 'TSStringKeyword', default: REQUIRED },
      value: { optional: true, type_kind: 'TSStringKeyword', default: B('') },
      label: { optional: true, type_kind: 'TSStringKeyword', default: NO_DEFAULT },
      description: { optional: true, type_kind: 'TSStringKeyword', default: NO_DEFAULT },
      error: { optional: true, type_kind: 'TSStringKeyword', default: NO_DEFAULT },
      rows: { optional: true, type_kind: 'TSNumberKeyword', default: L(4) },
      disabled: { optional: true, type_kind: 'TSBooleanKeyword', default: L(false) },
      class: { optional: true, type_kind: 'TSStringKeyword', default: L(undefined) },
    },
    snippets: {},
  },

  toggle: {
    kind: 'literal',
    props: {
      id: { optional: false, type_kind: 'TSStringKeyword', default: REQUIRED },
      pressed: { optional: false, type_kind: 'TSBooleanKeyword', default: B(false) },
      label: { optional: false, type_kind: 'TSStringKeyword', default: REQUIRED },
      disabled: { optional: true, type_kind: 'TSBooleanKeyword', default: L(false) },
      class: { optional: true, type_kind: 'TSStringKeyword', default: L(undefined) },
    },
    snippets: {},
  },

  tooltip: {
    kind: 'literal',
    props: {
      text: { optional: false, type_kind: 'TSStringKeyword', default: REQUIRED },
      placement: { optional: true, type_kind: 'TSTypeReference', default: L('top') },
      class: { optional: true, type_kind: 'TSStringKeyword', default: L(undefined) },
    },
    snippets: {
      children: s0(false),
    },
  },
};
