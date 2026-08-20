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
import { allowsPlainTextChildren } from './component-page-children-seed.ts';
import type { ComponentManifest, ObjectShape, PropManifest, ValueShape } from './types.ts';

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
 * A required prop the generator cannot make ADJUSTABLE, but CAN satisfy with a
 * synthesized literal so the preview mounts and the snippet compiles.
 *
 * Seeds exist because the alternative was worse: an array-of-object prop like
 * `Breadcrumbs.items` is not something a text input can edit, so the analyzer
 * used to report it unsynthesizable and the page deleted the whole Playground
 * section. A read-only placeholder renders a real, multi-item instance and
 * copies as valid Svelte.
 *
 * Not a `PlaygroundControl`: `PlaygroundValue` is `boolean | string | number`
 * and is threaded through the snippet builder, the mount, and the page's
 * `$state`. Widening it to `unknown` to carry an object would touch all of that,
 * and a JSON textarea would remount the component with a parse failure on most
 * keystrokes.
 */
export type PlaygroundSeed = {
  name: string;
  description?: string;
  /** The literal handed to `mount`. */
  value: unknown;
  /** The same literal as copy-pasteable Svelte source. */
  source: string;
};

/**
 * Three elements — enough that a list, chart, or carousel renders as a real
 * multi-item instance rather than a degenerate single-row case.
 */
const SYNTHESIZED_ARRAY_LENGTH = 3;

/** Ordinal words for placeholder text, so items read as content, not as `item0`. */
const ORDINALS = ['one', 'two', 'three', 'four', 'five'] as const;

function ordinal(index: number): string {
  return ORDINALS[index] ?? String(index + 1);
}

/** True when a shape is an {@link ObjectShape} rather than a leaf {@link ValueShape}. */
function isObjectShape(shape: ValueShape | ObjectShape): shape is ObjectShape {
  return 'fields' in shape;
}

/**
 * Invent the minimal value satisfying a shape. `index` varies the placeholders
 * across the elements of an array so the preview shows distinguishable items.
 */
function synthesizeValue(
  shape: ValueShape | ObjectShape,
  index: number,
  propName: string,
): unknown {
  if (isObjectShape(shape)) {
    if (shape.degenerate) return {};
    const value: Record<string, unknown> = {};
    for (const field of shape.fields) {
      value[field.name] = synthesizeValue(field.shape, index, field.name);
    }
    return value;
  }

  switch (shape.kind) {
    case 'string':
      // Identifier-ish fields get a slug, prose fields a readable label — an
      // `id` of "Item one" would be a strange thing to show a reader.
      return /^(id|key|value|slug|name)$/i.test(propName)
        ? ordinal(index)
        : `${sentenceCase(propName)} ${ordinal(index)}`;
    case 'number':
      return (index + 1) * 10;
    case 'boolean':
      return false;
    case 'enum':
      return shape.options[index % shape.options.length] ?? shape.options[0] ?? '';
    case 'array':
      // Two elements for a NESTED array — enough to read as a list without
      // making the outer literal unwieldy.
      return [0, 1].map((nested) => synthesizeValue(shape.element, nested, propName));
    default:
      // Opaque — never faked. Callers drop these fields entirely.
      return undefined;
  }
}

/** `datetime` -> `Datetime`, `firstName` -> `First name`. */
function sentenceCase(name: string): string {
  const spaced = name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * Serialize a synthesized value as Svelte SOURCE, not JSON: unquoted
 * identifier-safe keys and single-quoted strings, because `{"label":"Item one"}`
 * is valid but reads as JSON rather than as code a reader would have written.
 */
export function formatValueLiteral(value: unknown): string {
  if (typeof value === 'string') return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value === null || value === undefined) return 'null';
  if (Array.isArray(value)) return `[${value.map(formatValueLiteral).join(', ')}]`;
  const entries = Object.entries(value as Record<string, unknown>).map(
    ([key, entry]) =>
      `${/^[A-Za-z_$][\w$]*$/.test(key) ? key : `'${key}'`}: ${formatValueLiteral(entry)}`,
  );
  return entries.length === 0 ? '{}' : `{ ${entries.join(', ')} }`;
}

