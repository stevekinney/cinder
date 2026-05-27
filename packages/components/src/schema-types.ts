/**
 * Internal schema types used by every generated `<name>.schema.ts` module.
 *
 * This file is not exposed as a public package subpath. It ships in the tarball
 * so emitted declarations can resolve the `ComponentSchema` reference, but
 * consumers import schema modules via `cinder/<name>/schema`, not this type
 * directly.
 *
 * Schema dialect: JSON Schema draft 2020-12. The `$schema` URI is included on
 * every emitted schema and validated by the generator.
 */

export interface ComponentSchemaUnsupportedProp {
  readonly name: string;
  readonly reason: string;
}

export interface ComponentSchemaMetadata {
  readonly unsupportedProps?: readonly ComponentSchemaUnsupportedProp[];
}

export interface ComponentSchema {
  readonly $schema: 'https://json-schema.org/draft/2020-12/schema';
  readonly type: 'object';
  readonly properties: Readonly<Record<string, unknown>>;
  readonly required?: readonly string[];
  readonly allOf?: readonly Readonly<Record<string, unknown>>[];
  readonly additionalProperties?: boolean;
  readonly $defs?: Readonly<Record<string, unknown>>;
  readonly metadata?: ComponentSchemaMetadata;
}
