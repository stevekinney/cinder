<script lang="ts">
	import {
		appendAssistantMessage,
		appendUserMessage,
		Chat,
		createConversationHistory,
		type ChatSubmitEvent,
		type ConversationHistory
	} from '@lostgradient/chat';
	import ChatComposerPopover, {
		filterFuzzySubsequence,
		fuzzySubsequenceScore,
		type ChatComposerPopoverSelection
	} from '@lostgradient/chat/composer-popover';

	type SlashCommand = {
		value: string;
		label: string;
		description: string;
		insert: string;
		keywords?: readonly string[];
	};

	const commands: SlashCommand[] = [
		{
			value: 'help',
			label: 'Help',
			description: 'Show available commands',
			insert: '/help ',
			keywords: ['docs', 'support']
		},
		{
			value: 'new-thread',
			label: 'New thread',
			description: 'Start a fresh conversation',
			insert: '/new-thread ',
			keywords: ['reset', 'fresh']
		},
		{
			value: 'toggle-theme',
			label: 'Toggle theme',
			description: 'Switch between light and dark',
			insert: '/toggle-theme ',
			keywords: ['dark', 'light']
		},
		{
			value: 'clear-draft',
			label: 'Clear draft',
			description: 'Empty the composer',
			insert: '/clear-draft ',
			keywords: ['reset', 'empty']
		}
	];

	// Plain `let`: imperative handle, only read via `chat?.method()` calls, never reactively.
	let chat: ReturnType<typeof Chat> | undefined;

	let conversation = $state<ConversationHistory>(
		createConversationHistory({ id: 'composer-popover-exercise' })
	);
	let composerSnapshot = $state('');
	let lastSelection = $state<{ label: string; score: number | null } | null>(null);

	// insertAtRange boundary-contract debug controls (stevekinney/cinder#888
	// context: exercising the native `setRangeText` clamp/throw semantics
	// documented on `Chat.insertAtRange`).
	let caretPosition = $state<{ start: number; end: number } | null>(null);
	let insertRangeErrorName = $state<string | null>(null);

	// oncomposerkeydown IME-composition instrumentation.
	let composerKeydownCount = $state(0);

	function handleSubmit(event: ChatSubmitEvent): void {
		conversation = appendAssistantMessage(
			appendUserMessage(conversation, event.message.content),
			`You said: ${event.message.content}`
		);
	}

	// Explicit filter rather than relying on ChatComposerPopover's default so the
	// exercise proves it's calling the exported fuzzy-subsequence matcher itself.
	function filterCommands(items: readonly SlashCommand[], query: string): readonly SlashCommand[] {
		return filterFuzzySubsequence(items, query);
	}

	function refreshSnapshot(): void {
		composerSnapshot = chat?.getComposerValue() ?? '';
	}

	function handleSelect(selection: ChatComposerPopoverSelection<SlashCommand>): void {
		chat?.insertAtRange(selection.range, selection.item.insert);

		lastSelection = {
			label: selection.item.label,
			score: fuzzySubsequenceScore(selection.item.label, selection.query)
		};
		refreshSnapshot();
		chat?.focusInput();
	}

	function clearDraft(): void {
		chat?.clearInput();
		refreshSnapshot();
	}

	function refreshCaretPosition(): void {
		const editor = chat?.getEditorElement();
		caretPosition = editor
			? { start: editor.selectionStart ?? 0, end: editor.selectionEnd ?? 0 }
			: null;
	}

	/** `insertAtRange` reports its DOM errors as `DOMException`, not `Error`. */
	function getErrorName(value: unknown): string {
		if (value instanceof DOMException) return value.name;
		if (value instanceof Error) return value.name;
		return 'UnknownError';
	}

	// (a) end beyond `value.length`: native `setRangeText` clamps out-of-bounds
	// indexes to the current length rather than throwing, so this appends at
	// the end and leaves the caret there.
	function insertClampedAtEnd(): void {
		insertRangeErrorName = null;
		const currentLength = chat?.getComposerValue().length ?? 0;
		chat?.insertAtRange({ start: currentLength, end: currentLength + 1000 }, '[clamped]');
		refreshSnapshot();
		refreshCaretPosition();
	}

	// (b) start > end: native `setRangeText` throws for a reversed range.
	// Caught here so a malformed caller-supplied range can never crash the
	// page; the error name surfaces for the test to assert on.
	function insertReversedRange(): void {
		insertRangeErrorName = null;
		try {
			chat?.insertAtRange({ start: 5, end: 2 }, '[reversed]');
		} catch (error) {
			insertRangeErrorName = getErrorName(error);
		}
		refreshSnapshot();
		refreshCaretPosition();
	}

	// Wraps ChatComposerPopover's own `oncomposerkeydown` so we can count real
	// Enter firings from the page. Chat's `chat-input.svelte` calls this hook
	// for every composer keydown, so the counter is scoped to Enter here to
	// isolate the thing the IME-composition coverage below actually cares
	// about: whether Enter reached the hook. `chat-input.svelte` skips the
	// hook entirely while `event.isComposing` (or its own IME-composition
	// state) is true, so a composing Enter never increments this. Every key
	// still gets forwarded unconditionally so arrow-nav/escape keep working.
	function countComposerKeydown(
		event: KeyboardEvent,
		forward: (event: KeyboardEvent) => void
	): void {
		if (event.key === 'Enter') composerKeydownCount += 1;
		forward(event);
	}
