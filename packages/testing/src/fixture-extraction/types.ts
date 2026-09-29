import type { VisualFixture, VisualFixtureMetadata } from '../visual-fixtures.ts';

export type FixtureFileEntry = {
  componentName: string;
  sourcePath: string;
  contentHash: string;
  fixtures: VisualFixture[];
  metadata: VisualFixtureMetadata;
};

export type FixtureExtractResult = {
  entries: FixtureFileEntry[];
  violations: string[];
};

export type FileParseResult =
  | { kind: 'entry'; entry: FixtureFileEntry }
  | { kind: 'violations'; violations: string[] }
  | { kind: 'skipped' };
