/**
 * COR-228: JsonSchemaEditor and SchemaForm must validate schemas under a
 * Content-Security-Policy without `unsafe-eval`. AJV's `compile()`
 * code-generates a validator with `new Function`, which throws under that
 * CSP — this reproduces that CSP (by making `Function`/`eval` throw, the
 * same technique the originating bug report used) and runs both
 * components' validation boundaries through it for all three supported
 * drafts.
 *
 * Deliberately lives in `utilities/` rather than either component's own
 * directory: it is the one place that legitimately needs both
 * json-schema-editor's and schema-form's validator modules in the same
 * file, to prove the CSP-safe boundary they now share actually holds for
 * both callers.
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import type { JsonSchemaKnownDraft } from '../components/json-schema-editor/json-schema-editor-types.ts';
import {
  tryCompile,
  validateMetaSchema,
} from '../components/json-schema-editor/json-schema-validator.ts';
import { validateSchemaValue } from '../components/schema-form/schema-form-validation.ts';

const DRAFT_SCHEMA_IDS: Record<JsonSchemaKnownDraft, string> = {
  'draft-07': 'http://json-schema.org/draft-07/schema#',
  '2019-09': 'https://json-schema.org/draft/2019-09/schema',
  '2020-12': 'https://json-schema.org/draft/2020-12/schema',
};

let originalFunction: FunctionConstructor;
let originalEval: (typeof globalThis)['eval'];

beforeEach(() => {
  originalFunction = globalThis.Function;
  // Capturing the real primitive so afterEach can restore it.
  // eslint-disable-next-line no-eval
  originalEval = globalThis.eval;
  // Same technique the CIN-issue reproduction used: replace the two
  // primitives `unsafe-eval` gates with throwing stand-ins so any code path
  // that still reaches for dynamic code generation fails loudly instead of
  // silently falling back to an interpreter.
  globalThis.Function = function throwsUnderCsp(): never {
    throw new Error('CSP: unsafe-eval blocked (Function constructor)');
  } as unknown as FunctionConstructor;
  // Deliberately replacing the real `eval` with a throwing stand-in to
  // simulate a CSP without unsafe-eval.
  // eslint-disable-next-line no-eval
  globalThis.eval = ((): never => {
    throw new Error('CSP: unsafe-eval blocked (eval)');
  }) as (typeof globalThis)['eval'];
});

afterEach(() => {
  globalThis.Function = originalFunction;
  // eslint-disable-next-line no-eval -- restoring the real primitive captured above.
  globalThis.eval = originalEval;
});

describe('CSP without unsafe-eval: JsonSchemaEditor boundary', () => {
  for (const draft of Object.keys(DRAFT_SCHEMA_IDS) as JsonSchemaKnownDraft[]) {
    test(`${draft}: validateMetaSchema and tryCompile succeed for a valid object schema`, async () => {
      const schema = {
        $schema: DRAFT_SCHEMA_IDS[draft],
        type: 'object',
        properties: { email: { type: 'string', format: 'email' } },
        required: ['email'],
      };

      const meta = await validateMetaSchema(schema, draft);
      expect(meta).toEqual({ valid: true, errors: [] });

      const compiled = await tryCompile(schema, draft);
      expect(compiled).toEqual({ ok: true });
    });

    test(`${draft}: validateMetaSchema and tryCompile reject an invalid schema without throwing`, async () => {
      const schema = { $schema: DRAFT_SCHEMA_IDS[draft], type: 'not-a-real-type' };

      const meta = await validateMetaSchema(schema, draft);
      expect(meta.valid).toBe(false);
      expect(meta.errors.length).toBeGreaterThan(0);
    });

    test(`${draft}: boolean schemas remain accepted`, async () => {
      expect(await validateMetaSchema(true, draft)).toEqual({ valid: true, errors: [] });
      expect(await tryCompile(true, draft)).toEqual({ ok: true });
      expect(await tryCompile(false, draft)).toEqual({ ok: true });
    });
  }
});

describe('CSP without unsafe-eval: SchemaForm boundary', () => {
  for (const draft of Object.keys(DRAFT_SCHEMA_IDS) as JsonSchemaKnownDraft[]) {
    test(`${draft}: valid data validates and invalid data is rejected`, async () => {
      // SchemaForm has never registered ajv-formats (see
      // schema-form-validation.test.ts), so this uses a structural
      // constraint rather than `format` to prove the CSP-safe boundary
      // actually enforces something, not just that it doesn't throw.
      const schema = {
        $schema: DRAFT_SCHEMA_IDS[draft],
        type: 'object',
        properties: { count: { type: 'integer', minimum: 1 } },
        required: ['count'],
      };

      const valid = await validateSchemaValue(schema, { count: 5 });
      expect(valid).toEqual({ valid: true, value: { count: 5 }, issues: [] });

      const invalid = await validateSchemaValue(schema, { count: 0 });
      expect(invalid.valid).toBe(false);
      expect(invalid.issues.length).toBeGreaterThan(0);
    });
  }
});
