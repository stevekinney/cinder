import type { JsonSchemaObject, JsonSchemaValue } from './json-schema-editor-types.ts';

/**
 * A `oneOf` branch that represents one described enum value: `{ const, description? }`
 * and nothing else. Standard JSON Schema `enum` has no per-value description slot, so
 * a described enum value is promoted to this shape instead of a vendor extension.
 */
export type EnumOneOfBranch = { const: unknown; description?: string };

function isEnumOneOfBranch(branch: JsonSchemaValue): branch is EnumOneOfBranch {
  if (typeof branch !== 'object' || branch === null || Array.isArray(branch)) return false;
  const keys = Object.keys(branch);
  if (!keys.includes('const')) return false;
  return keys.every((key) => key === 'const' || key === 'description');
}

/**
 * True when every branch of `oneOf` is a bare `{ const, description? }` — i.e. the
 * `oneOf` is standing in for a described enum rather than a real composition. A
 * branch with any other keyword means the author wrote a real composition, so the
 * composition section should render it instead of the enum table.
 */
export function isEnumLikeOneOf(oneOf: JsonSchemaValue[] | undefined): boolean {
  return Array.isArray(oneOf) && oneOf.length > 0 && oneOf.every(isEnumOneOfBranch);
}

export type EnumSource = 'enum' | 'oneOf' | null;

/** Which representation (if either) currently holds this schema's enum values. */
export function detectEnumSource(schema: JsonSchemaObject): EnumSource {
  if (Array.isArray(schema.enum)) return 'enum';
  if (isEnumLikeOneOf(schema.oneOf)) return 'oneOf';
  return null;
}

function enumOneOfBranches(schema: JsonSchemaObject): EnumOneOfBranch[] {
  return (schema.oneOf ?? []).filter(isEnumOneOfBranch);
}

/** Reads the enum values out of whichever representation is active. */
export function readEnumValues(schema: JsonSchemaObject, source: EnumSource): unknown[] {
  if (source === 'enum') return schema.enum ?? [];
  if (source === 'oneOf') return enumOneOfBranches(schema).map((branch) => branch.const);
  return [];
}

/** Reads the parallel description array; `''` for a value with no description. */
export function readEnumDescriptions(schema: JsonSchemaObject, source: EnumSource): string[] {
  if (source !== 'oneOf') return readEnumValues(schema, source).map(() => '');
  return enumOneOfBranches(schema).map((branch) => branch.description ?? '');
}

/**
 * Builds the `enum`/`oneOf` patch for a committed values+descriptions pair. A bare
 * `enum` stays bare until a description is present anywhere in the list, at which
 * point every value promotes to a `oneOf` branch; clearing every description demotes
 * back to a bare `enum`. Both keys are always present (possibly `undefined`) so the
 * caller's patch-merge deletes whichever representation is no longer active.
 */
export function buildEnumPatch(
  values: unknown[],
  descriptions: string[],
): { enum: unknown[] | undefined; oneOf: EnumOneOfBranch[] | undefined } {
  const hasAnyDescription = descriptions.some((description) => description.trim() !== '');
  if (!hasAnyDescription) {
    return { enum: values, oneOf: undefined };
  }
  const oneOf: EnumOneOfBranch[] = values.map((value, index) => {
    const description = descriptions[index]?.trim();
    return description ? { const: value, description } : { const: value };
  });
  return { enum: undefined, oneOf };
}
