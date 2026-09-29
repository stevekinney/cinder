import { describe, expect, test } from 'bun:test';

import {
  createCssRule,
  createStyleRule,
  withDocumentStyleSheets,
} from './text-direction-test-helpers.ts';
import { resolveTextDirection } from './text-direction.ts';

describe('resolveTextDirection', () => {
  test('fails closed for a name-only container rule with an empty containerQuery', () => {
    // `@container sidebar {}` — a name with no condition — is valid CSS:
    // verified against real Chromium, it parses into a CSSContainerRule
    // whose `containerQuery` reads back as `''` (not undefined) and which
    // matches whenever a same-named queryable container exists. This
    // module doesn't reproduce that container-existence check on its own,
    // so it must fail closed instead of treating the bare container name
    // as if it were parseable query syntax.
    const container = document.createElement('section');
    container.style.setProperty('container-type', 'inline-size');
    container.style.setProperty('container-name', 'sidebar');
    Object.defineProperty(container, 'offsetWidth', { value: 400, configurable: true });
    const element = document.createElement('div');
    element.className = 'name-only-container-ltr';
    container.appendChild(element);
    document.body.appendChild(container);
    const nestedRule = createStyleRule({
      selectorText: '.name-only-container-ltr',
      direction: 'ltr',
    });
    const outerRule = createCssRule({
      cssText: '@container sidebar { .name-only-container-ltr { direction: ltr; } }',
      type: 0,
      conditionText: 'sidebar',
      containerName: 'sidebar',
      containerQuery: '',
      cssRules: [nestedRule],
    });
    try {
      expect(
        withDocumentStyleSheets([{ cssRules: [outerRule] }], () =>
          resolveTextDirection(element, 'rtl'),
        ),
      ).toBe('rtl');
    } finally {
      container.remove();
    }
  });

  test('evaluates a comma-separated @container condition list, matching a later entry when an earlier named entry misses', () => {
    // `CSSContainerRule.conditions` exposes each comma-separated entry as an
    // independent `{ name, query }` pair, blanking the legacy singular
    // `containerName`/`containerQuery` accessors to `''` (verified against
    // real Chromium). No ancestor is named "sidebar", so the first entry
    // can never match; the second (unnamed) entry must still be evaluated
    // independently against the nearest queryable container and match on
    // its own.
    const container = document.createElement('section');
    container.style.setProperty('container-type', 'inline-size');
    Object.defineProperty(container, 'offsetWidth', { value: 700, configurable: true });
    const element = document.createElement('div');
    element.className = 'condition-list-second-match-ltr';
    container.appendChild(element);
    document.body.appendChild(container);
    const nestedRule = createStyleRule({
      selectorText: '.condition-list-second-match-ltr',
      direction: 'ltr',
    });
    const outerRule = createCssRule({
      cssText:
        '@container sidebar (min-width: 20rem), (min-width: 40rem) { .condition-list-second-match-ltr { direction: ltr; } }',
      type: 0,
      conditionText: 'sidebar (min-width: 20rem), (min-width: 40rem)',
      containerName: '',
      containerQuery: '',
      conditions: [
        { name: 'sidebar', query: '(min-width: 20rem)' },
        { name: '', query: '(min-width: 40rem)' },
      ],
      cssRules: [nestedRule],
    });
    try {
      expect(
        withDocumentStyleSheets([{ cssRules: [outerRule] }], () =>
          resolveTextDirection(element, 'rtl'),
        ),
      ).toBe('ltr');
    } finally {
      container.remove();
    }
  });

  test('evaluates a named first entry independently of an unmatched unnamed second entry in a condition list', () => {
    // The inverse mix: the FIRST (named) entry matches its own
    // independently-resolved named ancestor while the SECOND (unnamed)
    // entry, resolved against the nearest queryable container regardless of
    // name, does not — proving each entry gets its own ancestor resolution
    // rather than sharing one across the whole list.
    const sidebar = document.createElement('section');
    sidebar.style.setProperty('container-type', 'inline-size');
    sidebar.style.setProperty('container-name', 'sidebar');
    Object.defineProperty(sidebar, 'offsetWidth', { value: 700, configurable: true });
    const wrapper = document.createElement('div');
    wrapper.style.setProperty('container-type', 'inline-size');
    Object.defineProperty(wrapper, 'offsetWidth', { value: 100, configurable: true });
    const element = document.createElement('div');
    element.className = 'condition-list-first-match-ltr';
    wrapper.appendChild(element);
    sidebar.appendChild(wrapper);
    document.body.appendChild(sidebar);
    const nestedRule = createStyleRule({
      selectorText: '.condition-list-first-match-ltr',
      direction: 'ltr',
    });
    const outerRule = createCssRule({
      cssText:
        '@container sidebar (min-width: 20rem), (min-width: 40rem) { .condition-list-first-match-ltr { direction: ltr; } }',
      type: 0,
      conditionText: 'sidebar (min-width: 20rem), (min-width: 40rem)',
      containerName: '',
      containerQuery: '',
      conditions: [
        { name: 'sidebar', query: '(min-width: 20rem)' },
        { name: '', query: '(min-width: 40rem)' },
      ],
      cssRules: [nestedRule],
    });
    try {
      expect(
        withDocumentStyleSheets([{ cssRules: [outerRule] }], () =>
          resolveTextDirection(element, 'rtl'),
        ),
      ).toBe('ltr');
    } finally {
      sidebar.remove();
    }
  });

  test('fails closed when no entry in a comma-separated @container condition list matches', () => {
    const container = document.createElement('section');
    container.style.setProperty('container-type', 'inline-size');
    Object.defineProperty(container, 'offsetWidth', { value: 100, configurable: true });
    const element = document.createElement('div');
    element.className = 'condition-list-no-match-ltr';
    container.appendChild(element);
    document.body.appendChild(container);
    const nestedRule = createStyleRule({
      selectorText: '.condition-list-no-match-ltr',
      direction: 'ltr',
    });
    const outerRule = createCssRule({
      cssText:
        '@container (min-width: 20rem), (min-width: 40rem) { .condition-list-no-match-ltr { direction: ltr; } }',
      type: 0,
      conditionText: '(min-width: 20rem), (min-width: 40rem)',
      containerName: '',
      containerQuery: '',
      conditions: [
        { name: '', query: '(min-width: 20rem)' },
        { name: '', query: '(min-width: 40rem)' },
      ],
      cssRules: [nestedRule],
    });
    try {
      expect(
        withDocumentStyleSheets([{ cssRules: [outerRule] }], () =>
          resolveTextDirection(element, 'rtl'),
        ),
      ).toBe('rtl');
    } finally {
      container.remove();
    }
  });

  test('fails closed when every entry in a comma-separated @container condition list is unparseable', () => {
    // Distinct from "no entry matches": these entries use size features and
    // units this module's grammar doesn't implement at all
    // (`hasUnsupportedContainerSizeQuery`), not ones that are merely
    // structurally false at the container's current size.
    const container = document.createElement('section');
    container.style.setProperty('container-type', 'inline-size');
    Object.defineProperty(container, 'offsetWidth', { value: 700, configurable: true });
    const element = document.createElement('div');
    element.className = 'condition-list-unparseable-ltr';
    container.appendChild(element);
    document.body.appendChild(container);
    const nestedRule = createStyleRule({
      selectorText: '.condition-list-unparseable-ltr',
      direction: 'ltr',
    });
    const outerRule = createCssRule({
      cssText:
        '@container (min-height: 40rem), (min-width: 30em) { .condition-list-unparseable-ltr { direction: ltr; } }',
      type: 0,
      conditionText: '(min-height: 40rem), (min-width: 30em)',
      containerName: '',
      containerQuery: '',
      conditions: [
        { name: '', query: '(min-height: 40rem)' },
        { name: '', query: '(min-width: 30em)' },
      ],
      cssRules: [nestedRule],
    });
    try {
      expect(
        withDocumentStyleSheets([{ cssRules: [outerRule] }], () =>
          resolveTextDirection(element, 'rtl'),
        ),
      ).toBe('rtl');
    } finally {
      container.remove();
    }
  });
});
