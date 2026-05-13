<script lang="ts">
  import type { SideNavigationProps } from '../../components/side-navigation.svelte';

  // ariaLabel is required; omitting it must be a compile error.
  // @ts-expect-error - ariaLabel is required
  const missingLabel: SideNavigationProps = { children: {} as never };
  void missingLabel;

  // Providing ariaLabel is valid.
  const validProps: SideNavigationProps = { ariaLabel: 'Sections', children: {} as never };
  void validProps;

  const ariaLabelInRest: SideNavigationProps = {
    ariaLabel: 'Sections',
    // @ts-expect-error - aria-label is omitted from HTMLAttributes via Omit
    'aria-label': 'Should not compile',
    children: {} as never,
  };
  void ariaLabelInRest;

  const ariaLabelledbyInRest: SideNavigationProps = {
    ariaLabel: 'Sections',
    // @ts-expect-error - aria-labelledby is omitted because it would win over aria-label
    'aria-labelledby': 'some-other-element',
    children: {} as never,
  };
  void ariaLabelledbyInRest;
</script>
