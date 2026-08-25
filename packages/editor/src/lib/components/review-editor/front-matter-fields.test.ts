/// <reference lib="dom" />
import { cleanup, fireEvent, render } from '@testing-library/svelte';
import { afterEach, describe, expect, mock, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';
import FrontMatterFields from './front-matter-fields.svelte';

setupHappyDom();

afterEach(() => {
  cleanup();
});

function queryTextarea(): HTMLTextAreaElement {
  const textarea = document.body.querySelector('textarea');
  if (!textarea) throw new Error('Expected a rendered <textarea>');
  return textarea;
}

describe('FrontMatterFields raw-YAML editing', () => {
  test('renders the raw-YAML textarea with variant="code"', () => {
    const onchange = mock((_data: Record<string, unknown> | null) => {});
    render(FrontMatterFields, {
      props: { id: 'fm', data: null, raw: '', onchange },
    });

    const textarea = queryTextarea();
    expect(textarea.getAttribute('data-cinder-variant')).toBe('code');
  });

  test('renders a complex-value field textarea with variant="code"', () => {
    const onchange = mock((_data: Record<string, unknown> | null) => {});
    render(FrontMatterFields, {
      props: { id: 'fm', data: { tags: ['a', 'b'] }, raw: 'tags:\n  - a\n  - b', onchange },
    });

    const textarea = queryTextarea();
    expect(textarea.getAttribute('data-cinder-variant')).toBe('code');
  });

  test('rejects non-object-shaped YAML instead of silently discarding it (cinder#1325 follow-up)', async () => {
    // The intentionally-empty front matter case renders the raw-YAML
    // textarea (data: null, raw: '').
    const onchange = mock((_data: Record<string, unknown> | null) => {});
    render(FrontMatterFields, {
      props: { id: 'fm', data: null, raw: '', onchange },
    });

    const textarea = queryTextarea();

    // `- one` is syntactically valid YAML (an array), so validateFrontMatter
    // alone says "valid" -- before the fix, that was enough to commit
    // `onchange(null)`, which the parent round-trips back to the document's
    // previous (empty) front matter, discarding the input with no error
    // shown.
    await fireEvent.input(textarea, { target: { value: '- one' } });

    expect(onchange).not.toHaveBeenCalled();
    expect(textarea.value).toBe('- one'); // the draft is not silently reverted
  });

  test('shows a validation error for the rejected input, not silence', async () => {
    const onchange = mock((_data: Record<string, unknown> | null) => {});
    render(FrontMatterFields, {
      props: { id: 'fm', data: null, raw: '', onchange },
    });

    const textarea = queryTextarea();
    await fireEvent.input(textarea, { target: { value: '- one' } });

    // The Textarea component renders its `error` prop into the DOM;
    // asserting some non-empty error text is present is a coarser check
    // than pinning the exact copy, but distinguishes "silently did
    // nothing" from "told the user something was wrong."
    expect(document.body.textContent).toContain('mapping');
  });

  test('still commits real object-shaped front matter', async () => {
    const onchange = mock((_data: Record<string, unknown> | null, _raw?: string | null) => {});
    render(FrontMatterFields, {
      props: { id: 'fm', data: null, raw: '', onchange },
    });

    const textarea = queryTextarea();
    await fireEvent.input(textarea, { target: { value: 'title: Hello' } });

    expect(onchange).toHaveBeenCalledWith({ title: 'Hello' }, 'title: Hello');
  });

  test('still commits clearing the field back to empty', async () => {
    const onchange = mock((_data: Record<string, unknown> | null, _raw?: string | null) => {});
    render(FrontMatterFields, {
      props: { id: 'fm', data: null, raw: 'title: Hello', onchange },
    });

    const textarea = queryTextarea();
    await fireEvent.input(textarea, { target: { value: '' } });

    // Genuinely blank content: `parseFrontMatter` reports `raw: null`
    // (nothing between the fences to preserve), so this really is a
    // removal, not the comment-only case below.
    expect(onchange).toHaveBeenCalledWith(null, null);
  });

  test('committing a comment-only block passes the raw text through, not just null data (cinder#1330 round-6 finding)', async () => {
    // Before the fix: `handleRawInput` called `onchange(parsed.data)` --
    // `null` for a comment-only block, indistinguishable from "genuinely
    // empty" -- and the parent (`replaceFrontMatterData`) collapsed it to
    // a bare `---\n---\n`, discarding whatever the user typed with no
    // error shown.
    const onchange = mock((_data: Record<string, unknown> | null, _raw?: string | null) => {});
    render(FrontMatterFields, {
      props: { id: 'fm', data: null, raw: '# TODO: fill this in', onchange },
    });

    const textarea = queryTextarea();
    await fireEvent.input(textarea, { target: { value: '# DONE' } });

    // No error shown -- comment-only content is valid, recognized front
    // matter (cinder#1325's round-5 follow-up) -- and the raw text is
    // passed as the second argument so the parent can preserve it.
    expect(document.body.textContent).not.toContain('mapping');
    expect(onchange).toHaveBeenCalledWith(null, '# DONE');
  });
});
