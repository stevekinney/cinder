/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../test/happy-dom.ts';

// setupHappyDom() MUST run before any `@testing-library/svelte` import. testing-library
// reads `globalThis.document` / `window` at module-init (top-level, not inside test bodies),
// so we register happy-dom's globals first and then dynamic-import testing-library below.
setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { createRawSnippet } = await import('svelte');
const { default: PageLayout } = await import('./page-layout.svelte');

const children = createRawSnippet(() => ({ render: () => '<p>Content</p>' }));

describe('PageLayout rendering', () => {
  test('renders with title', () => {
    const { container } = render(PageLayout, {
      props: {
        title: 'Dashboard',
        children,
      },
    });
    expect(container.querySelector('.cinder-page-layout')).not.toBeNull();
  });

  test('title text is visible', () => {
    const { container } = render(PageLayout, {
      props: {
        title: 'My Page',
        children,
      },
    });
    const heading = container.querySelector('.cinder-page-layout-title');
    expect(heading?.textContent?.trim()).toBe('My Page');
  });

  test('children render', () => {
    const childrenSnippet = createRawSnippet(() => ({
      render: () => '<p data-testid="child-content">Hello world</p>',
    }));

    const { container } = render(PageLayout, {
      props: { title: 'Page', children: childrenSnippet },
    });

    const content = container.querySelector('.cinder-page-layout-content');
    expect(content).not.toBeNull();
    expect(content?.querySelector('[data-testid="child-content"]')).not.toBeNull();
  });

  test('actions snippet renders when provided', () => {
    const actionsSnippet = createRawSnippet(() => ({
      render: () => '<button>Create</button>',
    }));

    const { container } = render(PageLayout, {
      props: {
        title: 'Page',
        children,
        actions: actionsSnippet,
      },
    });

    const actionsContainer = container.querySelector('.cinder-page-layout-actions');
    expect(actionsContainer).not.toBeNull();
    expect(actionsContainer?.querySelector('button')?.textContent).toBe('Create');
  });

  test('actions are not rendered when not provided', () => {
    const { container } = render(PageLayout, {
      props: {
        title: 'Page',
        children,
      },
    });

    expect(container.querySelector('.cinder-page-layout-actions')).toBeNull();
  });

  test('header landmark wraps the title row', () => {
    const { container } = render(PageLayout, {
      props: { title: 'Page', children },
    });
    expect(container.querySelector('header.cinder-page-layout-header')).not.toBeNull();
  });

  test('applies class prop to root element', () => {
    const { container } = render(PageLayout, {
      props: {
        title: 'Page',
        class: 'my-custom-class',
        children,
      },
    });

    const root = container.querySelector('.cinder-page-layout');
    expect(root?.classList.contains('my-custom-class')).toBe(true);
    expect(root?.classList.contains('cinder-page-layout')).toBe(true);
  });
});

describe('PageLayout breadcrumbs slot', () => {
  test('breadcrumbs snippet renders below the sticky header and above the content', () => {
    const breadcrumbs = createRawSnippet(() => ({
      render: () => '<nav aria-label="Breadcrumb">Home</nav>',
    }));

    const { container } = render(PageLayout, {
      props: { title: 'Page', children, breadcrumbs },
    });

    const breadcrumbsEl = container.querySelector('.cinder-page-layout-breadcrumbs');
    const header = container.querySelector('.cinder-page-layout-header');
    const content = container.querySelector('.cinder-page-layout-content');
    expect(breadcrumbsEl).not.toBeNull();
    expect(header).not.toBeNull();
    expect(content).not.toBeNull();
    // breadcrumbs must be outside (after) the sticky header and before content
    const afterHeader =
      header!.compareDocumentPosition(breadcrumbsEl!) & Node.DOCUMENT_POSITION_FOLLOWING;
    const beforeContent =
      breadcrumbsEl!.compareDocumentPosition(content!) & Node.DOCUMENT_POSITION_FOLLOWING;
    expect(afterHeader).toBeTruthy();
    expect(beforeContent).toBeTruthy();
  });

  test('breadcrumbs slot is absent when not provided', () => {
    const { container } = render(PageLayout, {
      props: { title: 'Page', children },
    });
    expect(container.querySelector('.cinder-page-layout-breadcrumbs')).toBeNull();
  });
});

