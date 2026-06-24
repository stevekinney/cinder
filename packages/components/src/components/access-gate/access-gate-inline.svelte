<script lang="ts" module>
  import type { Snippet } from 'svelte';
  import type { SvelteHTMLElements } from 'svelte/elements';

  export type AccessGateInlineProps = Omit<
    SvelteHTMLElements['div'],
    'aria-describedby' | 'aria-labelledby' | 'class' | 'role'
  > & {
    /** Additional class names appended to the inline denied wrapper. */
    class?: string | undefined;
    /** Human-readable explanation for why the action is unavailable. */
    reason: string;
    /** Control or controls kept visible while denied. */
    children?: Snippet;
  };
</script>

<script lang="ts">
  import { Lock } from 'lucide-svelte';
  import type { Attachment } from 'svelte/attachments';

  import { classNames } from '../../utilities/class-names.ts';

  const INTERACTIVE_SELECTOR = [
    'button',
    'input',
    'select',
    'textarea',
    'fieldset',
    'optgroup',
    'option',
    'summary',
    'a[href]',
    'audio[controls]',
    'video[controls]',
    '[contenteditable]:not([contenteditable="false"])',
    '[role="button"]',
    '[role="checkbox"]',
    '[role="combobox"]',
    '[role="gridcell"]',
    '[role="link"]',
    '[role="listbox"]',
    '[role="menuitem"]',
    '[role="menuitemcheckbox"]',
    '[role="menuitemradio"]',
    '[role="option"]',
    '[role="searchbox"]',
    '[role="scrollbar"]',
    '[role="slider"]',
    '[role="spinbutton"]',
    '[role="tab"]',
    '[role="textbox"]',
    '[role="treeitem"]',
    '[role="radio"]',
    '[role="switch"]',
  ].join(',');

  type NativeDisableable =
    | HTMLButtonElement
    | HTMLInputElement
    | HTMLSelectElement
    | HTMLTextAreaElement
    | HTMLFieldSetElement
    | HTMLOptGroupElement
    | HTMLOptionElement;

  let { reason, children, class: customClassName, ...rest }: AccessGateInlineProps = $props();

  const baseId = $props.id();
  const inlineTitleId = `${baseId}-title`;
  const inlineReasonId = `${baseId}-reason`;

  function isNativeDisableable(element: HTMLElement): element is NativeDisableable {
    return (
      element instanceof HTMLButtonElement ||
      element instanceof HTMLInputElement ||
      element instanceof HTMLSelectElement ||
      element instanceof HTMLTextAreaElement ||
      element instanceof HTMLFieldSetElement ||
      element instanceof HTMLOptGroupElement ||
      element instanceof HTMLOptionElement
    );
  }

  function appendId(value: string | null, id: string): string {
    const ids = (value ?? '').split(/\s+/).filter(Boolean);
    if (!ids.includes(id)) {
      ids.push(id);
    }
    return ids.join(' ');
  }

  function removeId(value: string | null, id: string): string | null {
    const ids = (value ?? '').split(/\s+/).filter((candidate) => candidate && candidate !== id);
    return ids.length > 0 ? ids.join(' ') : null;
  }

  function restoreAttribute(element: HTMLElement, name: string, value: string | null): void {
    if (value === null) {
      element.removeAttribute(name);
    } else {
      element.setAttribute(name, value);
    }
  }

  function setAttributeIfChanged(element: HTMLElement, name: string, value: string): void {
    if (element.getAttribute(name) !== value) {
      element.setAttribute(name, value);
    }
  }

  type DisabledControlState = {
    nativeDisabled: boolean | undefined;
    ariaDisabled: string | null;
    tabindex: string | null;
    href: string | null;
    dataControl: string | null;
  };

  type ConsumerStateRefreshes = ReadonlyArray<readonly [HTMLElement, readonly string[]]>;

  const disableDeniedControls: Attachment<HTMLElement> = (element) => {
    const disabledControls: Array<[HTMLElement, DisabledControlState]> = [];
    let ignoringGateMutations = false;
    let mutationResetVersion = 0;
    inlineContentDisabled = false;

    function disabledControlIndex(control: HTMLElement): number {
      return disabledControls.findIndex(([disabledControl]) => disabledControl === control);
    }

    function captureControlState(control: HTMLElement): DisabledControlState {
      return {
        nativeDisabled: isNativeDisableable(control) ? control.disabled : undefined,
        ariaDisabled: control.getAttribute('aria-disabled'),
        tabindex: control.getAttribute('tabindex'),
        href: control instanceof HTMLAnchorElement ? control.getAttribute('href') : null,
        dataControl: control.getAttribute('data-cinder-access-gate-control'),
      };
    }

    function refreshConsumerState(
      control: HTMLElement,
      state: DisabledControlState,
      attributes: readonly string[],
    ): void {
      if (attributes.includes('disabled')) {
        state.nativeDisabled = isNativeDisableable(control) ? control.disabled : undefined;
      }
      if (attributes.includes('aria-disabled')) {
        state.ariaDisabled = control.getAttribute('aria-disabled');
      }
      if (attributes.includes('tabindex')) {
        state.tabindex = control.getAttribute('tabindex');
      }
      if (attributes.includes('href')) {
        state.href = control instanceof HTMLAnchorElement ? control.getAttribute('href') : null;
      }
    }

    function runGateWrites(write: () => void): void {
      ignoringGateMutations = true;
      write();
      const resetVersion = ++mutationResetVersion;
      queueMicrotask(() => {
        if (resetVersion === mutationResetVersion) {
          ignoringGateMutations = false;
        }
      });
    }

    function restoreControl(control: HTMLElement, state: DisabledControlState): void {
      if (state.nativeDisabled !== undefined && isNativeDisableable(control)) {
        control.disabled = state.nativeDisabled;
      }
      restoreAttribute(control, 'aria-disabled', state.ariaDisabled);
      restoreAttribute(control, 'tabindex', state.tabindex);
      restoreAttribute(
        control,
        'aria-describedby',
        removeId(control.getAttribute('aria-describedby'), inlineReasonId),
      );
      if (control instanceof HTMLAnchorElement) {
        restoreAttribute(control, 'href', state.href);
      }
      restoreAttribute(control, 'data-cinder-access-gate-control', state.dataControl);
    }

    function moveFocusOffControl(control: HTMLElement): void {
      const activeElement = document.activeElement;
      if (activeElement instanceof HTMLElement && control.contains(activeElement)) {
        activeElement.blur();
      }
    }

    function disableControl(
      control: HTMLElement,
      stateRefreshes: ConsumerStateRefreshes | undefined,
    ): void {
      const existingIndex = disabledControlIndex(control);
      const existingState = existingIndex === -1 ? undefined : disabledControls[existingIndex]?.[1];
      const state = existingState ?? captureControlState(control);
      const refreshedAttributes = stateRefreshes?.find(([target]) => target === control)?.[1];
      if (existingState && refreshedAttributes) {
        refreshConsumerState(control, state, refreshedAttributes);
      }
      if (existingIndex === -1) {
        disabledControls.push([control, state]);
      }

      runGateWrites(() => {
        setAttributeIfChanged(control, 'data-cinder-access-gate-control', '');
        setAttributeIfChanged(
          control,
          'aria-describedby',
          appendId(control.getAttribute('aria-describedby'), inlineReasonId),
        );

        if (isNativeDisableable(control)) {
          if (!control.disabled) {
            control.disabled = true;
          }
        } else {
          setAttributeIfChanged(control, 'aria-disabled', 'true');
          setAttributeIfChanged(control, 'tabindex', '-1');
          if (control instanceof HTMLAnchorElement && control.hasAttribute('href')) {
            control.removeAttribute('href');
          }
        }
      });
      moveFocusOffControl(control);
    }

    function syncDisabledControls(
      stateRefreshes: ConsumerStateRefreshes | undefined = undefined,
    ): void {
      const currentControls = new Set(element.querySelectorAll<HTMLElement>(INTERACTIVE_SELECTOR));

      for (const control of currentControls) {
        disableControl(control, stateRefreshes);
      }

      for (const [control] of [...disabledControls]) {
        if (!element.contains(control)) {
          const index = disabledControlIndex(control);
          if (index !== -1) {
            if (control.isConnected) {
              restoreControl(control, disabledControls[index]![1]);
            }
            disabledControls.splice(index, 1);
          }
        }
      }
    }

    function eventTargetsDisabledControl(event: Event): boolean {
      const target = event.target;
      if (!(target instanceof Node)) return false;
      return disabledControls.some(([control]) => control.contains(target));
    }

    function preventActivation(event: Event): void {
      if (!eventTargetsDisabledControl(event)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      event.stopPropagation();
    }

    function preventKeyboardInteraction(event: KeyboardEvent): void {
      if (event.key !== 'Tab') {
        preventActivation(event);
      }
    }

    const blockedPointerEvents = [
      'click',
      'pointerdown',
      'pointerup',
      'mousedown',
      'mouseup',
      'touchstart',
      'touchend',
    ];
    for (const eventName of blockedPointerEvents) {
      element.addEventListener(eventName, preventActivation, true);
    }
    const blockedInputEvents = [
      'beforeinput',
      'input',
      'compositionstart',
      'compositionupdate',
      'compositionend',
    ];
    for (const eventName of blockedInputEvents) {
      element.addEventListener(eventName, preventActivation, true);
    }
    element.addEventListener('keydown', preventKeyboardInteraction, true);
    element.addEventListener('keyup', preventKeyboardInteraction, true);

    function isGateMutation(record: MutationRecord): boolean {
      if (record.type !== 'attributes') return false;
      if (!(record.target instanceof HTMLElement)) return false;

      const control = record.target;
      const attributeName = record.attributeName;
      if (disabledControlIndex(control) === -1 || attributeName === null) return false;

      if (attributeName === 'aria-describedby') {
        const previousIds = (record.oldValue ?? '').split(/\s+/).filter(Boolean);
        const currentIds = (control.getAttribute('aria-describedby') ?? '')
          .split(/\s+/)
          .filter(Boolean);
        return !previousIds.includes(inlineReasonId) && currentIds.includes(inlineReasonId);
      }

      if (attributeName === 'aria-disabled') {
        return control.getAttribute('aria-disabled') === 'true';
      }

      if (attributeName === 'disabled') {
        return isNativeDisableable(control) && control.disabled;
      }

      if (attributeName === 'href') {
        return control instanceof HTMLAnchorElement && !control.hasAttribute('href');
      }

      if (attributeName === 'tabindex') {
        return control.getAttribute('tabindex') === '-1';
      }

      return false;
    }

    const observer = new MutationObserver((records) => {
      if (ignoringGateMutations && records.every(isGateMutation)) return;

      const stateRefreshes: Array<[HTMLElement, string[]]> = [];
      for (const record of records) {
        if (record.type !== 'attributes') continue;
        if (!(record.target instanceof HTMLElement)) continue;
        if (!element.contains(record.target)) continue;
        if (isGateMutation(record)) continue;
        const attributeName = record.attributeName;
        if (
          attributeName === 'aria-disabled' ||
          attributeName === 'disabled' ||
          attributeName === 'href' ||
          attributeName === 'tabindex'
        ) {
          let refresh = stateRefreshes.find(([target]) => target === record.target);
          if (!refresh) {
            refresh = [record.target, []];
            stateRefreshes.push(refresh);
          }
          if (!refresh[1].includes(attributeName)) {
            refresh[1].push(attributeName);
          }
        }
      }

      syncDisabledControls(stateRefreshes);
    });
    observer.observe(element, {
      attributeFilter: ['aria-describedby', 'aria-disabled', 'disabled', 'href', 'tabindex'],
      attributeOldValue: true,
      attributes: true,
      childList: true,
      subtree: true,
    });
    syncDisabledControls();
    inlineContentDisabled = true;

    return () => {
      inlineContentDisabled = false;
      mutationResetVersion += 1;
      observer.disconnect();
      for (const eventName of blockedPointerEvents) {
        element.removeEventListener(eventName, preventActivation, true);
      }
      for (const eventName of blockedInputEvents) {
        element.removeEventListener(eventName, preventActivation, true);
      }
      element.removeEventListener('keydown', preventKeyboardInteraction, true);
      element.removeEventListener('keyup', preventKeyboardInteraction, true);
      for (const [control, state] of disabledControls) {
        restoreControl(control, state);
      }
      disabledControls.length = 0;
    };
  };

  let inlineContentDisabled = $state(false);
  const inlineContentRequiresHydrationGuard = $derived(!inlineContentDisabled);
</script>

<div
  {...rest}
  class={classNames('cinder-access-gate', customClassName)}
  data-cinder-variant="inline"
  role="group"
  aria-labelledby={inlineTitleId}
  aria-describedby={inlineReasonId}
>
  <span id={inlineTitleId} class="cinder-sr-only">Unavailable action</span>
  <span
    class="cinder-access-gate__inline-content"
    inert={inlineContentRequiresHydrationGuard}
    {@attach disableDeniedControls}
  >
    {@render children?.()}
  </span>
  <span id={inlineReasonId} class="cinder-access-gate__inline-reason">
    <Lock size={14} strokeWidth={2} aria-hidden="true" />
    <span>{reason}</span>
  </span>
</div>
