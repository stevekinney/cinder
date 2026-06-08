import type { CodeBlockInfo } from '@cinder/markdown/rendering/types';

import type { ComponentManifest } from './types.ts';

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

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
  avoidWhen: string[];
  related: string[];
  hasConstraints: boolean;
  hasExamples: boolean;
  artifacts: {
    schema: string;
    variables: string;
    constraints?: string;
    examples?: string;
  };
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
