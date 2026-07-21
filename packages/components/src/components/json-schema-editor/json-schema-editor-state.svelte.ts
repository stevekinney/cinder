/**
 * Reactive state container for JsonSchemaEditor.
 *
 * Holds distinct text representations so callers cannot conflate "what the
 * user is typing" with "what we've actually committed":
 *  - originalRawText: parent's input verbatim (diff source-of-truth)
 *  - originalCanonicalText: pretty-printed parsed original
 *  - committedSchema: the most recent applied schema (via useHistory)
 *  - committedCanonicalText: pretty-printed committed schema
 *  - jsonDraftText: textarea contents; may differ from committed
 *
 * Validation runs on the JSON draft (parse) immediately, on the committed
 * schema (meta-schema) and compile (debounced).
 */

import { stableSerialise, useHistory } from '../../utilities/use-history.svelte.ts';
import type { UseHistory } from '../../utilities/use-history.types.ts';

import type { CreateEditorStateOptions } from './json-schema-editor-state.types.ts';
import type {
  JsonSchemaDraft,
  JsonSchemaEditorView,
  JsonSchemaKnownDraft,
  JsonSchemaValidationError,
  JsonSchemaValidationResult,
  JsonSchemaValidationStatus,
  JsonSchemaValue,
} from './json-schema-editor-types.ts';
import {
  detectDraft,
  normaliseSchemaInput,
  tryCompile,
  tryParseJson,
  validateMetaSchema,
} from './json-schema-validator.ts';

const PRETTY_INDENT = 2;
const META_DEBOUNCE_MS = 250;
const COMPILE_DEBOUNCE_MS = 500;
/**
 * Skip Ajv compile for drafts larger than this byte threshold. Compile is
 * the expensive step (it walks every keyword and synthesises a validator
 * function) and on the main thread a 100KB+ schema can stall typing for
 * hundreds of milliseconds per debounce cycle. We still run parse + meta
 * validation; only the compile pass is silently deferred. The user sees
 * `status: 'pending'` while the gate is active.
 */
const COMPILE_DEFER_BYTES = 100_000;

