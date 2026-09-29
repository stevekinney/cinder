/**
 * MarkdownEditor's placeholder state: the live editor configuration, the
 * status message, and the diagnostics reported to the caller.
 *
 * Created once during component initialization. Values are only classified
 * here; they never reach the editor or a diagnostic.
 */

import {
  sortPlaceholderDiagnostics,
  type PlaceholderCompletionConfiguration,
  type PlaceholderDecorationConfiguration,
  type PlaceholderDefinitions,
  type PlaceholderDiagnostic,
} from '@lostgradient/markdown';
import { untrack } from 'svelte';

import {
  classifyPlaceholderValues,
  resolvePlaceholderConfiguration,
  type PlaceholderEditorConfiguration,
} from '../../editor/template-placeholder-configuration.ts';
import { samePlaceholderDiagnostics } from '../../editor/template-placeholder-diagnostic-comparison.ts';
import { computePlaceholderDiagnostics } from '../../editor/template-placeholder-diagnostics.ts';

/** Default instructions for placeholder completion. */
export const PLACEHOLDER_INSTRUCTIONS =
  'Type two opening braces to insert a placeholder. Use arrow keys and Enter to choose; Escape or Tab dismisses.';

/** Reactive reads of the component props this module needs. */
export interface MarkdownEditorPlaceholderProps {
  id: () => string;
  value: () => string;
  readonly: () => boolean;
  definitions: () => PlaceholderDefinitions | undefined;
  values: () => unknown;
  completion: () => PlaceholderCompletionConfiguration | undefined;
  decoration: () => PlaceholderDecorationConfiguration | undefined;
  onDiagnosticsChange: () => ((diagnostics: readonly PlaceholderDiagnostic[]) => void) | undefined;
  /** Configuration diagnostics for other component props, such as `mode`. */
  optionDiagnostics?: () => readonly PlaceholderDiagnostic[];
  /**
   * The filled preview's own diagnostics, which replace the authoring
   * diagnostics while it shows; `undefined` otherwise.
   */
  previewDiagnostics?: () => readonly PlaceholderDiagnostic[] | undefined;
}

const NO_DIAGNOSTICS: readonly PlaceholderDiagnostic[] = Object.freeze([]);

/** Join ID reference lists, keeping the caller's tokens first and dropping duplicates. */
export function mergeIdReferences(...lists: (string | null | undefined)[]): string | undefined {
  const tokens = lists.flatMap((list) => list?.split(/\s+/).filter(Boolean) ?? []);
  const unique = [...new Set(tokens)];
  return unique.length > 0 ? unique.join(' ') : undefined;
}

function withOptionDiagnostics(
  diagnostics: readonly PlaceholderDiagnostic[],
  options: readonly PlaceholderDiagnostic[],
): readonly PlaceholderDiagnostic[] {
  if (options.length === 0) return diagnostics;
  return Object.freeze(sortPlaceholderDiagnostics([...diagnostics, ...options]));
}

export function createMarkdownEditorPlaceholders(props: MarkdownEditorPlaceholderProps) {
  const valuesStatus = $derived(classifyPlaceholderValues(props.values()));
  const configuration: PlaceholderEditorConfiguration = $derived({
    definitions: props.definitions(),
    completion: props.completion(),
    decoration: props.decoration(),
    valuesStatus,
  });
  const resolved = $derived(resolvePlaceholderConfiguration(configuration));
  // Both editing modes offer completion, so the instructions follow the
  // configuration and readonly state, never the mode.
  const instructionsVisible = $derived(resolved.completion !== undefined && !props.readonly());
  let statusMessage = $state('');
  let diagnostics = $state.raw<readonly PlaceholderDiagnostic[]>(NO_DIAGNOSTICS);

  // Report only when the ordered list changes. The initial empty list is
  // never reported, so `[]` goes out only to clear earlier diagnostics.
  $effect(() => {
    const next = withOptionDiagnostics(
      props.previewDiagnostics?.() ?? computePlaceholderDiagnostics(resolved, props.value()),
      props.optionDiagnostics?.() ?? NO_DIAGNOSTICS,
    );
    untrack(() => {
      if (samePlaceholderDiagnostics(next, diagnostics)) return;
      diagnostics = next;
      props.onDiagnosticsChange()?.(next);
    });
  });

  return {
    /** The configuration object handed to the editor; replaced when a prop changes. */
    get configuration() {
      return configuration;
    },
    /** The resolved configuration, shared by both editing modes. */
    get resolved() {
      return resolved;
    },
    get statusMessage() {
      return statusMessage;
    },
    get diagnostics() {
      return diagnostics;
    },
    get instructionsVisible() {
      return instructionsVisible;
    },
    get listboxId() {
      return `${props.id()}-placeholder-listbox-wysiwyg`;
    },
    get sourceListboxId() {
      return `${props.id()}-placeholder-listbox-source`;
    },
    setStatusMessage(message: string) {
      statusMessage = message;
    },
    /** The editing element's `aria-describedby`: the caller's IDs, then instructions and diagnostics. */
    describedBy(callerDescribedBy: string | null | undefined): string | undefined {
      const id = props.id();
      return mergeIdReferences(
        callerDescribedBy,
        instructionsVisible ? `${id}-placeholder-instructions` : undefined,
        diagnostics.length > 0 ? `${id}-placeholder-diagnostics` : undefined,
      );
    },
  };
}
