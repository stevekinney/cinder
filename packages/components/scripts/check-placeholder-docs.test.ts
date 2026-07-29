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
  it('rejects case-insensitive pending design placeholders', () => {
    const violations = findPlaceholderViolations(
      '## Design review (required)\n- Reviewer: _pending — name the reviewer before merge.\n- Review outcome: approved\n- Nearest neighbours: Button\n- Why this component exists: reason\n\n## Novel interaction accessibility review\n- Applies: no — static',
      'component.a11y.md',
    );
    expect(violations.some(({ phrase }) => phrase === '_Pending')).toBe(true);
  });
  it('rejects case-insensitive record placeholders', () => {
    const violations = findPlaceholderViolations(
      'Applies: no\nAccessibility: _record',
      'README.md',
    );
    expect(violations.map(({ phrase }) => phrase)).toContain('_Record');
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
  it('does not treat the generated keyboard header as behavior', () => {
    const violations = findPlaceholderViolations(
      '## Design review (required)\n- Reviewer: Sam\n- Review outcome: approved\n- Nearest neighbours: Button\n- Why this component exists: reason\n\n## Novel interaction accessibility review\n- Applies: yes — reason\n### Focus management\nDocumented\n### Keyboard matrix\n| Key or gesture | Context | Expected behavior |\n| --- | --- | --- |\n### Assistive-technology announcements\nDocumented',
      'component.a11y.md',
    );
    expect(violations.filter(({ phrase }) => phrase === 'accessibility section')).toHaveLength(1);
  });
  it('rejects accessibility scaffold instructions after the marker is removed', () => {
    const violations = findPlaceholderViolations(
      '## Design review (required)\n- Reviewer: Sam\n- Review outcome: approved\n- Nearest neighbours: Button\n- Why this component exists: reason\n\n## Novel interaction accessibility review\n- Applies: yes — interactive\n- Reviewer: Sam\n- Review outcome: approved\n\n### Focus management\n_Initial focus, focus movement, dismissal, restoration, and behavior\nwhen the trigger or focused target disappears._\n\n### Keyboard matrix\n| Tab | dialog | Moves focus |\n\n### Assistive-technology announcements\nDocumented',
      'component.a11y.md',
    );
    expect(
      violations.some(
        ({ phrase }) =>
          phrase === 'initial focus, focus movement, dismissal, restoration, and behavior',
      ),
    ).toBe(true);
  });
  it('does not accept a renamed generated keyboard header without a data row', () => {
    const violations = findPlaceholderViolations(
      '## Design review (required)\n- Reviewer: Sam\n- Review outcome: approved\n- Nearest neighbours: Button\n- Why this component exists: reason\n\n## Novel interaction accessibility review\n- Applies: yes — interactive\n- Reviewer: Sam\n- Review outcome: approved\n\n### Focus management\nDocumented\n\n### Keyboard matrix\n| Keyboard input | Context | Expected behavior |\n| --- | --- | --- |\n\n### Assistive-technology announcements\nDocumented',
      'component.a11y.md',
    );
    expect(violations.filter(({ phrase }) => phrase === 'accessibility section')).toHaveLength(1);
  });
  it('does not accept a header renamed beyond the allowlist without a data row', () => {
    const violations = findPlaceholderViolations(
      '## Design review (required)\n- Reviewer: Sam\n- Review outcome: approved\n- Nearest neighbours: Button\n- Why this component exists: reason\n\n## Novel interaction accessibility review\n- Applies: yes — interactive\n- Reviewer: Sam\n- Review outcome: approved\n\n### Focus management\nDocumented\n\n### Keyboard matrix\n| Keys | Context | Expected behavior |\n| --- | --- | --- |\n\n### Assistive-technology announcements\nDocumented',
      'component.a11y.md',
    );
    expect(violations.filter(({ phrase }) => phrase === 'accessibility section')).toHaveLength(1);
  });
  it('rejects an empty accessibility record', () => {
    expect(findPlaceholderViolations('', 'component.a11y.md')).toEqual([
      expect.objectContaining({ phrase: 'accessibility record' }),
    ]);
  });
  it('requires structure for marker-associated records', () => {
    expect(findPlaceholderViolations('# Review completed', 'component.a11y.md', true)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ phrase: 'design review heading' }),
        expect.objectContaining({ phrase: 'accessibility heading' }),
      ]),
    );
  });
  it('requires structure for manual accessibility records without markers', () => {
    const violations = findPlaceholderViolations('# Review completed', 'component.a11y.md');
    expect(violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ phrase: 'design review heading' }),
        expect.objectContaining({ phrase: 'accessibility heading' }),
      ]),
    );
  });
  it('rejects design review instruction scaffolds after marker removal', () => {
    const violations = findPlaceholderViolations(
      '## Design review (required)\n- Reviewer: name the reviewer before merge._\n- Review outcome: record approved or changes requested before merge._\n- Nearest neighbours: list the closest existing Cinder components._\n- Why this component exists: explain why composition or an existing neighbour is insufficient._\n\n## Novel interaction accessibility review\n- Applies: no — static component',
      'component.a11y.md',
    );
    expect(violations.filter(({ phrase }) => phrase.includes('before merge')).length).toBe(2);
    expect(violations.some(({ phrase }) => phrase.includes('closest existing'))).toBe(true);
    expect(violations.some(({ phrase }) => phrase.includes('composition'))).toBe(true);
  });
  it('allows completed prose beginning with Record', () => {
    expect(
      findPlaceholderViolations(
        '## Design review (required)\n- Reviewer: Sam\n- Review outcome: approved\n- Nearest neighbours: Button\n- Why this component exists: reason\n\n## Novel interaction accessibility review\n- Applies: no — static\n- Reviewer: Sam\n- Review outcome: n/a\n\n### Focus management\n_Recorded focus restoration with Safari and VoiceOver._',
        'component.a11y.md',
      ).some(({ phrase }) => phrase === '_Record'),
    ).toBe(false);
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
  it('does not exempt pending design fields that use the conditional accessibility wording', () => {
    const violations = findPlaceholderViolations(
      '## Design review (required)\n- Reviewer: _Pending when this review applies.\n- Review outcome: approved\n- Nearest neighbours: Button\n- Why this component exists: reason\n\n## Novel interaction accessibility review\n- Applies: no — static',
      'component.a11y.md',
    );
    expect(violations.map(({ phrase }) => phrase)).toContain('_Pending');
  });
  it('accepts keyboard rows without a trailing outer pipe', () => {
    const violations = findPlaceholderViolations(
      '## Design review (required)\n- Reviewer: Sam\n- Review outcome: approved\n- Nearest neighbours: Button\n- Why this component exists: reason\n\n## Novel interaction accessibility review\n- Applies: yes — interactive\n- Reviewer: Sam\n- Review outcome: approved\n\n### Focus management\nDocumented\n\n### Keyboard matrix\n| Key or gesture | Context | Expected behavior |\n| --- | --- | --- |\n| Tab | dialog | Moves focus\n\n### Assistive-technology announcements\nDocumented',
      'component.a11y.md',
    );
    expect(violations).toEqual([]);
  });
  it('accepts escaped pipes inside keyboard table cells', () => {
    const violations = findPlaceholderViolations(
      '## Design review (required)\n- Reviewer: Sam\n- Review outcome: approved\n- Nearest neighbours: Button\n- Why this component exists: reason\n\n## Novel interaction accessibility review\n- Applies: yes — interactive\n- Reviewer: Sam\n- Review outcome: approved\n\n### Focus management\nDocumented\n\n### Keyboard matrix\n| Key or gesture | Context | Expected behavior |\n| --- | --- | --- |\n| ArrowUp \\| ArrowDown | listbox | Moves focus |\n\n### Assistive-technology announcements\nDocumented',
      'component.a11y.md',
    );
    expect(violations).toEqual([]);
  });
  it('does not treat recorded accessibility outcomes as placeholders', () => {
    const violations = findPlaceholderViolations(
      '## Design review (required)\n- Reviewer: Sam\n- Review outcome: approved\n- Nearest neighbours: Button\n- Why this component exists: reason\n\n## Novel interaction accessibility review\n- Applies: yes — interactive\n- Reviewer: Sam\n- Review outcome: _Recorded as approved after changes._\n\n### Focus management\nDocumented\n### Keyboard matrix\n| Tab | dialog | Moves focus\n### Assistive-technology announcements\nDocumented',
      'component.a11y.md',
    );
    expect(violations.some(({ phrase }) => phrase === 'accessibility review field')).toBe(false);
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

  it('rejects the generated applicability explanation scaffold', () => {
    const violations = findPlaceholderViolations(
      '## Design review (required)\n- Reviewer: Sam\n- Review outcome: approved\n- Nearest neighbours: Button\n- Why this component exists: reason\n\n## Novel interaction accessibility review\n- Applies: no — record yes or no and explain the decision._',
      'component.a11y.md',
    );
    expect(violations.some(({ phrase }) => phrase === 'Applies contract')).toBe(true);
  });
});