function serialise(value: JsonSchemaValue): string {
  return JSON.stringify(value, null, PRETTY_INDENT);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Synchronous-only slice of what `validateMetaSchema` would say: catches
 * the shapes it can reject without touching Ajv (no schema at all,
 * non-object/boolean). Returns null when the shape is plausible and the
 * real answer has to wait for the async check.
 *
 * Used to seed `metaResult` before a validation cycle goes 'pending' —
 * without this, a known-bad draft (unparseable JSON, a bare array) would
 * keep reporting whatever `metaResult.valid` happened to be from the
 * *previous* schema until the async check catches up, which is exactly
 * the stale-state window `onvalidate` consumers shouldn't see.
 */
function cheapMetaShapeCheck(
  schema: unknown,
): { valid: boolean; errors: JsonSchemaValidationError[] } | null {
  if (schema === null) return { valid: false, errors: [] };
  if (typeof schema === 'boolean') return { valid: true, errors: [] };
  if (typeof schema !== 'object' || Array.isArray(schema)) {
    return {
      valid: false,
      errors: [{ path: '', message: 'Schema must be an object or boolean', keyword: '' }],
    };
  }
  return null;
}

export function createEditorState(options: CreateEditorStateOptions) {
  // ---- Original (baseline) ----
  let originalRawText = $state('');
  let originalCanonicalText = $state('');
  let originalSchema = $state<JsonSchemaValue | null>(null);
  let originalLoadError = $state<string | null>(null);

  // ---- History / committed ----
  // history is wrapped in $state so derived values that read `history?.current`
  // re-evaluate when the history instance is replaced (revert, reload).
  let history = $state<UseHistory<JsonSchemaValue> | null>(null);

  // ---- Draft (JSON view) ----
  let jsonDraftText = $state('');

  // ---- View ----
  let view = $state<JsonSchemaEditorView>('form');

  // ---- Settings ----
  // readonly and draftOverride are reactive so the component can sync them to
  // current prop values via $effect after mount.
  let readonly = $state(Boolean(options.readonly));
  let draftOverride = $state<JsonSchemaKnownDraft | undefined>(options.draftOverride);

  function setReadonly(next: boolean) {
    readonly = next;
  }

  // ---- Validation status (debounced) ----
  let metaResult = $state<{ valid: boolean; errors: JsonSchemaValidationError[] }>({
    valid: true,
    errors: [],
  });
  let compileResult = $state<{ ok: true } | { ok: false; error: string } | null>(null);
  let validationStatus = $state<JsonSchemaValidationStatus>('valid');

  let metaDebounceHandle: ReturnType<typeof setTimeout> | null = null;
  let compileDebounceHandle: ReturnType<typeof setTimeout> | null = null;

  // validateMetaSchema/tryCompile dynamically import Ajv, so every
  // validation pass is now async. clearTimers() cancels pending *timers*
  // but not an already-in-flight validation promise, so bumping this epoch
  // is what actually invalidates stale in-flight work: any async callback
  // checks its captured epoch against the current one before writing state.
  let validationEpoch = 0;

  function clearTimers() {
    if (metaDebounceHandle !== null) clearTimeout(metaDebounceHandle);
    if (compileDebounceHandle !== null) clearTimeout(compileDebounceHandle);
    metaDebounceHandle = null;
    compileDebounceHandle = null;
    validationEpoch += 1;
  }

  function emitValidation(result: JsonSchemaValidationResult) {
    options.onvalidate?.(result);
  }

  function buildResult(
    overrides: Partial<JsonSchemaValidationResult> = {},
  ): JsonSchemaValidationResult {
    const compilable = compileResult === null ? null : compileResult.ok;
    const result: JsonSchemaValidationResult = {
      status: validationStatus,
      valid: metaResult.valid,
      errors: metaResult.errors,
      compilable,
    };
    if (compileResult && !compileResult.ok) {
      result.compileError = compileResult.error;
    }
    return { ...result, ...overrides };
  }

  function detectActiveDraft(schema: unknown): JsonSchemaDraft {
    if (draftOverride) return draftOverride;
    if (schema === null) return '2020-12';
    return detectDraft(schema);
  }

  /**
   * Pick the schema we want validation to reflect.
   *
   * When the JSON draft is dirty and parseable, validate that — the toolbar
   * status mirrors what the user is editing. When the draft is unparseable,
   * fall back to the committed schema (so the existing status remains
   * meaningful) and let `recomputeStatus` mark `'invalid'` based on the
   * parse error.
   *
   * Computes the "is dirty" check inline rather than reading the
   * `jsonDraftIsDirty` $derived because this function is called from
   * `loadFrom`, which runs before the $derived expressions are set up.
   */
  function schemaToValidate(): unknown {
    const committed = history?.current ?? null;
    const committedText = committed === null ? '' : serialise(committed);
    if (jsonDraftText !== committedText) {
      const parsed = tryParseJson(jsonDraftText);
      if (parsed.ok) {
        return parsed.value;
      }
    }
    return committed;
  }

  /**
   * Resolve meta-schema validity for the current draft and, if no newer
   * validation cycle has started in the meantime (see `validationEpoch`),
   * write the result. Callers that need the raw result synchronously (e.g.
   * `applyJsonDraft`, which gates a commit on it) should call
   * `validateMetaSchema` directly instead.
   */
  async function runMetaValidation(epoch: number) {
    const schema = schemaToValidate();
    if (schema === null) {
      if (epoch !== validationEpoch) return;
      metaResult = { valid: false, errors: [] };
      return;
    }
    const result = await validateMetaSchema(schema, detectActiveDraft(schema));
    if (epoch !== validationEpoch) return;
    metaResult = result;
  }

  async function runCompile(epoch: number) {
    const schema = schemaToValidate();
    if (schema === null) {
      if (epoch !== validationEpoch) return;
      compileResult = null;
      return;
    }
    const result = await tryCompile(schema, detectActiveDraft(schema));
    if (epoch !== validationEpoch) return;
    compileResult = result;
  }

  /**
   * Refresh both meta-schema and compile status for the schema currently
   * committed/drafted, then recompute the overall status and emit. Used by
   * every mutating action (commit, undo, redo, revert, …) that doesn't need
   * to gate its own outcome on the result — those actions apply immediately
   * and this just brings the reported validation status up to date.
   */
  async function refreshValidation(epoch: number) {
    await Promise.all([runMetaValidation(epoch), runCompile(epoch)]);
    if (epoch !== validationEpoch) return;
    recomputeStatus();
    emitValidation(buildResult());
  }

  /**
   * Cancel in-flight validation, start a new epoch, and announce 'pending'.
   * Clears `compileResult` (its `null` state is already what marks
   * `recomputeStatus`/`buildResult` as pending) and seeds `metaResult` with
   * whatever a cheap synchronous check can determine, so the pending emit
   * never reports validity left over from a different schema.
   */
  function beginValidationCycle(): number {
    clearTimers();
    const epoch = validationEpoch;
    const cheapMeta = cheapMetaShapeCheck(schemaToValidate());
    if (cheapMeta) metaResult = cheapMeta;
    compileResult = null;
    validationStatus = 'pending';
    emitValidation(buildResult({ status: 'pending' }));
    return epoch;
  }

  function recomputeStatus() {
    const parse = tryParseJson(jsonDraftText);
    if (!parse.ok) {
      validationStatus = 'invalid';
      return;
    }
    if (!metaResult.valid) {
      validationStatus = 'invalid';
      return;
    }
    if (compileResult === null) {
      validationStatus = 'pending';
      return;
    }
    if (!compileResult.ok) {
      validationStatus = 'invalid';
      return;
    }
    validationStatus = 'valid';
  }

  function scheduleValidation() {
    const epoch = beginValidationCycle();

    metaDebounceHandle = setTimeout(() => {
      void (async () => {
        await runMetaValidation(epoch);
        if (epoch !== validationEpoch) return;
        recomputeStatus();
        emitValidation(buildResult());
      })();
    }, META_DEBOUNCE_MS);

    // Skip compile for very large drafts — Ajv.compile is O(schema-size)
    // synchronous main-thread work and at 100KB+ it stalls typing badly.
    // Status stays 'pending' (compileResult never resolves) until the user
    // applies the draft and we have committed text to validate. Reset the
    // result so a previously-compiled smaller draft doesn't poison us.
    if (jsonDraftText.length > COMPILE_DEFER_BYTES) {
      compileResult = null;
      return;
    }

    compileDebounceHandle = setTimeout(() => {
      void (async () => {
        await runCompile(epoch);
        if (epoch !== validationEpoch) return;
        recomputeStatus();
        emitValidation(buildResult());
      })();
    }, COMPILE_DEBOUNCE_MS);
  }

  function emitChange() {
    const schema = history?.current ?? null;
    if (schema === null) return;
    options.onchange?.({ schema, jsonString: serialise(schema) });
  }

  function loadFrom(
    schemaInput: JsonSchemaValue | string,
    originalInput?: JsonSchemaValue | string,
  ) {
    const schemaResult = normaliseSchemaInput(schemaInput);
    const baselineInput = originalInput ?? schemaInput;
    const baselineResult = normaliseSchemaInput(baselineInput);

    if (baselineResult.ok) {
      originalRawText = baselineResult.rawText;
      originalCanonicalText = baselineResult.canonicalText;
      originalSchema = baselineResult.schema;
      originalLoadError = null;
    } else {
      originalRawText = baselineResult.rawText;
      originalCanonicalText = '';
      originalSchema = null;
      originalLoadError = baselineResult.error;
    }

    if (schemaResult.ok) {
      const useHistoryOptions: { initial: JsonSchemaValue; maxDepth?: number } = {
        initial: schemaResult.schema,
      };
      if (options.maxHistory !== undefined) useHistoryOptions.maxDepth = options.maxHistory;
      history = useHistory<JsonSchemaValue>(useHistoryOptions);
      jsonDraftText = schemaResult.canonicalText;
    } else {
      history = null;
      jsonDraftText = schemaResult.rawText || '';
    }

    const epoch = beginValidationCycle();
    void refreshValidation(epoch);
  }

  loadFrom(options.schema, options.original);

  // ===== Derived =====
  const committedSchema = $derived(history?.current ?? null);
  const committedCanonicalText = $derived(
    committedSchema === null ? '' : serialise(committedSchema),
  );
  const jsonDraftIsDirty = $derived(jsonDraftText !== committedCanonicalText);
  const hasChanges = $derived.by(() => {
    // Both null means invalid initial schema with no edits yet — not "changed".
    if (originalSchema === null && committedSchema === null) return false;
    if (originalSchema === null) {
      return originalRawText !== committedCanonicalText;
    }
    if (committedSchema === null) return originalRawText.length > 0;
    return stableSerialise(originalSchema) !== stableSerialise(committedSchema);
  });
  const isFormEditable = $derived(committedSchema !== null && !readonly && !jsonDraftIsDirty);

  // ===== Public API =====
  return {
    // ---- Reads ----
    get view() {
      return view;
    },
    set view(next: JsonSchemaEditorView) {
      view = next;
    },
    get readonly() {
      return readonly;
    },
    get originalRawText() {
      return originalRawText;
    },
    get originalCanonicalText() {
      return originalCanonicalText;
    },
    get originalSchema() {
      return originalSchema;
    },
    get originalLoadError() {
      return originalLoadError;
    },
    get committedSchema() {
      return committedSchema;
    },
    get committedCanonicalText() {
      return committedCanonicalText;
    },
    get jsonDraftText() {
      return jsonDraftText;
    },
    get jsonDraftIsDirty() {
      return jsonDraftIsDirty;
    },
    get hasChanges() {
      return hasChanges;
    },
    get isFormEditable() {
      return isFormEditable;
    },
    get diffOriginal() {
      return originalCanonicalText || originalRawText;
    },
    get diffCurrent() {
      return committedCanonicalText;
    },
    get copyValue() {
      return committedCanonicalText;
    },
    get canUndo() {
      return history?.canUndo ?? false;
    },
    get canRedo() {
      return history?.canRedo ?? false;
    },
    get validationStatus() {
      return validationStatus;
    },
    /**
     * `result.valid` is optimistic while `result.status === 'pending'` —
     * on a cold mount, or any time a validation cycle has just started, the
     * async Ajv check hasn't resolved yet and `valid` still reflects
     * whatever the last settled check found (`true` by default). Gate on
     * `status`, not `valid` alone.
     */
    get validationResult(): JsonSchemaValidationResult {
      return buildResult();
    },
    get activeDraft(): JsonSchemaDraft {
      return detectActiveDraft(schemaToValidate());
    },

    // ---- Writes ----
    setView(next: JsonSchemaEditorView) {
      view = next;
    },

    setJsonDraftText(text: string) {
      jsonDraftText = text;
      // Parse status updates synchronously by caller via tryParseJson.
      scheduleValidation();
    },

    discardJsonDraft() {
      jsonDraftText = committedCanonicalText;
      const epoch = beginValidationCycle();
      void refreshValidation(epoch);
    },

    /**
     * Apply the JSON draft as the committed schema. Async because the
     * meta-schema check that gates the commit dynamically imports Ajv on
     * first use — the commit itself only happens once that check resolves,
     * so this can no longer report its outcome synchronously. Callers that
     * only need to trigger the apply (the toolbar's Apply button) can call
     * it without awaiting; callers that need the resulting boolean must
     * await it.
     */
    async applyJsonDraft(): Promise<boolean> {
      if (readonly) return false;
      clearTimers();
      const epoch = validationEpoch;

      const parsed = tryParseJson(jsonDraftText);
      if (!parsed.ok) return false;

      const value = parsed.value;
      if (typeof value !== 'boolean' && !isPlainRecord(value)) return false;

      const schema = value as JsonSchemaValue;
      const draft = detectActiveDraft(schema);

      // Clear the previous compile result before announcing 'pending' — its
      // `null` state is what recomputeStatus/buildResult treat as pending,
      // so leaving a stale one behind would let a status recompute reuse
      // compile info from whatever schema was committed before this draft.
      compileResult = null;
      validationStatus = 'pending';
      emitValidation(buildResult({ status: 'pending' }));

      const meta = await validateMetaSchema(schema, draft);
      // A newer action (another apply, an undo, a reload, …) superseded
      // this one while Ajv was loading — abandon rather than commit stale
      // state or clobber whatever that newer action already wrote. Also
      // recheck readonly directly: a parent can flip it while this await is
      // in flight, and unlike other mutations that starts a new epoch,
      // setReadonly doesn't — so it has to be checked explicitly here.
      if (epoch !== validationEpoch || readonly) return false;
      if (!meta.valid) {
        metaResult = meta;
        recomputeStatus();
        emitValidation(buildResult());
        return false;
      }

      if (history) {
        history.commit(schema, { label: 'apply JSON' });
      } else {
        const applyOptions: { initial: JsonSchemaValue; maxDepth?: number } = { initial: schema };
        if (options.maxHistory !== undefined) applyOptions.maxDepth = options.maxHistory;
        history = useHistory<JsonSchemaValue>(applyOptions);
      }
      jsonDraftText = serialise(history.current);
      metaResult = meta;
      emitChange();

      const compile = await tryCompile(schema, draft);
      if (epoch === validationEpoch) {
        compileResult = compile;
        recomputeStatus();
        emitValidation(buildResult());
      }
      return true;
    },

    commitFromForm(
      next: JsonSchemaValue,
      commitOptions?: { coalesceKey?: string; label?: string },
    ) {
      if (!history || readonly || jsonDraftIsDirty) return;
      history.commit(next, commitOptions);
      jsonDraftText = serialise(history.current);
      emitChange();
      const epoch = beginValidationCycle();
      void refreshValidation(epoch);
    },

    undo(): string | undefined {
      if (!history || readonly) return undefined;
      const left = history.undo();
      if (!left) return undefined;
      jsonDraftText = serialise(history.current);
      emitChange();
      const epoch = beginValidationCycle();
      void refreshValidation(epoch);
      return left.label;
    },

    redo(): string | undefined {
      if (!history || readonly) return undefined;
      const moved = history.redo();
      if (!moved) return undefined;
      jsonDraftText = serialise(history.current);
      emitChange();
      const epoch = beginValidationCycle();
      void refreshValidation(epoch);
      return moved.label;
    },

    revert() {
      if (readonly) return;
      if (originalSchema !== null) {
        const revertOptions: { initial: JsonSchemaValue; maxDepth?: number } = {
          initial: originalSchema,
        };
        if (options.maxHistory !== undefined) revertOptions.maxDepth = options.maxHistory;
        history = useHistory<JsonSchemaValue>(revertOptions);
        jsonDraftText = originalCanonicalText;
        emitChange();
        const epoch = beginValidationCycle();
        void refreshValidation(epoch);
        options.onrevert?.({ restoredFrom: 'original-schema' });
      } else {
        history = null;
        jsonDraftText = originalRawText;
        clearTimers();
        metaResult = { valid: false, errors: [] };
        compileResult = null;
        recomputeStatus();
        emitValidation(buildResult());
        options.onrevert?.({ restoredFrom: 'original-text' });
      }
    },

    /** Update the active draft override; recomputes validation. */
    setDraftOverride(next: JsonSchemaKnownDraft | undefined) {
      draftOverride = next;
      const epoch = beginValidationCycle();
      void refreshValidation(epoch);
    },

    /** Live-update the readonly flag (used to re-sync the prop after mount). */
    setReadonly,

    /** Reload from a new schema/original pair — used by schemaKey-triggered reset. */
    reload(schemaInput: JsonSchemaValue | string, originalInput?: JsonSchemaValue | string) {
      loadFrom(schemaInput, originalInput);
    },

    destroy() {
      clearTimers();
    },
  };
}
