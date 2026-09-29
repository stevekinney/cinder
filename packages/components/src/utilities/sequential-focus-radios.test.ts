/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '@lostgradient/testing';

setupHappyDom();

const { getSequentialFocusTargets } = await import('./focus.ts');

afterEach(() => {
  // Blur any lingering focus so each test starts clean.
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
  // Drop any test-added buttons.
  for (const button of document.body.querySelectorAll('button')) {
    button.remove();
  }
});

describe('getSequentialFocusTargets', () => {
  test('exposes one radio per same-name group, preferring checked or first eligible', () => {
    const region = document.createElement('div');
    const first = document.createElement('input');
    first.type = 'radio';
    first.name = 'choice';
    first.setAttribute('tabindex', '0');
    const checked = document.createElement('input');
    checked.type = 'radio';
    checked.name = 'choice';
    checked.checked = true;
    checked.setAttribute('tabindex', '0');
    const other = document.createElement('input');
    other.type = 'radio';
    other.name = 'other';
    other.setAttribute('tabindex', '0');
    region.append(first, checked, other);
    document.body.append(region);

    const targets = getSequentialFocusTargets(region);
    expect(targets).not.toContain(first);
    expect(targets).toContain(checked);
    expect(targets).toContain(other);
    region.remove();
  });

  test('uses the last DOM-order radio as the "before" group representative when none is checked', () => {
    // Native reverse Tab enters an unchecked same-name radio group at its
    // LAST member in DOM order — the mirror of forward Tab's first-member
    // entry point. The checked member wins in both directions when present,
    // but an unchecked group's representative must be direction-aware.
    //
    // `first` and `last` are structurally identical apart from id, so this
    // asserts on object identity (`toBe`) rather than `toEqual`: two
    // distinct-but-attribute-identical elements compare equal under
    // `toEqual`, which would let the wrong representative pass silently.
    const region = document.createElement('div');
    const first = document.createElement('input');
    first.type = 'radio';
    first.name = 'choice';
    first.id = 'radio-first';
    first.setAttribute('tabindex', '0');
    const last = document.createElement('input');
    last.type = 'radio';
    last.name = 'choice';
    last.id = 'radio-last';
    last.setAttribute('tabindex', '0');
    const reference = document.createElement('span');
    region.append(first, last, reference);
    document.body.append(region);

    const result = getSequentialFocusTargets(region, {
      relativeTo: reference,
      direction: 'before',
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(last);
    region.remove();
  });

  test('skips an unchecked radio when its checked group member is outside the requested region', () => {
    const checked = document.createElement('input');
    checked.type = 'radio';
    checked.name = 'external';
    checked.checked = true;
    const region = document.createElement('div');
    const candidate = document.createElement('input');
    candidate.type = 'radio';
    candidate.name = 'external';
    candidate.tabIndex = 0;
    region.append(candidate);
    document.body.append(checked, region);

    expect(getSequentialFocusTargets(region)).not.toContain(candidate);
    region.remove();
    checked.remove();
  });

  test('groups radios by their external form owner', () => {
    const form = document.createElement('form');
    form.id = 'external-radio-form';
    const checked = document.createElement('input');
    checked.type = 'radio';
    checked.name = 'external-form-choice';
    checked.checked = true;
    form.append(checked);
    const region = document.createElement('div');
    const candidate = document.createElement('input');
    candidate.type = 'radio';
    candidate.name = checked.name;
    candidate.setAttribute('form', form.id);
    candidate.tabIndex = 0;
    region.append(candidate);
    document.body.append(form, region);

    expect(getSequentialFocusTargets(region)).not.toContain(candidate);
    region.remove();
    form.remove();
  });

  test('keeps unnamed radios as independent tab stops', () => {
    const region = document.createElement('div');
    const first = document.createElement('input');
    first.type = 'radio';
    first.setAttribute('tabindex', '0');
    const second = document.createElement('input');
    second.type = 'radio';
    second.setAttribute('tabindex', '0');
    region.append(first, second);
    document.body.append(region);

    const targets = getSequentialFocusTargets(region);
    expect(targets).toContain(first);
    expect(targets).toContain(second);
    region.remove();
  });

  test('recognizes a radio from a foreign document without instanceof checks', () => {
    const foreignDocument = new DOMParser().parseFromString(
      '<input type="radio" name="foreign" tabindex="0">',
      'text/html',
    );
    const foreignRadio = foreignDocument.querySelector('input');
    if (!foreignRadio) throw new Error('Expected the foreign-document radio');
    expect(getSequentialFocusTargets(foreignDocument)).toContain(foreignRadio);
  });
});
