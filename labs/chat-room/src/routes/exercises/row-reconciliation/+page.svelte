<script lang="ts">
	import {
		appendAssistantMessage,
		appendUserMessage,
		Chat,
		createConversationHistory,
		type ConversationHistory,
		type Message
	} from '@lostgradient/chat';

	/**
	 * ROADMAP I-1 — row insertion and removal, asserted in a real browser.
	 *
	 * Under happy-dom, a keyed `{#each}` whose body starts with a conditional
	 * renders its initial items and then never inserts or removes another one.
	 * Chat's static row list is exactly that shape — a `{#key ...}{#each
	 * renderRows as renderRow (chatRenderRowKey(renderRow))}` wrapped around a
	 * snippet that opens `{#if renderRow.type === 'date'}` — so under that
	 * harness the transcript looks frozen and every add/remove assertion passes
	 * without observing anything. Upstream documents the limitation in a
	 * test-only helper that is not in the published tarball
	 * (`packages/chat/src/lib/test/happy-dom.ts`) and says to assert row
	 * insertion and removal in a real browser instead. This route is that.
	 *
	 * It also carries the only reachable exercise of the focus backstop's
	 * rendered-set trigger — see `handleWindowKeyDown` below, which exists
	 * entirely because every ordinary control disarms the thing under test.
	 *
	 * `virtualized` is deliberately left unset. The virtualizer renders through
	 * a separate `{#each virtualRows ...}`; the trapped shape above is the
	 * NON-virtualized branch, so turning virtualization on here would test the
	 * other path and leave this one uncovered.
	 */

	// The removal target must not be the FIRST message. Chat wraps its static row
	// list in `{#key staticRowsResetIdentity}`, and that identity is
	// `messages[0]?.id` — so removing `messages[0]` changes the key, tears the
	// whole block down, and rebuilds it from scratch. The row would disappear and
	// the count would drop without a single reconciliation step having run, which
	// is precisely the vacuous green this exercise exists to rule out. Index 2 of
	// five leaves survivors on both sides.
	const TARGET_INDEX = 2;

	// Two-word bodies on purpose. The focus-backstop test asserts as a
	// PRECONDITION that the timeline is not scrollable (that is what isolates the
	// backstop's rendered-set trigger from its scroll trigger), and the precondition
	// has to hold across three engines' font metrics. Bodies short enough never to
	// wrap keep the seeded transcript comfortably inside the fixed-height box below.
	const SEED_BODIES = ['Alpha row', 'Bravo row', 'Charlie row', 'Delta row', 'Echo row'];

	function seedConversation(): ConversationHistory {
		let history = createConversationHistory({ id: 'row-reconciliation' });
		for (const [index, body] of SEED_BODIES.entries()) {
			history =
				index % 2 === 0 ? appendUserMessage(history, body) : appendAssistantMessage(history, body);
		}
		return history;
	}

	const seeded = seedConversation();

	// Captured ONCE, off the seed. Reading `conversation.ids[TARGET_INDEX]` at
	// press time would silently retarget the moment anything is removed or
	// prepended, and every readout below would then be describing a different
	// message than the one a test parked focus on.
	const targetMessageId = seeded.ids[TARGET_INDEX] ?? '';

	let conversation = $state<ConversationHistory>(seeded);
	let appendCount = $state(0);
	let lastMutation = $state('none');

	/**
	 * Removal, hand-rolled, because there is nothing to call. conversationalist's
	 * public surface is append/prepend builders, tool-result resolution,
	 * position-based redaction, queries, and collapse helpers — no
	 * `removeMessage`, no `deleteMessage`, no `updateMessage`. So this follows the
	 * same build-a-new-history shape `message-lifecycle`'s `replaceMessage`
	 * already uses: fresh `ids`, fresh `messages`, never a mutation of the objects
	 * Chat is currently rendering.
	 *
	 * `position` is deliberately left alone on the survivors, so it goes
	 * non-contiguous (0, 1, 3, 4). Chat's order comes from `getMessages`, which
	 * walks `ids` rather than sorting on `position`; renumbering would change
	 * nothing observable today and would mask a regression if that ever stopped
	 * being true.
	 */
	function removeMessage(history: ConversationHistory, messageId: string): ConversationHistory {
		if (!history.messages[messageId]) return history;

		const messages: Record<string, Message> = {};
		for (const id of history.ids) {
			if (id === messageId) continue;
			const message = history.messages[id];
			if (message) messages[id] = message;
		}

		return {
			...history,
			ids: history.ids.filter((id) => id !== messageId),
			messages,
			updatedAt: new Date().toISOString()
		};
	}

	/**
	 * `hidden` is a genuinely different mechanism from removal, not a second
	 * spelling of it, and the difference is invisible if you only look at the DOM.
	 * Chat reads its transcript with `getMessages(conversation)` and no options,
	 * and that call excludes hidden messages by default — so the ROW leaves the
	 * DOM while the MESSAGE stays in `ids` and in `messages`, still exportable,
	 * still addressable by id.
	 *
	 * The `target-still-stored` / `stored-id-count` readouts exist for exactly
	 * that: an assertion that only checks the row is gone cannot tell hiding from
	 * removal, and would keep passing if `hidden` were ever reimplemented as a
	 * delete.
	 *
	 * (`ChatMessage` also emits `data-hidden` on its wrapper, but that is reachable
	 * only by rendering `<ChatMessage>` standalone — through `<Chat>` the row is
	 * filtered out before it ever renders, so there is no element to carry it.)
	 */
	function setHidden(
		history: ConversationHistory,
		messageId: string,
		hidden: boolean
	): ConversationHistory {
		const existing = history.messages[messageId];
		if (!existing) return history;

		return {
			...history,
			messages: { ...history.messages, [messageId]: { ...existing, hidden } },
			updatedAt: new Date().toISOString()
		};
	}

	function appendRow(): void {
		appendCount += 1;
		conversation = appendAssistantMessage(conversation, `Foxtrot row ${appendCount}`);
		lastMutation = 'append:button';
	}

	function removeTarget(source: 'button' | 'delete-key'): void {
		if (!conversation.messages[targetMessageId]) return;
		conversation = removeMessage(conversation, targetMessageId);
		lastMutation = `remove:${source}`;
	}

	function setTargetHidden(hidden: boolean): void {
		conversation = setHidden(conversation, targetMessageId, hidden);
		lastMutation = hidden ? 'hide:button' : 'unhide:button';
	}

	const REMOVE_KEY = 'Delete';

	/**
	 * A window-level key, not a button, and that is the whole point of it.
	 *
	 * Chat's focus backstop tracks which row holds focus and re-checks that row's
	 * connectivity when the rendered set changes. Reaching a button to fire the
	 * removal destroys the state it is watching, two different ways:
	 *
	 * - Tabbing or clicking to any control moves focus off the row, and the
	 *   timeline's `focusout` handler clears the tracked row for any non-null
	 *   `relatedTarget`.
	 * - Any pointerdown outside Chat's container hits a capture-phase document
	 *   listener that clears it too, so even clicking a control that never takes
	 *   focus disarms it.
	 *
	 * So the removal has to arrive while focus is still sitting on the row, from
	 * an input that moves nothing. Chat's own keydown handler consumes only
	 * Home/End/PageUp/PageDown/ArrowUp/ArrowDown and Ctrl/Cmd+F, so Delete passes
	 * straight through to here — and this is a real user action, not a synthetic
	 * dispatch. It is also the docblock's own scenario: a message removed from the
	 * conversation while the user is reading, with no scroll involved.
	 *
	 * The editable-target guard keeps Delete meaning "delete a character" inside
	 * the composer, which is where a user typing would expect it to land.
	 */
	function handleWindowKeyDown(event: KeyboardEvent): void {
		if (event.key !== REMOVE_KEY) return;

		const target = event.target;
		if (
			target instanceof HTMLElement &&
			(target.isContentEditable || target.closest('input, textarea, [contenteditable]'))
		) {
			return;
		}

		removeTarget('delete-key');
	}

	const storedIdCount = $derived(conversation.ids.length);
	const renderedIdCount = $derived(
		conversation.ids.filter((id) => conversation.messages[id]?.hidden !== true).length
	);
	const targetStillStored = $derived(conversation.ids.includes(targetMessageId) ? 'yes' : 'no');
	const targetHidden = $derived(
		conversation.messages[targetMessageId]?.hidden === true ? 'yes' : 'no'
	);
