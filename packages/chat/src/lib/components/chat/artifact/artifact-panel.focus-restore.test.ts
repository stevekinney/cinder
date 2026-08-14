/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';
import { createRawSnippet, tick } from 'svelte';

import { setupHappyDom } from '../../../test/happy-dom.ts';

setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: ArtifactPanel } = await import('./artifact-panel.svelte');

/**
 * The panel focuses its Close button on mount so a keyboard user lands inside it.
 * It gave nothing back on unmount, so closing dropped focus on `<body>` — next
 * Tab restarts at the top of the document, and a screen reader is silent.
 * Reproduced identically in Chromium, Firefox, and WebKit before the fix, so it
 * was never an engine quirk.
 */
/** The panel requires a `children` snippet; its content is irrelevant here. */
const body = createRawSnippet(() => ({ render: () => '<p>artifact body</p>' }));

const appended: HTMLElement[] = [];

afterEach(() => {
  for (const element of appended.splice(0)) element.remove();
});

function mountOpener(): HTMLButtonElement {
  const opener = document.createElement('button');
  document.body.appendChild(opener);
  appended.push(opener);
  opener.focus();
  return opener;
}

describe('ArtifactPanel focus', () => {
  test('returns focus to whatever opened it', async () => {
    const opener = mountOpener();

    const { unmount } = render(ArtifactPanel, { props: { title: 'Hero', children: body } });
    await tick();

    // The taking half, restated because it is the reason the giving half is
    // owed rather than merely nice: the panel deliberately moves focus.
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Close artifact panel');

    unmount();
    await tick();

    expect(document.activeElement).toBe(opener);
    expect(document.activeElement).not.toBe(document.body);
  });

  test('does not throw when the opener was removed while the panel was open', async () => {
    // Restoring to a detached node is a silent no-op — `.focus()` succeeds and
    // focus stays put — so the guard exists to keep that from being an error
    // rather than to rescue focus. The panel has no surviving element of its
    // own to offer by teardown; a consumer whose close also removes the opener
    // has to manage focus itself, and this pins that the panel degrades quietly
    // rather than throwing on the way out.
    const opener = mountOpener();

    const { unmount } = render(ArtifactPanel, { props: { title: 'Hero', children: body } });
    await tick();

    opener.remove();
    expect(() => unmount()).not.toThrow();
  });
});
