/**
 * The registry of featured examples the component doc page double-mounts (#399),
 * plus the source-shape predicates that prove each one carries the
 * mount-isolation harness.
 *
 * This data lives in a plain module (not a `*.test.ts`) so it can be imported by
 * more than one test without one test file depending on another's exports — the
 * `featured-example-mount-id.test.ts` source-shape guard AND the
 * `strip-example-harness` full-corpus sweep both cross-check their counts against
 * {@link FEATURED_EXAMPLES}.
 */

/** A featured example the doc page mounts twice, with its pre-#399 hardcoded ids. */
export type FeaturedExample = {
  /** Kebab-case component id (the example directory name). */
  readonly component: string;
  /** Path to the `.example.svelte` file, relative to `src/examples/`. */
  readonly file: string;
  /**
   * The element ids this example hardcoded before the #399 fix. Recorded so the
   * guard can assert they no longer appear as `id=`/`name=`/`target=`/`for=`
   * literals at the component call sites.
   */
  readonly oldHardcodedIds: readonly string[];
};

/**
 * Every featured (alphabetically-first, or `featured = true`) example the doc
 * page double-mounts. Each emitted at least one hardcoded element id before the
 * #399 fix; those literals are recorded so the guard asserts they are gone from
 * the call sites. Keep this list in sync with the example set — every example
 * whose first scenario reaches the DOM with an `id`/`name` belongs here.
 */
export const FEATURED_EXAMPLES: readonly FeaturedExample[] = [
  {
    component: 'accordion',
    file: 'accordion/basic.example.svelte',
    oldHardcodedIds: ['item-1', 'item-2', 'item-3'],
  },
  {
    component: 'autocomplete',
    file: 'autocomplete/basic.example.svelte',
    oldHardcodedIds: ['autocomplete-basic'],
  },
  {
    component: 'chat',
    file: 'chat/basic.example.svelte',
    oldHardcodedIds: ['playground-basic-chat'],
  },
  {
    component: 'checkbox',
    file: 'checkbox/basic.example.svelte',
    oldHardcodedIds: ['checkbox-terms', 'checkbox-newsletter'],
  },
  {
    component: 'color-field',
    file: 'color-field/basic.example.svelte',
    oldHardcodedIds: ['color-field-basic'],
  },
  {
    component: 'combobox',
    file: 'combobox/basic.example.svelte',
    oldHardcodedIds: ['combobox-fruit'],
  },
  {
    component: 'command-menu',
    file: 'command-menu/slash-in-textarea.example.svelte',
    oldHardcodedIds: ['command-menu-textarea'],
  },
  {
    component: 'date-range-field',
    file: 'date-range-field/basic.example.svelte',
    oldHardcodedIds: ['basic-date-range'],
  },
  {
    component: 'drawer',
    file: 'drawer/basic.example.svelte',
    oldHardcodedIds: ['drawer-side', 'drawer-size', 'drawer-use-trigger-ref'],
  },
  {
    component: 'dropdown',
    file: 'dropdown/basic.example.svelte',
    oldHardcodedIds: ['dropdown-basic'],
  },
  {
    component: 'form-field',
    file: 'form-field/basic.example.svelte',
    oldHardcodedIds: ['full-name'],
  },
  {
    component: 'form-section',
    file: 'form-section/account-settings.example.svelte',
    oldHardcodedIds: ['display-name', 'account-email', 'public-profile', 'marketing-emails'],
  },
  { component: 'input', file: 'input/basic.example.svelte', oldHardcodedIds: ['name'] },
  {
    component: 'json-schema-editor',
    file: 'json-schema-editor/basic.example.svelte',
    oldHardcodedIds: ['basic-jse'],
  },
  {
    component: 'markdown-editor',
    file: 'markdown-editor/basic.example.svelte',
    oldHardcodedIds: ['playground-markdown-editor'],
  },
  {
    component: 'modal',
    file: 'modal/basic.example.svelte',
    oldHardcodedIds: ['invite-name', 'invite-email'],
  },
  {
    component: 'phone-input',
    file: 'phone-input/basic.example.svelte',
    oldHardcodedIds: ['basic-phone'],
  },
  {
    component: 'pin-input',
    file: 'pin-input/alphanumeric.example.svelte',
    oldHardcodedIds: ['invite-code'],
  },
  {
    component: 'radio-group',
    file: 'radio-group/basic.example.svelte',
    oldHardcodedIds: ['basic-plan', 'basic-plan-free', 'basic-plan-pro', 'basic-plan-team'],
  },
  { component: 'rating', file: 'rating/basic.example.svelte', oldHardcodedIds: ['basic-rating'] },
  {
    component: 'review-editor',
    file: 'review-editor/basic.example.svelte',
    oldHardcodedIds: ['playground-review-editor-basic'],
  },
  {
    component: 'search-field',
    file: 'search-field/basic.example.svelte',
    oldHardcodedIds: ['search-field-basic'],
  },
  {
    component: 'segmented-control',
    file: 'segmented-control/basic.example.svelte',
    oldHardcodedIds: ['playground-view'],
  },
  { component: 'select', file: 'select/basic.example.svelte', oldHardcodedIds: ['country'] },
  {
    component: 'skip-link',
    file: 'skip-link/basic.example.svelte',
    oldHardcodedIds: ['skip-link-example-main'],
  },
  {
    component: 'tag-input',
    file: 'tag-input/basic.example.svelte',
    oldHardcodedIds: ['basic-tag-input'],
  },
  { component: 'textarea', file: 'textarea/basic.example.svelte', oldHardcodedIds: ['bio'] },
  {
    component: 'toggle',
    file: 'toggle/basic.example.svelte',
    oldHardcodedIds: ['email-notifications'],
  },
];

/** True when the source declares a `mountIdPrefix` prop via `$props()`. */
export function declaresMountIdPrefixProp(source: string): boolean {
  return /let\s*\{[^}]*\bmountIdPrefix\b[^}]*\}\s*:\s*\{[^}]*\}\s*=\s*\$props\(\)/.test(source);
}

/**
 * True when the source reads its per-instance `$props.id()` fallback. `mountIdPrefix`
 * cannot default to `$props.id()` inside the destructure (Svelte's placement rule),
 * so the idiom is a separate `const uid = $props.id()` and `mountIdPrefix ?? uid` at
 * every id site. Without the fallback, a standalone copy (no injected prefix) would
 * emit `undefined`-based ids and two standalone copies would still collide.
 */
export function declaresPropsIdFallback(source: string): boolean {
  return (
    /const\s+uid\s*=\s*\$props\.id\(\)/.test(source) && /mountIdPrefix\s*\?\?\s*uid/.test(source)
  );
}

/** True when the source derives at least one id from the `mountIdPrefix ?? uid` base. */
export function derivesIdFromMountPrefix(source: string): boolean {
  return /\$derived\([^)]*mountIdPrefix\s*\?\?\s*uid/.test(source);
}
