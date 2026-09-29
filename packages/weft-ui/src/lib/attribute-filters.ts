/**
 * `attr.<name>[.gt|.lt|.gte|.lte]` query-parameter grammar, split out of
 * `filters.ts` to keep each function's branching under the lint complexity
 * budget (plan §4, T1.3 — this file is part of that frozen contract).
 *
 * Both directions mirror weft's server-side grammar
 * (`weft/src/server/attribute-filters.ts`) exactly, field for field, so the
 * console's parser is the true inverse of its own serializer over the same
 * wire format the server accepts: repeated `attr.<name>=value` params fold
 * into one filter with an array `value` (`appendExactAttributeValue`),
 * range operators are read via the *first* dot after `attr.` (not a suffix
 * match — an attribute name containing a literal dot is indistinguishable
 * from a range operator and is dropped, exactly as it is server-side), and
 * an unrecognized operator is silently skipped rather than stored.
 */
export type AttributeScalar = string | number | boolean | Date;

/**
 * Mirrors `weft`'s internal string-keyed `AttributeFilter<string>` shape.
 * Not exported from `@lostgradient/weft` (only used inside `ListFilter`'s
 * field type there), so this module names its own copy — structurally
 * identical, so it is still assignable to `ListFilter.attributes` entries.
 */
export interface AttributeFilter {
  key: string;
  value?: AttributeScalar | AttributeScalar[];
  gt?: AttributeScalar;
  lt?: AttributeScalar;
  gte?: AttributeScalar;
  lte?: AttributeScalar;
}

/**
 * Wire-format string for one attribute scalar. The REST grammar has no
 * round-trip representation for `Date` (weft's server-side
 * `inferAttributeValue` only ever infers a boolean, a number, or leaves the
 * raw string — never a `Date`), so a `Date` serializes to epoch
 * milliseconds, the same numeric form the engine's indexed range
 * comparisons expect. Parsing a date-valued filter back from the URL always
 * yields a `number`, not a `Date` — a property of the wire grammar itself,
 * not a bug in this module.
 */
function scalarToQueryValue(value: AttributeScalar): string {
  return value instanceof Date ? String(value.getTime()) : String(value);
}

/**
 * Appends one attribute filter's `attr.<name>[.op]` params. A `value` array
 * becomes repeated `attr.<name>=` params (`.append`, not `.set`) — the exact
 * inverse of `parseAttributeFilters`'s aggregation below.
 */
export function appendAttributeFilter(params: URLSearchParams, attribute: AttributeFilter): void {
  const key = attribute.key;
  if (attribute.value !== undefined) {
    const values = Array.isArray(attribute.value) ? attribute.value : [attribute.value];
    for (const value of values) params.append(`attr.${key}`, scalarToQueryValue(value));
  }
  if (attribute.gt !== undefined) params.append(`attr.${key}.gt`, scalarToQueryValue(attribute.gt));
  if (attribute.lt !== undefined) params.append(`attr.${key}.lt`, scalarToQueryValue(attribute.lt));
  if (attribute.gte !== undefined) {
    params.append(`attr.${key}.gte`, scalarToQueryValue(attribute.gte));
  }
  if (attribute.lte !== undefined) {
    params.append(`attr.${key}.lte`, scalarToQueryValue(attribute.lte));
  }
}

/**
 * Mirrors weft's `inferAttributeValue` (`weft/src/server/attribute-filters.ts`)
 * exactly, so parsing is the true inverse of the server's own grammar:
 * `"true"`/`"false"` become booleans, anything else that parses fully as a
 * number becomes a number (the empty string stays a string rather than
 * coercing to `0` via `Number('')`), and everything else stays the raw
 * string. Never produces a `Date` — see `scalarToQueryValue`.
 */
function inferAttributeScalar(raw: string): AttributeScalar {
  if (raw === 'true') return true;
  if (raw === 'false') return false;

  const asNumber = Number(raw);
  if (!Number.isNaN(asNumber) && raw.trim() !== '') return asNumber;

  return raw;
}

function appendExactAttributeValue(
  current: AttributeScalar | AttributeScalar[] | undefined,
  next: AttributeScalar,
): AttributeScalar | AttributeScalar[] {
  if (current === undefined) return next;

  const currentValues = Array.isArray(current) ? current : [current];
  return [...currentValues, next];
}

/**
 * Parses every `attr.<name>[.op]=value` entry in `params` into one
 * {@link AttributeFilter} per attribute name, aggregating repeated
 * exact-match params into a value array. This is the exact inverse of
 * `appendAttributeFilter`, built to match weft's own `parseAttributeFilters`
 * (`weft/src/server/attribute-filters.ts`) field for field — including its
 * "operator read via the first dot after `attr.`" rule and its "unknown
 * operator is silently skipped" rule — so the console and the server always
 * agree on what a given query string means.
 */
export function parseAttributeFilters(params: URLSearchParams): AttributeFilter[] {
  const filterMap = new Map<string, AttributeFilter>();

  for (const [rawKey, rawValue] of params.entries()) {
    if (!rawKey.startsWith('attr.')) continue;

    const rest = rawKey.slice('attr.'.length);
    const dotIndex = rest.indexOf('.');
    const scalar = inferAttributeScalar(rawValue);

    if (dotIndex === -1) {
      const name = rest;
      const existing = filterMap.get(name) ?? { key: name };
      existing.value = appendExactAttributeValue(existing.value, scalar);
      filterMap.set(name, existing);
      continue;
    }

    const name = rest.slice(0, dotIndex);
    const operator = rest.slice(dotIndex + 1);
    const existing = filterMap.get(name) ?? { key: name };

    if (operator === 'gt') existing.gt = scalar;
    else if (operator === 'lt') existing.lt = scalar;
    else if (operator === 'gte') existing.gte = scalar;
    else if (operator === 'lte') existing.lte = scalar;
    // Unknown operators are silently skipped (not stored) to avoid an
    // unconstrained range scan from a client typo — matches weft's server.
    else continue;

    filterMap.set(name, existing);
  }

  return [...filterMap.values()];
}
