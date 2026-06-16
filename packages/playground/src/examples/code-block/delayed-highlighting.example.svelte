<script lang="ts" module>
  export const title = 'Delayed highlighting';
  export const description =
    'Colorization can resolve after first paint while the code block keeps its dimensions.';
</script>

<script lang="ts">
  import { CodeBlock } from '@lostgradient/cinder';

  const code = `SELECT id, name, created_at, email_address, account_status, last_seen_at, billing_plan, feature_flags
FROM users
WHERE active = true
ORDER BY created_at DESC
LIMIT 10;`;

  const highlightedHtml = `<pre class="shiki" style="background-color:#fff;color:#24292e"><code>${escapeHtml(
    code,
  )}</code></pre>`;

  type LayoutHighlighterWindow = Window & {
    cinderCodeBlockLayoutHighlighterReady?: boolean;
    resolveCinderCodeBlockLayoutHighlight?: () => void;
  };

  if (typeof window !== 'undefined') {
    (window as LayoutHighlighterWindow).cinderCodeBlockLayoutHighlighterReady = false;
  }

  function escapeHtml(value: string): string {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function highlighter(): Promise<string> {
    return new Promise((resolve) => {
      if (typeof window === 'undefined') return;
      const target = window as LayoutHighlighterWindow;
      target.resolveCinderCodeBlockLayoutHighlight = () => resolve(highlightedHtml);
      target.cinderCodeBlockLayoutHighlighterReady = true;
    });
  }
</script>

<CodeBlock {code} language="sql" {highlighter} />
