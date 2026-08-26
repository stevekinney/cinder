import { expect, test } from '@playwright/test';
import { gotoHydrated } from '../hydration';

test('opens, closes, and reopens an artifact from conversation activity', async ({ page }) => {
	await gotoHydrated(page, '/exercises/artifacts');

	const log = page.getByRole('log', { name: 'Messages' });
	const layout = page.locator('.chat-artifact-layout');

	// Panel starts closed: no panel content, status says so, layout reports
	// closed via its own `data-panel-open` attribute and a single-column grid.
	await expect(page.getByText('No artifact open')).toBeVisible();
	await expect(layout).toHaveAttribute('data-panel-open', 'false');
	await expect(page.getByRole('complementary')).toHaveCount(0);
	await expect
		.poll(() => layout.evaluate((element) => getComputedStyle(element).gridTemplateColumns))
		.toMatch(/^\S+$/);

	// Opening an artifact from a button on an assistant message row (html
	// type). The action bar is hover/focus-revealed (opacity 0, pointer-events
	// none at rest), and it's positioned outside its message wrapper's own
	// box, so a mouse hover at the button's own coordinates never actually
	// lands on a hoverable ancestor — `elementFromPoint` there resolves clean
	// through to `.chat-timeline`. Focusing first exercises the same
	// keyboard-accessible reveal path real keyboard/AT users rely on, and
	// makes the button hit-testable for the click that follows. See message
	// lifecycle exercise notes / upstream friction.
	const openHero = page.getByTestId('open-artifact-html');
	await openHero.focus();
	await openHero.click();

	const panel = page.getByRole('complementary');
	await expect(panel).toBeVisible();
	await expect(layout).toHaveAttribute('data-panel-open', 'true');
	await expect(panel.getByText('Landing Page Hero')).toBeVisible();
	// The layout grid splits into two columns (chat + panel) once open.
	await expect
		.poll(() => layout.evaluate((element) => getComputedStyle(element).gridTemplateColumns))
		.toMatch(/^\S+ \S+$/);

	const heroFrame = panel.locator('iframe.artifact-viewer-html');
	await expect(heroFrame).toBeVisible();
	await expect(
		heroFrame.contentFrame().getByRole('heading', { name: 'Build faster' })
	).toBeVisible();

	// Closing via the panel's own close button hides the panel but keeps the
	// artifact remembered — the layout's grid collapses back to one column.
	await page.getByRole('button', { name: 'Close artifact panel' }).click();
	await expect(panel).toHaveCount(0);
	await expect(layout).toHaveAttribute('data-panel-open', 'false');
	// A11Y-2 / cinder#1299: the panel's own focusOnMount captured whatever had
	// focus before it opened — the row button that opened it — and restores
	// it on close instead of dropping focus to <body>.
	await expect(openHero).toBeFocused();

	const reopen = page.getByTestId('reopen-artifact');
	await expect(reopen).toHaveText('Reopen "Landing Page Hero"');
	await reopen.click();
	await expect(page.getByRole('complementary').getByText('Landing Page Hero')).toBeVisible();
	await expect(layout).toHaveAttribute('data-panel-open', 'true');

	// Opening an artifact from the tool-call row (svg type): the artifact
	// metadata lives on the folded tool-RESULT message, and Chat resolves it
	// into the visible tool-call row's `ChatRowContext.artifact` (the
	// convention added in chat 0.2.0 — resolved cinder#777/#783).
	const openSvg = page.getByTestId('open-artifact-svg');
	await openSvg.focus();
	await openSvg.click();
	const svgPanel = page.getByRole('complementary');
	await expect(svgPanel.getByText('Company Logo')).toBeVisible();

	// Code artifact renders through Cinder's syntax-highlighted CodeBlock
	// (the chat 0.4.1 default from cinder#893), not a bare <pre> or iframe.
	const openCode = page.getByTestId('open-artifact-code');
	await openCode.focus();
	await openCode.click();
	const codePanel = page.getByRole('complementary');
	await expect(codePanel.getByText('Pricing Table Source')).toBeVisible();
	await expect(codePanel.locator('.cinder-code-block.artifact-code-block')).toBeVisible();
	await expect(codePanel.getByText('tiers')).toBeVisible();

	// Mermaid artifact renders through the consumer-supplied `mermaidRenderer`
	// snippet (the extension point added in chat 0.2.0 for cinder#784) rather
	// than the built-in raw-source fallback.
	const openMermaid = page.getByTestId('open-artifact-mermaid');
	await openMermaid.focus();
	await openMermaid.click();
	const mermaidPanel = page.getByRole('complementary');
	await expect(mermaidPanel.getByText('Artifact Cache Flow')).toBeVisible();
	await expect(mermaidPanel.getByTestId('custom-mermaid-renderer')).toContainText(
		'custom renderer: flowchart TD'
	);

	// The chat log itself is unaffected by panel state.
	await expect(log.getByText('Generate a hero section for the landing page.')).toBeVisible();
});

