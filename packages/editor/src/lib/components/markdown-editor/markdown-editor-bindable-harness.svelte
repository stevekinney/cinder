<script lang="ts">
  /**
   * Test-only fixture. Exists solely so
   * `markdown-editor.setmarkdown-onewaysync.test.ts` can exercise a REAL
   * `bind:value` consumer of MarkdownEditor — the scenario `setMarkdown()`'s
   * `value = content;` write exists to support (added in the cinder#1306/
   * #1302/#1304 batch, see that commit's history on markdown-editor.svelte).
   * `@testing-library/svelte`'s `render()`/`rerender()` always passes props
   * one-way (no setter descriptor on the props object it builds — see
   * `props.svelte.js` in `@testing-library/svelte-core`), so it cannot
   * exercise `bind:` on its own; this wrapper supplies the genuine two-way
   * binding and exposes enough of an imperative surface for the test to
   * drive and observe it.
   */
  import MarkdownEditor from './markdown-editor.svelte';

  let { initialValue = '' }: { initialValue?: string } = $props();

  // svelte-ignore state_referenced_locally -- seeding local state from an
  // initial prop, then treating it as independently controlled afterward,
  // is intentional here (see link-popover.svelte for the same pattern).
  let value = $state(initialValue);
  let editorRef: MarkdownEditor | undefined = $state();

  export function getValue(): string {
    return value;
  }

  export function setMarkdownOnEditor(content: string): void {
    editorRef?.setMarkdown(content);
  }
</script>

<MarkdownEditor
  bind:this={editorRef}
  bind:value
  id="bindable-harness"
  label="Bindable harness"
  showToolbar={false}
/>
