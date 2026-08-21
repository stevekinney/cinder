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
   * different content. The only thing this adds is the colour-token panel.
   * Its ColorPicker/Popover/Input graph loads when the reader opens the panel,
   * rather than making every landing-page visit pay for an advanced editor.
   */
  import { Button } from '@lostgradient/cinder/button';
  import Palette from 'lucide-svelte/icons/palette';
  import type { Component } from 'svelte';

  import ComponentPage from '../component-page.svelte';
  import { PreviewStore, setPreviewStore } from './preview-store.svelte.ts';

  type Props = {
    components: string[];
    readmeHtml: string;
  };

  let { components, readmeHtml }: Props = $props();

  const store = new PreviewStore();
  setPreviewStore(store);

  /** Accessible name of the panel trigger; also the focus-restoration hook. */
  const COLOR_PANEL_LABEL = 'Color token panel';

  let isColorPanelOpen = $state(false);
  type ColorTokenPanelModule = {
    default: Component<{ onClose: () => void }>;
  };
  let colorTokenPanelModule = $state<Promise<ColorTokenPanelModule> | null>(null);

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
    /*
     * Selected by its accessible name, not by `data-testid`. Focus restoration
     * is runtime behaviour; keying it off a testing affordance means renaming
     * that attribute silently breaks keyboard focus when the panel closes.
     */
    requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(`button[aria-label="${COLOR_PANEL_LABEL}"]`)?.focus();
    });
  }

  async function toggleColorPanel(): Promise<void> {
    if (isColorPanelOpen) {
      closeColorPanel();
      return;
    }
    colorTokenPanelModule ??= import('./color-token-panel.svelte');
    await colorTokenPanelModule;
    isColorPanelOpen = true;
  }

  function getColorTokenPanelModule(): Promise<ColorTokenPanelModule> {
    if (colorTokenPanelModule === null) {
      throw new Error('Color token panel module was requested before loading.');
    }

    return colorTokenPanelModule;
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
      aria-label={COLOR_PANEL_LABEL}
      {...isColorPanelOpen ? { 'aria-controls': 'color-token-panel' } : {}}
      aria-expanded={isColorPanelOpen}
      data-testid="color-token-panel-toggle"
      onclick={() => void toggleColorPanel()}
    >
      <Palette size={17} strokeWidth={1.5} aria-hidden="true" />
    </Button>
  {/snippet}

  {#snippet overlays()}
    {#if isColorPanelOpen}
      {#await getColorTokenPanelModule() then module}
        {@const ColorTokenPanel = module.default}
        <ColorTokenPanel onClose={closeColorPanel} />
      {/await}
    {/if}
  {/snippet}
</ComponentPage>
