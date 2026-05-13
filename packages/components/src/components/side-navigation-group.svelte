<script lang="ts" module>
  import type { Snippet } from 'svelte';
  import type { HTMLLiAttributes } from 'svelte/elements';

  /** Props for the SideNavigationGroup component. */
  export type SideNavigationGroupProps = Omit<HTMLLiAttributes, 'id'> & {
    /** Visible section header label. */
    label: string;
    /** Optional stable id for the root <li>. Trigger uses `${id}-trigger`, panel uses `${id}-panel`. If omitted, generated via useId. */
    id?: string;
    /** Whether the group is expanded. Bindable. Default: true. */
    expanded?: boolean;
    /** When true, the disclosure button is disabled. Default: false. */
    disabled?: boolean;
    /** Optional leading icon rendered inside the header button before the label. */
    icon?: Snippet;
    /** Optional trailing badge rendered inside the header button after the label, before the chevron. */
    badge?: Snippet;
    /** Additional CSS class merged with `.cinder-side-navigation-group`. */
    class?: string;
    /** Must be <li>-wrapped NavigationItems (or SideNavigationItems) rendered inside the disclosed <ul>. */
    children: Snippet;
  };
</script>

<script lang="ts">
  import { classNames } from '../utilities/class-names.ts';
  import { useId } from '../utilities/use-id.ts';

  let {
    label,
    id: idProp,
    expanded = $bindable(true),
    disabled = false,
    icon,
    badge,
    class: className,
    children,
    ...rest
  }: SideNavigationGroupProps = $props();

  const generatedId = useId('side-navigation-group');
  const id = $derived(idProp ?? generatedId);

  const validatedLabel = $derived.by(() => {
    if (label.trim() === '') {
      throw new Error('SideNavigationGroup requires a non-empty label.');
    }
    return label;
  });
  const headerId = $derived(`${id}-trigger`);
  const panelId = $derived(`${id}-panel`);

  function toggle(): void {
    if (disabled) return;
    expanded = !expanded;
  }
</script>

<li
  {...rest}
  {id}
  class={classNames('cinder-side-navigation-group', className)}
  data-cinder-expanded={expanded ? '' : undefined}
>
  <button
    type="button"
    id={headerId}
    class="cinder-side-navigation-group__trigger"
    aria-expanded={expanded}
    aria-controls={panelId}
    {disabled}
    onclick={toggle}
  >
    {#if icon}
      <span class="cinder-side-navigation-group__icon" aria-hidden="true">{@render icon()}</span>
    {/if}
    <span class="cinder-side-navigation-group__label">{validatedLabel}</span>
    {#if badge}
      <span class="cinder-side-navigation-group__badge">{@render badge()}</span>
    {/if}
    <svg
      class="cinder-side-navigation-group__chevron"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill-rule="evenodd"
        d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06z"
        clip-rule="evenodd"
      />
    </svg>
  </button>
  <ul
    id={panelId}
    class="cinder-side-navigation-group__panel"
    aria-labelledby={headerId}
    hidden={!expanded}
  >
    {@render children()}
  </ul>
</li>
