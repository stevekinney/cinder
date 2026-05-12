/// <reference lib="dom" />
import { describe, expect, spyOn, test } from 'bun:test';
import { createRawSnippet } from 'svelte';

import { setupHappyDom } from '../test/happy-dom.ts';

setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: FormSection } = await import('./form-section.svelte');

const emptySnippet = createRawSnippet(() => ({
  render: () => `<span></span>`,
  setup: () => {},
}));

describe('FormSection rendering — section (default)', () => {
  test('renders <section> element by default', () => {
    const { container } = render(FormSection, {
      props: { children: emptySnippet },
    });
    expect(container.querySelector('section')).not.toBeNull();
    expect(container.querySelector('fieldset')).toBeNull();
  });

  test('renders <h2> by default when heading is provided', () => {
    const { container } = render(FormSection, {
      props: { heading: 'Personal Info', children: emptySnippet },
    });
    const heading = container.querySelector('h2');
    expect(heading).not.toBeNull();
    expect(heading?.textContent?.trim()).toBe('Personal Info');
  });

  test('renders <h3> when headingLevel=3', () => {
    const { container } = render(FormSection, {
      props: { heading: 'Section', headingLevel: 3, children: emptySnippet },
    });
    expect(container.querySelector('h3')).not.toBeNull();
    expect(container.querySelector('h2')).toBeNull();
  });

  test('renders <h4> when headingLevel=4', () => {
    const { container } = render(FormSection, {
      props: { heading: 'Section', headingLevel: 4, children: emptySnippet },
    });
    expect(container.querySelector('h4')).not.toBeNull();
  });

  test('does not render heading element when heading is omitted', () => {
    const { container } = render(FormSection, {
      props: { children: emptySnippet },
    });
    // no h2-h6 elements
    for (let i = 2; i <= 6; i++) {
      expect(container.querySelector(`h${i}`)).toBeNull();
    }
  });

  test('renders description <p> when description is provided', () => {
    const { container } = render(FormSection, {
      props: { description: 'Fill in your details.', children: emptySnippet },
    });
    const descEl = container.querySelector('.cinder-form-section__description');
    expect(descEl).not.toBeNull();
    expect(descEl?.textContent).toContain('Fill in your details.');
  });

  test('does not render description element when description is omitted', () => {
    const { container } = render(FormSection, {
      props: { children: emptySnippet },
    });
    expect(container.querySelector('.cinder-form-section__description')).toBeNull();
  });

  test('data-columns attribute matches columns prop (default 2)', () => {
    const { container } = render(FormSection, {
      props: { children: emptySnippet },
    });
    const section = container.querySelector('.cinder-form-section');
    expect(section?.getAttribute('data-columns')).toBe('2');
  });

  test('data-columns="1" when columns=1', () => {
    const { container } = render(FormSection, {
      props: { columns: 1, children: emptySnippet },
    });
    expect(container.querySelector('.cinder-form-section')?.getAttribute('data-columns')).toBe('1');
  });

  test('data-columns="3" when columns=3', () => {
    const { container } = render(FormSection, {
      props: { columns: 3, children: emptySnippet },
    });
    expect(container.querySelector('.cinder-form-section')?.getAttribute('data-columns')).toBe('3');
  });

  test('data-columns="4" when columns=4', () => {
    const { container } = render(FormSection, {
      props: { columns: 4, children: emptySnippet },
    });
    expect(container.querySelector('.cinder-form-section')?.getAttribute('data-columns')).toBe('4');
  });

  test('grid wrapper element exists with class cinder-form-section__grid', () => {
    const { container } = render(FormSection, {
      props: { children: emptySnippet },
    });
    expect(container.querySelector('.cinder-form-section__grid')).not.toBeNull();
  });

  test('applies additional class to root element', () => {
    const { container } = render(FormSection, {
      props: { class: 'custom-section', children: emptySnippet },
    });
    const root = container.querySelector('.cinder-form-section');
    expect(root?.classList.contains('custom-section')).toBe(true);
  });
});

describe('FormSection rendering — fieldset', () => {
  test('renders <fieldset> when as="fieldset"', () => {
    const { container } = render(FormSection, {
      props: { as: 'fieldset', heading: 'Contact', children: emptySnippet },
    });
    expect(container.querySelector('fieldset')).not.toBeNull();
    expect(container.querySelector('section')).toBeNull();
  });

  test('renders <legend> with heading text when as="fieldset"', () => {
    const { container } = render(FormSection, {
      props: { as: 'fieldset', heading: 'Contact Details', children: emptySnippet },
    });
    const legend = container.querySelector('legend');
    expect(legend).not.toBeNull();
    expect(legend?.textContent?.trim()).toBe('Contact Details');
  });

  test('does not render h2-h6 elements in fieldset mode', () => {
    const { container } = render(FormSection, {
      props: { as: 'fieldset', heading: 'Group', children: emptySnippet },
    });
    for (let i = 2; i <= 6; i++) {
      expect(container.querySelector(`h${i}`)).toBeNull();
    }
  });

  test('grid wrapper exists inside fieldset', () => {
    const { container } = render(FormSection, {
      props: { as: 'fieldset', heading: 'Group', children: emptySnippet },
    });
    expect(container.querySelector('.cinder-form-section__grid')).not.toBeNull();
  });
});

describe('FormSection dev warnings', () => {
  test('as="fieldset" without heading fires console.warn', () => {
    const warnSpy = spyOn(console, 'warn').mockImplementation(() => {});
    try {
      // Testing the runtime dev-warning path. TypeScript's discriminated union
      // prevents as="fieldset" without heading at compile time, but JS
      // consumers can bypass it. svelte-check catches the missing heading
      // prop; tsc doesn't (render() props are typed loosely in tsc but
      // strictly in the Svelte language server), so @ts-ignore suppresses both.
      render(FormSection, {
        // @ts-ignore — intentionally invalid: fieldset without required heading
        props: { as: 'fieldset', children: emptySnippet },
      });
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect((warnSpy.mock.calls[0] as string[])[0]).toContain('heading');
    } finally {
      warnSpy.mockRestore();
    }
  });

  test('as="fieldset" with heading does not fire console.warn', () => {
    const warnSpy = spyOn(console, 'warn').mockImplementation(() => {});
    try {
      render(FormSection, {
        props: { as: 'fieldset', heading: 'My Group', children: emptySnippet },
      });
      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });

  test('as="section" without heading does not fire console.warn', () => {
    const warnSpy = spyOn(console, 'warn').mockImplementation(() => {});
    try {
      render(FormSection, {
        props: { children: emptySnippet },
      });
      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });
});
