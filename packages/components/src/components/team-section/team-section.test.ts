/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

// setupHappyDom() MUST run before any `@testing-library/svelte` import. testing-library
// reads `globalThis.document` / `window` at module-init (top-level, not inside test bodies),
// so we register happy-dom's globals first and then dynamic-import testing-library below.
setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: TeamSection } = await import('./team-section.svelte');
const { createRawSnippet } = await import('svelte');
const runtimePatchSnippet = createRawSnippet(() => ({
  render: () => '<span></span>',
  setup: () => {},
}));
void runtimePatchSnippet;

const members = [
  { name: 'Jordan Lee', role: 'Engineering Lead', bio: 'Builds design systems.', href: '/jordan' },
  { name: 'Taylor Green', role: 'Product Designer', bio: 'Shapes delightful UX.' },
];

describe('TeamSection', () => {
  test('renders team members with names and roles', () => {
    const { container } = render(TeamSection, {
      props: {
        title: 'Meet the team',
        members,
      },
    });

    const element = container.querySelector('.cinder-team-section');
    expect(element).not.toBeNull();
    expect(container.querySelectorAll('.cinder-team-section__item')).toHaveLength(2);
    expect(container.querySelector('.cinder-team-section__name')?.textContent).toContain(
      'Jordan Lee',
    );
    expect(container.querySelector('.cinder-team-section__role')?.textContent).toContain(
      'Engineering Lead',
    );
  });

  test('renders profile links and avatar-group summary when enabled', () => {
    const { container } = render(TeamSection, {
      props: {
        members,
        showAvatarGroup: true,
      },
    });
    expect(container.querySelector('.cinder-avatar-group')).not.toBeNull();
    expect(container.querySelector('.cinder-team-section__link')?.getAttribute('href')).toBe(
      '/jordan',
    );
  });

  test('applies columns attribute and custom class', () => {
    const { container } = render(TeamSection, {
      props: {
        members,
        columns: 4,
        class: 'my-custom-class',
      },
    });
    const root = container.querySelector('.cinder-team-section');
    expect(root?.getAttribute('data-cinder-columns')).toBe('4');
    expect(root?.classList.contains('my-custom-class')).toBe(true);
  });
});