describe('PageLayout meta slot', () => {
  test('meta snippet renders beneath the title', () => {
    const meta = createRawSnippet(() => ({
      render: () => '<dl><dt>Role</dt><dd>Owner</dd></dl>',
    }));

    const { container } = render(PageLayout, {
      props: { title: 'Page', children, meta },
    });

    const metaEl = container.querySelector('.cinder-page-layout-meta');
    const titleEl = container.querySelector('.cinder-page-layout-title');
    expect(metaEl).not.toBeNull();
    expect(titleEl).not.toBeNull();
    // title must precede meta in DOM order
    const position = titleEl!.compareDocumentPosition(metaEl!);
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  test('meta slot is absent when not provided', () => {
    const { container } = render(PageLayout, {
      props: { title: 'Page', children },
    });
    expect(container.querySelector('.cinder-page-layout-meta')).toBeNull();
  });
});

describe('PageLayout avatar slot', () => {
  test('avatar snippet renders inline-start of the title', () => {
    const avatar = createRawSnippet(() => ({
      render: () => '<img src="/avatar.png" alt="User" />',
    }));

    const { container } = render(PageLayout, {
      props: { title: 'Page', children, avatar },
    });

    const avatarEl = container.querySelector('.cinder-page-layout-avatar');
    const titleEl = container.querySelector('.cinder-page-layout-title');
    expect(avatarEl).not.toBeNull();
    expect(titleEl).not.toBeNull();
    // avatar must precede the title in DOM order
    const position = avatarEl!.compareDocumentPosition(titleEl!);
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  test('avatar slot is absent when not provided', () => {
    const { container } = render(PageLayout, {
      props: { title: 'Page', children },
    });
    expect(container.querySelector('.cinder-page-layout-avatar')).toBeNull();
  });
});

describe('PageLayout title as snippet', () => {
  test('title accepts a snippet and renders it in place of the default h1', () => {
    const titleSnippet = createRawSnippet(() => ({
      render: () => '<h1 data-testid="custom-h1">Custom</h1>',
    }));

    const { container } = render(PageLayout, {
      props: { title: titleSnippet, children },
    });

    expect(container.querySelector('[data-testid="custom-h1"]')).not.toBeNull();
    expect(container.querySelector('.cinder-page-layout-title')).toBeNull();
    // snippet must render inside the title column
    const column = container.querySelector('.cinder-page-layout-title-column');
    expect(column?.querySelector('[data-testid="custom-h1"]')).not.toBeNull();
  });

  test('title as string still renders default h1', () => {
    const { container } = render(PageLayout, {
      props: { title: 'String Title', children },
    });

    const heading = container.querySelector('.cinder-page-layout-title');
    expect(heading?.tagName).toBe('H1');
    expect(heading?.textContent?.trim()).toBe('String Title');
  });
});

describe('PageLayout actions row CSS', () => {
  test('actions row min-block-size is declared in the stylesheet', async () => {
    const cssPath = new URL('../styles/components/page-layout.css', import.meta.url);
    const css = await Bun.file(cssPath).text();
    // Match the selector and then min-block-size: 2.75rem anywhere after it
    expect(css).toMatch(/\.cinder-page-layout-header-row[\s\S]*?min-block-size\s*:\s*2\.75rem/);
  });

  test('actions align to the inline-end of the title row', async () => {
    const actionsSnippet = createRawSnippet(() => ({
      render: () => '<button>Action</button>',
    }));

    const { container } = render(PageLayout, {
      props: { title: 'Page', children, actions: actionsSnippet },
    });

    const headerRow = container.querySelector('.cinder-page-layout-header-row');
    const actionsEl = container.querySelector('.cinder-page-layout-actions');
    expect(headerRow).not.toBeNull();
    expect(actionsEl).not.toBeNull();

    // (a) actions must be the last child of the header row
    expect(headerRow!.lastElementChild).toBe(actionsEl);

    // (b) CSS declares margin-inline-start: auto linked to .cinder-page-layout-actions
    const cssPath = new URL('../styles/components/page-layout.css', import.meta.url);
    const css = await Bun.file(cssPath).text();
    expect(css).toMatch(/\.cinder-page-layout-actions[\s\S]*?margin-inline-start\s*:\s*auto/);
  });
});

describe('PageLayout DOM order', () => {
  test('DOM order is header → breadcrumbs → content', () => {
    const breadcrumbs = createRawSnippet(() => ({
      render: () => '<nav>Breadcrumbs</nav>',
    }));

    const { container } = render(PageLayout, {
      props: { title: 'Page', children, breadcrumbs },
    });

    const header = container.querySelector('.cinder-page-layout-header')!;
    const breadcrumbsEl = container.querySelector('.cinder-page-layout-breadcrumbs')!;
    const content = container.querySelector('.cinder-page-layout-content')!;

    expect(header).not.toBeNull();
    expect(breadcrumbsEl).not.toBeNull();
    expect(content).not.toBeNull();

    // sticky header precedes breadcrumbs (breadcrumbs outside the banner landmark)
    expect(
      header.compareDocumentPosition(breadcrumbsEl) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    // breadcrumbs precedes page content
    expect(
      breadcrumbsEl.compareDocumentPosition(content) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});

describe('PageLayout integration: all slots simultaneously', () => {
  test('renders with all five optional snippets and preserves DOM order', () => {
    const breadcrumbs = createRawSnippet(() => ({
      render: () => '<nav data-testid="breadcrumbs">Home / Projects</nav>',
    }));
    const avatarSnippet = createRawSnippet(() => ({
      render: () => '<img data-testid="avatar" src="/avatar.png" alt="User" />',
    }));
    const titleSnippet = createRawSnippet(() => ({
      render: () => '<h1 data-testid="custom-title">Acme Corp</h1>',
    }));
    const metaSnippet = createRawSnippet(() => ({
      render: () => '<dl data-testid="meta"><dt>Role</dt><dd>Owner</dd></dl>',
    }));
    const actionsSnippet = createRawSnippet(() => ({
      render: () => '<button data-testid="action-btn">New Project</button>',
    }));

    const { container } = render(PageLayout, {
      props: {
        title: titleSnippet,
        children,
        breadcrumbs,
        avatar: avatarSnippet,
        meta: metaSnippet,
        actions: actionsSnippet,
      },
    });

    const breadcrumbsEl = container.querySelector('.cinder-page-layout-breadcrumbs')!;
    const avatarEl = container.querySelector('.cinder-page-layout-avatar')!;
    const customTitle = container.querySelector('[data-testid="custom-title"]')!;
    const metaEl = container.querySelector('.cinder-page-layout-meta')!;
    const actionsEl = container.querySelector('.cinder-page-layout-actions')!;
    const contentEl = container.querySelector('.cinder-page-layout-content')!;

    expect(breadcrumbsEl).not.toBeNull();
    expect(avatarEl).not.toBeNull();
    expect(customTitle).not.toBeNull();
    expect(metaEl).not.toBeNull();
    expect(actionsEl).not.toBeNull();
    expect(contentEl).not.toBeNull();

    // Default .cinder-page-layout-title class must not appear when title is a snippet
    expect(container.querySelector('.cinder-page-layout-title')).toBeNull();

    // Document order: avatar → title → meta → actions (inside header) → breadcrumbs → content
    // Breadcrumbs sits outside the sticky <header>, between it and the page content.
    const FOLLOWING = Node.DOCUMENT_POSITION_FOLLOWING;
    expect(avatarEl.compareDocumentPosition(customTitle) & FOLLOWING).toBeTruthy();
    expect(customTitle.compareDocumentPosition(metaEl) & FOLLOWING).toBeTruthy();
    expect(metaEl.compareDocumentPosition(actionsEl) & FOLLOWING).toBeTruthy();
    expect(actionsEl.compareDocumentPosition(breadcrumbsEl) & FOLLOWING).toBeTruthy();
    expect(breadcrumbsEl.compareDocumentPosition(contentEl) & FOLLOWING).toBeTruthy();
  });
});

describe('PageLayout content-width token', () => {
  test('page-layout.css uses --cinder-content-width for max-width caps', async () => {
    const cssPath = new URL('../styles/components/page-layout.css', import.meta.url);
    const source = await Bun.file(cssPath).text();

    // No hardcoded length on max-width — must reference the shared token.
    // Matches dimensional units only; viewport-relative or percentage values
    // (e.g. 100%, 100vw) are legitimate and intentionally not flagged.
    const hardcodedMaxWidth = /max-width:\s*\d+(?:\.\d+)?(?:rem|px|em|ch)\b/.exec(source);
    expect(hardcodedMaxWidth).toBeNull();

    // Three layout regions cap their inline size: breadcrumbs, header-row, content.
    // If you add a fourth, update this count deliberately.
    const tokenReferences = source.match(/max-width:\s*var\(--cinder-content-width\)/g) ?? [];
    expect(tokenReferences.length).toBe(3);
  });

  test('--cinder-content-width is declared in tokens-base.css', async () => {
    const tokensPath = new URL('../styles/tokens-base.css', import.meta.url);
    const source = await Bun.file(tokensPath).text();
    expect(source).toMatch(/--cinder-content-width:\s*\S+/);
  });
});
