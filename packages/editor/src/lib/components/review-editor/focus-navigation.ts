/**
 * F6 Landmark Navigation Utility
 *
 * Implements the F6 keyboard navigation pattern for cycling focus between
 * landmark regions. This is a Windows accessibility pattern that has been
 * widely adopted by web applications for navigating between major UI sections.
 *
 * The F6 key cycles forward through regions, and Shift+F6 cycles backward.
 *
 * @example
 * ```ts
 * const regions: FocusRegion[] = [
 *   { id: 'editor', selector: '.editor-content', label: 'Editor' },
 *   { id: 'sidebar', selector: '.comment-sidebar', label: 'Comments' },
 *   { id: 'popover', selector: '.thread-popover', label: 'Thread' },
 * ];
 *
 * const navigator = createFocusRegionNavigator(regions);
 *
 * function handleKeyDown(event: KeyboardEvent) {
 *   if (event.key === 'F6') {
 *     event.preventDefault();
 *     const container = event.currentTarget as HTMLElement;
 *     const current = navigator.getCurrentRegion(container);
 *     const next = navigator.getNextRegion(current, event.shiftKey);
 *     navigator.focusRegion(container, next);
 *   }
 * }
 * ```
 */

/**
 * Defines a focusable region for F6 navigation.
 */
export interface FocusRegion {
  /** Unique identifier for the region */
  id: string;
  /** CSS selector to find the region element within a container */
  selector: string;
  /** Human-readable label for the region (used for announcements) */
  label: string;
}

/**
 * Options for creating a focus region navigator.
 */
export interface FocusRegionNavigatorOptions {
  /**
   * Callback to determine if a region should be included in the navigation cycle.
   * Use this to conditionally exclude regions (e.g., exclude 'popover' when closed).
   *
   * @param region - The region to check
   * @returns true if the region should be navigable, false to skip it
   */
  isRegionActive?: (region: FocusRegion) => boolean;

  /**
   * Custom focus handler for specific regions.
   * Use this when a region requires special focus logic (e.g., focusing a ProseMirror editor).
   *
   * @param region - The region being focused
   * @param container - The scoping container element
   * @returns true if focus was handled, false to use default behavior
   */
  customFocusHandler?: (region: FocusRegion, container: HTMLElement) => boolean;
}

/**
 * Navigator interface returned by createFocusRegionNavigator.
 */
export interface FocusRegionNavigator {
  /**
   * Get the currently focused region based on document.activeElement.
   *
   * @param container - The container element to scope the check within.
   *   This supports multiple navigator instances on the same page.
   * @returns The current region, or null if focus is outside all regions
   */
  getCurrentRegion(container: HTMLElement): FocusRegion | null;

  /**
   * Get the next region in the navigation cycle.
   *
   * @param current - The current region (or null if none focused)
   * @param reverse - If true, navigate backward (Shift+F6)
   * @returns The next region to focus
   */
  getNextRegion(current: FocusRegion | null, reverse?: boolean): FocusRegion;

  /**
   * Focus the first focusable element within a region.
   *
   * @param container - The container element to scope the query within
   * @param region - The region to focus
   */
  focusRegion(container: HTMLElement, region: FocusRegion): void;

  /**
   * Get all currently active regions (respecting isRegionActive filter).
   *
   * @returns Array of active regions
   */
  getActiveRegions(): FocusRegion[];
}

/**
 * Standard focusable element selector.
 * Matches interactive elements that can receive keyboard focus.
 */
const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Create a focus region navigator for F6 landmark navigation.
 *
 * @param regions - Array of focus regions in navigation order
 * @param options - Optional configuration
 * @returns Navigator with methods for region navigation
 */
export function createFocusRegionNavigator(
  regions: FocusRegion[],
  options: FocusRegionNavigatorOptions = {},
): FocusRegionNavigator {
  const { isRegionActive, customFocusHandler } = options;

  /**
   * Get the list of currently active regions.
   */
  function getActiveRegions(): FocusRegion[] {
    if (!isRegionActive) {
      return regions;
    }
    return regions.filter(isRegionActive);
  }

  function getFallbackRegion(): FocusRegion {
    const firstRegion = regions[0];
    if (!firstRegion) {
      throw new Error('createFocusRegionNavigator requires at least one focus region.');
    }
    return firstRegion;
  }

  /**
   * Get the current region based on document.activeElement.
   */
  function getCurrentRegion(container: HTMLElement): FocusRegion | null {
    const active = document.activeElement;
    if (!active || !container.contains(active)) {
      return null;
    }

    // Check each region to see if it contains the active element
    for (const region of regions) {
      const element = container.querySelector(region.selector);
      if (element?.contains(active)) {
        return region;
      }
    }

    return null;
  }

  /**
   * Get the next region in the cycle.
   */
  function getNextRegion(current: FocusRegion | null, reverse = false): FocusRegion {
    const activeRegions = getActiveRegions();

    // If no regions active, return the first defined region
    if (activeRegions.length === 0) {
      return getFallbackRegion();
    }

    // If no current region, return the first active region
    if (!current) {
      return activeRegions[0] ?? getFallbackRegion();
    }

    // Find current region's index in the active list
    const currentIndex = activeRegions.findIndex((r) => r.id === current.id);

    // If current region is not in active list (e.g., just became inactive),
    // return the first active region
    if (currentIndex === -1) {
      return activeRegions[0] ?? getFallbackRegion();
    }

    // Calculate next index with wrap-around
    const nextIndex = reverse
      ? (currentIndex - 1 + activeRegions.length) % activeRegions.length
      : (currentIndex + 1) % activeRegions.length;

    return activeRegions[nextIndex] ?? getFallbackRegion();
  }

  /**
   * Focus the first focusable element within a region.
   */
  function focusRegion(container: HTMLElement, region: FocusRegion): void {
    // Try custom handler first
    if (customFocusHandler?.(region, container)) {
      return;
    }

    // Default behavior: find the region element and focus first focusable child
    const element = container.querySelector(region.selector);
    if (element instanceof HTMLElement) {
      const focusable = element.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      (focusable ?? element).focus();
    }
  }

  return {
    getCurrentRegion,
    getNextRegion,
    focusRegion,
    getActiveRegions,
  };
}
