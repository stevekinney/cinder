/**
 * Shared CSP-safe JSON Schema validation boundary for JsonSchemaEditor and
 * SchemaForm.
 *
 * json-schema-library's `compileSchema` builds a schema-node interpreter: it
 * walks the schema and evaluates keywords directly against data as plain
 * function calls. It never calls `new Function`/`eval` to synthesise a
 * validator, unlike Ajv's `ajv.compile()`, which code-generates one — the
 * exact mechanism that fails under a Content-Security-Policy without
 * `unsafe-eval`. Both json-schema-editor/json-schema-validator.ts and
 * schema-form/schema-form-validation.ts build on this module instead of
 * importing Ajv directly.
 *
 * Dynamically imported (mirroring the Ajv builds it replaces) so the
 * library isn't in either component's static bundle unless schema
 * validation actually runs.
 */

import { createRetryingLoaderCache } from './retrying-loader-cache.ts';

export type InterpreterKnownDraft = '2020-12' | '2019-09' | 'draft-07';

export type InterpreterError = {
  code: string;
  message: string;
  /** json-schema-library's raw JSON pointer: `'#'` for the root, `'#/a/b'` for nested. */
  pointer: string;
  data: Record<string, unknown>;
};

export type InterpreterValidateResult = { valid: boolean; errors: InterpreterError[] };

export type InterpreterCompiled = {
  /**
   * Structural schema-shape issues: bad keyword types, an invalid regex
   * `pattern`, the library's eager `#/$defs/...` ref-existence check, etc.
   * This is what a real JSON-Schema-meta-schema check would flag — it does
   * NOT include general ref-target existence (see `refErrors`).
   */
  schemaErrors: InterpreterError[];
  /**
   * Every `$ref` / `$dynamicRef` / `$recursiveRef` in the schema that fails
   * to resolve, found by walking the whole compiled node tree regardless of
   * what data will be validated. json-schema-library resolves refs lazily
   * (only while walking data that actually reaches them), so an unresolved
   * ref under a property nobody has set yet would otherwise go unnoticed —
   * this walk restores Ajv's eager "does every ref resolve" compile-time
   * guarantee.
   */
  refErrors: InterpreterError[];
  validate: (data: unknown) => InterpreterValidateResult;
};

type LibraryModule = typeof import('json-schema-library');
type CompiledRootNode = ReturnType<LibraryModule['compileSchema']>;
// `compileSchema`'s return type adds root-only fields (`schemaErrors`,
// `schemaAnnotations`) on top of the plain per-node `SchemaNode` shape.
// Every *child* node (`.properties.foo`, `.items`, …) is the plain shape —
// derived here from one of those child fields rather than imported, since
// the package doesn't export the bare `SchemaNode` interface by name.
type SchemaNode = NonNullable<CompiledRootNode['properties']>[string];
type CompilableSchema = Parameters<LibraryModule['compileSchema']>[0];
type DraftExtension = Parameters<LibraryModule['extendDraft']>[1];
type FormatMap = NonNullable<DraftExtension['formats']>;
type FormatValidator = FormatMap[string];

const loadLibrary = createRetryingLoaderCache(() => import('json-schema-library'));

// --- Format bridging -------------------------------------------------------
//
// ajv-formats registers its full `fullFormats` set (26 formats) when the
// editor and form register standard formats. json-schema-library ships
// built-in validators for date, date-time, duration, email, json-pointer,
// relative-json-pointer, regex, time, url and uuid, but not the rest of
// ajv-formats' set. The remaining formats are bridged here, using the same
// regex patterns ajv-formats itself uses, so `format` keeps validating
// identically to the Ajv-backed implementation this module replaces.
//
// This intentionally avoids the `json-schema-library/formats` subpath: it
// adds hostname/ipv4/ipv6/uri/uri-reference/uri-template too, but pulls in
// `@hyperjump/json-schema-formats` (IDN-aware validators backed by unicode
// tables) for a result that is both heavier and *not* what ajv-formats'
// plain-regex validators actually check today. Reusing ajv-formats' own
// regexes keeps bundle size down and preserves exact behaviour.
const HOSTNAME_PATTERN =
  /^(?=.{1,253}\.?$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[-0-9a-z]{0,61}[0-9a-z])?)*\.?$/i;
const IPV4_PATTERN =
  /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;
