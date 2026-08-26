<script lang="ts">
	import {
		appendAssistantMessage,
		appendUserMessage,
		Chat,
		createConversationHistory,
		CURRENT_SCHEMA_VERSION,
		type ConversationHistory
	} from '@lostgradient/chat';

	// Two documented environmental contracts, pinned side by side:
	//
	// 1. SCHEMA VERSION — the package README states: "Histories produced by an
	//    older compatible schema can render as-is; a newer schema requires
	//    upgrading @lostgradient/chat." Render one Chat at each of three
	//    schemaVersion values and observe what Chat actually does with each.
	//
	// 2. HEIGHT COLLAPSE — the README documents that Chat's root is
	//    `height: 100%`, and when no ancestor resolves to a definite height
	//    that collapses silently to the intrinsic height of the empty
	//    state + composer — "no browser error: it just silently shrinks to a
	//    small card." Reproduce the trap and the three documented escapes.

	function buildConversation(id: string): ConversationHistory {
		let conversation = createConversationHistory({ id });
		conversation = appendUserMessage(conversation, 'Does this conversation render?');
		conversation = appendAssistantMessage(conversation, 'Yes — this is a seeded reply.');
		return conversation;
	}

	// Stamp `schemaVersion` LAST, on the fully-built history, not before
	// appending — an append helper that recomputed the field from
	// `CURRENT_SCHEMA_VERSION` would silently erase the point of this demo.
	const schemaCurrent: ConversationHistory = buildConversation('contracts-schema-current');
	const schemaOlder: ConversationHistory = {
		...buildConversation('contracts-schema-older'),
		schemaVersion: CURRENT_SCHEMA_VERSION - 1
	};
	const schemaNewer: ConversationHistory = {
		...buildConversation('contracts-schema-newer'),
		schemaVersion: CURRENT_SCHEMA_VERSION + 1
	};

	// Identical, minimal content across every height box — the ONLY variable
	// under test is how each box resolves (or fails to resolve) a height.
	const heightDemoConversation: ConversationHistory = buildConversation('contracts-height-demo');
</script>

<div
	style="max-width: 64rem; margin: 0 auto; padding: 1rem; display: flex; flex-direction: column; gap: 2rem;"
>
	<section style="display: flex; flex-direction: column; gap: 1rem;">
		<h2 style="margin: 0;">Schema version contract (current schema is {CURRENT_SCHEMA_VERSION})</h2>

		<div style="display: flex; flex-direction: column; gap: 0.5rem;">
			<h3 style="margin: 0; font-size: 0.9rem;">
				Current schema ({CURRENT_SCHEMA_VERSION}) — expected: renders normally
			</h3>
			<div style="height: 16rem;">
				<Chat id="contracts-schema-current-chat" conversation={schemaCurrent} />
			</div>
		</div>

		<div style="display: flex; flex-direction: column; gap: 0.5rem;">
			<h3 style="margin: 0; font-size: 0.9rem;">
				Older compatible schema ({CURRENT_SCHEMA_VERSION - 1}) — documented: renders as-is
			</h3>
			<div style="height: 16rem;">
				<Chat id="contracts-schema-older-chat" conversation={schemaOlder} />
			</div>
		</div>

		<div style="display: flex; flex-direction: column; gap: 0.5rem;">
			<h3 style="margin: 0; font-size: 0.9rem;">
				Newer schema ({CURRENT_SCHEMA_VERSION + 1}) — documented: requires upgrading
				@lostgradient/chat
			</h3>
			<div style="height: 16rem;">
				<Chat id="contracts-schema-newer-chat" conversation={schemaNewer} />
			</div>
		</div>
	</section>

	<section style="display: flex; flex-direction: column; gap: 1rem;">
		<h2 style="margin: 0;">Height collapse contract</h2>

		<div style="display: flex; flex-direction: column; gap: 0.5rem;">
			<h3 style="margin: 0; font-size: 0.9rem;">
				The trap — no ancestor resolves to a definite height
			</h3>
			<div data-testid="height-trap-wrapper">
				<Chat id="contracts-height-trap-chat" conversation={heightDemoConversation} />
			</div>
		</div>

		<div style="display: flex; flex-direction: column; gap: 0.5rem;">
			<h3 style="margin: 0; font-size: 0.9rem;">Escape 1 — fixed-height container</h3>
			<div data-testid="height-fixed-wrapper" style="height: 26rem;">
				<Chat id="contracts-height-fixed-chat" conversation={heightDemoConversation} />
			</div>
		</div>

		<div style="display: flex; flex-direction: column; gap: 0.5rem;">
			<h3 style="margin: 0; font-size: 0.9rem;">
				Escape 2 — flex column, Chat's cell is `flex: 1; min-height: 0`
			</h3>
			<div
				data-testid="height-flex-wrapper"
				style="display: flex; flex-direction: column; height: 26rem; border: 1px solid var(--cinder-border, #ccc);"
			>
				<header style="flex: 0 0 auto; padding: 0.25rem 0.5rem;">Flex header</header>
				<div style="flex: 1; min-height: 0;">
					<Chat id="contracts-height-flex-chat" conversation={heightDemoConversation} />
				</div>
			</div>
		</div>

		<div style="display: flex; flex-direction: column; gap: 0.5rem;">
			<h3 style="margin: 0; font-size: 0.9rem;">
				Escape 3 — grid with a `minmax(0, 1fr)` track, cell has `min-height: 0`
			</h3>
			<div
				data-testid="height-grid-wrapper"
				style="display: grid; grid-template-rows: auto minmax(0, 1fr); height: 26rem; border: 1px solid var(--cinder-border, #ccc);"
			>
				<header style="padding: 0.25rem 0.5rem;">Grid header</header>
				<div style="min-height: 0;">
					<Chat id="contracts-height-grid-chat" conversation={heightDemoConversation} />
				</div>
			</div>
		</div>
	</section>
</div>
