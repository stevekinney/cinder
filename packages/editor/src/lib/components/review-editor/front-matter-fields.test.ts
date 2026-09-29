/// <reference lib="dom" />
import { cleanup, fireEvent, render } from '@testing-library/svelte';
import { afterEach, describe, expect, mock, test } from 'bun:test';

import { setupHappyDom } from '@lostgradient/testing';
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

  test('renders a complex-value field with JsonEditor', () => {
    const onchange = mock((_data: Record<string, unknown> | null) => {});
    render(FrontMatterFields, {
      props: {
        id: 'fm',
        data: { metadata: { owner: 'platform' } },
        raw: 'metadata:\n  owner: platform',
        onchange,
      },
    });

    const textarea = queryTextarea();
    expect(document.body.querySelector('.cinder-json-editor')).not.toBeNull();
    expect(textarea.value).toContain('"owner": "platform"');
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

  test('renders typed controls for scalar, tag, and structured values', () => {
    const onchange = mock((_data: Record<string, unknown> | null) => {});
    render(FrontMatterFields, {
      props: {
        id: 'fm',
        data: {
          title: 'Launch notes',
          priority: 2,
          published: false,
          tags: ['alpha', 'alpha', 'beta'],
          metadata: { owner: 'platform' },
          optional: null,
        },
        raw: [
          'title: Launch notes',
          'priority: 2',
          'published: false',
          'tags:',
          '  - alpha',
          '  - alpha',
          '  - beta',
          'metadata:',
          '  owner: platform',
          'optional:',
        ].join('\n'),
        onchange,
      },
    });

    expect(document.body.querySelector('.cinder-number-input')).not.toBeNull();
    expect(document.body.querySelector('.cinder-tag-input')).not.toBeNull();
    expect(document.body.querySelector('.cinder-json-editor')).not.toBeNull();
    expect(document.body.textContent).toContain('alpha');
    expect(document.body.textContent).toContain('beta');
  });

  test('tag edits preserve duplicate strings and call onchange with a string array', async () => {
    const onchange = mock((_data: Record<string, unknown> | null) => {});
    render(FrontMatterFields, {
      props: {
        id: 'fm',
        data: { tags: ['alpha', 'alpha', 'beta'], title: 'Launch notes' },
        raw: 'tags:\n  - alpha\n  - alpha\n  - beta\ntitle: Launch notes',
        onchange,
      },
    });

    const input = document.body.querySelector('#fm-tags');
    if (!(input instanceof HTMLInputElement)) throw new Error('Expected tag input.');
    await fireEvent.input(input, { target: { value: 'gamma' } });
    await fireEvent.keyDown(input, { key: 'Enter' });

    expect(onchange).toHaveBeenCalledWith({
      tags: ['alpha', 'alpha', 'beta', 'gamma'],
      title: 'Launch notes',
    });
  });

  test('structured JSON drafts stay local until they parse', async () => {
    const onchange = mock((_data: Record<string, unknown> | null) => {});
    render(FrontMatterFields, {
      props: {
        id: 'fm',
        data: { title: 'Launch notes', metadata: { owner: 'platform' } },
        raw: 'title: Launch notes\nmetadata:\n  owner: platform',
        onchange,
      },
    });

    const textarea = queryTextarea();
    await fireEvent.input(textarea, { target: { value: '{"owner":' } });

    expect(onchange).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('Enter valid JSON');

    await fireEvent.input(textarea, { target: { value: '{"owner":"docs","count":3}' } });

    expect(onchange).toHaveBeenCalledWith({
      title: 'Launch notes',
      metadata: { owner: 'docs', count: 3 },
    });
  });

  test('null fields start empty and become strings on the first nonempty edit', async () => {
    const onchange = mock((_data: Record<string, unknown> | null) => {});
    render(FrontMatterFields, {
      props: {
        id: 'fm',
        data: { optional: null },
        raw: 'optional:',
        onchange,
      },
    });

    const input = document.body.querySelector('#fm-optional');
    if (!(input instanceof HTMLInputElement)) throw new Error('Expected optional input.');
    expect(input.value).toBe('');

    await fireEvent.input(input, { target: { value: '' } });
    expect(onchange).not.toHaveBeenCalled();

    await fireEvent.input(input, { target: { value: 'ready' } });

    expect(onchange).toHaveBeenCalledWith({ optional: 'ready' });
  });

  test('readonly structured values stay selectable without disabled controls', () => {
    const onchange = mock((_data: Record<string, unknown> | null) => {});
    render(FrontMatterFields, {
      props: {
        id: 'fm',
        data: {
          title: 'Launch notes',
          priority: 2,
          published: false,
          tags: ['alpha', 'beta'],
          metadata: { owner: 'platform' },
        },
        raw: 'title: Launch notes',
        readonly: true,
        onchange,
      },
    });

    expect(document.body.textContent).toContain('Launch notes');
    expect(document.body.textContent).toContain('2');
    expect(document.body.textContent).toContain('false');
    expect(document.body.querySelector('.cinder-tag-input')).not.toBeNull();
    expect(document.body.querySelector('.cinder-payload-inspector')).not.toBeNull();
    expect(document.body.querySelector('input:disabled, textarea:disabled')).toBeNull();
  });
});
