import type { Snippet } from 'svelte';

export type ArtifactContentType = 'html' | 'svg' | 'code' | 'mermaid';

/** Serializable artifact descriptor stored in conversation message metadata. */
export type ChatArtifact = {
  type: ArtifactContentType;
  content: string;
  language?: string;
  title?: string;
};

/** Artifact value resolved from message metadata for user-facing actions and panels. */
export type ResolvedChatArtifact = ChatArtifact & {
  /** Stable source message identity. Duplicate titles and content never collide. */
  id: string;
  /** Normalized non-empty title used for accessible names and panel chrome. */
  title: string;
};

/** Consumer-owned Mermaid rendering snippet. */
export type MermaidRenderer = Snippet<[content: string, type: 'mermaid']>;
export type CodeRenderer = Snippet<[content: string, type: 'code', language: string | undefined]>;

export type ArtifactViewerProps = {
  type: ArtifactContentType;
  content: string;
  language?: string;
  title?: string;
  /**
   * Renders Mermaid source with the consumer's chosen integration. Invoked only
   * for `type="mermaid"`; otherwise ArtifactViewer uses its built-in renderer.
   */
  mermaidRenderer?: MermaidRenderer;
  /** Renders code artifacts with a consumer-owned highlighter or viewer. */
  codeRenderer?: CodeRenderer;
};
