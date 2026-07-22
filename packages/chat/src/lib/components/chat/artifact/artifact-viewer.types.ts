import type { Snippet } from 'svelte';

export type ArtifactContentType = 'html' | 'svg' | 'code' | 'mermaid';

/** Serializable artifact descriptor stored in conversation message metadata. */
export type ChatArtifact = {
  type: ArtifactContentType;
  content: string;
  language?: string;
  title?: string;
};

/** Consumer-owned Mermaid rendering snippet. */
export type MermaidRenderer = Snippet<[content: string, type: 'mermaid']>;

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
};