test('sandboxes hostile HTML artifact content — no script execution, no parent escape', async ({
	page
}) => {
	await gotoHydrated(page, '/exercises/artifacts');

	const consoleErrors: string[] = [];
	page.on('console', (message) => {
		if (message.type() === 'error') consoleErrors.push(message.text());
	});
	page.on('pageerror', (error) => consoleErrors.push(error.message));

	const originalTitle = await page.title();

	const openHostile = page.getByTestId('open-artifact-html-hostile');
	await openHostile.focus();
	await openHostile.click();

	const panel = page.getByRole('complementary');
	await expect(panel).toBeVisible();
	await expect(panel.getByText('Hostile HTML Artifact')).toBeVisible();

	const frame = panel.locator('iframe.artifact-viewer-html');
	await expect(frame).toBeVisible();

	// ArtifactViewer renders with `sandbox=""` — the empty token list applies
	// every sandbox restriction at once (no allow-scripts, no
	// allow-same-origin, no allow-forms, no allow-popups, ...). Without
	// allow-scripts, <script> tags, inline event handler attributes, and
	// `javascript:` navigations are all inert — this is the strictest
	// possible sandbox configuration, not merely "safe enough."
	await expect(frame).toHaveAttribute('sandbox', '');

	const contentFrame = frame.contentFrame();
	await expect(contentFrame.locator('#hostile-marker')).toBeVisible();

	// (b) the inline <script> never executed: its DOM mutation never landed,
	// so the marker it would have appended is absent, and the try/catch that
	// probes `window.top` never ran either — the marker still shows its
	// static "not attempted" seed text from the raw HTML, proving the
	// script body was never entered at all (not even to fail the reach and
	// log a caught error).
	await expect(contentFrame.locator('#script-executed-marker')).toHaveCount(0);
	await expect(contentFrame.locator('#top-access-marker')).toHaveText('not attempted');

	// Inline `onclick="..."` is scripting too — also inert under `sandbox=""`.
	await contentFrame.locator('#onclick-button').click();
	await expect(contentFrame.locator('#onclick-marker')).toHaveText('not clicked');

	// `javascript:` URL navigation is scripting — also blocked. Clicking the
	// link must neither run the handler nor navigate the frame away from srcdoc.
	await contentFrame.locator('#js-link').click();
	await expect(contentFrame.locator('#onclick-marker')).toHaveText('not clicked');
	const frameElement = await frame.elementHandle();
	const rawFrame = await frameElement?.contentFrame();
	expect(rawFrame?.url()).toBe('about:srcdoc');

	// (c) parent page is unaffected: title untouched, no marker element
	// leaked outside the iframe, no console/page error indicating an escape.
	await expect(page).toHaveTitle(originalTitle);
	await expect(page.locator('#script-executed-marker')).toHaveCount(0);
	await expect(page.locator('#hostile-marker')).toHaveCount(0);
	expect(
		consoleErrors.some((text) => /top-access-succeeded|escaped|script-executed-marker/.test(text))
	).toBe(false);
});

test('sandboxes hostile SVG artifact content carrying an embedded <script>', async ({ page }) => {
	await gotoHydrated(page, '/exercises/artifacts');

	const originalTitle = await page.title();

	const openHostile = page.getByTestId('open-artifact-svg-hostile');
	await openHostile.focus();
	await openHostile.click();

	const panel = page.getByRole('complementary');
	await expect(panel).toBeVisible();
	await expect(panel.getByText('Hostile SVG Artifact')).toBeVisible();

	const frame = panel.locator('iframe.artifact-viewer-svg');
	await expect(frame).toBeVisible();

	// Same sandbox mode as the HTML path — ArtifactViewer wraps SVG content
	// in a minimal HTML document and renders it through the same
	// `sandbox=""` iframe, so an embedded <script> inside the SVG gets the
	// same total containment.
	await expect(frame).toHaveAttribute('sandbox', '');

	const contentFrame = frame.contentFrame();
	await expect(contentFrame.locator('svg circle')).toBeVisible();
	await expect(contentFrame.locator('#svg-script-executed-marker')).toHaveCount(0);

	await expect(page).toHaveTitle(originalTitle);
	await expect(page.locator('#svg-script-executed-marker')).toHaveCount(0);
});
