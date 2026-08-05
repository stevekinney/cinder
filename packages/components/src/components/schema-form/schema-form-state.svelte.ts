import {
  arrayValueAtPath,
  decodeEnumValue,
  defaultValueForField,
  getValueAtPath,
  pathKey,
  pruneUndefined,
  rebaseFieldPath,
  setValueAtPath,
  type SchemaFormField,
  type SchemaFormModel,
} from './schema-form-model.ts';
import {
  issuesByPath,
  parseJsonDraft,
  validateSchemaValue,
  type SchemaFormValidationIssue,
} from './schema-form-validation.ts';
import type { SchemaFormDraftChangeHandler, SchemaFormOutput } from './schema-form.types.ts';

type ParsedRawDraft = { ok: true; value: unknown } | { ok: false; message: string };

export type SchemaFormStateOptions = {
  /**
   * The form is disabled (native `disabled` attributes) while a submit is
   * in flight, but a synthetic event dispatched before the DOM catches up
   * can still reach these handlers — `getSubmitting()` is this class's own
   * belt-and-suspenders guard against that race (see
   * schema-form-async.fixture.ts's "freezes edits until it resolves").
   */
  getSubmitting: () => boolean;
  onDraftChange?: SchemaFormDraftChangeHandler;
};

export type SchemaFormSubmitCandidate =
  | { ok: true; value: unknown }
  | { ok: false; issues: SchemaFormValidationIssue[] };

/**
 * Owns every path-keyed piece of SchemaForm's mutable editing state: the
 * form value itself, per-field validation errors, and five auxiliary draft
 * maps that track in-progress edits which aren't valid typed values yet
 * (raw JSON textareas, numeric input drafts, per-field validation
 * "touched" sequence numbers, and per-array-item stable render keys).
 *
 * Each of the six maps stays a SEPARATE private field rather than one
 * `Record<string, FieldState>` — the per-slot presence-check semantics
 * (`numericDrafts[key] !== undefined`, `parsedRawDrafts[key] === undefined`,
 * ...) are independently meaningful per map and would be lost if unified.
 *
 * Instantiated fresh inside schema-form-body.svelte's `<script>` on every
 * `{#key schema}` remount — never at module scope.
 */
export class SchemaFormState {
  formValue = $state<unknown>();
  serializedValue = $state('');

  #errors = $state<Record<string, string>>({});
  #rawDrafts = $state<Record<string, string>>({});
  #parsedRawDrafts = $state<Record<string, ParsedRawDraft>>({});
  #numericDrafts = $state<Record<string, string>>({});
  #touchedValidationSequences = $state<Record<string, number>>({});
  #arrayKeys = $state<Record<string, string[]>>({});
  #arrayKeyCounter = 0;

  readonly #model: SchemaFormModel;
  readonly #options: SchemaFormStateOptions;

  constructor(model: SchemaFormModel, initialValue: unknown, options: SchemaFormStateOptions) {
    this.#model = model;
    this.#options = options;
    this.formValue = initialValue;
    this.#rawDrafts = this.#seedRawDrafts(model.field, initialValue);
    this.#arrayKeys = this.#seedArrayKeys(model.field, initialValue);
  }

  get errors(): Record<string, string> {
    return this.#errors;
  }

  get rawDrafts(): Record<string, string> {
    return this.#rawDrafts;
  }

  clearSerializedValue(): void {
    this.serializedValue = '';
  }

