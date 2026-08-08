/**
 * Whether the docs playground may seed a component's `children` with plain text.
 *
 * The playground synthesizes an editable text `children` control seeded with the
 * component's own display name, so a Badge previews as a Badge reading "Badge"
 * rather than an empty shell. That is right for most components and actively
 * wrong for a few: a `CheckboxGroup` whose only content is the literal string
 * "CheckboxGroup" is worse than an empty preview, and a bare `<td>` mounted with
 * no `<tr>` ancestor is not a preview of anything.
 *
 * Three rules decide it, two of them derived from data that already exists so
 * they cost nothing to maintain. Only the third is a list, and it is a list
 * because the judgement it encodes — `Card` reads fine with text, `Masonry` does
 * not, and both are boxes — is a design call no source artifact records.
 */
import type { ComponentManifest } from './types.ts';

import {
  COMPOUND_COMPONENT_FAMILIES,
  COMPOUND_COMPONENT_PARENTS,
} from './shell-app/compound-families.ts';

/**
 * Components whose `children` need structure, an ancestor, or interactive state
 * that plain text cannot stand in for.
 *
 * Kept deliberately small. Anything covered by the compound-family rules below
 * is NOT listed here — `compound-families.test.ts` guards that, so a slug added
 * out of habit fails rather than silently overlapping.
 *
 * Grouped by why:
 *
 *  - LAYOUT primitives render a box whose whole job is arranging children. One
 *    text run shows no columns, no tracks, and no gutters, so the preview says
 *    nothing about the component. These get a preview recipe instead — see
 *    `component-page-preview-recipes.ts`.
 *  - OVERLAYS need open/trigger state before anything is visible. Seeding text
 *    into a closed overlay renders nothing at all.
 *  - BEHAVIOR wrappers render their children and nothing else, so the text is
 *    the entire preview and the component is invisible in it.
 *  - STRUCTURED containers document, in their own schema, that children must be
 *    particular elements or sub-components.
 */
export const NO_TEXT_CHILDREN: ReadonlySet<string> = new Set([
  // Layout primitives
  'container',
  'masonry',
  'aspect-ratio',
  'scroll-area',
  'marquee',
  'surface',
  // Overlays and gates
  'backdrop',
  'drawer',
  'modal',
  'popover',
  'tooltip',
  'toast-region',
  'access-gate',
  'capability-gate',
  // Behavior-only wrappers
  'focus-trap',
  'click-away-listener',
  'locale-provider',
  'portal',
  // Structured containers
  'checkbox-group',
  'form-field',
  'form-section',
  'button-group',
  'navigation-bar',
]);

/**
 * True when seeding `children` with the component's display name produces a
 * preview worth showing.
 *
 * Rejects, in order:
 *
 *  1. A compound ROOT — its children are `<Accordion.Item>`-shaped, so loose
 *     text renders a semantically broken instance.
 *  2. Any member of a compound FAMILY, root or leaf. `table-cell` is a `<td>`
 *     with no table; `dropdown-label` is an unstyled orphan outside its
 *     `role="menu"`; `side-navigation-group` renders a bare `<li>`. The mapping
 *     is already maintained and drift-guarded in `compound-families.ts`, so this
 *     rule costs nothing. Both directions are checked because a family root does
 *     not always assemble its parts with `Object.assign` — `segmented-control`
 *     re-exports `Segment` instead, so `isCompound` is false for it.
 *  3. {@link NO_TEXT_CHILDREN}.
 */
export function allowsPlainTextChildren(manifest: ComponentManifest): boolean {
  if (manifest.isCompound === true) return false;
  if (manifest.kebabName in COMPOUND_COMPONENT_PARENTS) return false;
  if (manifest.kebabName in COMPOUND_COMPONENT_FAMILIES) return false;
  return !NO_TEXT_CHILDREN.has(manifest.kebabName);
}
