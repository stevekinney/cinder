import { describe, expect, it } from 'bun:test';

import {
  formatBestPractices,
  formatComparison,
  formatDetail,
  formatHelp,
  formatList,
  formatSearch,
  jsonEnvelope,
  jsonError,
} from './output.ts';
import type {
  BestPracticeSection,
  ComponentComparison,
  ComponentDetail,
  ManifestComponent,
  PackageSummary,
} from './types.ts';

const minimalComponent: ManifestComponent = {
  name: 'Empty Guidance',
  id: 'empty-guidance',
  import: '@lostgradient/cinder/empty-guidance',
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
  it('prints deterministic JSON envelopes and errors', () => {
    const packageSummary: PackageSummary = {
      name: '@lostgradient/cinder',
      version: '0.0.0-test',
    };

    expect(JSON.parse(jsonEnvelope(packageSummary, 'list', [{ id: 'button' }]))).toEqual({
      package: packageSummary,
      command: 'list',
      data: [{ id: 'button' }],
    });
    expect(JSON.parse(jsonError('BAD_QUERY', 'Query is required.', ['Try button.']))).toEqual({
      error: {
        code: 'BAD_QUERY',
        message: 'Query is required.',
        suggestions: ['Try button.'],
      },
    });
  });

  it('renders copyable import statements in list output', () => {
    expect(formatList([{ ...minimalComponent, overlapFamilies: [] }])).toContain(
      "import { EmptyGuidance } from '@lostgradient/cinder/empty-guidance';",
    );
    expect(formatList([])).toBe('No Cinder components matched.');
  });

  it('renders search results with fallback guidance and matched metadata', () => {
    expect(formatSearch([])).toBe('No Cinder components matched.');
    expect(
      formatSearch([
        {
          ...minimalComponent,
          overlapFamilies: [],
          score: 7,
          matched: [],
        },
      ]),
    ).toContain('Use when: No guidance listed.\n  Matched: n/a');
  });

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

  it('prints detailed guidance, sidecars, comparisons, and best practices', () => {
    const componentWithGuidance: ManifestComponent = {
      ...minimalComponent,
      useWhen: ['Rendering primary product navigation.'],
      avoidWhen: [{ reason: 'Showing a breadcrumb trail.', alternative: 'breadcrumbs' }],
      hasConstraints: true,
      hasExamples: true,
      artifacts: {
        ...minimalComponent.artifacts,
        examples: './empty-guidance.examples.json',
        constraints: './empty-guidance.constraints.json',
      },
    };
    const detail: ComponentDetail = {
      component: componentWithGuidance,
      overlapFamilies: ['navigation'],
      schema: {},
      variables: {},
    };
    const comparison: ComponentComparison = {
      components: [
        { ...componentWithGuidance, overlapFamilies: ['navigation'] },
        { ...minimalComponent, id: 'other', overlapFamilies: ['navigation'] },
      ],
      sharedOverlapFamilies: {
        navigation: ['empty-guidance', 'other'],
      },
      guidance: ['Prefer the component with the closest semantic contract.'],
    };
    const sections: BestPracticeSection[] = [
      {
        topic: 'styles',
        title: 'Styles',
        guidance: ['Import the base stylesheet once.'],
      },
    ];

    expect(formatDetail(detail)).toContain('Examples: ./empty-guidance.examples.json');
    expect(formatDetail(detail)).toContain('Constraints: ./empty-guidance.constraints.json');
    expect(formatComparison(comparison)).toContain(
      'Shared overlap families:\n  - navigation: empty-guidance, other',
    );
    expect(formatBestPractices(sections)).toBe('Styles\n  - Import the base stylesheet once.');
  });
});
