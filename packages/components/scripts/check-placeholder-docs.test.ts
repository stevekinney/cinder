import { describe, expect, it } from 'bun:test';

import {
  findPlaceholderViolations,
  hasRequiredAccessibilityRecord,
} from './check-placeholder-docs.ts';

describe('findPlaceholderViolations', () => {
  it('marks generated component README records as requiring an accessibility file', () => {
    expect(hasRequiredAccessibilityRecord('<!-- generated:a11y-record:required -->')).toBe(true);
    expect(hasRequiredAccessibilityRecord('# Existing component')).toBe(false);
  });
  it('rejects design and accessibility placeholders when accessibility review applies', () => {
    const violations = findPlaceholderViolations(
      '## Design review (required)\n- Reviewer: _Pending\n- Review outcome: done\n- Nearest neighbours: known\n- Why this component exists: reason\n\n## Novel interaction accessibility review\n- Applies: yes — reason\nDesign: _Pending\nKeyboard: _Record',
      'component.a11y.md',
    );
    expect(violations.map(({ phrase }) => phrase)).toEqual([
      '_Pending',
      '_Pending',
      '_Record',
      'accessibility review field',
      'accessibility review field',
      'accessibility section',
      'accessibility section',
      'accessibility section',
    ]);
  });
  it('allows accessibility-only placeholders when review does not apply', () => {
    expect(
      findPlaceholderViolations(
        '## Design review (required)\n- Reviewer: Sam\n- Review outcome: approved\n- Nearest neighbours: Button\n- Why this component exists: reason\n\n## Novel interaction accessibility review\nApplies: no — this component is non-interactive.\nKeyboard: _Pending\nFocus: _Record',
        'component.a11y.md',
      ),
    ).toEqual([]);
  });
  it('rejects keyboard tables whose data rows contain no cells', () => {
    const violations = findPlaceholderViolations(
      '## Design review (required)\n- Reviewer: Sam\n- Review outcome: approved\n- Nearest neighbours: Button\n- Why this component exists: reason\n\n## Novel interaction accessibility review\n- Applies: yes — reason\n### Focus management\nDocumented\n### Keyboard matrix\n| Key | Action |\n| --- | --- |\n| | |\n### Assistive-technology announcements\nDocumented',
      'component.a11y.md',
    );
    expect(violations.filter(({ phrase }) => phrase === 'accessibility section')).toHaveLength(1);
  });
  it('scans design placeholders when accessibility appears first', () => {
    const violations = findPlaceholderViolations(
      '## Novel interaction accessibility review\n- Applies: no — static component\n\n## Design review (required)\n- Reviewer: _Pending\n- Review outcome: _Pending\n- Nearest neighbours: _Pending\n- Why this component exists: _Pending',
      'component.a11y.md',
    );
    expect(violations.some(({ phrase }) => phrase === '_Pending')).toBe(true);
  });
  it('rejects keyboard rows with missing expected behavior cells', () => {
    const violations = findPlaceholderViolations(
      '## Design review (required)\n- Reviewer: Sam\n- Review outcome: approved\n- Nearest neighbours: Button\n- Why this component exists: reason\n\n## Novel interaction accessibility review\n- Applies: yes — reason\n### Focus management\nDocumented\n### Keyboard matrix\n| Key | Action |\n| --- | --- |\n| Tab | |\n### Assistive-technology announcements\nDocumented',
      'component.a11y.md',
    );
    expect(violations.filter(({ phrase }) => phrase === 'accessibility section')).toHaveLength(1);
  });
  it('rejects keyboard rows with missing columns', () => {
    const violations = findPlaceholderViolations(
      '## Design review (required)\n- Reviewer: Sam\n- Review outcome: approved\n- Nearest neighbours: Button\n- Why this component exists: reason\n\n## Novel interaction accessibility review\n- Applies: yes — reason\n### Focus management\nDocumented\n### Keyboard matrix\n| Key | Context | Expected behavior |\n| --- | --- | --- |\n| Tab | dialog |\n### Assistive-technology announcements\nDocumented',
      'component.a11y.md',
    );
    expect(violations.filter(({ phrase }) => phrase === 'accessibility section')).toHaveLength(1);
  });
  it('rejects an empty accessibility record', () => {
    expect(findPlaceholderViolations('', 'component.a11y.md')).toEqual([
      expect.objectContaining({ phrase: 'accessibility record' }),
    ]);
  });
  it('parses bulleted applicability and scopes accessibility placeholders to its section', () => {
    const appliesNo = findPlaceholderViolations(
      '## Design review (required)\n- Reviewer: _Pending\n- Review outcome: done\n- Nearest neighbours: known\n- Why this component exists: reason\n\n## Novel interaction accessibility review\n- Applies: no — static component\n- Reviewer: _Pending when this review applies.\n- Focus: _Record',
      'component.a11y.md',
    );
    expect(appliesNo.map(({ phrase }) => phrase)).toEqual(['_Pending']);

    const appliesYes = findPlaceholderViolations(
      '## Design review (required)\n- Reviewer: _Pending\n- Review outcome: done\n- Nearest neighbours: known\n- Why this component exists: reason\n\n## Novel interaction accessibility review\n- Applies: yes — reason\n- Reviewer: _Pending when this review applies.\n- Focus: _Record',
      'component.a11y.md',
    );
    expect(appliesYes.map(({ phrase }) => phrase)).toEqual([
      '_Pending',
      '_Pending when this review applies.',
      '_Record',
      'accessibility review field',
      'accessibility review field',
      'accessibility section',
      'accessibility section',
      'accessibility section',
    ]);
  });
  it('rejects design placeholders regardless of accessibility applicability', () => {
    const violations = findPlaceholderViolations(
      'Applies: no — this component is non-interactive.\nDesign: Replace this sentence',
      'component.a11y.md',
    );
    expect(violations.map(({ phrase }) => phrase)).toEqual([
      'design review heading',
      'accessibility heading',
      'Replace this sentence',
    ]);
  });
  it('scans README records for all placeholder layers', () => {
    const violations = findPlaceholderViolations(
      'Applies: no\nDesign: _Pending\nAccessibility: _Record',
      'README.md',
    );
    expect(violations.map(({ phrase }) => phrase)).toEqual(['_Pending', '_Record']);
  });
  it('requires the generated design heading and required fields', () => {
    const violations = findPlaceholderViolations('Applies: no', 'component.a11y.md');
    expect(violations.some(({ phrase }) => phrase === 'design review heading')).toBe(true);
    expect(violations.filter(({ phrase }) => phrase === 'design review field')).toHaveLength(0);
  });
  it('rejects an empty manual design section and a deleted section', () => {
    const empty = findPlaceholderViolations(
      '## Design review (required)\n\nApplies: no',
      'component.a11y.md',
    );
    expect(empty.filter(({ phrase }) => phrase === 'design review field')).toHaveLength(4);
    const deleted = findPlaceholderViolations(
      '## Novel interaction accessibility review\n- Applies: no',
      'component.a11y.md',
    );
    expect(deleted.some(({ phrase }) => phrase === 'design review heading')).toBe(true);
  });
  it('requires non-whitespace design field values in design-only records', () => {
    const violations = findPlaceholderViolations(
      '## Design review (required)\n- Reviewer:   \n- Review outcome: approved\n- Nearest neighbours: Button\n- Why this component exists: reason',
      'component.a11y.md',
    );
    expect(violations.filter(({ phrase }) => phrase === 'design review field')).toHaveLength(1);
  });
  it('requires complete accessibility sections when Applies is yes', () => {
    const violations = findPlaceholderViolations(
      '## Design review (required)\n- Reviewer: Sam\n- Review outcome: approved\n- Nearest neighbours: Button\n- Why this component exists: reason\n\n## Novel interaction accessibility review\n- Applies: yes — interactive\n- Reviewer: Sam\n- Review outcome: approved\n\n### Focus management\nDocumented\n\n### Keyboard matrix\n| Key or gesture | Context | Expected behavior |\n| --- | --- | --- |\n| Tab | dialog | Moves focus |\n\n### Assistive-technology announcements\nDocumented',
      'component.a11y.md',
    );
    expect(violations).toEqual([]);
    expect(
      findPlaceholderViolations(
        '## Design review (required)\n- Reviewer: Sam\n- Review outcome: approved\n- Nearest neighbours: Button\n- Why this component exists: reason\n\n## Novel interaction accessibility review\n- Applies: yes — interactive\n- Reviewer: Sam\n- Review outcome: approved\n\n### Focus management\n\n### Keyboard matrix\nDocumented',
        'component.a11y.md',
      ).filter(({ phrase }) => phrase === 'accessibility section'),
    ).toHaveLength(3);
  });
  it('does not accept an Applies decision outside the accessibility section', () => {
    const violations = findPlaceholderViolations(
      '## Design review (required)\n- Reviewer: Sam\n- Review outcome: approved\n- Nearest neighbours: Button\n- Why this component exists: reason\n- Applies: no — unrelated\n\n## Novel interaction accessibility review\n### Focus management\nDocumented\n### Keyboard matrix\nDocumented\n### Assistive-technology announcements\nDocumented',
      'component.a11y.md',
    );
    expect(violations.some(({ phrase }) => phrase === 'Applies contract')).toBe(true);
  });
});
