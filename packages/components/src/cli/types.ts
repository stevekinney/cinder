export type AvoidWhen = {
  reason: string;
  alternative?: string;
};

export type ManifestComponent = {
  name: string;
  id: string;
  import: string;
  exportName: string;
  category: string;
  status: string;
  purpose: string;
  tags: string[];
  useWhen: string[];
  avoidWhen: AvoidWhen[];
  related: string[];
  hasConstraints: boolean;
  hasExamples: boolean;
  artifacts: {
    schema: string;
    variables: string;
    examples?: string;
    constraints?: string;
  };
  a11y?: {
    pattern?: string;
    keyboard?: Array<{ keys: string; action: string }>;
    notes?: string[];
  };
};

export type CinderManifest = {
  manifestVersion: 1;
  package: {
    name: string;
    version: string;
    framework: string;
    frameworkVersionRange: string;
    stylesEntry: string;
    schemaDialect: string;
  };
  categories: Record<string, { label: string; description: string }>;
  statusLevels: Record<string, string>;
  overlapFamilies: Record<string, string[]>;
  components: ManifestComponent[];
};

export type PackageSummary = {
  name: string;
  version: string;
};

export type ListOptions = {
  category?: string;
  status?: string;
  tag?: string;
};

export type SearchOptions = ListOptions & {
  limit?: number;
};

export type ComponentSummary = {
  id: string;
  name: string;
  exportName: string;
  import: string;
  category: string;
  status: string;
  purpose: string;
  tags: string[];
  useWhen: string[];
  avoidWhen: AvoidWhen[];
  related: string[];
  overlapFamilies: string[];
  hasExamples: boolean;
  hasConstraints: boolean;
};

export type SearchResult = ComponentSummary & {
  score: number;
  matched: string[];
};

export type ComponentDetail = {
  component: ManifestComponent;
  overlapFamilies: string[];
  schema: unknown;
  variables: unknown;
  examples?: unknown;
  constraints?: unknown;
};

export type ComponentComparison = {
  components: ComponentSummary[];
  sharedOverlapFamilies: Record<string, string[]>;
  guidance: string[];
};

export type BestPracticeTopic = 'imports' | 'styles' | 'metadata' | 'overlap' | 'all';

export type BestPracticeSection = {
  topic: Exclude<BestPracticeTopic, 'all'>;
  title: string;
  guidance: string[];
};

export class CinderKnowledgeError extends Error {
  readonly code: string;
  readonly suggestions: string[];

  constructor(code: string, message: string, suggestions: string[] = []) {
    super(message);
    this.name = 'CinderKnowledgeError';
    this.code = code;
    this.suggestions = suggestions;
  }
}
