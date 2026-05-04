/**
 * Reactive state container for JSONSchemaEditor.
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

import { useHistory, type UseHistory } from '../../utilities/use-history.svelte.ts';

import type {
  JSONSchemaDraft,
  JSONSchemaEditorChangeEvent,
  JSONSchemaEditorRevertEvent,
  JSONSchemaEditorView,
  JSONSchemaKnownDraft,
  JSONSchemaValidationError,
  JSONSchemaValidationResult,
  JSONSchemaValidationStatus,
  JSONSchemaValue,
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
const COMPILE_DEFER_BYTES = 100_000;

export interface CreateEditorStateOptions {
  schema: JSONSchemaValue | string;
  original?: JSONSchemaValue | string;
  draftOverride?: JSONSchemaKnownDraft;
  readonly?: boolean;
  maxHistory?: number;
  onchange?: (event: JSONSchemaEditorChangeEvent) => void;
  onrevert?: (event: JSONSchemaEditorRevertEvent) => void;
  onvalidate?: (result: JSONSchemaValidationResult) => void;
}

function serialise(value: JSONSchemaValue): string {
  return JSON.stringify(value, null, PRETTY_INDENT);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function stableKeySerialise(value: unknown): string {
  return JSON.stringify(value, (_key, val) => {
    if (!isPlainRecord(val)) return val;
    const sorted: Record<string, unknown> = {};
    for (const k of Object.keys(val).toSorted()) {
      sorted[k] = val[k];
    }
    return sorted;
  });
}

export function createEditorState(options: CreateEditorStateOptions) {
  // ---- Original (baseline) ----
  let originalRawText = $state('');
  let originalCanonicalText = $state('');
  let originalSchema = $state<JSONSchemaValue | null>(null);
  let originalLoadError = $state<string | null>(null);

  // ---- History / committed ----
  // history is wrapped in $state so derived values that read `history?.current`
  // re-evaluate when the history instance is replaced (revert, reload).
  let history = $state<UseHistory<JSONSchemaValue> | null>(null);

  // ---- Draft (JSON view) ----
  let jsonDraftText = $state('');

  // ---- View ----
  let view = $state<JSONSchemaEditorView>('form');

  // ---- Settings ----
  const readonly = $state(Boolean(options.readonly));
  let draftOverride = $state<JSONSchemaKnownDraft | undefined>(options.draftOverride);

  // ---- Validation status (debounced) ----
  let metaResult = $state<{ valid: boolean; errors: JSONSchemaValidationError[] }>({
    valid: true,
    errors: [],
  });
  let compileResult = $state<{ ok: true } | { ok: false; error: string } | null>(null);
  let validationStatus = $state<JSONSchemaValidationStatus>('valid');

  let metaDebounceHandle: ReturnType<typeof setTimeout> | null = null;
  let compileDebounceHandle: ReturnType<typeof setTimeout> | null = null;

  function clearTimers() {
    if (metaDebounceHandle !== null) clearTimeout(metaDebounceHandle);
    if (compileDebounceHandle !== null) clearTimeout(compileDebounceHandle);
    metaDebounceHandle = null;
    compileDebounceHandle = null;
  }

  function emitValidation(result: JSONSchemaValidationResult) {
    options.onvalidate?.(result);
  }

  function buildResult(
    overrides: Partial<JSONSchemaValidationResult> = {},
  ): JSONSchemaValidationResult {
    const compilable = compileResult === null ? null : compileResult.ok;
    const result: JSONSchemaValidationResult = {
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

  function detectActiveDraft(schema: JSONSchemaValue | null): JSONSchemaDraft {
    if (draftOverride) return draftOverride;
    if (schema === null) return '2020-12';
    return detectDraft(schema);
  }

  function shouldDeferCompile(text: string): boolean {
    return text.length > COMPILE_DEFER_BYTES;
  }

  function runMetaValidation(schema: JSONSchemaValue | null) {
    if (schema === null) {
      metaResult = { valid: false, errors: [] };
      return;
    }
    metaResult = validateMetaSchema(schema, detectActiveDraft(schema));
  }

  function runCompile(schema: JSONSchemaValue | null) {
    if (schema === null) {
      compileResult = null;
      return;
    }
    compileResult = tryCompile(schema, detectActiveDraft(schema));
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
      // Compile not yet run. If draft is large, we deferred; otherwise pending.
      validationStatus = shouldDeferCompile(jsonDraftText) ? 'compile-deferred' : 'pending';
      return;
    }
    if (!compileResult.ok) {
      validationStatus = 'invalid';
      return;
    }
    validationStatus = 'valid';
  }

  function scheduleValidation() {
    clearTimers();

    // Pending until debounce window resolves
    validationStatus = 'pending';
    emitValidation(buildResult({ status: 'pending' }));

    metaDebounceHandle = setTimeout(() => {
      runMetaValidation(history?.current ?? null);
      recomputeStatus();
      emitValidation(buildResult());
    }, META_DEBOUNCE_MS);

    if (shouldDeferCompile(jsonDraftText)) {
      compileResult = null;
      return;
    }

    compileDebounceHandle = setTimeout(() => {
      runCompile(history?.current ?? null);
      recomputeStatus();
      emitValidation(buildResult());
    }, COMPILE_DEBOUNCE_MS);
  }

  function emitChange() {
    const schema = history?.current ?? null;
    if (schema === null) return;
    options.onchange?.({ schema, jsonString: serialise(schema) });
  }

  function loadFrom(
    schemaInput: JSONSchemaValue | string,
    originalInput?: JSONSchemaValue | string,
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
      const useHistoryOptions: { initial: JSONSchemaValue; maxDepth?: number } = {
        initial: schemaResult.schema,
      };
      if (options.maxHistory !== undefined) useHistoryOptions.maxDepth = options.maxHistory;
      history = useHistory<JSONSchemaValue>(useHistoryOptions);
      jsonDraftText = schemaResult.canonicalText;
    } else {
      history = null;
      jsonDraftText = schemaResult.rawText || '';
    }

    runMetaValidation(history?.current ?? null);
    runCompile(history?.current ?? null);
    recomputeStatus();
    emitValidation(buildResult());
  }

  loadFrom(options.schema, options.original);

  // ===== Derived =====
  const committedSchema = $derived(history?.current ?? null);
  const committedCanonicalText = $derived(
    committedSchema === null ? '' : serialise(committedSchema),
  );
  const jsonDraftIsDirty = $derived(jsonDraftText !== committedCanonicalText);
  const hasChanges = $derived.by(() => {
    if (originalSchema === null) {
      return originalRawText !== committedCanonicalText;
    }
    if (committedSchema === null) return originalRawText.length > 0;
    return stableKeySerialise(originalSchema) !== stableKeySerialise(committedSchema);
  });
  const isFormEditable = $derived(committedSchema !== null && !readonly && !jsonDraftIsDirty);

  // ===== Public API =====
  return {
    // ---- Reads ----
    get view() {
      return view;
    },
    set view(next: JSONSchemaEditorView) {
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
    get validationResult(): JSONSchemaValidationResult {
      return buildResult();
    },
    get activeDraft(): JSONSchemaDraft {
      return detectActiveDraft(committedSchema);
    },

    // ---- Writes ----
    setView(next: JSONSchemaEditorView) {
      view = next;
    },

    setJsonDraftText(text: string) {
      jsonDraftText = text;
      // Parse status updates synchronously by caller via tryParseJson.
      scheduleValidation();
    },

    discardJsonDraft() {
      jsonDraftText = committedCanonicalText;
      runMetaValidation(history?.current ?? null);
      recomputeStatus();
      emitValidation(buildResult());
    },

    applyJsonDraft(): boolean {
      if (readonly) return false;
      const parsed = tryParseJson(jsonDraftText);
      if (!parsed.ok) return false;

      const value = parsed.value;
      if (typeof value !== 'boolean' && !isPlainRecord(value)) return false;

      const schema = value as JSONSchemaValue;
      const meta = validateMetaSchema(schema, detectActiveDraft(schema));
      if (!meta.valid) return false;

      if (history) {
        history.commit(schema, { label: 'apply JSON' });
      } else {
        const applyOptions: { initial: JSONSchemaValue; maxDepth?: number } = { initial: schema };
        if (options.maxHistory !== undefined) applyOptions.maxDepth = options.maxHistory;
        history = useHistory<JSONSchemaValue>(applyOptions);
      }
      jsonDraftText = serialise(history.current);
      runMetaValidation(history.current);
      runCompile(history.current);
      recomputeStatus();
      emitChange();
      emitValidation(buildResult());
      return true;
    },

    commitFromForm(
      next: JSONSchemaValue,
      commitOptions?: { coalesceKey?: string; label?: string },
    ) {
      if (!history || readonly || jsonDraftIsDirty) return;
      history.commit(next, commitOptions);
      jsonDraftText = serialise(history.current);
      runMetaValidation(history.current);
      runCompile(history.current);
      recomputeStatus();
      emitChange();
      emitValidation(buildResult());
    },

    undo(): string | undefined {
      if (!history) return undefined;
      const left = history.undo();
      if (!left) return undefined;
      jsonDraftText = serialise(history.current);
      runMetaValidation(history.current);
      runCompile(history.current);
      recomputeStatus();
      emitChange();
      emitValidation(buildResult());
      return left.label;
    },

    redo(): string | undefined {
      if (!history) return undefined;
      const moved = history.redo();
      if (!moved) return undefined;
      jsonDraftText = serialise(history.current);
      runMetaValidation(history.current);
      runCompile(history.current);
      recomputeStatus();
      emitChange();
      emitValidation(buildResult());
      return moved.label;
    },

    revert() {
      if (readonly) return;
      if (originalSchema !== null) {
        const revertOptions: { initial: JSONSchemaValue; maxDepth?: number } = {
          initial: originalSchema,
        };
        if (options.maxHistory !== undefined) revertOptions.maxDepth = options.maxHistory;
        history = useHistory<JSONSchemaValue>(revertOptions);
        jsonDraftText = originalCanonicalText;
        runMetaValidation(history.current);
        runCompile(history.current);
        recomputeStatus();
        emitChange();
        emitValidation(buildResult());
        options.onrevert?.({ restoredFrom: 'original-schema' });
      } else {
        history = null;
        jsonDraftText = originalRawText;
        metaResult = { valid: false, errors: [] };
        compileResult = null;
        recomputeStatus();
        emitValidation(buildResult());
        options.onrevert?.({ restoredFrom: 'original-text' });
      }
    },

    /** Force compile validation now — used after the user clicks the deferred-compile button. */
    runCompileNow() {
      runCompile(history?.current ?? null);
      recomputeStatus();
      emitValidation(buildResult());
    },

    /** Update the active draft override; recomputes validation. */
    setDraftOverride(next: JSONSchemaKnownDraft | undefined) {
      draftOverride = next;
      runMetaValidation(history?.current ?? null);
      runCompile(history?.current ?? null);
      recomputeStatus();
      emitValidation(buildResult());
    },

    /** Reload from a new schema/original pair — used by schemaKey-triggered reset. */
    reload(schemaInput: JSONSchemaValue | string, originalInput?: JSONSchemaValue | string) {
      clearTimers();
      loadFrom(schemaInput, originalInput);
    },

    destroy() {
      clearTimers();
    },
  };
}

export type EditorState = ReturnType<typeof createEditorState>;
