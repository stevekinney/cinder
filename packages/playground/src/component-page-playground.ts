/**
 * Pure helpers for the documentation page's interactive Playground.
 *
 * Adjustable controls are derived ONLY from structured manifest data (the
 * existing {@link ControlKind} discriminant) and prop defaults — never by
 * parsing example source. Prop shapes the generator can't render as a control
 * are skipped and surfaced as a visible "not adjustable here" note, so a
 * component with an exotic prop degrades gracefully instead of emitting a
 * broken control or invalid snippet.
 */
import type { ComponentManifest, PropManifest } from './types.ts';

/**
 * Fields common to every {@link PlaygroundControl}, regardless of kind.
 *
 * `value` is the control's seeded initial state — for props without a manifest
 * default it is a synthesized placeholder (first option / `0` / `''` / `false`),
 * not the component's real default. `hasDefault` records whether the manifest
 * actually declared a default; the snippet uses it to decide what to omit, so a
 * synthesized placeholder is never silently dropped from the copyable code.
 */
type PlaygroundControlBase = { name: string; description?: string; hasDefault: boolean };

/** A single adjustable control derived from a supported prop shape. */
export type PlaygroundControl = PlaygroundControlBase &
  (
    | { kind: 'boolean'; value: boolean }
    | { kind: 'text'; value: string; isChildren?: boolean }
    | { kind: 'number'; value: number }
    | { kind: 'select'; value: string; options: string[] }
  );

/** The current value of one control, keyed by prop name. */
export type PlaygroundValue = boolean | string | number;

/**
 * The result of classifying a component's props for the Playground: the
 * controls we can render, and the names of props we deliberately skipped
 * (shown to the reader so the omission is explicit, not silent).
 */
export type PlaygroundModel = {
  controls: PlaygroundControl[];
  skipped: string[];
  /**
   * True when the component has a required prop with no default that we cannot
   * supply a baseline for. The page should then omit the generated preview +
   * snippet rather than emit an invalid one.
   */
  hasUnsatisfiedRequired: boolean;
  /**
   * True when the component is better represented by its authored examples than
   * by the generic prop playground. This covers components whose essential
   * behavior depends on optional callbacks/data sources the analyzer cannot
   * synthesize into a sensible live demo.
   */
  requiresExamplePlayground: boolean;
};

const EXAMPLE_ONLY_PLAYGROUND_COMPONENTS = new Set(['autocomplete']);

/**
 * True when a prop would make the generated preview invalid by construction: it
 * is required (not optional, no default) AND is a value the generator cannot
 * synthesize. The ubiquitous required `children` snippet is EXCLUDED — plain
 * children can be synthesized as text, so it does not suppress the playground by
 * itself. Other required snippets are structured render props the generator
 * cannot invent safely.
 */
function blocksGeneratedPreview(prop: PropManifest): boolean {
  if (prop.optional || prop.defaultValue !== undefined) return false;
  return (
    prop.control.kind === 'unknown' || (prop.control.kind === 'snippet' && prop.name !== 'children')
  );
}

/**
 * Coerce a manifest `defaultValue` into a boolean control's initial state.
 * Unknown/missing defaults fall back to `false`.
 */
function booleanDefault(value: unknown): boolean {
  return value === true;
}

