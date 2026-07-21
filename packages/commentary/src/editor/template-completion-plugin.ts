/**
 * ProseMirror plugin for inline autocomplete of `{{…}}` template placeholder tokens.
 *
 * Shows a popup suggestion menu as the user types inside `{{…}}` tokens in the
 * WYSIWYG editor. Supports both static candidates and async lookup with debouncing.
 *
 * The plugin integrates with Milkdown via `$prose` and communicates state changes
 * through ProseMirror meta transactions on its plugin key.
 *
 * DEP-583: WYSIWYG placeholder completion for saved-prompt template authoring.
 */

import type {
  PlaceholderCandidate,
  PlaceholderCompletionConfiguration,
} from '@cinder/markdown/templates/types';
import type { EditorState, Transaction } from 'prosemirror-state';
import { Plugin, PluginKey, TextSelection } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';

import { createLazyProsePlugin, type LazyProsePlugin } from './milkdown-plugin-runtime.js';
import { textOffsetToBlockDocumentPosition } from './template-position-utilities.js';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** @internal Exported for testing only. */
export const MAXIMUM_VISIBLE_SUGGESTIONS = 8;

/** Default minimum query length before showing suggestions. */
const DEFAULT_MINIMUM_QUERY_LENGTH = 1;

/** Default debounce interval for async lookup calls (ms). */
const DEFAULT_LOOKUP_DEBOUNCE_MS = 150;

/**
 * Pattern for valid placeholder path prefixes.
 * Allows letters, digits, underscores, and dots (partial paths like "input.na").
 */
const VALID_QUERY_PATTERN = /^[a-zA-Z0-9_.]*$/;

// ─────────────────────────────────────────────────────────────────────────────
// Plugin key (exported for external state inspection)
// ─────────────────────────────────────────────────────────────────────────────

/** Plugin key for the template completion plugin. */
export const templateCompletionPluginKey = new PluginKey<CompletionState>('template-completion');

// ─────────────────────────────────────────────────────────────────────────────
// Completion state
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Internal state tracked by the completion plugin across transactions.
 *
 * @internal Exported for testing only.
 */
export interface CompletionState {
  /** Whether the completion menu is currently active. */
  active: boolean;
  /** The current query string (text between `{{` and cursor, trimmed). */
  query: string;
  /** Filtered and sorted suggestions for the current query. */
  suggestions: PlaceholderCandidate[];
  /** Index of the currently highlighted suggestion (0-based). */
  activeIndex: number;
  /** ProseMirror document position where the `{{` token starts. */
  tokenFrom: number;
  /** ProseMirror document position of the cursor (for popup positioning). */
  cursorPos: number;
}

/** @internal Exported for testing only. */
export const INACTIVE_STATE: CompletionState = {
  active: false,
  query: '',
  suggestions: [],
  activeIndex: 0,
  tokenFrom: 0,
  cursorPos: 0,
};

// ─────────────────────────────────────────────────────────────────────────────
// Meta transaction types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Meta payload shapes dispatched on `templateCompletionPluginKey`.
 *
 * @internal Exported for testing only.
 */
