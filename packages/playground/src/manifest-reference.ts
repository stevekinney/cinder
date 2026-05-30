/**
 * Pure helpers backing the Props / API reference panel on a component page.
 *
 * The Svelte component (`component-page.svelte`) fetches a `ComponentManifest`
 * from `/api/manifest/:name` and renders it as a table. Keeping the
 * fetch + normalization logic here makes it unit-testable without mounting the
 * whole page: feed a `ComponentManifest` in, assert the display rows out.
 */
import type { ComponentManifest, ControlKind, PropManifest } from './types.ts';

/**
 * A single prop rendered as one row in the reference table. Every field is a
 * display-ready value derived from a {@link PropManifest}, so the template can
 * render it directly without re-deriving anything.
 */
export type PropReferenceRow = {
  /** Prop name, e.g. `variant`. */
  name: string;
  /** Human-readable type label derived from the control kind. */
  type: string;
  /** Default value rendered as source-ish text, or `undefined` when none. */
  defaultValue: string | undefined;
  /** True when the prop has no default and is not optional. */
  required: boolean;
  /** True when a parent may `bind:` to this prop. */
  bindable: boolean;
  /** Prop description, or `undefined` when the analyzer found none. */
  description: string | undefined;
};

/**
 * Describe a {@link ControlKind} as a short human-readable type label.
 *
 * - `select` → the options joined as a union, e.g. `'sm' | 'md' | 'lg'`.
 * - `unknown` → the analyzer's raw type string (falling back to `unknown`
 *   when the analyzer could not recover one, e.g. the `?` placeholder).
 * - everything else → the bare kind (`text`, `number`, `boolean`, `snippet`).
 *
 * @param control - The control descriptor from a {@link PropManifest}.
 * @returns A label suitable for the "Type" column.
 */
export function describeControlType(control: ControlKind): string {
  switch (control.kind) {
    case 'select':
      return control.options.map((option) => `'${option}'`).join(' | ');
    case 'unknown': {
      const raw = control.rawType.trim();
      return raw === '' || raw === '?' ? 'unknown' : raw;
    }
    default:
      return control.kind;
  }
}

/**
 * Render a prop's default value as compact source-ish text for the table.
 *
 * Strings are single-quoted, primitives are stringified, and structured values
 * are JSON-serialized. Returns `undefined` when the analyzer recorded no
 * default (distinct from a default of `undefined`, which the analyzer omits).
 *
 * @param defaultValue - The `defaultValue` field of a {@link PropManifest}.
 * @returns Display text, or `undefined` when there is no default.
 */
export function describeDefaultValue(defaultValue: unknown): string | undefined {
  if (defaultValue === undefined) return undefined;
  if (typeof defaultValue === 'string') return `'${defaultValue}'`;
  if (
    typeof defaultValue === 'number' ||
    typeof defaultValue === 'boolean' ||
    defaultValue === null ||
    typeof defaultValue === 'bigint'
  ) {
    return String(defaultValue);
  }
  try {
    // `JSON.stringify` returns `undefined` for values it can't represent
    // (functions, symbols); fall back to a placeholder rather than the literal
    // string "undefined".
    const serialized = JSON.stringify(defaultValue);
    return serialized ?? '(unserializable)';
  } catch {
    // Circular references and other serialization failures land here.
    return '(unserializable)';
  }
}

/**
 * Normalize one {@link PropManifest} into a display-ready {@link PropReferenceRow}.
 *
 * A prop is "required" when it is neither optional nor has a default value —
 * the analyzer's `optional` flag plus the presence of a default together decide
 * whether a consumer must pass it.
 *
 * @param prop - The prop metadata from a {@link ComponentManifest}.
 * @returns The display row for this prop.
 */
export function toPropReferenceRow(prop: PropManifest): PropReferenceRow {
  const defaultValue = describeDefaultValue(prop.defaultValue);
  return {
    name: prop.name,
    type: describeControlType(prop.control),
    defaultValue,
    required: !prop.optional && defaultValue === undefined,
    bindable: prop.bindable,
    description: prop.description,
  };
}

/**
 * Normalize a whole {@link ComponentManifest} into table rows.
 *
 * @param manifest - The component manifest fetched from `/api/manifest/:name`.
 * @returns One {@link PropReferenceRow} per prop, in manifest order.
 */
