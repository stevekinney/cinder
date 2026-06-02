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
        props: {
          class: { optional: true, type_kind: 'TSStringKeyword', default: L(undefined) },
          variant: { optional: true, type_kind: 'TSTypeReference', default: L('card') },
          bodyTone: { optional: true, type_kind: 'TSTypeReference', default: L('default') },
          footerTone: { optional: true, type_kind: 'TSTypeReference', default: L('default') },
          edgeToEdgeOnMobile: { optional: true, type_kind: 'TSBooleanKeyword', default: L(false) },
        },
        snippets: { children: s0(false), footer: s0(true) },
      },
      {
        kind: 'intersection',
        html_attrs: 'HTMLAttributes',
        props: {
          class: { optional: true, type_kind: 'TSStringKeyword', default: L(undefined) },
          variant: { optional: true, type_kind: 'TSTypeReference', default: L('card') },
          bodyTone: { optional: true, type_kind: 'TSTypeReference', default: L('default') },
          footerTone: { optional: true, type_kind: 'TSTypeReference', default: L('default') },
          edgeToEdgeOnMobile: { optional: true, type_kind: 'TSBooleanKeyword', default: L(false) },
        },
        snippets: { header: s0(false), children: s0(false), footer: s0(true) },
      },
      {
        kind: 'intersection',
        html_attrs: 'HTMLAttributes',
        props: {
          title: { optional: false, type_kind: 'TSStringKeyword', default: REQUIRED },
          description: { optional: true, type_kind: 'TSStringKeyword', default: NO_DEFAULT },
          class: { optional: true, type_kind: 'TSStringKeyword', default: L(undefined) },
          variant: { optional: true, type_kind: 'TSTypeReference', default: L('card') },
          bodyTone: { optional: true, type_kind: 'TSTypeReference', default: L('default') },
          footerTone: { optional: true, type_kind: 'TSTypeReference', default: L('default') },
          edgeToEdgeOnMobile: { optional: true, type_kind: 'TSBooleanKeyword', default: L(false) },
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

  'file-upload': {
    kind: 'intersection',
    html_attrs: 'HTMLInputAttributes',
    props: {
      id: { optional: true, type_kind: 'TSStringKeyword', default: NO_DEFAULT },
      accept: { optional: true, type_kind: 'TSStringKeyword', default: NO_DEFAULT },
      multiple: { optional: true, type_kind: 'TSBooleanKeyword', default: L(false) },
      maxSize: { optional: true, type_kind: 'TSNumberKeyword', default: NO_DEFAULT },
      disabled: { optional: true, type_kind: 'TSBooleanKeyword', default: NO_DEFAULT },
      name: { optional: true, type_kind: 'TSStringKeyword', default: NO_DEFAULT },
      class: { optional: true, type_kind: 'TSStringKeyword', default: NO_DEFAULT },
      files: { optional: true, type_kind: 'TSArrayType', default: NO_DEFAULT },
      onchange: { optional: true, type_kind: 'TSFunctionType', default: NO_DEFAULT },
      onreject: { optional: true, type_kind: 'TSFunctionType', default: NO_DEFAULT },
    },
    snippets: {
      idle: s0(true),
      dragActive: s0(true),
      fileList: sp(1, true),
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
    kind: 'union',
    // ModalProps is a discriminated union of named aliases so TypeScript can require
    // describedById when role="alertdialog". The AST-only contract checker validates
    // union arity here; the component schema constraints cover the accessibility rule.
    arms: [
      {
        kind: 'literal',
        props: {
          open: { optional: false, type_kind: 'TSBooleanKeyword', default: B(false) },
          title: { optional: false, type_kind: 'TSStringKeyword', default: REQUIRED },
          dismissOnBackdropClick: {
            optional: true,
            type_kind: 'TSBooleanKeyword',
            default: L(true),
          },
          dismissOnEscape: { optional: true, type_kind: 'TSBooleanKeyword', default: L(true) },
          showCloseButton: { optional: true, type_kind: 'TSBooleanKeyword', default: L(true) },
          class: { optional: true, type_kind: 'TSStringKeyword', default: L(undefined) },
          role: { optional: true, type_kind: 'TSLiteralType', default: L('dialog') },
          describedById: { optional: true, type_kind: 'TSStringKeyword', default: NO_DEFAULT },
        },
        snippets: {
          children: s0(false),
          footer: s0(true),
        },
      },
      {
        kind: 'literal',
        props: {
          open: { optional: false, type_kind: 'TSBooleanKeyword', default: B(false) },
          title: { optional: false, type_kind: 'TSStringKeyword', default: REQUIRED },
          dismissOnBackdropClick: {
            optional: true,
            type_kind: 'TSBooleanKeyword',
            default: L(true),
          },
          dismissOnEscape: { optional: true, type_kind: 'TSBooleanKeyword', default: L(true) },
          showCloseButton: { optional: true, type_kind: 'TSBooleanKeyword', default: L(true) },
          class: { optional: true, type_kind: 'TSStringKeyword', default: L(undefined) },
          role: { optional: false, type_kind: 'TSLiteralType', default: REQUIRED },
          describedById: { optional: false, type_kind: 'TSStringKeyword', default: REQUIRED },
        },
        snippets: {
          children: s0(false),
          footer: s0(true),
        },
      },
    ],
  },

  'menu-bar': {
    kind: 'intersection',
    html_attrs: 'HTMLAttributes',
    props: {
      id: { optional: true, type_kind: 'TSStringKeyword', default: L(undefined) },
      menus: { optional: false, type_kind: 'TSTypeOperator', default: REQUIRED },
      label: { optional: true, type_kind: 'TSStringKeyword', default: L('Application menu') },
      labelledBy: { optional: true, type_kind: 'TSStringKeyword', default: NO_DEFAULT },
      class: { optional: true, type_kind: 'TSStringKeyword', default: L(undefined) },
    },
    snippets: {},
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
      // Generic over the option value type: `value?: NoInfer<T>` (TSTypeReference),
      // now optional (aligns with the `$bindable()` runtime — undefined is the
      // unselected sentinel); `options: readonly SelectOption<T>[]` (TSTypeOperator).
      value: { optional: true, type_kind: 'TSTypeReference', default: BE },
      options: { optional: false, type_kind: 'TSTypeOperator', default: REQUIRED },
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
      label: { optional: true, type_kind: 'TSStringKeyword', default: L('Loading') },
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

  'time-picker': {
    kind: 'intersection',
    html_attrs: 'HTMLInputAttributes',
    props: {
      id: { optional: false, type_kind: 'TSStringKeyword', default: REQUIRED },
      value: { optional: true, type_kind: 'TSStringKeyword', default: B('') },
      defaultValue: { optional: true, type_kind: 'TSStringKeyword', default: L('') },
      hourCycle: { optional: true, type_kind: 'TSTypeReference', default: NO_DEFAULT },
      locale: { optional: true, type_kind: 'TSStringKeyword', default: NO_DEFAULT },
      seconds: { optional: true, type_kind: 'TSBooleanKeyword', default: L(false) },
      min: { optional: true, type_kind: 'TSStringKeyword', default: NO_DEFAULT },
      max: { optional: true, type_kind: 'TSStringKeyword', default: NO_DEFAULT },
      step: { optional: true, type_kind: 'TSNumberKeyword', default: L(60) },
      disabled: { optional: true, type_kind: 'TSBooleanKeyword', default: NO_DEFAULT },
      required: { optional: true, type_kind: 'TSBooleanKeyword', default: NO_DEFAULT },
      name: { optional: true, type_kind: 'TSStringKeyword', default: NO_DEFAULT },
      label: { optional: true, type_kind: 'TSStringKeyword', default: NO_DEFAULT },
      description: { optional: true, type_kind: 'TSStringKeyword', default: NO_DEFAULT },
      error: { optional: true, type_kind: 'TSStringKeyword', default: NO_DEFAULT },
      class: { optional: true, type_kind: 'TSStringKeyword', default: NO_DEFAULT },
      onchange: { optional: true, type_kind: 'TSFunctionType', default: NO_DEFAULT },
    },
    snippets: {},
  },

  toggle: {
    kind: 'literal',
    props: {
      id: { optional: false, type_kind: 'TSStringKeyword', default: REQUIRED },
      // `checked` is declared as `$bindable(false)` — bindable, with a default that
      // applies when the prop is not bound. Encoded as `B(false)` so the contract
      // analyzer sees the bindable shape (matches the runtime $bindable wrapper).
      checked: { optional: true, type_kind: 'TSBooleanKeyword', default: B(false) },
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

  'visually-hidden': {
    kind: 'intersection',
    html_attrs: 'HTMLAnchorAttributes',
    props: {
      as: { optional: true, type_kind: 'TSTypeReference', default: L('span') },
      focusable: { optional: true, type_kind: 'TSBooleanKeyword', default: L(false) },
      class: { optional: true, type_kind: 'TSStringKeyword', default: L(undefined) },
    },
    snippets: {
      children: s0(false),
    },
  },
};
