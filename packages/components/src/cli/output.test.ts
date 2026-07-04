import { describe, expect, it } from 'bun:test';

import { formatDetail, formatHelp } from './output.ts';
import type { ComponentDetail, ManifestComponent } from './types.ts';

const minimalComponent: ManifestComponent = {
  name: 'Empty Guidance',
  id: 'empty-guidance',
  import: "import { EmptyGuidance } from '@lostgradient/cinder/empty-guidance';",
  exportName: 'EmptyGuidance',
  category: 'test',
  status: 'stable',
  purpose: 'Exercises empty guidance formatting.',
  tags: [],
  useWhen: [],
  avoidWhen: [],
  related: [],
  hasConstraints: false,
  hasExamples: false,
  artifacts: {
    schema: './empty-guidance.schema.json',
    variables: './empty-guidance.variables.json',
  },
};

describe('CLI text formatting', () => {
  it('documents tag filtering on search usage', () => {
    expect(formatHelp()).toContain(
      'cinder search <query> [--category <id>] [--status <level>] [--tag <tag>] [--limit <n>] [--json]',
    );
  });

  it('prints fallback guidance when a component has no useWhen entries', () => {
    const detail: ComponentDetail = {
      component: minimalComponent,
      overlapFamilies: [],
      schema: {},
      variables: {},
    };

    expect(formatDetail(detail)).toContain('Use when:\n  No guidance listed.');
  });
});
