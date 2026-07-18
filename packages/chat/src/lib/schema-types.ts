/** Internal shape shared by generated component schema modules. */
export type ComponentSchemaUnsupportedProp = {
  readonly name: string;
  readonly reason: string;
  readonly required?: boolean;
  readonly description?: string;
};

/** Metadata retained when a component prop cannot be represented in JSON Schema. */
export type ComponentSchemaMetadata = {
  readonly unsupportedProps?: readonly ComponentSchemaUnsupportedProp[];
};

/** JSON Schema draft 2020-12 document emitted for a public Chat component. */
export type ComponentSchema = {
  readonly $schema: 'https://json-schema.org/draft/2020-12/schema';
  readonly type: 'object';
  readonly properties: Readonly<Record<string, unknown>>;
  readonly required?: readonly string[];
  readonly allOf?: readonly Readonly<Record<string, unknown>>[];
  readonly additionalProperties?: boolean;
  readonly $defs?: Readonly<Record<string, unknown>>;
  readonly metadata?: ComponentSchemaMetadata;
};
