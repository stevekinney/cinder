/**
 * Internal schema types used by every generated `<name>.schema.ts` module.
 *
 * This file is not exposed as a public package subpath. It ships in the tarball
 * so emitted declarations can resolve the `ComponentSchema` reference, but
 * consumers import schema modules via `@lostgradient/cinder/<name>/schema`, not this type
 * directly.
 *
 * Schema dialect: JSON Schema draft 2020-12. The `$schema` URI is included on
 * every emitted schema and validated by the generator.
 */

export interface ComponentSchemaUnsupportedProp {
  readonly name: string;
  readonly reason: string;
  /**
   * Whether the prop is required on the component. Present for props that the
   * JSON schema cannot express but that are still part of the component's API
   * (e.g. a required `onselect: () => void` callback), so tooling and docs can
   * report them faithfully. Absent for legacy entries (treated as not-required).
   */
  readonly required?: boolean;
  /** The prop's authored JSDoc description, when one exists. */
  readonly description?: string;
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
