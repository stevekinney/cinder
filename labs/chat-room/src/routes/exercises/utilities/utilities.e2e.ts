import { expect, test } from '@playwright/test';
import { gotoHydrated } from '../hydration';

test('utility functions render correctly against the seeded conversation', async ({ page }) => {
	await gotoHydrated(page, '/exercises/utilities');

	const rows = page.getByTestId('utilities-message-row');
	await expect(rows).toHaveCount(24);

	const userRow = rows.first();
	await expect(userRow.getByTestId('utilities-role-label')).toHaveText('You');
	await expect(userRow.getByTestId('utilities-format-as-markdown')).toHaveText(
		'What is the weather in **Portland**?'
	);
	await expect(userRow.getByTestId('utilities-get-message-text')).toHaveText(
		'What is the weather in **Portland**?'
	);

	const assistantRow = rows.nth(1);
	await expect(assistantRow.getByTestId('utilities-role-label')).toHaveText('Assistant');
	await expect(assistantRow.getByTestId('utilities-format-as-markdown')).toContainText(
		'Let me check that for you.'
	);

	// The tool-call/tool-result messages carry their payload in `toolCall`/`toolResult`,
	// not `content`, so getMessageText/formatMessageAsMarkdown are empty for them —
	// exercising that these utilities are text-only and don't reach into tool payloads.
	const toolCallRow = rows.nth(2);
	await expect(toolCallRow.getByTestId('utilities-role-label')).toHaveText('Tool Call');
	await expect(toolCallRow.getByTestId('utilities-format-as-markdown')).toHaveText('');

	const toolResultRow = rows.nth(3);
	await expect(toolResultRow.getByTestId('utilities-role-label')).toHaveText('Tool Result');
	await expect(toolResultRow.getByTestId('utilities-get-message-text')).toHaveText('');

	const fullTranscript = page.getByTestId('utilities-messages-to-markdown');
	await expect(fullTranscript).toContainText('**You:**');
	await expect(fullTranscript).toContainText('**Assistant:**');
	await expect(fullTranscript).toContainText('**Tool Call:**');
	await expect(fullTranscript).toContainText('**Tool Result:**');
	await expect(fullTranscript).toContainText('---');
});

// Mirrors `buildSeededConversation()` in +page.svelte: 4 seed messages
// (user, assistant, tool-call, tool-result) followed by 20 padding messages
// alternating user/assistant starting with user. Kept in one place so both
// the Markdown and JSON export assertions below check against the same
// ground truth as the page's own message rows.
const EXPECTED_ROLES = [
	'user',
	'assistant',
	'tool-call',
	'tool-result',
	...Array.from({ length: 20 }, (_, index) => (index % 2 === 0 ? 'user' : 'assistant'))
];

test('ConversationExportActions: Markdown export matches the full expected structure', async ({
	context,
	page,
	browserName
}) => {
	test.skip(
		browserName !== 'chromium',
		'Only Chromium maps both clipboard-read and clipboard-write permissions'
	);

	await context.grantPermissions(['clipboard-read', 'clipboard-write']);
	await gotoHydrated(page, '/exercises/utilities');

	const status = page.getByTestId('utilities-export-status');
	await expect(status).toHaveText('');

	await page.getByRole('button', { name: 'Export conversation' }).click();
	await page.getByRole('menuitem', { name: /Copy as Markdown/ }).click();
	await expect(status).toHaveText('exported: markdown');

	const clipboardText = await page.evaluate(() => navigator.clipboard.readText());

	// messagesToMarkdown joins `**RoleLabel:**\n\n<text>` blocks with
	// `\n\n---\n\n` (utilities.ts in @lostgradient/chat) — one block per
	// message, in transcript order, with no role-based filtering here (no
	// system/developer messages in this seeded conversation).
	const blocks = clipboardText.split('\n\n---\n\n');
	expect(blocks).toHaveLength(EXPECTED_ROLES.length);

	const roleLabels: Record<string, string> = {
		user: 'You',
		assistant: 'Assistant',
		'tool-call': 'Tool Call',
		'tool-result': 'Tool Result'
	};
	for (const [index, role] of EXPECTED_ROLES.entries()) {
		expect(blocks[index].startsWith(`**${roleLabels[role]}:**\n\n`)).toBe(true);
	}

	// Text-bearing messages carry their real content...
	expect(blocks[0]).toBe('**You:**\n\nWhat is the weather in **Portland**?');
	expect(blocks[1]).toContain('Let me check that for you.');
	expect(blocks[4]).toBe(
		'**You:**\n\nPadding message 1 — enough text to give this row real height so the transcript overflows the viewport.'
	);
	expect(blocks[23]).toBe(
		'**Assistant:**\n\nPadding message 20 — enough text to give this row real height so the transcript overflows the viewport.'
	);

	// ...while the tool-call/tool-result pair carries its payload in
	// `toolCall`/`toolResult`, not `content` — formatMessageAsMarkdown is
	// text-only, so their bodies are empty (see the utility-function
	// assertions above for the same contract).
	expect(blocks[2]).toBe('**Tool Call:**\n\n');
	expect(blocks[3]).toBe('**Tool Result:**\n\n');
});

