<script lang="ts">
  /**
   * Renders one artifact/section value by structure (plan §9.5, Track D).
   * Dispatch lives in `./review-domain.ts`'s pure `classifyArtifactValue()`;
   * this component only owns the presentation per kind:
   *   - `text`   → a plain paragraph.
   *   - `markdown` → `@lostgradient/markdown`'s
   *     `renderMarkdown()`, which sanitizes before returning HTML — safe to
   *     `{@html}`.
   *   - `image`  → a plain `<img>`. `imageUrl` is asserted by an artifact
   *     AUTHOR (a workflow), which is a step below "fully untrusted end
   *     user input" but still not the console's own content — `src` is
   *     browser-validated the same way any `<img src>` is; no code
   *     execution surface exists for an image tag.
   *   - `html`   → an `iframe sandbox=""` with `srcdoc`. Empty `sandbox`
   *     (not omitted) is deliberate: it blocks script execution, forms,
   *     popups, and top-navigation while still rendering markup/CSS — the
   *     safe way to display artifact-supplied HTML the console did not
   *     author, without hand-rolling an HTML sanitizer allow-list.
   *   - `inspector` → `PayloadInspector` with humanized top-level keys
   *     (`humanizeKeys`) for a plain object, or the raw value otherwise
   *     (arrays/primitives have no keys to humanize).
   */
  import { PayloadInspector } from '@lostgradient/cinder';
  import { renderMarkdown } from '@lostgradient/markdown';

  import { classifyArtifactValue, humanizeKeys } from './review-domain.ts';

  interface ArtifactViewProps {
    value: unknown;
    /** Header label passed through to `PayloadInspector` for the inspector fallback. */
    label?: string;
  }

  let { value, label = 'Artifact' }: ArtifactViewProps = $props();

  const rendered = $derived(classifyArtifactValue(value));

  function isPlainObject(candidate: unknown): candidate is Record<string, unknown> {
    return typeof candidate === 'object' && candidate !== null && !Array.isArray(candidate);
  }

  const inspectorValue = $derived(
    rendered.kind === 'inspector' && isPlainObject(rendered.value)
      ? humanizeKeys(rendered.value)
      : rendered.kind === 'inspector'
        ? rendered.value
        : undefined,
  );
</script>

{#if rendered.kind === 'text'}
  <p class="weft-artifact-text">{rendered.text}</p>
{:else if rendered.kind === 'markdown'}
  <!-- eslint-disable-next-line svelte/no-at-html-tags -->
  <div class="weft-artifact-markdown">{@html renderMarkdown(rendered.markdown).html}</div>
{:else if rendered.kind === 'image'}
  <img class="weft-artifact-image" src={rendered.imageUrl} alt="Review artifact" />
{:else if rendered.kind === 'html'}
  <iframe
    class="weft-artifact-html"
    title="Review artifact content"
    sandbox=""
    srcdoc={rendered.html}
  ></iframe>
{:else}
  <PayloadInspector value={inspectorValue} {label} />
{/if}
