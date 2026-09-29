/**
 * Start Workflow wizard — pure logic (plan §9.2 T2.3, Appendix A `start()`).
 * Advanced-options field parsing, raw-JSON payload validation, and the
 * `ClientStartOptions` builder, all unit-testable without mounting the
 * wizard. `start-wizard.svelte` + its step components are the thin UI.
 */
import type { ClientStartOptions, SearchAttributeValue } from '@lostgradient/weft';

/** The Advanced options step's raw form state — every field a plain string/string[] so it round-trips cleanly through `Input`/`TagInput`. */
export interface AdvancedStartOptionsInput {
  readonly id: string;
  readonly idempotencyKey: string;
  readonly tags: readonly string[];
  /** One `key=value` pair per search attribute, as typed into the row UI. */
  readonly searchAttributes: readonly { readonly key: string; readonly value: string }[];
  /** Free-text duration, e.g. `"1h"`, `"30m"` — passed through to `StartOptions.executionTimeout` (`Duration = number | string`). */
  readonly executionTimeout: string;
}

export const EMPTY_ADVANCED_START_OPTIONS: AdvancedStartOptionsInput = {
  id: '',
  idempotencyKey: '',
  tags: [],
  searchAttributes: [],
  executionTimeout: '',
};

/** Same scalar-inference rule as the query builder / URL attribute grammar (`true`/`false` → boolean, a fully-numeric string → number, else the raw string). Search attributes accept the same primitive types, so reusing the rule keeps "type in a value, get the right wire type" consistent across every attribute-entry surface in the console. */
function inferSearchAttributeValue(raw: string): SearchAttributeValue {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  const asNumber = Number(raw);
  if (!Number.isNaN(asNumber) && raw.trim() !== '') return asNumber;
  return raw;
}

/** Builds the `searchAttributes` record from the advanced-options rows, dropping rows with no key. */
function buildSearchAttributes(
  rows: readonly { readonly key: string; readonly value: string }[],
): Record<string, SearchAttributeValue> | undefined {
  const entries = rows
    .filter((row) => row.key.trim() !== '')
    .map((row) => [row.key, inferSearchAttributeValue(row.value)] as const);
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

/**
 * Builds `ClientStartOptions` from the advanced-options form state. Blank
 * fields are omitted entirely (not sent as empty strings) so the server
 * applies its own defaults — an empty `id` should mean "let the engine
 * generate one," not "start a workflow literally id'd `''`."
 */
export function buildStartOptions(input: AdvancedStartOptionsInput): ClientStartOptions {
  const options: ClientStartOptions = {};
  if (input.id.trim() !== '') options.id = input.id.trim();
  if (input.idempotencyKey.trim() !== '') options.idempotencyKey = input.idempotencyKey.trim();
  if (input.tags.length > 0) options.tags = [...input.tags];
  const searchAttributes = buildSearchAttributes(input.searchAttributes);
  if (searchAttributes) options.searchAttributes = searchAttributes;
  if (input.executionTimeout.trim() !== '')
    options.executionTimeout = input.executionTimeout.trim();
  return options;
}

export type RawPayloadParseResult =
  { readonly ok: true; readonly value: unknown } | { readonly ok: false; readonly error: string };

/**
 * Validates the raw-JSON payload textarea (the Configure step's JSON mode —
 * plan §10.2's payload editor, minus CodeMirror; see the console's final
 * report for why). An empty/whitespace-only textarea is valid and means
 * "no input" (`null`), matching how many fixture workflows accept no input.
 */
export function parseRawPayload(text: string): RawPayloadParseResult {
  const trimmed = text.trim();
  if (trimmed === '') return { ok: true, value: null };
  try {
    return { ok: true, value: JSON.parse(trimmed) };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid JSON';
    return { ok: false, error: message };
  }
}
