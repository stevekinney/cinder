import type { ReviewState, Thread } from '../../comments/index.ts';
import { toPersistedThreads } from '../../comments/index.ts';
import {
  generateCommentsExport,
  generateMarkdownSummary,
  generateUnifiedDiff,
  type MarkdownSummaryOptions,
  type MarkdownSummaryResult,
  type UnifiedDiffOptions,
  type UnifiedDiffResult,
} from '../../export/index.ts';
import { stringifyOrNull } from '../../utilities/stringify.ts';
import type { ReviewFormData } from './review-editor.types.ts';

export type { ReviewFormData };

export interface ReviewEditorExportOptions {
  getState: () => ReviewState;
  getValue: () => string;
  getOriginal: () => string;
  getThreads: () => Thread[];
  getName: () => string | undefined;
}

export interface ReviewEditorExportActions {
  exportMarkdownSummary(options?: MarkdownSummaryOptions): MarkdownSummaryResult;
  exportUnifiedDiff(options?: UnifiedDiffOptions): UnifiedDiffResult;
  getSummaryContent(): string;
  getFormData(): ReviewFormData;
  getFieldName(field: string): string;
  handleExportContent(): string;
  handleExportSummary(): string;
  handleExportJSON(): string;
  handleExportDiff(): string;
  handleExportComments(): string;
}

export function exportMarkdownSummary(
  state: ReviewState,
  options?: MarkdownSummaryOptions,
): MarkdownSummaryResult {
  return generateMarkdownSummary(state, options);
}

export function exportUnifiedDiff(
  state: ReviewState,
  options?: UnifiedDiffOptions,
): UnifiedDiffResult {
  return generateUnifiedDiff(state, options);
}

export function exportCommentsMarkdown(state: ReviewState): string {
  return generateCommentsExport(state).markdown;
}

export function getSummaryContentWithoutHeading(state: ReviewState): string {
  return exportMarkdownSummary(state).markdown.replace(/^# Review Summary\n+/, '');
}

export function buildFormData(state: ReviewState): ReviewFormData {
  return {
    original: state.original ?? '',
    current: state.content,
    comments: JSON.stringify(state.threads),
    diff: exportUnifiedDiff(state).diff,
    summary: exportMarkdownSummary(state).markdown,
  };
}

export function buildFormDataFromValues(
  original: string,
  current: string,
  threads: Thread[],
): ReviewFormData {
  const formData = buildFormData({
    schemaVersion: 4,
    content: current,
    original,
    threads: toPersistedThreads(threads),
    updatedAt: new Date().toISOString(),
  });

  return {
    ...formData,
    comments: JSON.stringify(threads),
  };
}

export function createReviewEditorExportActions(
  options: ReviewEditorExportOptions,
): ReviewEditorExportActions {
  const { getState, getValue, getOriginal, getThreads, getName } = options;

  function runMarkdownSummary(exportOptions?: MarkdownSummaryOptions): MarkdownSummaryResult {
    return exportMarkdownSummary(getState(), exportOptions);
  }

  function runUnifiedDiff(exportOptions?: UnifiedDiffOptions): UnifiedDiffResult {
    return exportUnifiedDiff(getState(), exportOptions);
  }

  function getSummaryContent(): string {
    return getSummaryContentWithoutHeading(getState());
  }

  function getFieldName(field: string): string {
    const name = getName();
    return name ? `${name}-${field}` : field;
  }

  function getFormData(): ReviewFormData {
    return buildFormDataFromValues(getOriginal(), getValue(), getThreads());
  }

  function handleExportJSON(): string {
    const json = stringifyOrNull(getState());
    return json ?? '{"error": "Failed to serialize editor state"}';
  }

  return {
    exportMarkdownSummary: runMarkdownSummary,
    exportUnifiedDiff: runUnifiedDiff,
    getSummaryContent,
    getFormData,
    getFieldName,
    handleExportContent: getValue,
    handleExportSummary: () => runMarkdownSummary().markdown,
    handleExportJSON,
    handleExportDiff: () => runUnifiedDiff().diff,
    handleExportComments: () => exportCommentsMarkdown(getState()),
  };
}