export function toPropReferenceRows(manifest: ComponentManifest): PropReferenceRow[] {
  return manifest.props.map(toPropReferenceRow);
}

/**
 * Read a property off an object-typed `unknown` without a type assertion.
 *
 * `Reflect.get` returns `unknown` for an arbitrary key, which keeps the
 * validation guards cast-free while still letting them inspect untrusted
 * JSON one property at a time.
 *
 * @param value - An object (callers narrow with `typeof === 'object'` first).
 * @param key - The property name to read.
 * @returns The property value, typed as `unknown`.
 */
function readProperty(value: object, key: string): unknown {
  return Reflect.get(value, key);
}

/**
 * Type guard: is `value` shaped like a {@link ControlKind}?
 *
 * Validates the discriminant plus the kind-specific payload so a malformed
 * manifest can't smuggle a half-built control into the table.
 */
function isControlKind(value: unknown): value is ControlKind {
  if (typeof value !== 'object' || value === null) return false;
  const kind = readProperty(value, 'kind');
  switch (kind) {
    case 'text':
    case 'number':
    case 'boolean':
    case 'snippet':
      return true;
    case 'select': {
      const options = readProperty(value, 'options');
      return Array.isArray(options) && options.every((option) => typeof option === 'string');
    }
    case 'unknown':
      return typeof readProperty(value, 'rawType') === 'string';
    default:
      return false;
  }
}

/**
 * Type guard: is `value` shaped like a {@link PropManifest}?
 */
function isPropManifest(value: unknown): value is PropManifest {
  if (typeof value !== 'object' || value === null) return false;
  const description = readProperty(value, 'description');
  return (
    typeof readProperty(value, 'name') === 'string' &&
    isControlKind(readProperty(value, 'control')) &&
    typeof readProperty(value, 'bindable') === 'boolean' &&
    typeof readProperty(value, 'optional') === 'boolean' &&
    (description === undefined || typeof description === 'string')
  );
}

/**
 * Type guard: is `value` shaped like a {@link ComponentManifest}?
 *
 * The `/api/manifest/:name` route returns JSON, so the fetched body is
 * `unknown` until validated. This guard lets the component fail into its error
 * state instead of rendering garbage when the payload is malformed.
 *
 * @param value - A parsed JSON body.
 * @returns True when `value` matches the {@link ComponentManifest} shape.
 */
export function isComponentManifest(value: unknown): value is ComponentManifest {
  if (typeof value !== 'object' || value === null) return false;
  const props = readProperty(value, 'props');
  return (
    typeof readProperty(value, 'name') === 'string' &&
    typeof readProperty(value, 'kebabName') === 'string' &&
    typeof readProperty(value, 'file') === 'string' &&
    typeof readProperty(value, 'importPath') === 'string' &&
    Array.isArray(props) &&
    props.every(isPropManifest)
  );
}

/**
 * The narrow slice of the response we read inside {@link fetchComponentManifest}.
 */
type ManifestResponse = {
  ok: boolean;
  status: number;
  statusText: string;
  json: () => Promise<unknown>;
};

/**
 * The narrow slice of `fetch` we depend on. Declaring exactly what we use lets
 * tests inject a minimal fake without satisfying the entire `fetch` surface
 * (`preconnect`, overloads, etc.) — the global `fetch` is assignable to it.
 */
export type ManifestFetch = (url: string) => Promise<ManifestResponse>;

/**
 * Fetch and validate a component's manifest from `/api/manifest/:name`.
 *
 * Throws on a non-OK response or a malformed body so the caller can surface a
 * single error state. The component name is the kebab-case segment from the
 * page URL (e.g. `button`), which the route matches against `kebabName`.
 *
 * @param componentName - kebab-case component name from the page URL.
 * @param fetchImpl - Injectable fetch (defaults to the global) for testing.
 * @returns The validated manifest.
 */
export async function fetchComponentManifest(
  componentName: string,
  fetchImpl: ManifestFetch = fetch,
): Promise<ComponentManifest> {
  const response = await fetchImpl(`/api/manifest/${encodeURIComponent(componentName)}`);
  if (!response.ok) {
    throw new Error(`Manifest request failed: ${response.status} ${response.statusText}`);
  }
  const body: unknown = await response.json();
  if (!isComponentManifest(body)) {
    throw new Error('Manifest response was not a valid ComponentManifest');
  }
  return body;
}
