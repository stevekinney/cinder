<script lang="ts" module>
  export const title = 'With language label and copy';
  export const description = 'Header shows the language and a copy-to-clipboard button.';
</script>

<script lang="ts">
  import { CodeBlock } from '../../../../components/src/index.ts';

  const code = `SELECT id, name, created_at
FROM users
WHERE active = true
ORDER BY created_at DESC
LIMIT 10;`;
</script>

<CodeBlock {code} language="sql" copyable />
