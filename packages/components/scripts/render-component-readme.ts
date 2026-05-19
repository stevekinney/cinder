/**
 * Renders the generated regions (`props`, `variables`, `subcomponents`) of a
 * component's `README.md`. Regions are bounded by HTML comment markers:
 *
 *     <!-- generated:props:start -->
 *     ...
 *     <!-- generated:props:end -->
 *
 * Content outside matching markers is preserved verbatim. The drift checker
 * fails if a generated region diverges from a fresh regeneration.
 */

import type { ComponentSchemaOutput, PropertySchema } from './generate-component-schema.ts';

export type Region = 'props' | 'variables' | 'subcomponents';

export interface RenderInput {
  existingReadme: string;
  schema: ComponentSchemaOutput;
  variables: readonly string[];
  /**
   * Optional subcomponent list. When omitted, the existing subcomponents region
   * is preserved verbatim — useful for components where the migrator hand-wrote
   * the section and there is no automated source for it.
   */
  subcomponents?: ReadonlyArray<{ name: string; description?: string }>;
}

export function renderComponentReadme(input: RenderInput): string {
  let next = input.existingReadme;
  next = replaceRegion(next, 'props', renderPropsTable(input.schema));
  next = replaceRegion(next, 'variables', renderVariablesList(input.variables));
  if (input.subcomponents !== undefined) {
    next = replaceRegion(next, 'subcomponents', renderSubcomponentsList(input.subcomponents));
  }
  return next;
}

function replaceRegion(text: string, region: Region, body: string): string {
  const startMarker = `<!-- generated:${region}:start -->`;
  const endMarker = `<!-- generated:${region}:end -->`;
  const startIndex = text.indexOf(startMarker);
  const endIndex = text.indexOf(endMarker);
  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    // No region in this README — leave content untouched. README scaffolding
    // is the migrator's responsibility; this generator only rewrites existing
    // regions.
    return text;
  }
  const before = text.slice(0, startIndex + startMarker.length);
  const after = text.slice(endIndex);
  return `${before}\n${body}\n${after}`;
}

function renderPropsTable(schema: ComponentSchemaOutput): string {
  const propertyEntries = Object.entries(schema.properties);
  const requiredSet = new Set(schema.required ?? []);
  const unsupported = new Map(
    (schema.metadata?.unsupportedProps ?? []).map((entry) => [entry.name, entry.reason]),
  );

  if (propertyEntries.length === 0 && unsupported.size === 0) {
    return 'This component does not declare any props.';
  }

  const rows: string[] = [];
  rows.push('| Prop | Type | Required | Default | Description |');
  rows.push('| --- | --- | --- | --- | --- |');

  for (const [name, prop] of propertyEntries.toSorted(([a], [b]) => a.localeCompare(b))) {
    const type = formatType(prop);
    const required = requiredSet.has(name) ? 'yes' : 'no';
    const def = formatDefault(prop.default);
    const description = (prop.description ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
    rows.push(`| \`${name}\` | ${type} | ${required} | ${def} | ${description} |`);
  }

  for (const [name, reason] of [...unsupported.entries()].toSorted(([a], [b]) =>
    a.localeCompare(b),
  )) {
    rows.push(`| \`${name}\` | \`(opaque)\` | — | — | ${reason} |`);
  }

  return rows.join('\n');
}

function formatType(prop: PropertySchema): string {
  if (prop.enum) {
    return prop.enum.map((value) => '`' + JSON.stringify(value) + '`').join(' \\| ');
  }
  if (prop.const !== undefined) {
    return '`' + JSON.stringify(prop.const) + '`';
  }
  if (prop.anyOf) {
    return prop.anyOf.map(formatType).join(' \\| ');
  }
  if (prop.type === 'array' && prop.items) {
    return `${formatType(prop.items)}[]`;
  }
  if (prop.type) return '`' + prop.type + '`';
  return '`unknown`';
}

function formatDefault(value: unknown): string {
  if (value === undefined) return '—';
  return '`' + JSON.stringify(value) + '`';
}

function renderVariablesList(variables: readonly string[]): string {
  if (variables.length === 0) {
    return 'This component does not declare any local CSS variables.';
  }
  return variables.map((variable) => `- \`${variable}\``).join('\n');
}

function renderSubcomponentsList(
  subcomponents: ReadonlyArray<{ name: string; description?: string }>,
): string {
  if (subcomponents.length === 0) return 'None.';
  return subcomponents
    .toSorted((a, b) => a.name.localeCompare(b.name))
    .map((sub) =>
      sub.description ? `- \`${sub.name}\` — ${sub.description}` : `- \`${sub.name}\``,
    )
    .join('\n');
}
