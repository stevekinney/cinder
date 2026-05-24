<script lang="ts">
  import type { SideNavigationItemProps } from '../../components/side-navigation-item/side-navigation-item.types.ts';

  // Bare-minimum link-arm props are valid.
  const validLink: SideNavigationItemProps = {
    href: '/dashboard',
    children: {} as never,
  };
  void validLink;

  // Button arm is also valid.
  const validButton: SideNavigationItemProps = {
    onclick: () => {},
    children: {} as never,
  };
  void validButton;

  // `variant` is intentionally omitted from the public surface — side
  // navigation always forces the vertical variant. Allowing it would let
  // consumers reintroduce tombstone focus rings inside a sidebar.
  const variantNotAccepted: SideNavigationItemProps = {
    href: '/dashboard',
    // @ts-expect-error - variant is omitted from SideNavigationItemProps
    variant: 'vertical',
    children: {} as never,
  };
  void variantNotAccepted;

  const horizontalVariantAlsoRejected: SideNavigationItemProps = {
    href: '/dashboard',
    // @ts-expect-error - variant is omitted from SideNavigationItemProps
    variant: 'horizontal',
    children: {} as never,
  };
  void horizontalVariantAlsoRejected;
</script>
