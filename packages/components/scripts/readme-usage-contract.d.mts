export declare function discoverReadmeComponents(
  rootDirectory: string,
): Array<{ componentId: string; directory: string }>;

export declare function toIdentifier(id: string): string;

export declare const COMPOSE_ONLY_LEAF_EXEMPTIONS: ReadonlySet<string>;

export declare const DOTTED_NAMESPACE_ONLY_EXEMPTIONS: ReadonlySet<string>;
