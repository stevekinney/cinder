<script lang="ts" module>
  export const title = 'Bounded source diff viewer';
  export const description =
    'Large patches can cap rendered diff rows while preserving the total count.';
</script>

<script lang="ts">
  import { SourceDiffViewer } from '@lostgradient/cinder/source-diff-viewer';

  const patch = `diff --git a/src/generated.txt b/src/generated.txt
--- a/src/generated.txt
+++ b/src/generated.txt
@@ -1,6 +1,6 @@
 unchanged
-old one
+new one
-old two
+new two
 unchanged
`;
</script>

<SourceDiffViewer {patch} maxLines={4} />
