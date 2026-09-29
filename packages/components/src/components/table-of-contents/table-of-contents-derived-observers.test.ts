/// <reference lib="dom" />
import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';

import {
  cleanup,
  createHeading,
  FakeIntersectionObserver,
  originalIntersectionObserver,
  render,
  TableOfContents,
  waitFor,
  waitForTableOfContentsLinks,
} from './table-of-contents-test-helpers.ts';

beforeEach(() => {
  FakeIntersectionObserver.records = [];
  globalThis.IntersectionObserver = FakeIntersectionObserver;
});

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
  globalThis.IntersectionObserver = originalIntersectionObserver;
});

describe('TableOfContents', () => {
  test('discovers headings added after initial render in derived mode', async () => {
    const { container } = render(TableOfContents, {
      props: {
        target: '#late-target',
      },
    });

    expect(container.querySelectorAll('a.cinder-table-of-contents__link').length).toBe(0);

    const article = document.createElement('article');
    article.id = 'late-target';
    article.appendChild(createHeading('late-one', 'Late one', 'h2'));
    document.body.appendChild(article);

    const links = await waitForTableOfContentsLinks(container, 1);
    expect(links[0]?.getAttribute('href')).toBe('#late-one');
  });
  test('refreshes derived headings when selector target element is replaced', async () => {
    const firstTarget = document.createElement('article');
    firstTarget.id = 'replace-target';
    firstTarget.appendChild(createHeading('original', 'Original', 'h2'));
    document.body.appendChild(firstTarget);

    const { container } = render(TableOfContents, {
      props: {
        target: '#replace-target',
      },
    });
    await Promise.resolve();
    expect(
      container.querySelectorAll('a.cinder-table-of-contents__link')[0]?.textContent?.trim(),
    ).toBe('Original');

    const replacementTarget = document.createElement('article');
    replacementTarget.id = 'replace-target';
    replacementTarget.appendChild(createHeading('replacement', 'Replacement', 'h2'));
    firstTarget.replaceWith(replacementTarget);
    await new Promise((resolve) => setTimeout(resolve, 300));

    const links = container.querySelectorAll('a.cinder-table-of-contents__link');
    expect(links.length).toBe(1);
    expect(links[0]?.getAttribute('href')).toBe('#replacement');
  });
  test('refreshes derived headings when selector matching target id changes', async () => {
    const target = document.createElement('article');
    target.id = 'dynamic-target';
    target.appendChild(createHeading('dynamic-original', 'Dynamic original', 'h2'));
    document.body.appendChild(target);

    const { container } = render(TableOfContents, {
      props: {
        target: '#dynamic-target',
      },
    });
    await Promise.resolve();
    expect(
      container.querySelectorAll('a.cinder-table-of-contents__link')[0]?.getAttribute('href'),
    ).toBe('#dynamic-original');

    target.id = 'dynamic-target-old';
    const nextTarget = document.createElement('article');
    nextTarget.id = 'dynamic-target';
    nextTarget.appendChild(createHeading('dynamic-new', 'Dynamic new', 'h2'));
    document.body.appendChild(nextTarget);
    await new Promise((resolve) => setTimeout(resolve, 80));

    const links = container.querySelectorAll('a.cinder-table-of-contents__link');
    expect(links.length).toBe(1);
    expect(links[0]?.getAttribute('href')).toBe('#dynamic-new');
  });
  test('does not reuse stale derived headings after switching back from explicit items', async () => {
    const target = document.createElement('article');
    target.id = 'mode-switch-target';
    target.appendChild(createHeading('derived-old', 'Derived old', 'h2'));
    document.body.appendChild(target);

    const view = render(TableOfContents, {
      props: {
        target: '#mode-switch-target',
      },
    });
    await Promise.resolve();
    expect(
      view.container.querySelector('a.cinder-table-of-contents__link')?.getAttribute('href'),
    ).toBe('#derived-old');

    await view.rerender({
      items: [{ id: 'explicit-item', label: 'Explicit item' }],
      target: '#mode-switch-target',
    });
    await Promise.resolve();

    target.replaceChildren(createHeading('derived-new', 'Derived new', 'h2'));

    const derivedModeProps = {
      items: undefined,
      target: '#mode-switch-target',
    } satisfies Parameters<typeof view.rerender>[0];

    await view.rerender(derivedModeProps);

    expect(view.container.querySelector('a[href="#derived-old"]')).toBeNull();

    await waitFor(() => {
      expect(view.container.querySelector('a[href="#derived-new"]')).not.toBeNull();
    });
  });
  test('clears derived items when an HTMLElement target is detached', async () => {
    const target = document.createElement('article');
    target.appendChild(createHeading('detached-heading', 'Detached heading', 'h2'));
    document.body.appendChild(target);

    const { container } = render(TableOfContents, {
      props: {
        target,
      },
    });
    await Promise.resolve();
    expect(container.querySelectorAll('a.cinder-table-of-contents__link').length).toBe(1);

    target.remove();
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(container.querySelectorAll('a.cinder-table-of-contents__link').length).toBe(0);
  });
  test('clears derived items when an HTMLElement target becomes disconnected via ancestor removal', async () => {
    const wrapper = document.createElement('section');
    const target = document.createElement('article');
    target.appendChild(createHeading('nested-heading', 'Nested heading', 'h2'));
    wrapper.appendChild(target);
    document.body.appendChild(wrapper);

    const { container } = render(TableOfContents, {
      props: {
        target,
      },
    });
    await Promise.resolve();
    expect(container.querySelectorAll('a.cinder-table-of-contents__link').length).toBe(1);

    wrapper.remove();
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(container.querySelectorAll('a.cinder-table-of-contents__link').length).toBe(0);
  });
  test('document-wide MutationObserver filters to id/class attributes (#1186 row 8a)', () => {
    const article = document.createElement('article');
    article.id = 'doc-8a';
    article.appendChild(createHeading('doc-8a-install', 'Install', 'h2'));
    document.body.appendChild(article);

    const observeSpy = spyOn(MutationObserver.prototype, 'observe');
    render(TableOfContents, { props: { target: '#doc-8a' } });

    const documentBodyCall = observeSpy.mock.calls.find((call) => call[0] === document.body);
    expect(documentBodyCall).toBeDefined();
    expect(documentBodyCall?.[1]).toEqual({
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['id', 'class'],
    });

    observeSpy.mockRestore();
  });
  test('target-scoped MutationObserver filters to id-only attribute changes (#1186 row 8b)', async () => {
    const article = document.createElement('article');
    article.id = 'doc-8b';
    const heading = createHeading('doc-8b-install', 'Install', 'h2');
    article.appendChild(heading);
    document.body.appendChild(article);

    const observeSpy = spyOn(MutationObserver.prototype, 'observe');
    const { container } = render(TableOfContents, { props: { target: '#doc-8b' } });

    const targetCall = observeSpy.mock.calls.find((call) => call[0] === article);
    expect(targetCall).toBeDefined();
    expect(targetCall?.[1]).toMatchObject({
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['id'],
    });
    observeSpy.mockRestore();

    await waitForTableOfContentsLinks(container, 1);

    const querySelectorAllSpy = spyOn(article, 'querySelectorAll');

    // An unrelated attribute mutation inside the target must not recompute.
    heading.setAttribute('data-highlight', 'true');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(querySelectorAllSpy).toHaveBeenCalledTimes(0);
    expect(container.querySelector('a.cinder-table-of-contents__link')?.getAttribute('href')).toBe(
      '#doc-8b-install',
    );

    // A heading id mutation must still recompute.
    heading.id = 'doc-8b-install-renamed';
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(querySelectorAllSpy.mock.calls.length).toBeGreaterThan(0);
    await waitFor(() => {
      expect(
        container.querySelector('a.cinder-table-of-contents__link')?.getAttribute('href'),
      ).toBe('#doc-8b-install-renamed');
    });

    querySelectorAllSpy.mockRestore();
  });
});
