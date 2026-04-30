<script lang="ts" module>
  export const title = 'Basic code block';
  export const description = 'Multi-line preformatted code.';
</script>

<script lang="ts">
  import { CodeBlock } from '../../../../components/src/index.ts';

  const code = `function greet(name: string): string {
  return \`Hello, \${name}!\`;
}

const message = greet('world');`;
</script>

<CodeBlock {code} />