</script>

<svelte:window onkeydown={handleWindowKeyDown} />

<div
	style="max-width: 60rem; margin: 0 auto; padding: 1rem; display: flex; flex-direction: column; gap: 1rem;"
>
	<section style="display: flex; flex-direction: column; gap: 0.5rem;">
		<h1 style="margin: 0; font-size: 1.25rem;">Row reconciliation</h1>
		<p style="margin: 0;">
			Insert, remove, and hide messages in a non-virtualized transcript, then watch where focus
			lands when the message holding it leaves the DOM. Pressing Delete outside a text field removes
			the third message without touching a control, which is the only way to reach the focus
			backstop with its tracking still armed.
		</p>
	</section>

	<div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
		<button type="button" data-testid="append-message" onclick={appendRow}>Append a message</button>
		<button type="button" data-testid="remove-target" onclick={() => removeTarget('button')}>
			Remove the third message
		</button>
		<button type="button" data-testid="hide-target" onclick={() => setTargetHidden(true)}>
			Hide the third message
		</button>
		<button type="button" data-testid="unhide-target" onclick={() => setTargetHidden(false)}>
			Unhide the third message
		</button>
	</div>

	<dl
		data-testid="row-reconciliation-status"
		style="display: flex; flex-wrap: wrap; gap: 0.5rem 1.5rem; margin: 0;"
	>
		<div>
			<dt style="display: inline;">storedIdCount:</dt>
			<dd style="display: inline; margin: 0;" data-testid="stored-id-count">{storedIdCount}</dd>
		</div>
		<div>
			<dt style="display: inline;">renderedIdCount:</dt>
			<dd style="display: inline; margin: 0;" data-testid="rendered-id-count">{renderedIdCount}</dd>
		</div>
		<div>
			<dt style="display: inline;">targetMessageId:</dt>
			<dd style="display: inline; margin: 0;" data-testid="target-message-id">{targetMessageId}</dd>
		</div>
		<div>
			<dt style="display: inline;">targetStillStored:</dt>
			<dd style="display: inline; margin: 0;" data-testid="target-still-stored">
				{targetStillStored}
			</dd>
		</div>
		<div>
			<dt style="display: inline;">targetHidden:</dt>
			<dd style="display: inline; margin: 0;" data-testid="target-hidden">{targetHidden}</dd>
		</div>
		<div>
			<dt style="display: inline;">lastMutation:</dt>
			<dd style="display: inline; margin: 0;" data-testid="last-mutation">{lastMutation}</dd>
		</div>
	</dl>

	<!--
		A fixed height, large enough that five two-word messages never fill the
		timeline. That is load-bearing rather than cosmetic: a transcript that does
		not overflow produces no scroll or scrollend events, which is what keeps
		the backstop's SCROLL trigger (`handleScrollStateChange`) out of the
		picture and leaves its rendered-set `$effect` as the only thing that can
		reclaim focus. The spec asserts `scrollHeight <= clientHeight` before it
		measures anything, so if this box ever stops being big enough the test says
		so instead of quietly pinning the other trigger.
	-->
	<div style="height: 720px;">
		<Chat id="row-reconciliation-chat" {conversation} />
	</div>
</div>