/**
 * The result of classifying a component's props for the Playground: the
 * controls we can render, and the names of props we deliberately skipped
 * (shown to the reader so the omission is explicit, not silent).
 */
export type PlaygroundModel = {
  controls: PlaygroundControl[];
  /**
   * Props satisfied by a synthesized literal rather than a control. See
   * {@link PlaygroundSeed}.
   */
  seeds: PlaygroundSeed[];
  skipped: string[];
  /**
   * Names of the required props with no default that we cannot supply a
   * baseline for — the props that make a GENERATED preview invalid by
   * construction (see {@link blocksGeneratedPreview}).
   *
   * Carried as names rather than a bare flag because the page has to tell the
   * reader WHY the generated snippet is missing. The previous boolean-only
   * shape left the page with nothing honest to say, so it printed "This
   * component has no adjustable props" — false whenever the component had
   * plenty of adjustable props and merely one unsynthesizable required one.
   */
  unsatisfiedRequired: string[];
  /**
   * True when the component has a required prop with no default that we cannot
   * supply a baseline for. The page should then omit the generated preview +
   * snippet rather than emit an invalid one. Equivalent to
   * `unsatisfiedRequired.length > 0`; kept as a named field because it is the
   * question every call site actually asks.
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

/**
 * Components documented through their authored examples rather than the generic
 * prop playground.
 *
 * The overlays are here for a specific reason: `Modal`, `Drawer`, and
 * `CommandPalette` all call `showModal()`, so seeding `open: true` would not put
 * a preview in the stage — it would blanket the entire documentation page in the
 * top layer and take the body scroll lock with it. `Popover` cannot be opened at
 * all without a `trigger` snippet to anchor against, which the generator has no
 * way to synthesize as focusable markup. Each of them ships a trigger-based
 * example that demonstrates the real interaction, which is what the stage shows
 * instead of an empty box.
 */
const EXAMPLE_ONLY_PLAYGROUND_COMPONENTS = new Set([
  'autocomplete',
  'spectrogram',
  // These closed-by-default overlays need state, anchors, or callbacks that a
  // bare mount cannot supply. Their authored examples provide the real working
  // interaction instead of an empty stage.
  'alert-dialog',
  'backdrop',
  'command-menu',
  'confirm-dialog',
  // These containers require structured child snippets. Their existing
  // authored examples show a valid composition without a failed bare mount.
  'button-group',
  'checkbox-group',
  'form-field',
  'form-section',
  'scroll-area',
  'segmented-control',
  // SideNavigation requires list-item children composed from its own Item and
  // Group components. The authored example supplies that semantic structure.
  'side-navigation',
  // Sidebar needs application-owned navigation content and an explicit mobile
  // drawer trigger. Its authored example provides both, while a bare mount can
  // create an empty top-layer drawer at the mobile breakpoint.
  'sidebar',
  'modal',
  'drawer',
  'popover',
  // Listed defensively. CommandPalette is currently blocked anyway by its
  // required `items` snippet, so no `open` control is generated today — but it
  // is a `showModal()` dialog like the four above, so if that snippet ever
  // becomes synthesizable the blanket-the-page failure would come back silently.
  'command-palette',
]);

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
/**
 * Per-component seeds for required text props whose value has to be a REAL
 * instance of something, not a label.
 *
 * `requiredTextSeed` keys only on the prop name and falls back to the name
 * itself, which is fine for a `label` but produced the two most visibly broken
 * previews in the library: `Image` rendered a broken-image glyph because `src`
 * was the literal string "src", and `SourceDiffViewer` rendered a fake one-line
 * diff because `patch` was the literal string "patch".
 */
const COMPONENT_TEXT_SEEDS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  'bar-chart': {
    // The category key must name a property that actually exists on each datum.
    categoryKey: 'month',
  },
  image: {
    // An inline SVG data URI rather than a remote placeholder service: the docs
    // site ships no image assets, and the examples already use this pattern
    // (see `examples/carousel/basic.example.svelte`) precisely to avoid a
    // third-party network dependency that breaks offline dev and snapshots.
    src:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='600' height='338'%3E" +
      "%3Crect width='600' height='338' fill='%23b8c4d4'/%3E%3C/svg%3E",
    alt: 'A muted grey placeholder rectangle',
  },
  'source-diff-viewer': {
    // Deliberately a Markdown diff, not a code diff: no braces, quotes,
    // ampersands, or angle brackets, so it survives every attribute-escaping
    // path unchanged.
    patch: [
      'diff --git a/README.md b/README.md',
      '--- a/README.md',
      '+++ b/README.md',
      '@@ -1,3 +1,3 @@',
      ' # Cinder',
      '-A component library.',
      '+A Svelte component library for building fast UIs.',
      ' Read the docs to get started.',
    ].join('\n'),
  },
};

