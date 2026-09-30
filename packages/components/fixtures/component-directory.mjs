/** Locate a component's published subpaths from its manifest schema artifact. */
export function componentDirectory(id, schemaArtifactPath) {
  return typeof schemaArtifactPath === 'string' &&
    schemaArtifactPath.startsWith('src/components/experimental/')
    ? `experimental/${id}`
    : id;
}
