import type { BestPracticeSection, BestPracticeTopic } from './types.ts';

export const bestPracticeSections: Record<
  Exclude<BestPracticeTopic, 'all'>,
  BestPracticeSection
> = {
  imports: {
    topic: 'imports',
    title: 'Imports',
    guidance: [
      'Import the base stylesheet once at the app entry before any component sidecar styles.',
      'Prefer component subpaths such as @lostgradient/cinder/button in application code for the smallest import graph.',
      'Use the root barrel when convenience matters more than per-file tree-shaking.',
      'Use the kebab-case manifest id when cross-referencing components in tools or generated code.',
    ],
  },
  styles: {
    topic: 'styles',
    title: 'Styles',
    guidance: [
      'Load @lostgradient/cinder/styles first; it declares cascade layer order, tokens, foundation rules, utilities, and shared internal chrome.',
      'Import @lostgradient/cinder/<component>/styles beside each component when using the slim, tree-shaken CSS path.',
      'Use @lostgradient/cinder/styles/all only when shipping every component style is acceptable.',
      'Override public --cinder-* tokens and component root classes; do not redefine private --_cinder-* variables.',
    ],
  },
  metadata: {
    topic: 'metadata',
    title: 'Metadata',
    guidance: [
      'Read @lostgradient/cinder/manifest first; it is the authoritative component index for agents.',
      'Use schema and variables artifacts for prop contracts and CSS custom-property names.',
      'Fetch examples only when hasExamples is true and constraints only when hasConstraints is true.',
      'Treat constraints as the source for cross-prop rules that JSON Schema cannot express cleanly.',
    ],
  },
  overlap: {
    topic: 'overlap',
    title: 'Overlap Decisions',
    guidance: [
      'Use overlapFamilies when multiple components solve similar problems.',
      'Prefer each candidate component useWhen and avoidWhen guidance over name similarity.',
      'Compare related components before introducing bespoke UI for overlays, notices, selection controls, hover surfaces, or tabs.',
      'When no Cinder component fits, compose from Cinder primitives before introducing a fully bespoke surface.',
    ],
  },
};
