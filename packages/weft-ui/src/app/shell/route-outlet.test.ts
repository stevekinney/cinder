/**
 * Component tests for `<RouteOutlet>` (T1.6).
 */
import { render } from '@testing-library/svelte';
import { describe, expect, test } from 'bun:test';

import { router } from '../../lib/router.svelte.ts';
import RouteOutlet from './route-outlet.svelte';

describe('RouteOutlet', () => {
  test('regression: renders a <main> landmark, not a plain <div>', async () => {
    // Guards the WFC-11 design-fidelity fix: the app had no `<main>` or
    // `role="main"` landmark anywhere, a semantic-structure gap. The root
    // element must stay a `<main>` even while a route chunk is still
    // loading (the skeleton state), not just once content mounts.
    router.navigate('/');

    const { container } = render(RouteOutlet);

    const main = container.querySelector('main.weft-shell-outlet');
    expect(main).not.toBeNull();
    expect(container.querySelector('div.weft-shell-outlet')).toBeNull();
  });

  test('renders the not-found empty state inside the <main> landmark for an unowned path', async () => {
    router.navigate('/this-path-does-not-exist');

    const { container, findByText } = render(RouteOutlet);

    expect(await findByText('Page not found')).not.toBeNull();
    expect(container.querySelector('main.weft-shell-outlet')).not.toBeNull();
  });
});
