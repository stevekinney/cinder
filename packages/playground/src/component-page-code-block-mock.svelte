<script lang="ts">
  let { code, language }: { code: string; language?: string } = $props();
</script>

<pre data-language={language}><code>{code}</code></pre>