/**
 * Per-component seeds for STRUCTURAL props whose generic placeholder is
 * technically valid but reads as nonsense. `ShortcutHint.keys` is the clear
 * case: the generic array-of-string synthesis yields
 * `['Keys one', 'Keys two', 'Keys three']`, and rendering those as keycaps is
 * exactly the sort of thing a reader would screenshot as a bug.
 */
const COMPONENT_VALUE_SEEDS: Readonly<Record<string, Readonly<Record<string, unknown>>>> = {
  'bar-chart': {
    data: [
      { month: 'January', revenue: 42 },
      { month: 'February', revenue: 58 },
      { month: 'March', revenue: 73 },
    ],
    series: [{ id: 'revenue', label: 'Revenue', valueKey: 'revenue' }],
  },
  'data-table': {
    columns: [
      { key: 'name', label: 'Name', rowHeader: true },
      { key: 'role', label: 'Role' },
    ],
    rows: [
      { id: 'ada', name: 'Ada Lovelace', role: 'Engineer' },
      { id: 'grace', name: 'Grace Hopper', role: 'Admiral' },
    ],
  },
  'keyboard-shortcuts': {
    groups: [
      {
        label: 'General',
        shortcuts: [{ action: 'Open command palette', keys: ['Meta', 'K'] }],
      },
    ],
  },
  'shortcut-hint': { keys: ['Meta', 'Shift', 'P'] },
};

