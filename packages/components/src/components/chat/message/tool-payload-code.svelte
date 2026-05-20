<script lang="ts" module>
  type RenderingModule = typeof import('@cinder/markdown/rendering');
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
    renderingModulePromise ??= import('@cinder/markdown/rendering');
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
</style>
