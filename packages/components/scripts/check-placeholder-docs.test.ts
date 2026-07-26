import { describe, expect, it } from 'bun:test';

import { findPlaceholderViolations } from './check-placeholder-docs.ts';

describe('findPlaceholderViolations', () => {
  it('rejects design and accessibility placeholders when accessibility review applies', () => {
    const violations = findPlaceholderViolations(
      'Applies: yes\nDesign: _Pending\nKeyboard: _Record',
      'component.a11y.md',
    );
    expect(violations.map(({ phrase }) => phrase)).toEqual(['_Pending', '_Record']);
  });
  it('allows accessibility-only placeholders when review does not apply', () => {
    expect(
      findPlaceholderViolations(
        'Applies: no — this component is non-interactive.\nKeyboard: _Pending\nFocus: _Record',
        'component.a11y.md',
      ),
    ).toEqual([]);
  });
  it('parses bulleted applicability and scopes accessibility placeholders to its section', () => {
    const appliesNo = findPlaceholderViolations(
      '## Design review (required)\n- Reviewer: _Pending\n\n## Novel interaction accessibility review\n- Applies: no — static component\n- Reviewer: _Pending when this review applies.\n- Focus: _Record',
      'component.a11y.md',
    );
    expect(appliesNo.map(({ phrase }) => phrase)).toEqual(['_Pending']);

    const appliesYes = findPlaceholderViolations(
      '## Design review (required)\n- Reviewer: _Pending\n\n## Novel interaction accessibility review\n- Applies: yes\n- Reviewer: _Pending when this review applies.\n- Focus: _Record',
      'component.a11y.md',
    );
    expect(appliesYes.map(({ phrase }) => phrase)).toEqual([
      '_Pending',
      '_Pending when this review applies.',
      '_Record',
    ]);
  });
  it('rejects design placeholders regardless of accessibility applicability', () => {
    const violations = findPlaceholderViolations(
      'Applies: no — this component is non-interactive.\nDesign: Replace this sentence',
      'component.a11y.md',
    );
    expect(violations.map(({ phrase }) => phrase)).toEqual(['Replace this sentence']);
  });
  it('scans README records for all placeholder layers', () => {
    const violations = findPlaceholderViolations(
      'Applies: no\nDesign: _Pending\nAccessibility: _Record',
      'README.md',
    );
    expect(violations.map(({ phrase }) => phrase)).toEqual(['_Pending', '_Record']);
  });
});
