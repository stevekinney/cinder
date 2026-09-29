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
    | 'TSTypeOperator'
    | 'TSUndefinedKeyword';
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
    kind: 'union',
    arms: [
      {
        kind: 'intersection',
        html_attrs: 'HTMLAttributes',
        props: {
          variant: { optional: true, type_kind: 'TSTypeReference', default: L('neutral') },
          size: { optional: true, type_kind: 'TSTypeReference', default: L('md') },
          monospace: { optional: true, type_kind: 'TSBooleanKeyword', default: L(false) },
          class: { optional: true, type_kind: 'TSStringKeyword', default: L(undefined) },
          subscriptionState: { optional: false, type_kind: 'TSTypeReference', default: REQUIRED },
        },
        snippets: {
          children: s0(true),
        },
      },
      {
        kind: 'intersection',
        html_attrs: 'HTMLAttributes',
        props: {
          variant: { optional: true, type_kind: 'TSTypeReference', default: L('neutral') },
          size: { optional: true, type_kind: 'TSTypeReference', default: L('md') },
          monospace: { optional: true, type_kind: 'TSBooleanKeyword', default: L(false) },
          class: { optional: true, type_kind: 'TSStringKeyword', default: L(undefined) },
          subscriptionState: {
            optional: true,
            type_kind: 'TSUndefinedKeyword',
            default: NO_DEFAULT,
          },
        },
        snippets: {
          children: s0(false),
        },
      },
    ],
  },

  // COR-239: ButtonProps was `ButtonOnlyProps | LinkButtonProps` (each arm a TSTypeReference to
  // its own named alias), which the AST-only checker below already treated as `unresolvable` —
  // it validated arm *count* only, never these per-arm `props`. Restructuring ButtonProps to
  // `SharedHtmlAttributes & DataAttributes & PadUnion<ButtonDiscriminant> & { ...cinder props }`
  // (see button.types.ts) to avoid TS2590 makes it a genuine `TSIntersectionType`, so this
  // contract now checks real, previously-unchecked ground: the cinder-specific props inlined as
  // the intersection's trailing literal. The href/button discriminant itself (and icon-only
  // naming/visual constraints) is covered by `scripts/consumer-strict-types.ts` instead, which
  // can actually assign object literals against the type — this AST-only checker cannot.
  button: {
    kind: 'intersection',
    html_attrs: 'HTMLAttributes',
    props: {
      variant: { optional: true, type_kind: 'TSTypeReference', default: L('secondary') },
      size: { optional: true, type_kind: 'TSTypeReference', default: L('md') },
      fullWidth: { optional: true, type_kind: 'TSBooleanKeyword', default: L(false) },
      loading: { optional: true, type_kind: 'TSBooleanKeyword', default: L(false) },
      class: { optional: true, type_kind: 'TSStringKeyword', default: L(undefined) },
    },
    snippets: { children: s0(true) },
  },

  // COR-239: CardProps was `CardPlain | CardWithHeader | CardWithTitle` (each arm a
  // TSTypeReference to its own named alias), which the AST-only checker below already treated
  // as `unresolvable` — it validated arm *count* only, never these per-arm `props`.
  // Restructuring CardProps to `SharedHtmlAttributes & DataAttributes & PadUnion<CardDiscriminant>
  // & { ...cinder props }` (see card.types.ts) to avoid TS2590 makes it a genuine
  // `TSIntersectionType`, so this contract now checks real, previously-unchecked ground: the
  // cinder-specific props inlined as the intersection's trailing literal. The header/title
  // exclusivity and div/anchor/button discriminant are covered by
  // `scripts/consumer-strict-types.ts` instead, which can actually assign object literals
  // against the type — this AST-only checker cannot.
  card: {
    kind: 'intersection',
    html_attrs: 'HTMLAttributes',
    props: {
      class: { optional: true, type_kind: 'TSStringKeyword', default: L(undefined) },
      variant: { optional: true, type_kind: 'TSTypeReference', default: L('card') },
      elevation: { optional: true, type_kind: 'TSTypeReference', default: NO_DEFAULT },
      tone: { optional: true, type_kind: 'TSTypeReference', default: NO_DEFAULT },
      bodyTone: { optional: true, type_kind: 'TSTypeReference', default: L('default') },
      footerTone: { optional: true, type_kind: 'TSTypeReference', default: L('default') },
      edgeToEdgeOnMobile: { optional: true, type_kind: 'TSBooleanKeyword', default: L(false) },
      padding: { optional: true, type_kind: 'TSTypeReference', default: NO_DEFAULT },
    },
    // `children` is required in every real CardDiscriminant arm, but that discriminant lives
    // inside `PadUnion<...>`, not this flat literal, so the AST checker can't see it here —
    // marked optional so it isn't flagged as missing; the real requirement is enforced by
    // `scripts/consumer-strict-types.ts`'s `card-union-positive`/`card-union-negative` fixtures.
    snippets: { children: s0(true), footer: s0(true), header: s0(true) },
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

  // COR-239: DropdownProps was `LegacyDropdownProps | CompoundDropdownProps` (each arm a
  // TSTypeReference to its own named alias), which the AST-only checker below already treated
  // as `unresolvable` — it validated arm *count* only, never these per-arm `props`.
  // Restructuring DropdownProps to `SharedHtmlAttributes & DataAttributes &
  // PadUnion<DropdownDiscriminant> & { class?: string }` (see dropdown.types.ts) to avoid TS2590
  // makes it a genuine `TSIntersectionType`, so this contract now checks the one prop that
  // survives as a flat literal member; `open`/`id`/`placement`/`trigger`/`children` all live
  // inside the discriminant now and are covered by `scripts/consumer-strict-types.ts` instead.
  dropdown: {
    kind: 'intersection',
    html_attrs: 'HTMLAttributes',
    props: {
      class: { optional: true, type_kind: 'TSStringKeyword', default: L(undefined) },
    },
    snippets: {},
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
      maxFiles: { optional: true, type_kind: 'TSNumberKeyword', default: NO_DEFAULT },
      disabled: { optional: true, type_kind: 'TSBooleanKeyword', default: NO_DEFAULT },
      name: { optional: true, type_kind: 'TSStringKeyword', default: NO_DEFAULT },
      class: { optional: true, type_kind: 'TSStringKeyword', default: NO_DEFAULT },
      title: {
        optional: true,
        type_kind: 'TSStringKeyword',
        default: L('Click to upload or drop files'),
      },
      description: { optional: true, type_kind: 'TSStringKeyword', default: NO_DEFAULT },
      draggingLabel: { optional: true, type_kind: 'TSStringKeyword', default: L('Drop to add') },
      browseLabel: { optional: true, type_kind: 'TSStringKeyword', default: L('Browse files') },
      borderBeamVisible: { optional: true, type_kind: 'TSBooleanKeyword', default: L(true) },
      files: { optional: true, type_kind: 'TSArrayType', default: NO_DEFAULT },
      onFilesAccepted: { optional: true, type_kind: 'TSFunctionType', default: NO_DEFAULT },
      onFilesChange: { optional: true, type_kind: 'TSFunctionType', default: NO_DEFAULT },
      onReject: { optional: true, type_kind: 'TSFunctionType', default: NO_DEFAULT },
      onFileRetry: { optional: true, type_kind: 'TSFunctionType', default: NO_DEFAULT },
    },
    snippets: {
      idle: s0(true),
      dragActive: s0(true),
      fileList: sp(2, true),
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
          closeButtonVisible: { optional: true, type_kind: 'TSBooleanKeyword', default: L(true) },
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
          closeButtonVisible: { optional: true, type_kind: 'TSBooleanKeyword', default: L(true) },
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
      ariaLabelledby: { optional: true, type_kind: 'TSStringKeyword', default: NO_DEFAULT },
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

  // COR-239: NavigationItemProps was `LinkArm | ButtonArm` (each arm a TSTypeReference to its
  // own named alias), which the AST-only checker below already treated as `unresolvable` — it
  // validated arm *count* only, never real props. Restructuring NavigationItemProps to
  // `NavigationItemSharedHtmlAttributes & DataAttributes & PadUnion<LinkExtra | ButtonExtra> &
  // { ...cinder props }` (see navigation-item.types.ts) to avoid TS2590 makes it a genuine
  // `TSIntersectionType`, so this contract now checks real, previously-unchecked ground: the
  // cinder-specific props inlined as the intersection's trailing literal. The href/button
  // discriminant itself is covered by `scripts/consumer-strict-types.ts` instead, which can
  // actually assign object literals against the type — this AST-only checker cannot.
  'navigation-item': {
    kind: 'intersection',
    html_attrs: 'HTMLAttributes',
    props: {
      active: { optional: true, type_kind: 'TSBooleanKeyword', default: NO_DEFAULT },
      disabled: { optional: true, type_kind: 'TSBooleanKeyword', default: NO_DEFAULT },
      current: { optional: true, type_kind: 'TSUnionType', default: NO_DEFAULT },
      class: { optional: true, type_kind: 'TSStringKeyword', default: NO_DEFAULT },
      variant: { optional: true, type_kind: 'TSUnionType', default: L('horizontal') },
    },
    snippets: { children: s0(false) },
  },

  pagination: {
    kind: 'literal',
    props: {
      currentPage: { optional: false, type_kind: 'TSNumberKeyword', default: B(1) },
      totalPages: { optional: true, type_kind: 'TSNumberKeyword', default: NO_DEFAULT },
      hasPreviousPage: { optional: true, type_kind: 'TSBooleanKeyword', default: NO_DEFAULT },
      hasNextPage: { optional: true, type_kind: 'TSBooleanKeyword', default: L(false) },
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

  toggle: {
    kind: 'literal',
    props: {
      id: { optional: false, type_kind: 'TSStringKeyword', default: REQUIRED },
      // `checked` is declared as `$bindable(false)` — bindable, with a default that
      // applies when the prop is not bound. Encoded as `B(false)` so the contract
      // analyzer sees the bindable shape (matches the runtime $bindable wrapper).
      checked: { optional: true, type_kind: 'TSBooleanKeyword', default: B(false) },
      label: { optional: false, type_kind: 'TSStringKeyword', default: REQUIRED },
      // `disabled` no longer defaults to `false` in the destructure — it resolves
      // through FormField context (`disabled ?? context?.disabled ?? false`), so
      // the prop carries no literal default.
      disabled: { optional: true, type_kind: 'TSBooleanKeyword', default: NO_DEFAULT },
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
