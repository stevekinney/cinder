<script lang="ts">
  let { code, language, highlight }: { code: string; language?: string; highlight?: boolean } =
    $props();
</script>

<pre
  data-language={language}
  data-highlight={language !== undefined && highlight !== false ? 'on' : 'off'}><code>{code}</code
  ></pre>
