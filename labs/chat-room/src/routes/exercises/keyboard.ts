import type { Page } from '@playwright/test';

/**
 * Move focus to the next tab stop, using the keystroke that means that on the
 * engine under test.
 *
 * ROADMAP HS-3 added WebKit and Firefox to the matrix, and this is the single
 * biggest thing it surfaced: **Playwright's macOS WebKit does not put buttons or
 * links in the plain-Tab cycle.** That is macOS's Full Keyboard Access setting,
 * which is off by default, and WebKit honours it; `Option+Tab` is Safari's
 * idiom for the full traversal.
 *
 * Measured on a static page carrying NO component code — an `<a href>`, three
 * `<button>`s, an `<input>`, a `<textarea>`, and a contenteditable `<div>` —
 * seven presses starting from `<body>`:
 *
 * ```
 * webkit   Tab      INPUT -> TEXTAREA -> DIV[contenteditable] -> BODY -> INPUT -> …
 * webkit   Alt+Tab  BUTTON -> BODY -> A -> BUTTON -> INPUT -> BUTTON -> TEXTAREA
 * chromium Tab      A -> BUTTON -> INPUT -> BUTTON -> TEXTAREA -> DIV -> BUTTON
 * firefox  Tab      A -> BUTTON -> INPUT -> BUTTON -> TEXTAREA -> DIV -> BUTTON
 * ```
 *
 * So macOS WebKit's `Alt+Tab` yields the same order the other two give for
 * `Tab`. Linux WebKit uses the ordinary `Tab` sequence, including in CI.
 * Translating the keystroke only for macOS keeps the assertion byte-identical
 * and keeps the coverage; skipping the engine would forfeit it. This is
 * emphatically NOT loosening a test until it passes — the expectation does not
 * move, only the input that expresses "next tab stop" on that platform.
 *
 * **The idiom inverts if Full Keyboard Access is ON**, where plain Tab reaches
 * everything and `Option+Tab` becomes the restricted order. This helper is
 * therefore pinned to the FKA-off configuration the suite runs under, which is
 * the macOS default; `defaults read -g AppleKeyboardUIMode` reads `1` on the
 * machine these were measured on. If a run ever shows WebKit skipping a
 * *textarea*, suspect that setting first.
 */
export async function pressNextTabStop(page: Page, browserName: string): Promise<void> {
	const isMacOS = await page.evaluate(() => navigator.platform.startsWith('Mac'));
	await page.keyboard.press(browserName === 'webkit' && isMacOS ? 'Alt+Tab' : 'Tab');
}

/**
 * Whether this engine puts plain `<button>` elements in the sequential focus
 * order, measured rather than assumed from the engine name.
 *
 * Used by the handful of tests whose subject IS the tab order of the composed
 * surface — those cannot be rescued by translating a keystroke, because what
 * they assert is which elements appear and in what sequence, and on this
 * platform WebKit genuinely has a different (correct-for-the-platform) answer.
 *
 * A capability probe rather than `browserName === 'webkit'` so that the skip
 * reason stays true if the setting changes, and so a future engine with the
 * same policy is covered without an edit.
 */
export async function tabReachesButtons(page: Page): Promise<boolean> {
	await page.setContent('<input id="start" /><button id="target">target</button>');
	await page.locator('#start').focus();
	await page.keyboard.press('Tab');
	return page.evaluate(() => document.activeElement?.id === 'target');
}
