/**
 * Viewport width below which Sidebar uses its mobile drawer behavior.
 *
 * Consumers with app chrome outside the Sidebar can import this value instead
 * of duplicating the component's internal breakpoint.
 */
export const SIDEBAR_MOBILE_BREAKPOINT = '47.99rem';

/**
 * Fully parenthesized media query used by Sidebar to switch from the inline
 * aside to the mobile drawer.
 */
export const SIDEBAR_MOBILE_MEDIA_QUERY = `(max-width: ${SIDEBAR_MOBILE_BREAKPOINT})`;
