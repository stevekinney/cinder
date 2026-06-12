import type { CodeBlockInfo } from '@cinder/markdown/rendering/types';

import type { ComponentManifest } from './types.ts';

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

/**
 * One "avoid when" guidance entry: a reason not to use the component plus an
 * optional kebab-case id of the component to reach for instead.
 */
export type AvoidWhenEntry = {
  reason: string;
  alternative?: string;
};

/** One keyboard interaction: a key (or chord) and what it does. */
export type KeyboardShortcut = {
  keys: string;
  action: string;
};

/** Accessibility metadata, present only when a11y tags were authored. */
export type A11yMetadata = {
  pattern?: string;
  keyboard?: KeyboardShortcut[];
  notes?: string[];
};

export type DocumentationComponentSummary = {
  id: string;
  name: string;
  importSpecifier: string;
  exportName: string;
  category: string;
  categoryLabel: string;
  categoryDescription: string;
  status: string;
  statusDescription: string;
  purpose: string;
  tags: string[];
  useWhen: string[];
  avoidWhen: AvoidWhenEntry[];
  related: string[];
  hasConstraints: boolean;
  hasExamples: boolean;
  artifacts: {
    schema: string;
    variables: string;
    constraints?: string;
    examples?: string;
  };
  /** Library-level package version (no per-component version exists). */
  packageVersion: string;
  /** Accessibility metadata, present only when a11y tags were authored. */
  a11y?: A11yMetadata;
};

export type DocumentationReadme = {
  rawMarkdown: string;
  html: string;
  codeBlocks: CodeBlockInfo[];
  hadUnsafeContent: boolean;
};

export type ComponentDocumentationRawArtifacts = {
  manifestEntry: JsonValue;
  schema: JsonValue;
  variables: JsonValue;
  constraints: JsonValue | null;
  examples: JsonValue | null;
};

export type ComponentDocumentationPayload = {
  component: DocumentationComponentSummary;
  readme: DocumentationReadme;
  propsManifest: ComponentManifest;
  schema: JsonValue;
  variables: JsonValue;
  constraints: JsonValue | null;
  examples: JsonValue | null;
  rawArtifacts: ComponentDocumentationRawArtifacts;
};