test('ConversationExportActions: JSON export round-trips the full conversation', async ({
	context,
	page,
	browserName
}) => {
	test.skip(
		browserName !== 'chromium',
		'Only Chromium maps both clipboard-read and clipboard-write permissions'
	);

	await context.grantPermissions(['clipboard-read', 'clipboard-write']);
	await gotoHydrated(page, '/exercises/utilities');

	const status = page.getByTestId('utilities-export-status');
	await expect(status).toHaveText('');

	// Cross-check the exported ids against what the page actually rendered
	// for the same messages, so "ids survive round-trip" is checked against
	// real DOM state, not just re-asserted against the test's own fixture.
	const rows = page.getByTestId('utilities-message-row');
	const firstRowId = await rows.first().getAttribute('data-message-id');
	const secondRowId = await rows.nth(1).getAttribute('data-message-id');

	await page.getByRole('button', { name: 'Export conversation' }).click();
	await page.getByRole('menuitem', { name: /Copy as JSON/ }).click();
	await expect(status).toHaveText('exported: json');

	const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
	const exported = JSON.parse(clipboardText) as {
		schemaVersion: string;
		exportedAt: string;
		conversationId: string;
		messages: Array<{
			id: string;
			role: string;
			content: unknown;
			toolCall?: { id: string; name: string; arguments: unknown };
			toolResult?: { callId: string; outcome: string; content: unknown };
		}>;
	};

	expect(exported.schemaVersion).toBe('1.0');
	expect(new Date(exported.exportedAt).toString()).not.toBe('Invalid Date');
	expect(exported.conversationId).toBe('utilities-demo');

	// Message count and the full role sequence match the seeded conversation.
	expect(exported.messages).toHaveLength(EXPECTED_ROLES.length);
	expect(exported.messages.map((message) => message.role)).toEqual(EXPECTED_ROLES);

	// ids and content survive the round-trip, including against the page's
	// own rendered ids for the same two messages.
	expect(exported.messages[0].id).toBe(firstRowId);
	expect(exported.messages[0].content).toBe('What is the weather in **Portland**?');
	expect(exported.messages[1].id).toBe(secondRowId);
	expect(exported.messages[1].content).toContain('Let me check that for you.');

	// The tool-call/tool-result pair is represented via `toolCall`/`toolResult`.
	expect(exported.messages[2].toolCall).toEqual({
		id: 'call-1',
		name: 'get_weather',
		arguments: { city: 'Portland' }
	});
	expect(exported.messages[3].toolResult).toEqual({
		callId: 'call-1',
		outcome: 'success',
		content: { tempF: 54, sky: 'overcast' }
	});
});

test('imperative Chat methods: announce, scroll, focus, and composer access', async ({ page }) => {
	await gotoHydrated(page, '/exercises/utilities');

	const chatWrapper = page.getByTestId('utilities-full-chat-wrapper');
	const composer = chatWrapper.getByRole('textbox', { name: 'Message' });

	// announce() writes into Chat's own polite live region.
	await page.getByTestId('utilities-announce').click();
	await expect(page.getByText('Announcement: imperative announce() probe fired.')).toBeAttached();

	// The seeded transcript overflows the 24rem viewport, so scrollToTop/scrollToBottom
	// actually move the anchor rather than being no-ops.
	await expect(page.getByTestId('utilities-at-bottom')).toHaveText('atBottom: true');
	await page.getByTestId('utilities-scroll-top').click();
	await expect(page.getByTestId('utilities-at-bottom')).toHaveText('atBottom: false');
	await page.getByTestId('utilities-scroll-bottom').click();
	await expect(page.getByTestId('utilities-at-bottom')).toHaveText('atBottom: true');

	// focusInput() moves focus to the composer textarea.
	await page.getByTestId('utilities-focus-input').click();
	await expect(composer).toBeFocused();

	// getComposerValue() reads the live composer contents.
	await composer.fill('draft reply text');
	await page.getByTestId('utilities-refresh-composer-value').click();
	await expect(page.getByTestId('utilities-composer-value')).toHaveText(
		'Composer value: "draft reply text"'
	);

	// clearInput() empties the composer; a follow-up getComposerValue() confirms it.
	await page.getByTestId('utilities-clear-input').click();
	await expect(composer).toHaveValue('');
	await expect(page.getByTestId('utilities-composer-value')).toHaveText('Composer value: ""');
});