export type CompletionMeta =
  | { type: 'close' }
  | { type: 'navigate'; index: number }
  | { type: 'asyncResults'; candidates: PlaceholderCandidate[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isCompletionMeta(value: unknown): value is CompletionMeta {
  if (!isRecord(value)) return false;

  if (value['type'] === 'close') return true;
  if (value['type'] === 'navigate') return typeof value['index'] === 'number';
  if (value['type'] === 'asyncResults') return Array.isArray(value['candidates']);
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Query detection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Detect whether the cursor is inside an in-progress `{{…}}` token.
 *
 * Uses `doc.textBetween` to derive pre-cursor text so that inline atom nodes
 * (hard_break, images, etc.) are correctly excluded from the text coordinate
 * space. This prevents `$from.parentOffset` — which counts atom nodeSize —
 * from diverging from the plain-text index into `textContent`.
 *
 * @internal Exported for testing only.
 *
 * @returns An object with the query text and token start position, or `null`
 *   if the cursor is not inside an open placeholder token.
 */
export function detectTokenQuery(
  state: EditorState,
): { query: string; tokenFrom: number; cursorPos: number } | null {
  const { $from } = state.selection;
  const cursorPos = state.selection.from;

  // Must be a cursor (collapsed selection)
  if (state.selection.from !== state.selection.to) return null;

  // Get the parent text block
  const parentNode = $from.parent;
  if (!parentNode.isTextblock) return null;

  const blockContentStart = $from.start();
  const blockContentEnd = $from.end();

  // Use textBetween to collect the block's text correctly. Unlike
  // `parentNode.textContent.slice(0, $from.parentOffset)`, this approach
  // treats inline atoms (hard_break, images) as having zero text length,
  // keeping the text-offset coordinate system consistent with textContent.
  const textBeforeCursor = state.doc.textBetween(blockContentStart, cursorPos);
  const fullText = state.doc.textBetween(blockContentStart, blockContentEnd);

  // Find the last occurrence of `{{` before the cursor
  const openIndex = textBeforeCursor.lastIndexOf('{{');
  if (openIndex === -1) return null;

  // Check for a closing `}}` between `{{` and the cursor
  const textBetween = textBeforeCursor.slice(openIndex + 2);
  if (textBetween.includes('}}')) return null;

  // Also check if the full block text has `}}` right at/after cursor position
  // that would indicate a completed token
  const textAfterOpen = fullText.slice(openIndex + 2);
  const closingIndex = textAfterOpen.indexOf('}}');
  if (closingIndex !== -1 && closingIndex < textBeforeCursor.length - openIndex - 2) {
    // The `}}` is before the cursor in the text, so the token is complete
    return null;
  }

  // Extract and trim the query
  const rawQuery = textBeforeCursor.slice(openIndex + 2);
  const query = rawQuery.trim();

  // Validate query characters
  if (!VALID_QUERY_PATTERN.test(query)) return null;

  // Convert the text-coordinate `openIndex` to an absolute document position
  // by walking the block's children, counting text characters to skip atoms.
  const tokenFrom = textOffsetToBlockDocumentPosition(parentNode, blockContentStart, openIndex);

  return { query, tokenFrom, cursorPos };
}

// ─────────────────────────────────────────────────────────────────────────────
// Filtering and sorting
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Filter candidates by case-insensitive prefix match and sort lexicographically.
 *
 * @internal Exported for testing only.
 *
 * @param candidates - All available candidates.
 * @param query - The query to match against candidate paths.
 * @returns Filtered and sorted candidates, limited to {@link MAXIMUM_VISIBLE_SUGGESTIONS}.
 */
export function filterAndSortCandidates(
  candidates: PlaceholderCandidate[],
  query: string,
): PlaceholderCandidate[] {
  const lowerQuery = query.toLowerCase();

  return candidates
    .filter((candidate) => candidate.path.toLowerCase().startsWith(lowerQuery))
    .toSorted((a, b) => a.path.localeCompare(b.path))
    .slice(0, MAXIMUM_VISIBLE_SUGGESTIONS);
}

/**
 * Merge static and async candidates, deduplicating by path.
 *
 * Static candidates take priority when paths overlap.
 *
 * @internal Exported for testing only.
 *
 * @param staticCandidates - Candidates from the static configuration.
 * @param asyncCandidates - Candidates from the async lookup.
 * @returns Merged candidate array with duplicates removed.
 */
export function mergeCandidates(
  staticCandidates: PlaceholderCandidate[],
  asyncCandidates: PlaceholderCandidate[],
): PlaceholderCandidate[] {
  const seen = new Set(staticCandidates.map((candidate) => candidate.path));
  const merged = [...staticCandidates];

  for (const candidate of asyncCandidates) {
    if (!seen.has(candidate.path)) {
      seen.add(candidate.path);
      merged.push(candidate);
    }
  }

  return merged;
}

// ─────────────────────────────────────────────────────────────────────────────
// Suggestion acceptance
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Find the end position of the complete `{{…}}` token starting at `tokenFrom`.
 *
 * Scans forward from `tokenFrom + 2` (past the opening `{{`) to find the first
 * `}}` within the document, stopping at the end of the current text block.
 *
 * The closing `}}` position is computed by walking the block's inline children
 * rather than treating the text-string index of `}}` as a document-position
 * offset. When inline atom nodes (such as `hard_break`) exist between
 * `tokenFrom` and `}}`, the text string is shorter than the document-position
 * span because atoms contribute zero text characters but occupy document
 * positions. Using the raw text index as a doc offset would return a position
 * that is too low, causing `acceptSuggestion` to leave trailing characters
 * behind.
 *
 * @param state - The current ProseMirror editor state.
 * @param tokenFrom - The document position where `{{` starts.
 * @returns The document position immediately after the closing `}}`, or `null`
 *   if no closing `}}` is found within the current block.
 *
 * @internal Exported for testing only.
 */
export function findTokenEnd(state: EditorState, tokenFrom: number): number | null {
  const $tokenFrom = state.doc.resolve(tokenFrom);
  const blockContentStart = $tokenFrom.start();
  const blockEnd = $tokenFrom.end();
  const parentNode = $tokenFrom.parent;

  const contentStart = tokenFrom + 2; // skip past `{{`
  if (contentStart >= blockEnd) return null;

  // textBetween treats atom nodes as empty strings, so the returned string
  // may be shorter than the document-position span when atoms are present.
  // We use this only to locate the `}}` in text space.
  const textFromContentStart = state.doc.textBetween(contentStart, blockEnd);
  const closingIndex = textFromContentStart.indexOf('}}');
  if (closingIndex === -1) return null;

  // closingIndex is a text-string index within [contentStart, blockEnd].
  // Convert it to an absolute document position by expressing it as a
  // text-coordinate offset from blockContentStart, then using the shared
  // walker that correctly accounts for atom-node document sizes.
  const textUpToContentStart = state.doc.textBetween(blockContentStart, contentStart);
  const closingTextOffset = textUpToContentStart.length + closingIndex;
  const closingDocPos = textOffsetToBlockDocumentPosition(
    parentNode,
    blockContentStart,
    closingTextOffset,
  );

  // closingDocPos is the position of the first `}`. The closing `}}` occupies
  // two text characters (no atoms), so the end of the token is +2.
  return closingDocPos + 2;
}

/**
 * Accept a suggestion by replacing the entire `{{…}}` token with the completed placeholder.
 *
 * Finds the full extent of the token (from `{{` to the matching `}}`, if present)
 * and replaces it with `{{path}}`, then positions the cursor after the closing braces.
 * When the caret is in the middle of an existing token (e.g., `{{input.n|ame}}`),
 * the entire token including the suffix is replaced, preventing partial-suffix corruption.
 *
 * @param view - The ProseMirror editor view.
 * @param suggestion - The candidate to accept.
 * @param tokenFrom - The document position where `{{` starts.
 */
function acceptSuggestion(
  view: EditorView,
  suggestion: PlaceholderCandidate,
  tokenFrom: number,
): void {
  const replacementText = `{{${suggestion.path}}}`;
  const { state } = view;
  const cursorPos = state.selection.from;

  // Scan forward from the token start to find the full `{{…}}` extent.
  // This handles the case where the cursor is in the middle of an existing
  // token (e.g., `{{input.n|ame}}`), replacing the whole token rather than
  // leaving the suffix behind.
  const fullTokenEnd = findTokenEnd(state, tokenFrom);
  const tokenTo = fullTokenEnd ?? cursorPos;

  const transaction = state.tr
    .replaceWith(tokenFrom, tokenTo, state.schema.text(replacementText))
    .setMeta(templateCompletionPluginKey, { type: 'close' } satisfies CompletionMeta);

  // Place cursor after the replacement text
  const newCursorPos = tokenFrom + replacementText.length;
  transaction.setSelection(TextSelection.create(transaction.doc, newCursorPos));

  view.dispatch(transaction);
}

// ─────────────────────────────────────────────────────────────────────────────
// DOM popup
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create the popup container element for the suggestion menu.
 *
 * @returns A positioned, hidden `<div>` with `role="listbox"`.
 */
function createPopupElement(): HTMLElement {
  const popup = document.createElement('div');
  popup.className = 'template-completion-popup';
  popup.setAttribute('role', 'listbox');
  popup.style.position = 'absolute';
  popup.style.zIndex = '50';
  popup.style.display = 'none';
  return popup;
}

/**
 * Render suggestion items into the popup element.
 *
 * Each suggestion is a `<div role="option">` containing the path and optional
 * description. Click handlers accept the clicked suggestion.
 *
 * @param popup - The popup container element.
 * @param completionState - Current completion state with suggestions and active index.
 * @param view - The ProseMirror editor view (for dispatching acceptance).
 */
function renderSuggestions(
  popup: HTMLElement,
  completionState: CompletionState,
  view: EditorView,
): void {
  // Clear existing children
  popup.textContent = '';

  const { suggestions, activeIndex, tokenFrom } = completionState;

  for (let index = 0; index < suggestions.length; index++) {
    const candidate = suggestions[index];
    if (!candidate) continue;

    const item = document.createElement('div');
    item.setAttribute('role', 'option');
    item.setAttribute('aria-selected', String(index === activeIndex));
    item.className = 'template-completion-item';

    if (index === activeIndex) {
      item.classList.add('template-completion-item--active');
    }

    // Path label
    const pathLabel = document.createElement('span');
    pathLabel.className = 'template-completion-item-path';
    pathLabel.textContent = candidate.path;
    item.appendChild(pathLabel);

    // Description and value kind (secondary text)
    if (candidate.description || candidate.valueKind !== 'unknown') {
      const secondary = document.createElement('span');
      secondary.className = 'template-completion-item-description';

      const parts: string[] = [];
      if (candidate.valueKind && candidate.valueKind !== 'unknown') {
        parts.push(candidate.valueKind);
      }
      if (candidate.description) {
        parts.push(candidate.description);
      }
      secondary.textContent = parts.join(' — ');
      item.appendChild(secondary);
    }

    // Click handler to accept this suggestion
    item.addEventListener('mousedown', (event) => {
      // Prevent the editor from losing focus
      event.preventDefault();
      event.stopPropagation();
      acceptSuggestion(view, candidate, tokenFrom);
    });

    popup.appendChild(item);
  }
}

/**
 * Position the popup element near the cursor using ProseMirror coordinates.
 *
 * Places the popup below the cursor line, aligned to the cursor's horizontal position.
 *
 * @param popup - The popup container element.
 * @param view - The ProseMirror editor view.
 * @param cursorPos - The document position to anchor the popup to.
 */
function positionPopup(popup: HTMLElement, view: EditorView, cursorPos: number): void {
  const coordinates = view.coordsAtPos(cursorPos);
  const parentElement = popup.parentElement;
  if (!parentElement) return;

  const parentRect = parentElement.getBoundingClientRect();

  popup.style.left = `${coordinates.left - parentRect.left}px`;
  popup.style.top = `${coordinates.bottom - parentRect.top + 4}px`;
}

// ─────────────────────────────────────────────────────────────────────────────
// State computation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute the next completion state from a transaction.
 *
 * Handles meta-driven updates (close, navigate, asyncResults) and recomputes
 * the token query and suggestions on each document/selection change.
 *
 * @internal Exported for testing only.
 *
 * @param previousState - The completion state before this transaction.
 * @param transaction - The ProseMirror transaction being applied.
 * @param editorState - The new ProseMirror editor state after the transaction.
 * @param configuration - The current placeholder completion configuration.
 * @returns The updated completion state.
 */
export function computeCompletionState(
  previousState: CompletionState,
  transaction: Transaction,
  editorState: EditorState,
  configuration: PlaceholderCompletionConfiguration | undefined,
): CompletionState {
  // If disabled, always return inactive
  if (!configuration) return INACTIVE_STATE;

  // Check for meta-driven updates
  const rawMeta: unknown = transaction.getMeta(templateCompletionPluginKey);
  const meta = isCompletionMeta(rawMeta) ? rawMeta : undefined;

  if (meta) {
    if (meta.type === 'close') {
      return INACTIVE_STATE;
    }

    if (meta.type === 'navigate') {
      return { ...previousState, activeIndex: meta.index };
    }

    if (meta.type === 'asyncResults') {
      // Merge async results with static candidates, re-filter, and re-sort
      const merged = mergeCandidates(configuration.candidates, meta.candidates);
      const suggestions = filterAndSortCandidates(merged, previousState.query);
      const activeIndex = Math.min(previousState.activeIndex, Math.max(0, suggestions.length - 1));

      if (suggestions.length === 0) {
        return INACTIVE_STATE;
      }

      return { ...previousState, suggestions, activeIndex };
    }
  }

  // Detect if the cursor is inside an open `{{…}}` token
  const detected = detectTokenQuery(editorState);

  if (!detected) {
    return INACTIVE_STATE;
  }

  const { query, tokenFrom, cursorPos } = detected;
  const minimumQueryLength = configuration.minimumQueryLength ?? DEFAULT_MINIMUM_QUERY_LENGTH;

  // Query too short — close menu
  if (query.length < minimumQueryLength) {
    return INACTIVE_STATE;
  }

  // Filter and sort candidates
  const suggestions = filterAndSortCandidates(configuration.candidates, query);

  if (suggestions.length === 0) {
    // Keep menu active with empty suggestions if async lookup is configured
    // (async results may arrive later). Otherwise, close.
    if (!configuration.lookupCandidates) {
      return INACTIVE_STATE;
    }

    return {
      active: true,
      query,
      suggestions: [],
      activeIndex: 0,
      tokenFrom,
      cursorPos,
    };
  }

  // Preserve active index when query hasn't changed, reset otherwise
  const activeIndex =
    previousState.active && previousState.query === query
      ? Math.min(previousState.activeIndex, suggestions.length - 1)
      : 0;

  return {
    active: true,
    query,
    suggestions,
    activeIndex,
    tokenFrom,
    cursorPos,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Plugin factory
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a Milkdown plugin that provides inline autocomplete for `{{…}}` template tokens.
 *
 * The plugin watches the cursor position, detects when it is inside an in-progress
 * placeholder token, filters available candidates, and shows a positioned popup with
 * suggestions. Keyboard navigation (ArrowUp/Down, Enter, Tab, Escape) and mouse
 * clicks interact with the popup.
 *
 * The factory accepts a getter function so the configuration can change at runtime
 * (e.g., when the candidate set is recomputed from a new JSON Schema) without
 * recreating the plugin.
 *
 * @param getConfiguration - Returns the current completion configuration, or
 *   `undefined` to disable the popup entirely.
 * @returns A Milkdown-compatible plugin created via `$prose`.
 *
 * @example
 * ```typescript
 * const plugin = createTemplateCompletionPlugin(() => ({
 *   candidates: [
 *     { path: 'input.name', description: 'User name', valueKind: 'string' },
 *     { path: 'input.age', description: 'User age', valueKind: 'number' },
 *   ],
 * }));
 * ```
 */
export function createTemplateCompletionPlugin(
  getConfiguration: () => PlaceholderCompletionConfiguration | undefined,
): LazyProsePlugin {
  return createLazyProsePlugin(() => {
    return new Plugin<CompletionState>({
      key: templateCompletionPluginKey,

      // ─────────────────────────────────────────────────────────────────────
      // State field: compute completion state on each transaction
      // ─────────────────────────────────────────────────────────────────────

      state: {
        init(): CompletionState {
          return INACTIVE_STATE;
        },

        apply(transaction, previousState, _oldEditorState, newEditorState): CompletionState {
          return computeCompletionState(
            previousState,
            transaction,
            newEditorState,
            getConfiguration(),
          );
        },
      },

      // ─────────────────────────────────────────────────────────────────────
      // Props: keyboard interception when the menu is open
      // ─────────────────────────────────────────────────────────────────────

      props: {
        handleKeyDown(view, event): boolean {
          const pluginState = templateCompletionPluginKey.getState(view.state);
          if (!pluginState?.active) {
            // Menu is not open — let all keys pass through
            return false;
          }

          const { suggestions, activeIndex, tokenFrom } = pluginState;

          switch (event.key) {
            case 'ArrowDown': {
              if (suggestions.length === 0) return false;
              const nextIndex = (activeIndex + 1) % suggestions.length;
              view.dispatch(
                view.state.tr.setMeta(templateCompletionPluginKey, {
                  type: 'navigate',
                  index: nextIndex,
                } satisfies CompletionMeta),
              );
              event.preventDefault();
              return true;
            }

            case 'ArrowUp': {
              if (suggestions.length === 0) return false;
              const previousIndex = (activeIndex - 1 + suggestions.length) % suggestions.length;
              view.dispatch(
                view.state.tr.setMeta(templateCompletionPluginKey, {
                  type: 'navigate',
                  index: previousIndex,
                } satisfies CompletionMeta),
              );
              event.preventDefault();
              return true;
            }

            case 'Enter': {
              if (suggestions.length === 0) return false;
              const selected = suggestions[activeIndex];
              if (selected) {
                acceptSuggestion(view, selected, tokenFrom);
                event.preventDefault();
                return true;
              }
              return false;
            }

            case 'Tab': {
              // Accept active suggestion when menu is open with suggestions.
              // When menu is NOT open, this returns false above (before the switch).
              if (suggestions.length === 0) return false;
              const tabSelected = suggestions[activeIndex];
              if (tabSelected) {
                acceptSuggestion(view, tabSelected, tokenFrom);
                event.preventDefault();
                return true;
              }
              return false;
            }

            case 'Escape': {
              view.dispatch(
                view.state.tr.setMeta(templateCompletionPluginKey, {
                  type: 'close',
                } satisfies CompletionMeta),
              );
              event.preventDefault();
              return true;
            }

            default:
              return false;
          }
        },
      },

      // ─────────────────────────────────────────────────────────────────────
      // View: manage DOM popup and async lookup lifecycle
      // ─────────────────────────────────────────────────────────────────────

      view(editorView) {
        // Create the popup element and append it to the editor's parent
        const popup = createPopupElement();
        const parentElement = editorView.dom.parentElement ?? document.body;
        parentElement.appendChild(popup);

        // Async lookup state
        let currentAbortController: AbortController | null = null;
        let debounceTimeout: ReturnType<typeof setTimeout> | null = null;

        /**
         * Update popup visibility, content, and position based on current state.
         */
        function updatePopup(view: EditorView): void {
          const pluginState = templateCompletionPluginKey.getState(view.state);

          if (!pluginState?.active || pluginState.suggestions.length === 0) {
            popup.style.display = 'none';
            return;
          }

          popup.style.display = '';
          renderSuggestions(popup, pluginState, view);
          positionPopup(popup, view, pluginState.cursorPos);
        }

        /**
         * Cancel any pending async lookup.
         */
        function cancelAsyncLookup(): void {
          currentAbortController?.abort();
          currentAbortController = null;
          if (debounceTimeout !== null) {
            clearTimeout(debounceTimeout);
            debounceTimeout = null;
          }
        }

        // Initial render
        updatePopup(editorView);

        return {
          update(view, previousEditorState) {
            const pluginState = templateCompletionPluginKey.getState(view.state);
            const previousPluginState = templateCompletionPluginKey.getState(previousEditorState);

            // If menu closed, cancel any pending async lookup
            if (!pluginState?.active) {
              cancelAsyncLookup();
              updatePopup(view);
              return;
            }

            // If the query changed, trigger a new async lookup (if configured)
            if (pluginState.active && pluginState.query !== previousPluginState?.query) {
              cancelAsyncLookup();

              const configuration = getConfiguration();
              if (configuration?.lookupCandidates) {
                const abortController = new AbortController();
                currentAbortController = abortController;

                const lookupDebounceMs =
                  configuration.lookupDebounceMs ?? DEFAULT_LOOKUP_DEBOUNCE_MS;

                debounceTimeout = setTimeout(async () => {
                  debounceTimeout = null;
                  try {
                    const asyncResults = await configuration.lookupCandidates!(
                      pluginState.query,
                      abortController.signal,
                    );

                    // Abort controller may have been replaced since the lookup started
                    if (abortController.signal.aborted) return;

                    // Dispatch async results into the plugin state
                    view.dispatch(
                      view.state.tr.setMeta(templateCompletionPluginKey, {
                        type: 'asyncResults',
                        candidates: asyncResults,
                      } satisfies CompletionMeta),
                    );
                  } catch {
                    // Ignore errors from aborted requests or lookup failures.
                    // The popup will continue showing static results (if any).
                  }
                }, lookupDebounceMs);
              }
            }

            // Update popup rendering
            updatePopup(view);
          },

          destroy() {
            cancelAsyncLookup();

            // Remove the popup from the DOM
            if (popup.parentElement) {
              popup.parentElement.removeChild(popup);
            }
          },
        };
      },
    });
  });
}
