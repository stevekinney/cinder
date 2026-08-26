<script lang="ts">
	import { resolve } from '$app/paths';

	type ExerciseSlug =
		| 'attachments'
		| 'adapter-push'
		| 'message-lifecycle'
		| 'assistant-metadata'
		| 'conversation-list'
		| 'composer-popover'
		| 'history-scroll'
		| 'virtualization'
		| 'presentation'
		| 'artifacts'
		| 'utilities'
		| 'tool-approval'
		| 'interleaving'
		| 'contracts'
		| 'review-basics'
		| 'review-views'
		| 'review-modes'
		| 'review-comment-creation'
		| 'review-comment-lifecycle'
		| 'review-anchoring'
		| 'review-form-and-exports'
		| 'review-front-matter'
		| 'review-state-and-session'
		| 'review-ssr-and-a11y'
		| 'review-imperative'
		| 'review-diff-performance'
		| 'diff-viewer'
		| 'markdown-editor'
		| 'row-reconciliation';

	type Exercise = {
		slug: ExerciseSlug;
		/**
		 * Resolved at definition, from a LITERAL, rather than built at render time
		 * from the slug.
		 *
		 * `resolve()` is typed with one overload per known route, and TypeScript
		 * resolves an overloaded call by matching a single signature — it cannot
		 * distribute a union argument across them. So
		 * ``resolve(`/exercises/${exercise.slug}`)`` passes the union of every slug
		 * to a function that only accepts one route at a time. That compiled while
		 * the union was small enough for TypeScript to keep folding, and stopped the
		 * moment this list reached 28 entries — a scaling limit, not a change in
		 * what the code means.
		 *
		 * A literal per entry is the fix rather than a cast: each call is checked
		 * against its own overload, so a slug that does not name a real route is a
		 * compile error here instead of a 404 at runtime. That is strictly more
		 * checking than the template literal ever had.
		 */
		href: string;
		title: string;
		description: string;
	};

	const exercises: Exercise[] = [
		{
			slug: 'attachments',
			href: resolve('/exercises/attachments'),
			title: 'Attachments',
			description: 'Add, remove, and fail file attachments through the composer.'
		},
		{
			slug: 'adapter-push',
			href: resolve('/exercises/adapter-push'),
			title: 'Adapter Push',
			description: "Drive the transcript entirely through a ChatAdapter's push handlers."
		},
		{
			slug: 'message-lifecycle',
			href: resolve('/exercises/message-lifecycle'),
			title: 'Message Lifecycle',
			description: 'Stream, cancel, and retry a message mid-flight.'
		},
		{
			slug: 'assistant-metadata',
			href: resolve('/exercises/assistant-metadata'),
			title: 'Assistant Metadata',
			description: 'Exercise reasoning, steps, and suggestions on assistant messages.'
		},
		{
			slug: 'conversation-list',
			href: resolve('/exercises/conversation-list'),
			title: 'Conversation List',
			description: 'Switch between multiple seeded conversations with a conversation header.'
		},
		{
			slug: 'composer-popover',
			href: resolve('/exercises/composer-popover'),
			title: 'Composer Popover',
			description: 'Trigger a slash-command popover with fuzzy filtering in the composer.'
		},
		{
			slug: 'history-scroll',
			href: resolve('/exercises/history-scroll'),
			title: 'History Scroll',
			description: 'Load older pages of history and track scroll/unread state.'
		},
		{
			slug: 'virtualization',
			href: resolve('/exercises/virtualization'),
			title: 'Virtualization',
			description: 'Confirm a large transcript stays virtualized while streaming.'
		},
		{
			slug: 'presentation',
			href: resolve('/exercises/presentation'),
			title: 'Presentation',
			description: 'Exercise copy, retry, edit, and search capabilities on a seeded transcript.'
		},
		{
			slug: 'artifacts',
			href: resolve('/exercises/artifacts'),
			title: 'Artifacts',
			description: 'Open an artifact viewer from message metadata.'
		},
		{
			slug: 'utilities',
			href: resolve('/exercises/utilities'),
			title: 'Utilities',
			description: 'Exercise the standalone message and export utility exports.'
		},
		{
			slug: 'tool-approval',
			href: resolve('/exercises/tool-approval'),
			title: 'Tool Approval',
			description:
				'Approve or deny action-required tool calls through the adapter and callback contract.'
		},
		{
			slug: 'interleaving',
			href: resolve('/exercises/interleaving'),
			title: 'Interleaving',
			description: 'Race streaming, editing, retrying, and stopping against a shared transcript.'
		},
		{
			slug: 'contracts',
			href: resolve('/exercises/contracts'),
			title: 'Contracts',
			description:
				'Pin the schema-version compatibility and height-collapse environmental contracts.'
		},

		// ReviewEditor (`@lostgradient/editor`) — a second component under the
		// same treatment as Chat. Ordered roughly from the surface inward:
		// props, then views, then comments, then the machinery underneath.
		{
			slug: 'review-basics',
			href: resolve('/exercises/review-basics'),
			title: 'Review Basics',
			description: 'Round-trip the bindable props and observe every notification callback fire.'
		},
		{
			slug: 'review-views',
			href: resolve('/exercises/review-views'),
			title: 'Review Views and Diff',
			description: 'Switch editor/diff/summary, drive the diff view modes, and revert all changes.'
		},
		{
			slug: 'review-modes',
			href: resolve('/exercises/review-modes'),
			title: 'Review Modes and Identity',
			description: 'Exercise readonly mode and what currentUserId gates.'
		},
		{
			slug: 'review-comment-creation',
			href: resolve('/exercises/review-comment-creation'),
			title: 'Review Comment Creation',
			description: 'Create threads from a selection and as document-level feedback.'
		},
		{
			slug: 'review-comment-lifecycle',
			href: resolve('/exercises/review-comment-lifecycle'),
			title: 'Review Comment Lifecycle',
			description: 'Edit, soft-delete, and hard-delete comments through a thread.'
		},
		{
			slug: 'review-anchoring',
			href: resolve('/exercises/review-anchoring'),
			title: 'Review Anchoring',
			description: 'Follow anchors through edits, re-anchoring, and orphaned text.'
		},
		{
			slug: 'review-form-and-exports',
			href: resolve('/exercises/review-form-and-exports'),
			title: 'Review Form and Exports',
			description: 'Submit a real form and copy each export the actions menu offers.'
		},
		{
			slug: 'review-front-matter',
			href: resolve('/exercises/review-front-matter'),
			title: 'Review Front Matter',
			description: 'Edit YAML front matter and check its round-trip fidelity.'
		},
		{
			slug: 'review-state-and-session',
			href: resolve('/exercises/review-state-and-session'),
			title: 'Review State and Session',
			description:
				'Serialize and restore a review through getState/setState and the session helpers.'
		},
		{
			slug: 'review-ssr-and-a11y',
			href: resolve('/exercises/review-ssr-and-a11y'),
			title: 'Review SSR and Accessibility',
			description: 'Pin SSR output, hydration, live regions, and the keyboard path.'
		},
		{
			slug: 'review-imperative',
			href: resolve('/exercises/review-imperative'),
			title: 'Review Imperative Mutation',
			description: 'Drive the eight thread and comment mutation methods through bind:this.'
		},
		{
			slug: 'review-diff-performance',
			href: resolve('/exercises/review-diff-performance'),
			title: 'Review Diff Performance',
			description:
				'ROADMAP X-1: measure the per-keystroke cost of the toolbar diff recompute against a large document.'
		},
		{
			slug: 'diff-viewer',
			href: resolve('/exercises/diff-viewer'),
			title: 'Diff Viewer',
			description:
				'Mount the standalone DiffViewer directly and drive getHunks, the view modes, and its window-level keys.'
		},
		{
			slug: 'markdown-editor',
			href: resolve('/exercises/markdown-editor'),
			title: 'Markdown Editor',
			description:
				'Drive the seven imperative methods and the plugin seam on the standalone editor.'
		},
		{
			slug: 'row-reconciliation',
			href: resolve('/exercises/row-reconciliation'),
			title: 'Row Reconciliation',
			description: 'Insert, remove, and hide rows, and watch focus when the focused row unmounts.'
		}
	];
</script>

<div style="max-width: 40rem; margin: 0 auto; padding: 2rem 1rem;">
	<h1>Exercises</h1>
	<ul style="list-style: none; padding: 0; margin: 1.5rem 0 0; display: grid; gap: 1rem;">
		{#each exercises as exercise (exercise.slug)}
			<li>
				<!--
					`exercise.href` IS resolved — every entry builds it with
					`resolve('/exercises/…')` from a literal, which is what makes each call
					typecheck against its own overload (see the `href` field's docblock).
					The rule is a syntactic check for a `resolve()` call at the href site
					and cannot follow the value back to its definition, so it reports a
					false positive here.

					Disabled for this line only, with the reason, rather than turned off in
					the config: the rule is right about every other anchor in this repo, and
					the next person to add one should still be caught by it.
				-->
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
				<a href={exercise.href}>{exercise.title}</a>
				<p style="margin: 0.25rem 0 0; color: var(--cinder-text-muted, currentColor);">
					{exercise.description}
				</p>
			</li>
		{/each}
	</ul>
</div>