function requiredTextSeed(prop: PropManifest, manifest: ComponentManifest): string {
  const scoped = COMPONENT_TEXT_SEEDS[manifest.kebabName]?.[prop.name];
  if (scoped !== undefined) return scoped;
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
  const seeds: PlaygroundSeed[] = [];
  const skipped: string[] = [];
  const unsatisfiedRequired: string[] = [];

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
      case 'array':
      case 'object': {
        // ONLY a required prop with no default is seeded, matching exactly the
        // condition that would otherwise block the preview (see
        // `blocksGeneratedPreview`) — which is the entire reason seeds exist.
        //
        // Seeding an optional or defaulted structural prop actively breaks the
        // component: `buildSnippet` always emits seeds and `toMountProps` always
        // passes them, so `ChoiceGrid.values` (optional, defaults to `[]`) had
        // its own default overwritten with invented data, and
        // `PhoneInput.countries` (optional) had its full 245-country list
        // replaced by three. Same reasoning as the synthesized `''`/`0` values
        // that `shouldEmit` and `toMountProps` already drop: never supply a
        // value the component did not ask for.
        if (prop.optional || prop.defaultValue !== undefined) {
          skipped.push(prop.name);
          break;
        }
        const scoped = COMPONENT_VALUE_SEEDS[manifest.kebabName]?.[prop.name];
        const value =
          scoped !== undefined
            ? scoped
            : prop.control.kind === 'array'
              ? Array.from({ length: SYNTHESIZED_ARRAY_LENGTH }, (_unused, index) =>
                  synthesizeValue(
                    prop.control.kind === 'array'
                      ? prop.control.element
                      : {
                          fields: [],
                          degenerate: true,
                        },
                    index,
                    prop.name,
                  ),
                )
              : synthesizeValue(prop.control.shape, 0, prop.name);
        seeds.push({ ...base, value, source: formatValueLiteral(value) });
        break;
      }
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
        if (
          prop.name === 'children' &&
          prop.control.kind === 'snippet' &&
          allowsPlainTextChildren(manifest)
        ) {
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
        if (blocksGeneratedPreview(prop)) unsatisfiedRequired.push(prop.name);
        break;
    }
  }

  return {
    controls,
    seeds,
    skipped,
    unsatisfiedRequired,
    hasUnsatisfiedRequired: unsatisfiedRequired.length > 0,
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
  // `{` and `}` are NOT safe in a double-quoted Svelte attribute — `{expr}` is
  // interpolated there, so a value containing braces pastes as different (or
  // invalid) Svelte than the preview shows. `\n` is legal but emits literal
  // newlines inside the quotes, wrecking the snippet's formatting and
  // highlighting. All of them route to the JSON-escaped expression form.
  if (/["&<>{}\n]/.test(value)) return `${name}={${JSON.stringify(value)}}`;
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
  // A synthesized `0` is noise for the same reason a synthesized `''` is: the
  // component never declared it. It is also actively wrong for `Image`, where
  // `width={0} height={0}` collapses the element to nothing however good the
  // `src` is.
  return current !== '' && current !== 0;
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

/**
 * Serialized seed literals longer than this move out of the attribute list and
 * into a `<script>` preamble. An inline nine-field object array is not how
 * anyone writes this, and the snippet is meant to be copied.
 */
const INLINE_SEED_MAX_CHARS = 60;

export function buildSnippet(
  exportName: string,
  controls: PlaygroundControl[],
  values: Record<string, PlaygroundValue>,
  seeds: readonly PlaygroundSeed[] = [],
  importPath?: string,
  baselineProps: Readonly<Record<string, unknown>> = {},
): string {
  // The synthesized `children` control renders as element CONTENT, not an
  // attribute, so it is partitioned out of the attribute list.
  const childrenControl = controls.find((c) => c.kind === 'text' && c.isChildren);
  const childrenText =
    childrenControl !== undefined
      ? String(values[childrenControl.name] ?? childrenControl.value)
      : '';

  // Seeds are ALWAYS emitted — a synthesized value for a required prop can never
  // be omitted without the snippet failing to compile. Short ones inline as an
  // expression attribute; long ones become `const` bindings in a preamble and
  // are referenced by the `{name}` shorthand.
  const inlineSeeds = seeds.filter((seed) => seed.source.length <= INLINE_SEED_MAX_CHARS);
  const preambleSeeds = seeds.filter((seed) => seed.source.length > INLINE_SEED_MAX_CHARS);

  const attributes = [
    ...Object.entries(baselineProps)
      .filter(([name]) => {
        const matchingControl = controls.find((control) => control.name === name);
        return (
          matchingControl === undefined ||
          !shouldEmit(matchingControl, values[matchingControl.name] ?? matchingControl.value)
        );
      })
      .flatMap(([name, value]) =>
        typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
          ? [attributeFor(name, value)]
          : [],
      ),
    ...controls
      .filter((control) => !(control.kind === 'text' && control.isChildren))
      .filter((control) => shouldEmit(control, values[control.name] ?? control.value))
      .map((control) => attributeFor(control.name, values[control.name] ?? control.value)),
    ...inlineSeeds.map((seed) => `${seed.name}={${seed.source}}`),
    ...preambleSeeds.map((seed) => `{${seed.name}}`),
  ];

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
  const element =
    childrenText !== ''
      ? `<${exportName}${attributePart}>${escapeSnippetText(childrenText)}</${exportName}>`
      : attributes.length > 1
        ? `<${exportName}${attributePart}/>`
        : `<${exportName}${attributePart} />`;

  if (preambleSeeds.length === 0) return element;

  const importLine =
    importPath === undefined ? '' : `  import { ${exportName} } from '${importPath}';\n\n`;
  const declarations = preambleSeeds
    .map((seed) => `  const ${seed.name} = ${seed.source};`)
    .join('\n');
  return `<script lang="ts">\n${importLine}${declarations}\n</script>\n\n${element}`;
}