test('announce("assertive") writes into the assertive live region and clears after its 1s delay', async ({
	page
}) => {
	await page.clock.install();
	await gotoHydrated(page, '/exercises/utilities');
	await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1000);

	const chatWrapper = page.getByTestId('utilities-full-chat-wrapper');
	// ChatStatusAnnouncer renders the assertive region as its own
	// `aria-live="assertive"` element, separate from the `role="log"`
	// transcript — per the docs it exists outside the log.
	const assertiveRegion = chatWrapper.locator('[aria-live="assertive"]');
	await expect(assertiveRegion).toHaveCount(1);
	await expect(assertiveRegion).toHaveText('');

	const announcement = 'Assertive announcement: imperative announce() probe fired.';
	await page.getByTestId('utilities-announce-assertive').click();
	await expect(assertiveRegion).toHaveText(announcement);

	// Ground truth: Chat's own CONSUMER_ANNOUNCEMENT_CLEAR_DELAY_MS is 1000ms
	// (container/chat.svelte). Advancing the browser clock fires that exact timer
	// deterministically instead of relying on wall-clock scheduling under load.
	await page.clock.runFor(999);
	expect(await assertiveRegion.textContent()).toBe(announcement);
	await page.clock.runFor(1);
	expect(await assertiveRegion.textContent()).toBe('');
});

test('standalone building blocks render and behave correctly without the Chat shell', async ({
	page
}) => {
	await gotoHydrated(page, '/exercises/utilities');

	// ChatDateSeparator with a custom formatter for a deterministic label.
	await expect(page.getByRole('separator', { name: 'Messages from 2024-03-14' })).toBeVisible();

	// ChatMessage, rendered bare, still resolves its own role label and body.
	const userMessage = page.getByTestId('utilities-chat-message-user');
	await expect(userMessage.locator('.chat-message-role')).toHaveText('You');
	await expect(userMessage).toContainText(
		'Standalone ChatMessage, rendered with no Chat container'
	);

	const assistantMessage = page.getByTestId('utilities-chat-message-assistant');
	await expect(assistantMessage.locator('.chat-message-role')).toHaveText('Assistant');
	await expect(assistantMessage.locator('strong')).toHaveText('without');

	// MessageContent renders markdown on its own.
	const messageContent = page.getByTestId('utilities-message-content');
	await expect(messageContent.locator('strong')).toHaveText('Bold');
	await expect(messageContent.locator('em')).toHaveText('italic');
	await expect(messageContent.locator('code')).toHaveText('code span');

	// ToolCallGroup renders a pair built by hand (no Chat/pairToolCallsWithResults)
	// and its own disclosure toggle works standalone.
	const toolCallGroup = page.getByTestId('utilities-tool-call-group');
	await expect(toolCallGroup).toContainText('lookup_order');
	const toggle = toolCallGroup.getByRole('button', {
		name: 'Toggle tool call details for lookup_order'
	});
	await expect(toggle).toHaveAttribute('aria-expanded', 'false');
	await toggle.click();
	await expect(toggle).toHaveAttribute('aria-expanded', 'true');
	await expect(toolCallGroup).toContainText('shipped');

	// ChatInput works as a freestanding composer with its own onsubmit callback.
	const standaloneInput = page.getByTestId('utilities-chat-input');
	const standaloneComposer = standaloneInput.getByRole('textbox', { name: 'Message' });
	await expect(page.getByTestId('utilities-last-submission')).toHaveText('no submission yet');

	await standaloneComposer.fill('hello from a bare ChatInput');
	await standaloneInput.getByRole('button', { name: 'Send message' }).click();

	await expect(page.getByTestId('utilities-last-submission')).toContainText(
		'hello from a bare ChatInput'
	);
	// clearOnSubmit defaults to true.
	await expect(standaloneComposer).toHaveValue('');
});
