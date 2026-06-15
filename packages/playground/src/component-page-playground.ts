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
    | { kind: 'text'; value: string }
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
};

/**
 * True when a prop would make the generated preview invalid by construction: it
 * is required (not optional, no default) AND is a value the generator cannot
 * synthesize. Snippet props (e.g. the ubiquitous required `children`) are
 * EXCLUDED — their content comes from the mounted example scenario, not from
 * generated props, so a required `children` never suppresses the playground.
 */
function blocksGeneratedPreview(prop: PropManifest): boolean {
  if (prop.control.kind === 'snippet') return false;
  return !prop.optional && prop.defaultValue === undefined;
}

/**
 * Coerce a manifest `defaultValue` into a boolean control's initial state.
 * Unknown/missing defaults fall back to `false`.
 */
function booleanDefault(value: unknown): boolean {
  return value === true;
}

/** Coerce a manifest `defaultValue` into a string control's initial value. */
function stringDefault(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/** Coerce a manifest `defaultValue` into a number control's initial value. */
function numberDefault(value: unknown): number {
  return typeof value === 'number' ? value : 0;
}

/**
 * Build a {@link PlaygroundModel} from a component manifest.
 *
 * Supported control shapes: `boolean -> switch`, `select -> segmented/select`,
 * `text -> input`, `number -> number input` — all become controls, synthesizing
 * an initial value (`false` / first option / `''` / `0`) when no default is
 * given, so a required supported prop is still adjustable. Only `snippet` and
 * `unknown` props are skipped. Among those, a required `unknown` prop with no
 * default also flags `hasUnsatisfiedRequired` (see {@link blocksGeneratedPreview})
 * so the caller can suppress the generated preview/snippet entirely; a required
 * `snippet` (e.g. the ubiquitous `children`) does not, since its content comes
 * from the mounted example.
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
        controls.push({ ...base, kind: 'text', value: stringDefault(prop.defaultValue) });
        break;
      case 'number':
        controls.push({ ...base, kind: 'number', value: numberDefault(prop.defaultValue) });
        break;
      default:
        // snippet / unknown — not adjustable. A required non-snippet value the
        // generator can't synthesize means we can't build a valid preview at all.
        skipped.push(prop.name);
        if (blocksGeneratedPreview(prop)) hasUnsatisfiedRequired = true;
        break;
    }
  }

  return { controls, skipped, hasUnsatisfiedRequired };
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
export function buildSnippet(
  exportName: string,
  controls: PlaygroundControl[],
  values: Record<string, PlaygroundValue>,
): string {
  const attributes = controls
    .filter((control) => shouldEmit(control, values[control.name] ?? control.value))
    .map((control) => attributeFor(control.name, values[control.name] ?? control.value));

  if (attributes.length === 0) return `<${exportName} />`;
  if (attributes.length === 1) return `<${exportName} ${attributes[0]} />`;
  return `<${exportName}\n  ${attributes.join('\n  ')}\n/>`;
}
