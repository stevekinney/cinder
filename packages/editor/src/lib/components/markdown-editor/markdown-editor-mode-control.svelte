<script lang="ts">
  /**
   * MarkdownEditor's single built-in mode control. It reports the user's
   * choice and never writes the mode itself, so an invalid parent `mode` is
   * never written back.
   */
  import { FileCode, FileText, Pencil, Segment, SegmentedControl } from '@lostgradient/cinder';
  import type { EditorMode } from './markdown-editor.types.ts';

  let {
    id,
    label,
    mode,
    onSelect,
  }: {
    id: string;
    label: string;
    mode: EditorMode;
    onSelect: (mode: EditorMode) => void;
  } = $props();
</script>

<SegmentedControl
  {id}
  selectionMode="single"
  size="sm"
  value={mode}
  {label}
  labelVisible={false}
  onValueChange={(next) => onSelect(next as EditorMode)}
>
  <Segment value="wysiwyg" aria-label="Rich editor"
    ><Pencil class="cinder-icon-xs" aria-hidden="true" /><span class="cinder-sr-only">Rich</span
    ></Segment
  >
  <Segment value="source" aria-label="Raw Markdown"
    ><FileCode class="cinder-icon-xs" aria-hidden="true" /><span class="cinder-sr-only">Raw</span
    ></Segment
  >
  <Segment value="preview" aria-label="Preview"
    ><FileText class="cinder-icon-xs" aria-hidden="true" /><span class="cinder-sr-only"
      >Preview</span
    ></Segment
  >
</SegmentedControl>