/** Coerce a manifest `defaultValue` into a string value. */
function stringDefault(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/**
 * Seed required text props with readable values. Empty strings are useful for
 * optional text controls, but a required label/id/title seeded to `''` makes the
 * live playground look broken before the reader changes anything.
 */
function requiredTextSeed(prop: PropManifest, manifest: ComponentManifest): string {
  switch (prop.name) {
    case 'id':
      return `${manifest.kebabName}-example`;
    case 'ariaLabel':
    case 'label':
    case 'legend':
    case 'title':
      return manifest.name;
    case 'name':
      return manifest.kebabName;
    case 'placeholder':
      return `Enter ${manifest.name.toLowerCase()}`;
    default:
      return prop.name;
  }
}

function textDefault(prop: PropManifest, manifest: ComponentManifest): string {
  const value = stringDefault(prop.defaultValue);
  if (value !== '') return value;
  return prop.optional ? '' : requiredTextSeed(prop, manifest);
}

/** Coerce a manifest `defaultValue` into a number control's initial value. */
function numberDefault(value: unknown): number {
  return typeof value === 'number' ? value : 0;
}

/**
 * Seed text for a synthesized `children` control. Uses the component's display
 * name so the live preview renders a labelled instance out of the box (a Badge
 * reading "Badge", a Button reading "Button") rather than an empty shell. The
 * reader edits it freely from there.
 */
function childrenSeed(manifest: ComponentManifest): string {
  return manifest.name;
}

/**
 * Build a {@link PlaygroundModel} from a component manifest.
 *
 * Supported control shapes: `boolean -> switch`, `select -> segmented/select`,
 * `text -> input`, `number -> number input` — all become controls, synthesizing
 * an initial value (`false` / first option / `''` / `0`) when no default is
 * given, so a required supported prop is still adjustable. Only `snippet` and
 * `unknown` props are skipped. Among those, a required unknown prop or required
 * non-`children` snippet with no default also flags `hasUnsatisfiedRequired`
 * (see {@link blocksGeneratedPreview}) so the caller can suppress the generated
 * preview/snippet entirely. The ubiquitous required `children` snippet is the
 * exception because plain children can be synthesized as text.
 */
export function buildPlaygroundModel(manifest: ComponentManifest): PlaygroundModel {
  const controls: PlaygroundControl[] = [];
  const skipped: string[] = [];
  let hasUnsatisfiedRequired = false;

  for (const prop of manifest.props) {
    // Spread description only when present — the control type uses an optional
    // `description?: string` under `exactOptionalPropertyTypes`.
    const base = {
      name: prop.name,
      hasDefault: prop.defaultValue !== undefined,
      ...(prop.description !== undefined ? { description: prop.description } : {}),
    };
    switch (prop.control.kind) {
      case 'boolean':
        controls.push({ ...base, kind: 'boolean', value: booleanDefault(prop.defaultValue) });
        break;
      case 'select':
        controls.push({
          ...base,
          kind: 'select',
          options: prop.control.options,
          value: stringDefault(prop.defaultValue) || (prop.control.options[0] ?? ''),
        });
        break;
      case 'text':
        controls.push({ ...base, kind: 'text', value: textDefault(prop, manifest) });
        break;
      case 'number':
        controls.push({ ...base, kind: 'number', value: numberDefault(prop.defaultValue) });
        break;
      default:
        // snippet / unknown — not adjustable as an attribute. The one exception
        // is the ubiquitous `children` snippet: many components (Badge, Button,
        // Chip, …) render plain text children, and without a control the live
        // preview shows an empty shell. Synthesize an editable TEXT control for
        // it, seeded with the component's display name so the preview reads as a
        // labelled instance out of the box. Marked `isChildren` so the snippet
        // renders it as element content (`<X>text</X>`) and the mount converts it
        // to a children snippet, rather than emitting it as an attribute.
        //
        // Compound components are EXCLUDED: their `children` must be structured
        // sub-components (`<Accordion.Item>`), so seeding plain text would render
        // a semantically broken preview (loose text in an empty `.cinder-accordion`
        // shell). They skip the control and fall back to the featured-example
        // mount instead — see {@link ComponentManifest.isCompound}.
        if (prop.name === 'children' && prop.control.kind === 'snippet' && !manifest.isCompound) {
          controls.push({
            ...base,
            kind: 'text',
            isChildren: true,
            value: childrenSeed(manifest),
          });
          break;
        }
        // Other snippet / unknown props remain non-adjustable. A required
        // non-snippet value the generator can't synthesize means we can't build
        // a valid preview at all.
        skipped.push(prop.name);
        if (blocksGeneratedPreview(prop)) hasUnsatisfiedRequired = true;
        break;
    }
  }

  return {
    controls,
    skipped,
    hasUnsatisfiedRequired,
    requiresExamplePlayground: EXAMPLE_ONLY_PLAYGROUND_COMPONENTS.has(manifest.kebabName),
  };
}

/**
 * Render one control's current value as a Svelte attribute fragment.
 *
 * Booleans always render explicitly — bare `name` for `true`, `name={false}` for
 * `false` — so a snippet faithfully reproduces the selected state even when the
 * component's default for that prop is `true` (omitting it would otherwise show
 * the default, contradicting the UI). String values that are safe for a
 * double-quoted attribute use the plain `name="value"` form; values containing a
 * quote, ampersand, or angle bracket fall back to a `name={"..."}` expression
 * with a JSON-escaped literal that copy-pastes as valid Svelte. Whether a prop is
 * emitted at all is decided by {@link buildSnippet}; this only formats it.
 */
function attributeFor(name: string, value: PlaygroundValue): string {
  if (typeof value === 'boolean') return value ? name : `${name}={false}`;
  if (typeof value === 'number') return `${name}={${value}}`;
  if (/["&<>]/.test(value)) return `${name}={${JSON.stringify(value)}}`;
  return `${name}="${value}"`;
}

/**
 * Decide whether a control's current value should appear in the snippet.
 *
 * When the prop has a real manifest default, emit it only when the current
 * value DIFFERS from that default — omitting an unchanged value renders
 * identically, keeping the snippet minimal. Crucially, clearing a non-empty
 * default to `''` differs from it, so `name=""` IS emitted (otherwise a paste
 * would silently revert to the default, contradicting the live UI).
 *
 * When the prop has NO manifest default, it carries a synthesized seed (first
 * option / `0` / `''` / `false`). A seeded `''` is noise — `name=""` adds
 * nothing over omission — so empty strings are dropped; any other value stays
 * visible, since we cannot prove the component's own default matches the seed.
 */
function shouldEmit(control: PlaygroundControl, current: PlaygroundValue): boolean {
  if (control.hasDefault) return current !== control.value;
  return current !== '';
}

/**
 * Generate a copy-able Svelte snippet for the component from the live control
 * values. Each emitted control renders explicitly — booleans as bare `name` /
 * `name={false}`, strings as `name="value"`, numbers as `name={value}` — so the
 * snippet always reproduces the live UI state. {@link shouldEmit} governs which
 * props are included.
 *
 * @param exportName - The component's PascalCase export name, e.g. `Accordion`.
 * @param controls - The controls in display order.
 * @param values - Current value per control name.
 * @returns A single-element Svelte snippet string.
 */
/**
 * Escape a string for a Svelte **source** text-content context — the COPYABLE
 * snippet string this module builds, which interpolates the children value as
 * element content. If the user types `<`, `&`, or `{`, the pasted snippet would
 * be invalid or different Svelte (`<` opens a tag, `&` starts an entity, `{`
 * opens an expression). Escaping those three keeps the copied code rendering the
 * same literal text the live preview shows. `>` is left as-is — it is literal in
 * element text content.
 *
 * The live MOUNT path escapes separately and for a different context: it renders
 * the value through `createRawSnippet` as an HTML text string (see
 * `escapeHtmlText` in `component-page-live-preview.ts`, which escapes `&` and `<`
 * for an HTML text node). Both paths produce the same visible literal text; they
 * differ only in which characters each target syntax treats as special (`{` is
 * special in Svelte source, not in an HTML text node).
 */
function escapeSnippetText(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\{/g, '&lbrace;');
}

export function buildSnippet(
  exportName: string,
  controls: PlaygroundControl[],
  values: Record<string, PlaygroundValue>,
): string {
  // The synthesized `children` control renders as element CONTENT, not an
  // attribute, so it is partitioned out of the attribute list.
  const childrenControl = controls.find((c) => c.kind === 'text' && c.isChildren);
  const childrenText =
    childrenControl !== undefined
      ? String(values[childrenControl.name] ?? childrenControl.value)
      : '';

  const attributes = controls
    .filter((control) => !(control.kind === 'text' && control.isChildren))
    .filter((control) => shouldEmit(control, values[control.name] ?? control.value))
    .map((control) => attributeFor(control.name, values[control.name] ?? control.value));

  // One attribute fragment shared by both the self-closing and open/close forms,
  // so children is a single suffix concern rather than a parallel set of paths.
  const attributePart =
    attributes.length === 0
      ? ''
      : attributes.length === 1
        ? ` ${attributes[0]}`
        : `\n  ${attributes.join('\n  ')}\n`;

  // With children content, emit an open/close pair so the snippet copy-pastes as
  // a real labelled instance; otherwise keep the minimal self-closing form.
  if (childrenText !== '') {
    return `<${exportName}${attributePart}>${escapeSnippetText(childrenText)}</${exportName}>`;
  }
  return attributes.length > 1
    ? `<${exportName}${attributePart}/>`
    : `<${exportName}${attributePart} />`;
}