const IPV6_PATTERN =
  /^((([0-9a-f]{1,4}:){7}([0-9a-f]{1,4}|:))|(([0-9a-f]{1,4}:){6}(:[0-9a-f]{1,4}|((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9a-f]{1,4}:){5}(((:[0-9a-f]{1,4}){1,2})|:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9a-f]{1,4}:){4}(((:[0-9a-f]{1,4}){1,3})|((:[0-9a-f]{1,4})?:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9a-f]{1,4}:){3}(((:[0-9a-f]{1,4}){1,4})|((:[0-9a-f]{1,4}){0,2}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9a-f]{1,4}:){2}(((:[0-9a-f]{1,4}){1,5})|((:[0-9a-f]{1,4}){0,3}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9a-f]{1,4}:){1}(((:[0-9a-f]{1,4}){1,6})|((:[0-9a-f]{1,4}){0,4}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(:(((:[0-9a-f]{1,4}){1,7})|((:[0-9a-f]{1,4}){0,5}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:)))$/i;
const NOT_URI_FRAGMENT = /\/|:/;
const URI_PATTERN =
  /^(?:[a-z][a-z0-9+\-.]*:)(?:\/?\/(?:(?:[a-z0-9\-._~!$&'()*+,;=:]|%[0-9a-f]{2})*@)?(?:\[(?:(?:(?:(?:[0-9a-f]{1,4}:){6}|::(?:[0-9a-f]{1,4}:){5}|(?:[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){4}|(?:(?:[0-9a-f]{1,4}:){0,1}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){3}|(?:(?:[0-9a-f]{1,4}:){0,2}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){2}|(?:(?:[0-9a-f]{1,4}:){0,3}[0-9a-f]{1,4})?::[0-9a-f]{1,4}:|(?:(?:[0-9a-f]{1,4}:){0,4}[0-9a-f]{1,4})?::)(?:[0-9a-f]{1,4}:[0-9a-f]{1,4}|(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?))|(?:(?:[0-9a-f]{1,4}:){0,5}[0-9a-f]{1,4})?::[0-9a-f]{1,4}|(?:(?:[0-9a-f]{1,4}:){0,6}[0-9a-f]{1,4})?::)|[Vv][0-9a-f]+\.[a-z0-9\-._~!$&'()*+,;=:]+)\]|(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)|(?:[a-z0-9\-._~!$&'()*+,;=]|%[0-9a-f]{2})*)(?::\d*)?(?:\/(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})*)*|\/(?:(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})*)*)?|(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})*)*)(?:\?(?:[a-z0-9\-._~!$&'()*+,;=:@/?]|%[0-9a-f]{2})*)?(?:#(?:[a-z0-9\-._~!$&'()*+,;=:@/?]|%[0-9a-f]{2})*)?$/i;
const URI_REFERENCE_PATTERN =
  /^(?:[a-z][a-z0-9+\-.]*:)?(?:\/?\/(?:(?:[a-z0-9\-._~!$&'()*+,;=:]|%[0-9a-f]{2})*@)?(?:\[(?:(?:(?:(?:[0-9a-f]{1,4}:){6}|::(?:[0-9a-f]{1,4}:){5}|(?:[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){4}|(?:(?:[0-9a-f]{1,4}:){0,1}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){3}|(?:(?:[0-9a-f]{1,4}:){0,2}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){2}|(?:(?:[0-9a-f]{1,4}:){0,3}[0-9a-f]{1,4})?::[0-9a-f]{1,4}:|(?:(?:[0-9a-f]{1,4}:){0,4}[0-9a-f]{1,4})?::)(?:[0-9a-f]{1,4}:[0-9a-f]{1,4}|(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?))|(?:(?:[0-9a-f]{1,4}:){0,5}[0-9a-f]{1,4})?::[0-9a-f]{1,4}|(?:(?:[0-9a-f]{1,4}:){0,6}[0-9a-f]{1,4})?::)|[Vv][0-9a-f]+\.[a-z0-9\-._~!$&'()*+,;=:]+)\]|(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)|(?:[a-z0-9\-._~!$&'"()*+,;=]|%[0-9a-f]{2})*)(?::\d*)?(?:\/(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})*)*|\/(?:(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})*)*)?|(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})*)*)?(?:\?(?:[a-z0-9\-._~!$&'"()*+,;=:@/?]|%[0-9a-f]{2})*)?(?:#(?:[a-z0-9\-._~!$&'"()*+,;=:@/?]|%[0-9a-f]{2})*)?$/i;
// ajv-formats' own uri-template pattern excludes ASCII control characters
// (\x00-\x20) from a literal (non-templated) segment; that's intentional
// per RFC 6570, not a mistake.
const URI_TEMPLATE_PATTERN =
  // eslint-disable-next-line no-control-regex
  /^(?:(?:[^\x00-\x20"'<>%\\^`{|}]|%[0-9a-f]{2})|\{[+#./;?&=,!@|]?(?:[a-z0-9_]|%[0-9a-f]{2})+(?::[1-9][0-9]{0,3}|\*)?(?:,(?:[a-z0-9_]|%[0-9a-f]{2})+(?::[1-9][0-9]{0,3}|\*)?)*\})*$/i;
const JSON_POINTER_URI_FRAGMENT_PATTERN =
  /^#(?:\/(?:[a-z0-9_\-.!$&'()*+,;:=@]|%[0-9a-f]{2}|~0|~1)*)*$/i;
const BYTE_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
// ajv-formats' "iso-time"/"iso-date-time" are its "time"/"date-time" formats
// with an optional (rather than required) timezone suffix — built here from
// its own "fast" regex bases, widened the same way.
const ISO_TIME_PATTERN =
  /^(?:[0-2]\d:[0-5]\d:[0-5]\d|23:59:60)(?:\.\d+)?(?:z|[+-]\d\d(?::?\d\d)?)?$/i;
const ISO_DATE_TIME_PATTERN =
  /^\d\d\d\d-[0-1]\d-[0-3]\d[t\s](?:[0-2]\d:[0-5]\d:[0-5]\d|23:59:60)(?:\.\d+)?(?:z|[+-]\d\d(?::?\d\d)?)?$/i;

const MIN_INT32 = -(2 ** 31);
const MAX_INT32 = 2 ** 31 - 1;

function stringFormat(pattern: RegExp, code: string, label: string): FormatValidator {
  return ({ node, pointer, data }) => {
    if (typeof data !== 'string' || data === '') return undefined;
    if (pattern.test(data)) return undefined;
    return node.createError(
      code,
      { value: data, pointer, schema: node.schema },
      `Value \`${data}\` at \`${pointer}\` is not a valid ${label}`,
    );
  };
}

const uriFormat: FormatValidator = ({ node, pointer, data }) => {
  if (typeof data !== 'string' || data === '') return undefined;
  if (NOT_URI_FRAGMENT.test(data) && URI_PATTERN.test(data)) return undefined;
  return node.createError(
    'format-uri-error',
    { value: data, pointer, schema: node.schema },
    `Value \`${data}\` at \`${pointer}\` is not a valid uri`,
  );
};

const byteFormat: FormatValidator = ({ node, pointer, data }) => {
  if (typeof data !== 'string' || data === '') return undefined;
  if (BYTE_PATTERN.test(data)) return undefined;
  return node.createError(
    'format-byte-error',
    { value: data, pointer, schema: node.schema },
    `Value \`${data}\` at \`${pointer}\` is not a valid byte (base64)`,
  );
};

const int32Format: FormatValidator = ({ node, pointer, data }) => {
  if (typeof data !== 'number') return undefined;
  if (Number.isInteger(data) && data >= MIN_INT32 && data <= MAX_INT32) return undefined;
  return node.createError(
    'format-int32-error',
    { value: data, pointer, schema: node.schema },
    `Value \`${data}\` at \`${pointer}\` is not a valid int32`,
  );
};

const int64Format: FormatValidator = ({ node, pointer, data }) => {
  if (typeof data !== 'number') return undefined;
  if (Number.isInteger(data)) return undefined;
  return node.createError(
    'format-int64-error',
    { value: data, pointer, schema: node.schema },
    `Value \`${data}\` at \`${pointer}\` is not a valid int64`,
  );
};

// ajv-formats registers float/double/password/binary as always-passing
// formats (a bare `true`/no-op validator, or — for float/double — a
// validator function that always returns `true`). Match that: these exist
// so `format` isn't reported as unrecognised, not to add new assertions.
const alwaysValidFormat: FormatValidator = () => undefined;

function buildCustomFormats(): FormatMap {
  return {
    hostname: stringFormat(HOSTNAME_PATTERN, 'format-hostname-error', 'hostname'),
    ipv4: stringFormat(IPV4_PATTERN, 'format-ipv4-error', 'ipv4 address'),
    ipv6: stringFormat(IPV6_PATTERN, 'format-ipv6-error', 'ipv6 address'),
    uri: uriFormat,
    'uri-reference': stringFormat(
      URI_REFERENCE_PATTERN,
      'format-uri-reference-error',
      'uri-reference',
    ),
    'uri-template': stringFormat(URI_TEMPLATE_PATTERN, 'format-uri-template-error', 'uri-template'),
    'json-pointer-uri-fragment': stringFormat(
      JSON_POINTER_URI_FRAGMENT_PATTERN,
      'format-json-pointer-error',
      'json-pointer-uri-fragment',
    ),
    'iso-time': stringFormat(ISO_TIME_PATTERN, 'format-date-time-error', 'iso-time'),
    'iso-date-time': stringFormat(ISO_DATE_TIME_PATTERN, 'format-date-time-error', 'iso-date-time'),
    byte: byteFormat,
    int32: int32Format,
    int64: int64Format,
    float: alwaysValidFormat,
    double: alwaysValidFormat,
    password: alwaysValidFormat,
    binary: alwaysValidFormat,
  };
}

// --- Draft selection ---------------------------------------------------

type KnownDrafts = Record<InterpreterKnownDraft, ReturnType<LibraryModule['extendDraft']>>;

let cachedDrafts: KnownDrafts | null = null;

function draftsFor(lib: LibraryModule): KnownDrafts {
  if (cachedDrafts) return cachedDrafts;
  const formats = buildCustomFormats();
  cachedDrafts = {
    'draft-07': lib.extendDraft(lib.draft07, { formats }),
    '2019-09': lib.extendDraft(lib.draft2019, { formats }),
    '2020-12': lib.extendDraft(lib.draft2020, { formats }),
  };
  return cachedDrafts;
}

// --- Error normalisation -------------------------------------------------

// json-schema-library types `JsonError.code` as `string | ErrorConfig`
// (a quirk of its generic `Annotation` type, reused for both a created
// error's actual `code` string and the config shape used to *register*
// error message templates). Every error this module actually receives back
// from `schemaErrors`/`validate` carries a plain string code.
type RawJsonError = { code: unknown; message: string; data?: Record<string, unknown> };

function toInterpreterError(error: RawJsonError): InterpreterError {
  const rawPointer = error.data?.['pointer'];
  const pointer = typeof rawPointer === 'string' ? rawPointer : '#';
  const code = typeof error.code === 'string' ? error.code : String(error.code);
  return { code, message: error.message, pointer, data: error.data ?? {} };
}

/**
 * The library's `$ref` keyword eagerly checks `#/$defs/...`-shaped refs at
 * parse time (before any data is validated) and reports a missing target as
 * a `schema-error` in `schemaErrors`. That is a ref-resolution failure, not
 * a structural shape problem — `validateMetaSchema` (which mirrors "is this
 * a valid schema document", blind to whether refs resolve) needs to exclude
 * it, while `tryCompile` (which mirrors "can I use this schema at all")
 * keeps it.
 */
export function isRefResolutionSchemaError(error: InterpreterError): boolean {
  return error.code === 'schema-error' && error.pointer.endsWith('/$ref');
}

// --- Eager ref-resolution walk -------------------------------------------
//
// json-schema-library resolves $ref/$dynamicRef/$recursiveRef lazily, while
// walking data — a ref nested under a property nobody has set never gets
// resolved, so its being broken never surfaces. Ajv's ajv.compile() resolves
// every ref eagerly, regardless of what data will be validated later, and
// JsonSchemaEditor/SchemaForm's contract depends on that (an unresolved ref
// must be an explicit compile error, not something that only appears once a
// user happens to fill in the right field). Calling a node's own `validate`
// with `undefined` data forces its `$ref` keyword to attempt resolution
// unconditionally (the keyword's `addValidate` gate only checks the schema,
// never the data), without needing to reach into resolution internals.
function isSchemaNode(value: unknown): value is SchemaNode {
  return value !== null && typeof value === 'object' && 'schema' in value;
}

function hasOwnRef(node: SchemaNode): boolean {
  const schema = node.schema;
  return (
    typeof schema === 'object' &&
    schema !== null &&
    (schema['$ref'] != null || schema['$dynamicRef'] != null || schema['$recursiveRef'] != null)
  );
}

/** Every SchemaNode field that can hold one or more child SchemaNodes,
 *  declared explicitly (rather than iterated dynamically) so the walk stays
 *  fully typed. Mirrors `SchemaNode`'s own containment fields, including
 *  `propertyDependencies`, which only a draft that registers
 *  json-schema-library's opt-in keyword populates. Exported for that contract's
 *  test; the module is internal to the package. */
export function childNodes(node: SchemaNode): SchemaNode[] {
  const children: SchemaNode[] = [];
  const single = [
    node.additionalProperties,
    node.items,
    node.contains,
    node.not,
    node.if,
    node.then,
    node.else,
    node.propertyNames,
    node.unevaluatedItems,
    node.unevaluatedProperties,
  ];
  for (const child of single) if (child) children.push(child);

  const arrays = [node.allOf, node.anyOf, node.oneOf, node.prefixItems];
  for (const array of arrays) if (array) children.push(...array);

  const records = [node.properties, node.$defs];
  for (const record of records) if (record) children.push(...Object.values(record));

  if (node.dependentSchemas) {
    for (const child of Object.values(node.dependentSchemas)) {
      if (isSchemaNode(child)) children.push(child);
    }
  }
  if (node.propertyDependencies) {
    for (const inner of Object.values(node.propertyDependencies)) {
      children.push(...Object.values(inner));
    }
  }

  return children;
}

function collectRefErrors(root: SchemaNode): InterpreterError[] {
  const seen = new Set<SchemaNode>();
  const errors: InterpreterError[] = [];

  function visit(node: SchemaNode): void {
    if (seen.has(node)) return;
    seen.add(node);

    if (hasOwnRef(node)) {
      const result = node.validate(undefined);
      for (const error of result.errors) {
        if (error.code === 'ref-error') errors.push(toInterpreterError(error));
      }
    }

    for (const child of childNodes(node)) visit(child);
  }

  visit(root);
  return errors;
}

export type CompileInterpretedOptions = {
  /**
   * Whether the `format` keyword actually asserts. Defaults to `true`
   * (JsonSchemaEditor's historical behaviour: it registers ajv-formats and
   * enforces every format it lists). SchemaForm passes `false` — it has
   * never registered ajv-formats, so `format` has always been a no-op
   * annotation there, and changing that is a behaviour change this repair
   * doesn't own. Either way `format` stays a *recognised* keyword (no
   * schema errors, no "unknown keyword" warnings) — only the assertion
   * itself is toggled.
   */
  formats?: boolean;
};

/**
 * Compile a schema for one draft and expose the two independent error
 * surfaces JsonSchemaEditor and SchemaForm each need. Uses a single-entry
 * `drafts` list, so the resolved draft always applies regardless of the
 * schema's own `$schema` — draft resolution/override policy stays entirely
 * with the caller (json-schema-editor's `resolveDraft`/`detectDraft`,
 * schema-form's own `$schema` sniff).
 */
export async function compileInterpreted(
  schema: CompilableSchema,
  draft: InterpreterKnownDraft,
  options: CompileInterpretedOptions = {},
): Promise<InterpreterCompiled> {
  const lib = await loadLibrary();
  const draftObject = draftsFor(lib)[draft];
  const node = lib.compileSchema(schema, {
    drafts: [draftObject],
    formatAssertion: options.formats ?? true,
  });

  const schemaErrors = (node.schemaErrors ?? []).map(toInterpreterError);
  const refErrors = collectRefErrors(node);

  return {
    schemaErrors,
    refErrors,
    validate: (data: unknown): InterpreterValidateResult => {
      const result = node.validate(data);
      return { valid: result.valid, errors: result.errors.map(toInterpreterError) };
    },
  };
}

/** De-duplicate by (code, pointer) — `schemaErrors` and `refErrors` can both
 *  report the same `#/$defs/...`-shorthand ref, since the walk in
 *  `collectRefErrors` doesn't special-case that shorthand. */
export function dedupeInterpreterErrors(errors: InterpreterError[]): InterpreterError[] {
  const seen = new Set<string>();
  const result: InterpreterError[] = [];
  for (const error of errors) {
    const key = `${error.code}\u0000${error.pointer}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(error);
  }
  return result;
}

/** JSON-schema-library pointers are `'#'` (root) or `'#/a/b'` (nested).
 *  Strip the leading `#` so callers can feed the result into ordinary
 *  JSON-pointer parsing (`''` for root, `'/a/b'` for nested) — matching
 *  Ajv's `instancePath` convention that both consumers already build on. */
export function stripPointerHash(pointer: string): string {
  return pointer === '#' ? '' : pointer.slice(1);
}
