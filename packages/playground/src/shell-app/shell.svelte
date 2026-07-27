<script lang="ts">
  /*
   * The landing page (`/`).
   *
   * This used to be a second, parallel chrome: its own top bar with a Light/Dark
   * segmented control, its own sidebar markup with Title Case labels, its own
   * layout. Component pages had a different top bar, a different theme toggle,
   * different label casing, and no filter. Two chromes on one site.
   *
   * It is now a thin wrapper around the SAME component every documentation page
   * renders, in landing mode — so `/` and `/page/<name>` are one layout with
   * different content. The only thing this adds is the colour-token panel, which
   * lives here because it pulls ColorPicker/Popover/Input/Button: this is one
   * bundle, whereas the documentation page compiles once per component (170
   * bundles), where that graph made each build ~4x slower.
   */
  import { Button } from '@lostgradient/cinder/button';
  import Palette from 'lucide-svelte/icons/palette';

  import ComponentPage from '../component-page.svelte';
  import ColorTokenPanel from './color-token-panel.svelte';
  import { PreviewStore, setPreviewStore } from './preview-store.svelte.ts';

  type Props = {
    components: string[];
    readmeHtml: string;
  };

  let { components, readmeHtml }: Props = $props();

  const store = new PreviewStore('');
  setPreviewStore(store);

  let isColorPanelOpen = $state(false);

  $effect(() => {
    store.applyActiveColorTokenOverridesToDocument(document);
  });

  /**
   * True when an open colour-picker popover should absorb this Escape — either a
   * token trigger is expanded, or the event came from inside the popover. The
   * first press dismisses the picker, a later one closes the panel.
   */
  function isColorTokenPickerEscape(event: KeyboardEvent): boolean {
    if (document.querySelector('.token-color-trigger[aria-expanded="true"]') !== null) return true;
    return event
      .composedPath()
      .some(
        (target) =>
          target instanceof HTMLElement && target.classList.contains('color-token-picker-popover'),
      );
  }

  $effect(() => {
    if (!isColorPanelOpen) return;

    const onKeydown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      if (isColorTokenPickerEscape(event)) return;
      closeColorPanel();
    };

    window.addEventListener('keydown', onKeydown);
    return () => window.removeEventListener('keydown', onKeydown);
  });

  function closeColorPanel(): void {
    isColorPanelOpen = false;
    requestAnimationFrame(() => {
      document.querySelector<HTMLElement>('[data-testid="color-token-panel-toggle"]')?.focus();
    });
  }
</script>

<ComponentPage
  {readmeHtml}
  sidebarComponents={components}
  onThemeChange={(next) => store.adoptTheme(next)}
>
  {#snippet toolbarActions()}
    <Button
      variant="ghost"
      size="sm"
      iconOnly
      aria-label="Color token panel"
      {...isColorPanelOpen ? { 'aria-controls': 'color-token-panel' } : {}}
      aria-expanded={isColorPanelOpen}
      data-testid="color-token-panel-toggle"
      onclick={() => (isColorPanelOpen = !isColorPanelOpen)}
    >
      <Palette size={17} strokeWidth={1.5} aria-hidden="true" />
    </Button>
  {/snippet}

  {#snippet overlays()}
    {#if isColorPanelOpen}
      <ColorTokenPanel onClose={closeColorPanel} />
    {/if}
  {/snippet}
</ComponentPage>
