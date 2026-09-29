/**
 * MarkdownEditor's display modes and the configuration diagnostics for its
 * mode and value-mode props.
 */

import type { PlaceholderDiagnostic, PlaceholderValueMode } from '@lostgradient/markdown';

import type { EditorMode } from './markdown-editor.types.ts';

/** Every display mode, in the order the built-in mode control lists them. */
export const EDITOR_MODES: readonly EditorMode[] = Object.freeze(['wysiwyg', 'source', 'preview']);

/** The two modes that edit the template; preview only renders it. */
export type EditingMode = Exclude<EditorMode, 'preview'>;

export function isEditorMode(mode: unknown): mode is EditorMode {
  return typeof mode === 'string' && (EDITOR_MODES as readonly string[]).includes(mode);
}

/** Whether `valueMode` is usable: absent (the `'text'` default) or a known mode. */
export function isPlaceholderValueMode(
  valueMode: unknown,
): valueMode is PlaceholderValueMode | undefined {
  return valueMode === undefined || valueMode === 'text' || valueMode === 'markdown';
}

function invalidOption(property: string, message: string): PlaceholderDiagnostic {
  return { code: 'invalid_option', message, location: { kind: 'configuration', property } };
}

/**
 * `invalid_option` diagnostics for an invalid `mode` or `placeholderValueMode`
 * prop, in the Markdown package's configuration order (by property). Never
 * includes the invalid value itself.
 */
export function modeOptionDiagnostics(
  mode: unknown,
  valueMode: unknown,
): readonly PlaceholderDiagnostic[] {
  const issues: PlaceholderDiagnostic[] = [];
  if (!isEditorMode(mode)) {
    issues.push(invalidOption('mode', 'Option "mode" must be "wysiwyg", "source" or "preview".'));
  }
  if (!isPlaceholderValueMode(valueMode)) {
    issues.push(
      invalidOption(
        'placeholderValueMode',
        'Option "placeholderValueMode" must be "text" or "markdown".',
      ),
    );
  }
  return issues;
}
