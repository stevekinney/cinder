<script lang="ts">
	import {
		appendMessages,
		ArtifactViewer,
		Chat,
		ChatArtifactLayout,
		CINDER_ARTIFACT_METADATA_KEY,
		createConversationHistory,
		type ChatArtifact,
		type ChatRowContext,
		type ConversationHistory
	} from '@lostgradient/chat';

	const heroHtml = `<!doctype html><html><body style="font-family: sans-serif; margin: 0; padding: 3rem; background: #f5f3ff; color: #2e1065;"><h1>Build faster</h1><p>A generated hero section, rendered in a sandboxed iframe.</p></body></html>`;

	const logoSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><circle cx="60" cy="60" r="50" fill="#7c3aed" /><text x="60" y="68" font-size="28" text-anchor="middle" fill="white" font-family="sans-serif">CR</text></svg>`;

	const pricingTableCode = `<script lang="ts">\n\tconst tiers = ['Starter', 'Team', 'Enterprise'];\n<\u002Fscript>\n\n<ul>\n\t{#each tiers as tier}\n\t\t<li>{tier}</li>\n\t{/each}\n</ul>`;

	const flowMermaid = `flowchart TD\n\tA[Request] --> B{Cache hit?}\n\tB -- yes --> C[Return cached artifact]\n\tB -- no --> D[Generate artifact]\n\tD --> C`;

	// Security-coverage fixtures: hostile content probing ArtifactViewer's
	// sandboxed iframe (`sandbox=""`, no `allow-scripts`/`allow-same-origin`).
	// The inline <script> mutates the frame's own DOM, flips its own
	// `document.title`, and — only if it somehow ran — attempts a
	// `window.top`/`parent` reach, recording the outcome in
	// `#top-access-marker` rather than throwing past the try/catch. The
	// `onclick` handler and the `javascript:` link probe whether *any*
	// scripting path survives the sandbox, not just <script> tags.
	const hostileHtml = `<!doctype html>
<html>
<body>
	<div id="hostile-marker">hostile html loaded</div>
	<div id="top-access-marker">not attempted</div>
	<div id="onclick-marker">not clicked</div>
	<button id="onclick-button" onclick="document.getElementById('onclick-marker').textContent='onclick fired'">
		Trigger onclick
	</button>
	<a id="js-link" href="javascript:document.getElementById('onclick-marker').textContent='javascript: link fired'">
		javascript: link
	</a>
	<script>
		document.title = 'HOSTILE-TITLE-INJECTED';
		var marker = document.createElement('div');
		marker.id = 'script-executed-marker';
		marker.textContent = 'inline script ran';
		document.body.appendChild(marker);
		try {
			var topTitle = window.top.document.title;
			document.getElementById('top-access-marker').textContent = 'top-access-succeeded:' + topTitle;
		} catch (error) {
			document.getElementById('top-access-marker').textContent = 'top-access-denied:' + error.name;
		}
	<\u002Fscript>
</body>
</html>`;

	const hostileSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">
	<circle cx="60" cy="60" r="50" fill="#dc2626" />
	<script>
		document.title = 'HOSTILE-SVG-TITLE-INJECTED';
		var marker = document.createElement('div');
		marker.id = 'svg-script-executed-marker';
		marker.textContent = 'svg inline script ran';
		document.body.appendChild(marker);
	<\u002Fscript>
</svg>`;

	/**
	 * Static, deterministic transcript: a user message per artifact, an
	 * assistant text reply carrying `cinder:artifact` metadata directly, and
	 * one tool-call/tool-result pair (the SVG logo) with the artifact
	 * metadata on the tool-RESULT message — Chat folds paired tool-results
	 * into the visible tool-call row and resolves the folded result's
	 * artifact into that row's `ChatRowContext.artifact` (the first-class
	 * convention added in chat 0.2.0).
	 */
	function buildConversation(): ConversationHistory {
		let conversation = createConversationHistory({ id: 'artifacts-demo' });

		conversation = appendMessages(
			conversation,
			{ role: 'user', content: 'Generate a hero section for the landing page.' },
			{
				role: 'assistant',
				content: "Here's a hero section artifact — open it to preview the rendered HTML.",
				metadata: {
					[CINDER_ARTIFACT_METADATA_KEY]: {
						type: 'html',
						title: 'Landing Page Hero',
						content: heroHtml
					} satisfies ChatArtifact
				}
			},
			{ role: 'user', content: 'Can you pull up the logo you generated earlier?' },
			{
				role: 'tool-call',
				content: '',
				toolCall: { id: 'call_logo', name: 'fetch_artifact', arguments: { title: 'Company Logo' } }
			},
			{
				role: 'tool-result',
				content: '',
				toolResult: { callId: 'call_logo', outcome: 'success', content: { title: 'Company Logo' } },
				metadata: {
					[CINDER_ARTIFACT_METADATA_KEY]: {
						type: 'svg',
						title: 'Company Logo',
						content: logoSvg
					} satisfies ChatArtifact
				}
			},
			{ role: 'user', content: 'Show me the source for the pricing table component.' },
			{
				role: 'assistant',
				content: "Here's the component source as a code artifact.",
				metadata: {
					[CINDER_ARTIFACT_METADATA_KEY]: {
						type: 'code',
						title: 'Pricing Table Source',
						content: pricingTableCode,
						language: 'svelte'
					} satisfies ChatArtifact
				}
			},
			{ role: 'user', content: 'And a diagram of how artifact generation is cached.' },
			{
				role: 'assistant',
				content: "Here's the flow as a Mermaid diagram artifact.",
				metadata: {
					[CINDER_ARTIFACT_METADATA_KEY]: {
						type: 'mermaid',
						title: 'Artifact Cache Flow',
						content: flowMermaid
					} satisfies ChatArtifact
				}
			},
			// Security-coverage fixtures — appended at the end so they don't
			// disturb the row indices/testids the existing e2e assertions rely on.
			{ role: 'user', content: 'Render an HTML artifact from an untrusted source.' },
			{
				role: 'assistant',
				content:
					"Here's the (hostile) HTML artifact — it should be fully contained by the sandbox.",
				metadata: {
					[CINDER_ARTIFACT_METADATA_KEY]: {
						type: 'html',
						title: 'Hostile HTML Artifact',
						content: hostileHtml
					} satisfies ChatArtifact
				}
			},
			{ role: 'user', content: 'And an SVG artifact carrying an embedded script.' },
			{
				role: 'assistant',
				content: "Here's the (hostile) SVG artifact — same sandbox should contain it.",
				metadata: {
					[CINDER_ARTIFACT_METADATA_KEY]: {
						type: 'svg',
						title: 'Hostile SVG Artifact',
						content: hostileSvg
					} satisfies ChatArtifact
				}
			}
		);

		return conversation;
	}

	/**
	 * The four original artifacts each have a unique `type`, so
	 * `open-artifact-{type}` was already unique — existing e2e selectors
	 * depend on that exact id. The two hostile fixtures share a `type` with
	 * an existing artifact (html, svg), so they get a distinguishing suffix
	 * instead of changing the scheme for everyone.
	 */
	function artifactTestId(artifact: ChatArtifact): string {
		const suffix = artifact.title?.startsWith('Hostile') ? '-hostile' : '';
		return `open-artifact-${artifact.type}${suffix}`;
	}

	// Plain `const`: this transcript is static for the lifetime of the page —
	// there is no adapter, streaming, or editing that would mutate it.
	const conversation: ConversationHistory = buildConversation();

	// Kept separate from `activeArtifact`: closing the panel clears `panelOpen`
	// but preserves the last-viewed artifact, so "reopen" can restore it
	// without requiring the user to click a message row again.
	let activeArtifact = $state<ChatArtifact | undefined>(undefined);
	let panelOpen = $state(false);

	function openArtifact(artifact: ChatArtifact): void {
		activeArtifact = artifact;
		panelOpen = true;
	}

	function closePanel(): void {
		panelOpen = false;
	}

	function reopenPanel(): void {
		if (!activeArtifact) return;
		panelOpen = true;
	}
</script>

{#snippet mermaidRenderer(content: string)}
	<pre data-testid="custom-mermaid-renderer">custom renderer: {content}</pre>
{/snippet}

<div style="height: 100dvh; display: flex; flex-direction: column;">
	<div style="padding: 0.5rem 1rem; border-bottom: 1px solid var(--cinder-border);">
		{#if !panelOpen && activeArtifact}
			<button type="button" data-testid="reopen-artifact" onclick={reopenPanel}>
				Reopen "{activeArtifact.title}"
			</button>
		{:else}
			<span data-testid="panel-status">
				{panelOpen ? 'Artifact panel open' : 'No artifact open'}
			</span>
		{/if}
	</div>

	<div style="flex: 1; min-height: 0;">
		<ChatArtifactLayout
			instanceId="artifacts-demo"
			open={panelOpen}
			panelTitle={activeArtifact?.title}
			onclose={closePanel}
		>
			<Chat id="artifacts-exercise-chat" {conversation}>
				{#snippet messageActions(context: ChatRowContext)}
					{#if context.artifact}
						{@const artifact = context.artifact}
						<!-- Native button on the documented `chat-message-action-button`
						     class contract (cinder#887): the action bar styles it to
						     match the built-in actions. -->
						<button
							type="button"
							class="chat-message-action-button"
							data-testid={artifactTestId(artifact)}
							onclick={() => openArtifact(artifact)}
						>
							View "{artifact.title}"
						</button>
					{/if}
				{/snippet}
			</Chat>

			{#snippet panel()}
				{#if activeArtifact}
					<ArtifactViewer
						type={activeArtifact.type}
						content={activeArtifact.content}
						title={activeArtifact.title}
						language={activeArtifact.language}
						{mermaidRenderer}
					/>
				{/if}
			{/snippet}
		</ChatArtifactLayout>
	</div>
</div>
