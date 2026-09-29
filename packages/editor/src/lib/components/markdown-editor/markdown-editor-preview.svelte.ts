/**
 * MarkdownEditor's preview: a rendered, read-only view of a derived copy of
 * the template. Nothing here writes to `value`.
 *
 * The renderer arrives through a dynamic import that starts only in a client
 * effect, so server rendering and the first hydration pass both show the
 * loading state. The import resolves to the rendering functions, never to
 * HTML: the HTML is derived synchronously from the current inputs, so a
 * render can never be older than the inputs it shows. A teardown flag stops a
 * late import from committing into a destroyed editor.
 *
 * Values are read only to render and diagnose. They are never copied into
 * state, logged or persisted, and diagnostics never contain them.
 */

import type {
  JsonObject,
  PlaceholderDefinitions,
  PlaceholderDiagnostic,
  PlaceholderValueMode,
} from '@lostgradient/markdown';

import { classifyPlaceholderValues } from '../../editor/template-placeholder-configuration.ts';
import { isPlaceholderValueMode } from './markdown-editor-mode.ts';

/** The rendering functions preview needs from `@lostgradient/markdown`. */
export type PreviewRenderer = Pick<
  typeof import('@lostgradient/markdown'),
  'renderMarkdown' | 'renderTemplate' | 'resolveTemplatePlaceholders' | 'sortPlaceholderDiagnostics'
>;

/** Whether preview fills the template, and with what. */
export type PreviewFill =
  | {
      readonly kind: 'unfilled';
      /**
       * Whether the source is a placeholder template the caller configured
       * (definitions or values supplied), so the preview is labeled unfilled.
       */
      readonly template: boolean;
    }
  | {
      readonly kind: 'filled';
      readonly definitions: PlaceholderDefinitions;
      readonly values: JsonObject;
      readonly valueMode: PlaceholderValueMode;
    };

/** What the preview region shows. */
export type PreviewView =
  | { readonly status: 'loading' }
  | {
      readonly status: 'ready';
      readonly filled: boolean;
      /** Whether an unfilled preview shows a configured template rather than plain Markdown. */
      readonly template: boolean;
      /** Sanitized HTML from the Markdown rendering pipeline. */
      readonly html: string;
      /** A filled preview's diagnostics; `undefined` for an unfilled one. */
      readonly diagnostics: readonly PlaceholderDiagnostic[] | undefined;
    };

export interface PlanPreviewFillInput {
  readonly definitions: PlaceholderDefinitions | undefined;
  readonly values: unknown;
  readonly valueMode: unknown;
  /** Whether the definitions produced a usable catalog with no configuration conflict. */
  readonly catalogEnabled: boolean;
}

const LOADING: PreviewView = Object.freeze({ status: 'loading' });

/**
 * A plain top-level object. Its entries are validated by the resolver, which
 * reads only declared paths and reports invalid data instead of using it.
 */
function isPlainValues(values: unknown): values is JsonObject {
  return classifyPlaceholderValues(values) === 'plain';
}

/**
 * Fill only with usable definitions, a plain values object and a valid value
 * mode. Anything else previews the unfilled template; the configuration
 * diagnostics explain why.
 */
export function planPreviewFill({
  definitions,
  values,
  valueMode,
  catalogEnabled,
}: PlanPreviewFillInput): PreviewFill {
  const unfilled: PreviewFill = {
    kind: 'unfilled',
    template: definitions !== undefined || values !== undefined,
  };
  if (definitions === undefined || !catalogEnabled) return unfilled;
  if (!isPlainValues(values)) return unfilled;
  if (!isPlaceholderValueMode(valueMode)) return unfilled;
  return { kind: 'filled', definitions, values, valueMode: valueMode ?? 'text' };
}

/** Render one preview synchronously with a loaded renderer. */
export function renderPreview(
  renderer: PreviewRenderer,
  source: string,
  fill: PreviewFill,
  configurationIssues: readonly PlaceholderDiagnostic[],
): PreviewView {
  if (fill.kind === 'unfilled') {
    return Object.freeze({
      status: 'ready',
      filled: false,
      template: fill.template,
      html: renderer.renderMarkdown(source).html,
      diagnostics: undefined,
    });
  }
  const options = {
    definitions: fill.definitions,
    valueMode: fill.valueMode,
    unresolved: 'preserve',
  } as const;
  const { issues } = renderer.resolveTemplatePlaceholders(source, fill.values, options);
  return Object.freeze({
    status: 'ready',
    filled: true,
    template: true,
    html: renderer.renderTemplate(source, fill.values, options),
    diagnostics: Object.freeze(
      renderer.sortPlaceholderDiagnostics([...configurationIssues, ...issues]),
    ),
  });
}

function loadRenderer(): Promise<PreviewRenderer> {
  return import('@lostgradient/markdown');
}

function reportError(error: unknown): void {
  if (typeof globalThis.reportError === 'function') globalThis.reportError(error);
  else throw error;
}

/** Reactive reads of the component state preview depends on. */
export interface MarkdownEditorPreviewOptions {
  /** Whether preview is the current mode. The renderer loads on first activation. */
  active: () => boolean;
  /** The template: the component's Markdown `value`. */
  source: () => string;
  fill: () => PreviewFill;
  /** Definition and configuration diagnostics included with a filled preview's. */
  configurationIssues: () => readonly PlaceholderDiagnostic[];
  /** Loads the renderer. Defaults to importing `@lostgradient/markdown`. */
  load?: () => Promise<PreviewRenderer>;
}

/** Create the preview state. Call during component (or effect-root) initialization. */
export function createMarkdownEditorPreview(options: MarkdownEditorPreviewOptions) {
  const load = options.load ?? loadRenderer;
  let renderer = $state.raw<PreviewRenderer | null>(null);
  let requested = false;
  let destroyed = false;

  $effect(() => () => {
    destroyed = true;
  });

  // Effects never run on the server, so the renderer is only requested after
  // client mount.
  $effect(() => {
    if (!options.active() || requested) return;
    requested = true;
    void load().then(
      (module) => {
        if (!destroyed) renderer = module;
        return undefined;
      },
      (error: unknown) => {
        requested = false;
        reportError(error);
      },
    );
  });

  const view = $derived.by((): PreviewView => {
    if (renderer === null || !options.active()) return LOADING;
    return renderPreview(renderer, options.source(), options.fill(), options.configurationIssues());
  });

  return {
    get view(): PreviewView {
      return view;
    },
    /** A filled preview's diagnostics while it shows; otherwise `undefined`. */
    get diagnostics(): readonly PlaceholderDiagnostic[] | undefined {
      return view.status === 'ready' ? view.diagnostics : undefined;
    },
  };
}