</script>

<div style="height: 100dvh; display: flex; flex-direction: column;">
	<div
		style="padding: 0.5rem 1rem; display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: baseline; border-bottom: 1px solid var(--cinder-border);"
	>
		<button type="button" onclick={clearDraft}>Clear draft</button>
		<button type="button" onclick={refreshSnapshot}>Refresh draft preview</button>
		<span data-testid="draft-preview">Draft: "{composerSnapshot}"</span>
		{#if lastSelection}
			<span data-testid="last-selection">
				Inserted "{lastSelection.label}" (fuzzy score: {lastSelection.score})
			</span>
		{/if}
	</div>
	<div
		style="padding: 0.5rem 1rem; display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: baseline; border-bottom: 1px solid var(--cinder-border);"
	>
		<button type="button" onclick={insertClampedAtEnd}>Insert clamped at end</button>
		<button type="button" onclick={insertReversedRange}>Insert reversed range</button>
		<button type="button" onclick={refreshCaretPosition}>Refresh caret position</button>
		<span data-testid="caret-position">
			Caret: {caretPosition ? `${caretPosition.start}-${caretPosition.end}` : 'unknown'}
		</span>
		<span data-testid="insert-range-error">
			Range error: {insertRangeErrorName ?? 'none'}
		</span>
		<span data-testid="composer-keydown-count">
			Composer keydown count: {composerKeydownCount}
		</span>
	</div>
	<div style="flex: 1; min-height: 0;">
		<ChatComposerPopover
			id="composer-popover-exercise-commands"
			items={commands}
			filter={filterCommands}
			onSelect={handleSelect}
		>
			{#snippet composer(composerProps)}
				<Chat
					bind:this={chat}
					id="composer-popover-exercise-chat"
					{conversation}
					onsubmit={handleSubmit}
					composerRole={composerProps.composerRole}
					composerAriaExpanded={composerProps.composerAriaExpanded}
					composerAriaControls={composerProps.composerAriaControls}
					composerAriaActiveDescendant={composerProps.composerAriaActiveDescendant}
					composerAriaAutocomplete={composerProps.composerAriaAutocomplete}
					oncomposerinput={composerProps.oncomposerinput}
					oncomposerkeydown={(event) =>
						countComposerKeydown(event, composerProps.oncomposerkeydown)}
					oncomposerselectionchange={composerProps.oncomposerselectionchange}
					oncomposerblur={composerProps.oncomposerblur}
				/>
			{/snippet}
		</ChatComposerPopover>
	</div>
</div>
