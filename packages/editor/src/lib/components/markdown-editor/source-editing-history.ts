/**
 * The explicit undo history of MarkdownEditor's source textarea.
 *
 * The browser's native textarea undo stack cannot be trusted once the
 * component writes the value itself (a completion acceptance, a replayed
 * undo), so source mode keeps its own history of reversible text splices.
 * Each entry stores only the changed range, the text it replaced and the
 * selection before and after, never a whole-document snapshot. History
 * lives in memory for one mounted textarea, is never persisted or logged,
 * and is discarded on teardown.
 */

/** A textarea selection as UTF-16 offsets. */
export interface SourceSelection {
  readonly start: number;
  readonly end: number;
}

/** One reversible change to the source text. */
export interface SourceSplice {
  /** Offset where the change starts. */
  readonly from: number;
  /** Text the change removed. */
  readonly removed: string;
  /** Text the change inserted. */
  readonly inserted: string;
  readonly selectionBefore: SourceSelection;
  readonly selectionAfter: SourceSelection;
}

/** The text and selection after replaying an entry. */
export interface SourceHistoryStep {
  readonly value: string;
  readonly selection: SourceSelection;
}

function isHighSurrogate(code: number): boolean {
  return code >= 0xd8_00 && code <= 0xdb_ff;
}

function isLowSurrogate(code: number): boolean {
  return code >= 0xdc_00 && code <= 0xdf_ff;
}

/**
 * The single changed range that turns `before` into `after`, found by
 * trimming their common prefix and suffix without splitting a surrogate
 * pair, or `null` when they are equal.
 */
export function diffSourceText(
  before: string,
  after: string,
): Pick<SourceSplice, 'from' | 'removed' | 'inserted'> | null {
  if (before === after) return null;
  const limit = Math.min(before.length, after.length);
  let prefix = 0;
  while (prefix < limit && before.charCodeAt(prefix) === after.charCodeAt(prefix)) prefix += 1;
  if (prefix > 0 && isHighSurrogate(before.charCodeAt(prefix - 1))) prefix -= 1;

  let suffix = 0;
  while (
    suffix < limit - prefix &&
    before.charCodeAt(before.length - 1 - suffix) === after.charCodeAt(after.length - 1 - suffix)
  ) {
    suffix += 1;
  }
  if (suffix > 0 && isLowSurrogate(before.charCodeAt(before.length - suffix))) suffix -= 1;

  return {
    from: prefix,
    removed: before.slice(prefix, before.length - suffix),
    inserted: after.slice(prefix, after.length - suffix),
  };
}

function applySplice(value: string, from: number, remove: string, insert: string): string | null {
  if (value.slice(from, from + remove.length) !== remove) return null;
  return value.slice(0, from) + insert + value.slice(from + remove.length);
}

/** Undo and redo stacks of source splices. */
export class SourceEditingHistory {
  #undo: SourceSplice[] = [];
  #redo: SourceSplice[] = [];

  get undoDepth(): number {
    return this.#undo.length;
  }

  get redoDepth(): number {
    return this.#redo.length;
  }

  /** Add one entry. A new edit always clears redo. */
  record(splice: SourceSplice): void {
    this.#undo.push(splice);
    this.#redo = [];
  }

  /** Forget everything, for a new baseline or teardown. */
  clear(): void {
    this.#undo = [];
    this.#redo = [];
  }

  /**
   * Reverse the latest entry against `value`. Returns `null` when there is
   * nothing to undo, or clears the history and returns `null` when `value`
   * no longer matches it.
   */
  undo(value: string): SourceHistoryStep | null {
    const splice = this.#undo.pop();
    if (!splice) return null;
    const next = applySplice(value, splice.from, splice.inserted, splice.removed);
    if (next === null) {
      this.clear();
      return null;
    }
    this.#redo.push(splice);
    return { value: next, selection: splice.selectionBefore };
  }

  /** Reapply the latest undone entry against `value`; see {@link undo}. */
  redo(value: string): SourceHistoryStep | null {
    const splice = this.#redo.pop();
    if (!splice) return null;
    const next = applySplice(value, splice.from, splice.removed, splice.inserted);
    if (next === null) {
      this.clear();
      return null;
    }
    this.#undo.push(splice);
    return { value: next, selection: splice.selectionAfter };
  }
}

type ShortcutEvent = Pick<KeyboardEvent, 'key' | 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey'>;

/** The platform facts the history shortcuts depend on. */
export interface ShortcutPlatform {
  readonly mac: boolean;
  readonly windows: boolean;
}

/** Detect the platform the way the editor's keymap does (SSR-safe). */
export function detectShortcutPlatform(): ShortcutPlatform {
  const platform = typeof navigator === 'undefined' ? '' : navigator.platform;
  return { mac: /Mac|iPod|iPhone|iPad/.test(platform), windows: /Win/.test(platform) };
}

function hasOnlyMod(event: ShortcutEvent, platform: ShortcutPlatform): boolean {
  if (event.altKey) return false;
  return platform.mac ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
}

/**
 * Which history action a keydown asks for: Mod-Z undoes; Mod-Shift-Z, and
 * Ctrl-Y on Windows, redo. Mod is Command on macOS and Control elsewhere.
 */
export function historyShortcut(
  event: ShortcutEvent,
  platform: ShortcutPlatform,
): 'undo' | 'redo' | null {
  if (!hasOnlyMod(event, platform)) return null;
  const key = event.key.toLowerCase();
  if (key === 'z') return event.shiftKey ? 'redo' : 'undo';
  if (key === 'y' && platform.windows && !event.shiftKey) return 'redo';
  return null;
}
