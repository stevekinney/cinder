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

/** Fields common to every {@link PlaygroundControl}, regardless of kind. */
type PlaygroundControlBase = { name: string; description?: string };

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
 * `text -> input`, `number -> number input`. `snippet`, `unknown`, and any
 * required-without-default prop are skipped (and, for required ones, flagged so
 * the caller can suppress the generated preview/snippet entirely).
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

/** Render one control's current value as a Svelte attribute fragment, or `null` to omit it. */
function attributeFor(name: string, value: PlaygroundValue): string | null {
  if (typeof value === 'boolean') return value ? name : null;
  if (typeof value === 'number') return `${name}={${value}}`;
  if (value === '') return null;
  return `${name}="${value}"`;
}

/**
 * Generate a copy-able Svelte snippet for the component from the live control
 * values. Boolean controls render as bare attributes when true (and are omitted
 * when false); string/number controls render as `name="value"` / `name={value}`.
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
    .map((control) => attributeFor(control.name, values[control.name] ?? control.value))
    .filter((fragment): fragment is string => fragment !== null);

  if (attributes.length === 0) return `<${exportName} />`;
  if (attributes.length === 1) return `<${exportName} ${attributes[0]} />`;
  return `<${exportName}\n  ${attributes.join('\n  ')}\n/>`;
}
