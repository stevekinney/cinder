/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: CommentComposer } = await import('./comment-composer.svelte');

/**
 * The inline submit is revealed by `:focus-within` on its container, which also
 * flips it from `pointer-events: none` to `auto`. WebKit does not focus a
 * `<button>` on mousedown, so mid-gesture the textarea blurred, `:focus-within`
 * dropped, `pointer-events` went back to `none` before mouseup, and the mouseup
 * hit-tested to the textarea — the `click` then retargeted to the wrapper `<div>`
 * and the form never submitted. Clicking "Comment" did nothing in Safari; only
 * the undiscoverable Cmd+Enter worked.
 *
 * WHAT THIS FILE CAN AND CANNOT PROVE. happy-dom does not model hit-testing,
 * `:focus-within`, computed `pointer-events`, or WebKit's focus policy, so it
 * cannot reproduce the failure and no test here should pretend to. What it CAN
 * check is the mechanism the fix rests on: that mousedown's default action is
 * suppressed, which is the single thing that keeps focus in the textarea for the
 * duration of the gesture. Remove the handler and this goes red.
 *
 * The end-to-end behavior is pinned where it is observable — in a consumer's
 * real-browser suite running WebKit.
 */
describe('CommentComposer inline submit', () => {
  test('suppresses the default focus change on mousedown, so :focus-within survives the click', () => {
    const { container } = render(CommentComposer, {
      props: { id: 'test-composer', value: 'A reply', onsubmit: () => {} },
    });

    const submit = container.querySelector<HTMLButtonElement>('button[type="submit"]');
    expect(submit).not.toBeNull();

    const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    submit!.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });

  test('does not suppress the click itself, which is what actually submits', () => {
    // Guards the direction of the fix: preventing mousedown must not turn into
    // preventing the activation. If this ever went the other way the button
    // would be inert in EVERY engine rather than just WebKit.
    const { container } = render(CommentComposer, {
      props: { id: 'test-composer', value: 'A reply', onsubmit: () => {} },
    });

    const submit = container.querySelector<HTMLButtonElement>('button[type="submit"]');
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    submit!.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
  });
});