  #bumpTouchedValidationSequence(path: readonly string[]): void {
    const key = pathKey(path);
    this.#touchedValidationSequences = {
      ...this.#touchedValidationSequences,
      [key]: (this.#touchedValidationSequences[key] ?? 0) + 1,
    };
  }

  #currentDraft(): SchemaFormOutput {
    let nextValue = this.formValue;
    for (const field of this.#currentNumericFields(this.#model.field, this.formValue)) {
      const draft = this.#numericDrafts[pathKey(field.path)];
      if (draft !== undefined) nextValue = setValueAtPath(nextValue, field.path, draft);
    }
    for (const field of this.#currentJsonFields(this.#model.field, this.formValue)) {
      const key = pathKey(field.path);
      const parsed = this.#parsedRawDrafts[key];
      if (parsed === undefined) continue;
      nextValue = setValueAtPath(
        nextValue,
        field.path,
        parsed.ok ? parsed.value : this.#rawDrafts[key],
      );
    }
    return pruneUndefined(nextValue);
  }

  #reportDraftChange(): void {
    this.#options.onDraftChange?.(this.#currentDraft());
  }

  updateValue(path: readonly string[], next: unknown, reportChange = true): void {
    if (this.#options.getSubmitting()) return;
    this.formValue = setValueAtPath(this.formValue, path, next);
    const key = pathKey(path);
    if (this.#numericDrafts[key] !== undefined) {
      const { [key]: _removedDraft, ...remainingDrafts } = this.#numericDrafts;
      this.#numericDrafts = remainingDrafts;
    }
    this.#bumpTouchedValidationSequence(path);
    if (this.#errors[key]) {
      const { [key]: _removed, ...remaining } = this.#errors;
      this.#errors = remaining;
    }
    this.clearSerializedValue();
    if (reportChange) this.#reportDraftChange();
  }

  updateNumberValue(field: SchemaFormField, next: number | null): void {
    const draft = this.#numericDrafts[pathKey(field.path)];
    if (next === null && draft !== undefined && draft.trim() !== '') return;
    this.updateValue(field.path, next ?? undefined);
  }

  async validateTouchedField(field: SchemaFormField): Promise<void> {
    if (this.#options.getSubmitting()) return;
    const fieldKey = pathKey(field.path);
    const sequence = (this.#touchedValidationSequences[fieldKey] ?? 0) + 1;
    this.#touchedValidationSequences = {
      ...this.#touchedValidationSequences,
      [fieldKey]: sequence,
    };
    const raw = this.#rawJsonIssues();
    const rawIssue = raw.issues.find((candidateIssue) => {
      const candidateKey = pathKey(candidateIssue.path);
      return candidateKey === fieldKey || candidateKey.startsWith(`${fieldKey}/`);
    });
    if (rawIssue) {
      this.#errors = { ...this.#errors, [fieldKey]: rawIssue.message };
      return;
    }
    const candidate = pruneUndefined(raw.value);
    const result = await validateSchemaValue(this.#model.sourceSchema, candidate);
    if (this.#touchedValidationSequences[fieldKey] !== sequence) return;
    const issue = (result.valid ? [] : result.issues).find((candidateIssue) => {
      const candidateKey = pathKey(candidateIssue.path);
      return candidateKey === fieldKey || candidateKey.startsWith(`${fieldKey}/`);
    });

    if (issue) {
      this.#errors = { ...this.#errors, [fieldKey]: issue.message };
      return;
    }

    if (this.#errors[fieldKey]) {
      const { [fieldKey]: _removed, ...remaining } = this.#errors;
      this.#errors = remaining;
    }
  }

  /** Enum Select is one-way (value + onchange) rather than a function binding:
   *  the encode/decode round-trip is unstable inside Svelte's <select> binding
   *  writeback, which reverts the selection. Decode the chosen option here. */
  updateEnum(field: SchemaFormField, event: Event): void {
    if (this.#options.getSubmitting()) return;
    const select = event.currentTarget;
    if (!(select instanceof HTMLSelectElement)) return;
    this.updateValue(field.path, decodeEnumValue(select.value));
  }

  /** JSON fields hold a raw text draft (validated/parsed on submit), so the
   *  textarea's value flows into `rawDrafts` rather than the typed value tree. */
  updateRawJsonValue(field: SchemaFormField, next: string): void {
    if (this.#options.getSubmitting()) return;
    const key = pathKey(field.path);
    this.#rawDrafts = { ...this.#rawDrafts, [key]: next };
    const parsed = parseJsonDraft(field.path, next);
    this.#parsedRawDrafts = {
      ...this.#parsedRawDrafts,
      [key]: parsed.ok ? parsed : { ok: false, message: parsed.issue.message },
    };
    this.#bumpTouchedValidationSequence(field.path);
    if (this.#errors[key]) {
      const { [key]: _removed, ...remaining } = this.#errors;
      this.#errors = remaining;
    }
    this.clearSerializedValue();
    this.#reportDraftChange();
  }

  handleFieldInput(field: SchemaFormField, event: Event): void {
    if (this.#options.getSubmitting()) return;
    this.#bumpTouchedValidationSequence(field.path);
    if (field.kind !== 'number' && field.kind !== 'integer') return;
    if (!(event.target instanceof HTMLInputElement)) return;
    this.#numericDrafts = { ...this.#numericDrafts, [pathKey(field.path)]: event.target.value };
    this.clearSerializedValue();
    this.#reportDraftChange();
  }

  arrayRows(field: SchemaFormField): Array<{ key: string; index: number }> {
    const values = arrayValueAtPath(this.formValue, field.path);
    const keys = this.#arrayKeys[pathKey(field.path)] ?? [];
    return values.map((_, index) => ({
      key: keys[index] ?? `${pathKey(field.path)}-${index}`,
      index,
    }));
  }

  addArrayItem(field: SchemaFormField): void {
    if (this.#options.getSubmitting()) return;
    const values = arrayValueAtPath(this.formValue, field.path);
    const nextValue = field.item ? defaultValueForField(field.item) : null;
    this.updateValue(field.path, [...values, nextValue]);
    const key = pathKey(field.path);
    this.#arrayKeys = {
      ...this.#arrayKeys,
      [key]: [...(this.#arrayKeys[key] ?? []), `${key}-${this.#arrayKeyCounter++}`],
    };
  }

  removeArrayItem(field: SchemaFormField, index: number): void {
    if (this.#options.getSubmitting()) return;
    const values = arrayValueAtPath(this.formValue, field.path);
    this.updateValue(
      field.path,
      values.filter((_, candidateIndex) => candidateIndex !== index),
      false,
    );
    this.#rawDrafts = this.#reindexArrayPathState(this.#rawDrafts, field.path, index);
    this.#parsedRawDrafts = this.#reindexArrayPathState(this.#parsedRawDrafts, field.path, index);
    this.#numericDrafts = this.#reindexArrayPathState(this.#numericDrafts, field.path, index);
    this.#errors = this.#reindexArrayPathState(this.#errors, field.path, index);
    this.#touchedValidationSequences = this.#bumpPathValidationSequences(
      this.#reindexArrayPathState(this.#touchedValidationSequences, field.path, index),
      field.path,
    );
    const key = pathKey(field.path);
    this.#arrayKeys = {
      ...this.#arrayKeys,
      [key]: (this.#arrayKeys[key] ?? []).filter((_, candidateIndex) => candidateIndex !== index),
    };
    this.#reportDraftChange();
  }

  #reindexArrayPathState<T>(
    state: Record<string, T>,
    arrayPath: readonly string[],
    removedIndex: number,
  ): Record<string, T> {
    const prefix = pathKey(arrayPath);
    const pathPrefix = prefix === '' ? '' : `${prefix}/`;
    const next: Record<string, T> = {};

    for (const [key, stateValue] of Object.entries(state)) {
      if (!key.startsWith(pathPrefix)) {
        next[key] = stateValue;
        continue;
      }

      const relativeKey = key.slice(pathPrefix.length);
      if (relativeKey === '') {
        next[key] = stateValue;
        continue;
      }

      const [indexSegment = '', ...remainingSegments] = relativeKey.split('/');
      const index = Number(indexSegment);
      if (!Number.isInteger(index) || index < 0) {
        next[key] = stateValue;
        continue;
      }

      if (index < removedIndex) {
        next[key] = stateValue;
        continue;
      }

      if (index === removedIndex) continue;

      const shiftedKey = [String(index - 1), ...remainingSegments].join('/');
      next[`${pathPrefix}${shiftedKey}`] = stateValue;
    }

    return next;
  }

  #bumpPathValidationSequences(
    state: Record<string, number>,
    path: readonly string[],
  ): Record<string, number> {
    const prefix = pathKey(path);
    const pathPrefix = prefix === '' ? '' : `${prefix}/`;
    const next: Record<string, number> = {};

    for (const [key, sequence] of Object.entries(state)) {
      next[key] = key === prefix || key.startsWith(pathPrefix) ? sequence + 1 : sequence;
    }

    return next;
  }

  #seedRawDrafts(field: SchemaFormField, currentValue: unknown): Record<string, string> {
    const drafts: Record<string, string> = {};
    for (const jsonField of this.#currentJsonFields(field, currentValue)) {
      drafts[pathKey(jsonField.path)] = JSON.stringify(
        getValueAtPath(currentValue, jsonField.path) ?? null,
        null,
        2,
      );
    }
    return drafts;
  }

  #currentJsonFields(field: SchemaFormField, currentValue: unknown): SchemaFormField[] {
    const fields: SchemaFormField[] = [];

    const visit = (candidate: SchemaFormField) => {
      if (candidate.kind === 'json') fields.push(candidate);
      for (const child of candidate.fields) visit(child);
      if (candidate.kind === 'array' && candidate.item) {
        for (const [index] of arrayValueAtPath(currentValue, candidate.path).entries()) {
          visit(rebaseFieldPath(candidate.item, [...candidate.path, String(index)]));
        }
      }
    };

    visit(field);
    return fields;
  }

  #currentNumericFields(field: SchemaFormField, currentValue: unknown): SchemaFormField[] {
    const fields: SchemaFormField[] = [];

    const visit = (candidate: SchemaFormField) => {
      if (candidate.kind === 'number' || candidate.kind === 'integer') fields.push(candidate);
      for (const child of candidate.fields) visit(child);
      if (candidate.kind === 'array' && candidate.item) {
        for (const [index] of arrayValueAtPath(currentValue, candidate.path).entries()) {
          visit(rebaseFieldPath(candidate.item, [...candidate.path, String(index)]));
        }
      }
    };

    visit(field);
    return fields;
  }

  #seedArrayKeys(field: SchemaFormField, currentValue: unknown): Record<string, string[]> {
    const keys: Record<string, string[]> = {};

    const visit = (candidate: SchemaFormField) => {
      if (candidate.kind === 'array') {
        const key = pathKey(candidate.path);
        keys[key] = arrayValueAtPath(currentValue, candidate.path).map(
          () => `${key}-${this.#arrayKeyCounter++}`,
        );
      }
      for (const child of candidate.fields) visit(child);
      if (candidate.item) visit(candidate.item);
    };

    visit(field);
    return keys;
  }

  #rawJsonIssues(): { value: unknown; issues: SchemaFormValidationIssue[] } {
    let nextValue = this.formValue;
    const issues: SchemaFormValidationIssue[] = [];
    for (const field of this.#currentJsonFields(this.#model.field, this.formValue)) {
      const parsed = this.#parsedRawDrafts[pathKey(field.path)];
      if (parsed === undefined) continue;
      if (parsed.ok) {
        nextValue = setValueAtPath(nextValue, field.path, parsed.value);
      } else {
        issues.push({ path: field.path, message: parsed.message });
      }
    }
    return { value: nextValue, issues };
  }

  /**
   * Assembles the submit-ready candidate value from `formValue` plus every
   * pending numeric/JSON draft, or reports the raw-JSON parse issues that
   * block assembly. Called by schema-form-body.svelte's `handleSubmit`
   * before running schema validation.
   */
  buildSubmitCandidate(): SchemaFormSubmitCandidate {
    const raw = this.#rawJsonIssues();
    if (raw.issues.length > 0) return { ok: false, issues: raw.issues };

    let candidate = raw.value;
    for (const field of this.#currentNumericFields(this.#model.field, this.formValue)) {
      const draft = this.#numericDrafts[pathKey(field.path)];
      if (draft !== undefined) candidate = setValueAtPath(candidate, field.path, draft);
    }
    return { ok: true, value: pruneUndefined(candidate) };
  }

  /** Records validation issues from a failed submit or field-level check. */
  applyIssues(issues: SchemaFormValidationIssue[]): void {
    this.#errors = issuesByPath(issues);
    this.clearSerializedValue();
  }

  /** Applies a successfully validated + serialized submit result. */
  commit(value: unknown, serializedValue: string): void {
    this.formValue = value;
    this.#errors = {};
    this.serializedValue = serializedValue;
  }
}

export function createSchemaFormState(
  model: SchemaFormModel,
  initialValue: unknown,
  options: SchemaFormStateOptions,
): SchemaFormState {
  return new SchemaFormState(model, initialValue, options);
}
