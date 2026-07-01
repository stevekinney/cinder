<script lang="ts" module>
  // Resolve the markdown rendering module through `@lostgradient/cinder/markdown/rendering`
  // — the published `@lostgradient/cinder` package re-exports it as a sub-path, while
  // `@cinder/markdown` itself is not in the published runtime deps. Using
  // the cinder sub-path keeps this component shippable through the
  // `svelte` export condition without requiring consumers to install
  // private workspace packages.
  type RenderingModule = typeof import('@lostgradient/cinder/markdown/rendering');
  type Highlighter = Awaited<ReturnType<RenderingModule['getHighlighter']>>;

  export type ToolPayloadCodeProps = {
    /** Structured payload text to render. */
    code: string;
    /** Additional CSS class. */
    class?: string;
  };

  let renderingModulePromise: Promise<RenderingModule> | undefined;
  let highlighterPromise: Promise<Highlighter> | undefined;

  async function getRenderingModule(): Promise<RenderingModule> {
    renderingModulePromise ??= import('@lostgradient/cinder/markdown/rendering');
    return renderingModulePromise;
  }

  async function getJsonHighlighter(): Promise<Highlighter> {
    const renderingModule = await getRenderingModule();
    highlighterPromise ??= renderingModule.getHighlighter();
    return highlighterPromise;
  }
</script>

<script lang="ts">
  import CodeBlock from '../../code-block/code-block.svelte';
  import { classNames } from '../../../utilities/class-names.ts';

  let { code, class: className }: ToolPayloadCodeProps = $props();

  async function highlightJson(source: string, language: string): Promise<string> {
    const { isLanguageSupported } = await getRenderingModule();
    const highlighter = await getJsonHighlighter();
    const lang = isLanguageSupported(language) ? language : 'json';
    return highlighter.codeToHtml(source, { lang, theme: 'depict' });
  }
</script>

<div class={classNames('tool-payload-code', className)}>
  <!-- Scoped highlighter: pass this tool-payload's own JSON/`depict`-themed
       highlighter directly so the tool payload is always highlighted with the
       depict theme — it is NOT routed through CodeBlock's bundled auto-load
       default, which would silently change the JSON theme and Shiki load
       timing. -->
  <CodeBlock {code} language="json" highlighter={highlightJson} />
</div>

<style>
  .tool-payload-code {
    inline-size: max-content;
    min-inline-size: min(18rem, 100%);
    max-inline-size: 100%;
  }

  .tool-payload-code :global(.cinder-code-block) {
    inline-size: 100%;
  }

  /* Cap tall payloads so a large arguments/result blob scrolls in place instead
   * of dominating the transcript. The viewport already owns overflow-x and is
   * focusable (tabindex=0), so adding a block-axis cap here keeps it keyboard-
   * scrollable on both axes without nesting scroll containers. Matches the
   * reasoning block's scroll region cap. */
  .tool-payload-code :global(.cinder-code-block__viewport) {
    max-block-size: 16rem;
    overflow-y: auto;
  }
</style>
