<script lang="ts" module>
  export const title = 'Basic tree';
  export const description =
    'A small hierarchy with one branch expanded. Uses the Tree namespace API: Tree.Item composes inside the parent Tree.';
</script>

<script lang="ts">
  import { Tree } from '@lostgradient/cinder/tree';

  let expandedIds = $state<string[]>(['fruit']);
</script>

<Tree aria-label="Pantry" bind:expandedIds>
  <Tree.Item id="fruit" label="Fruit" branch>
    <Tree.Item id="apple" label="Apple" />
    <Tree.Item id="banana" label="Banana" />
    <Tree.Item id="citrus" label="Citrus" branch>
      <Tree.Item id="lemon" label="Lemon" />
      <Tree.Item id="orange" label="Orange" />
    </Tree.Item>
  </Tree.Item>
  <Tree.Item id="grain" label="Grain" branch>
    <Tree.Item id="rice" label="Rice" />
    <Tree.Item id="wheat" label="Wheat" />
  </Tree.Item>
</Tree>
