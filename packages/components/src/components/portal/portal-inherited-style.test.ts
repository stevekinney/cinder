import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { tick } from 'svelte';

import {
  copyInheritedPortalAttributes,
  getInheritedPortalStyle,
  PortalAttachmentTest,
  render,
  restorePortalGlobalState,
} from './portal-test-helpers.ts';

beforeEach(() => document.body.replaceChildren());
afterEach(restorePortalGlobalState);

describe('Portal', () => {
  test('takes typography from the source parent context', () => {
    const parent = document.createElement('div');
    parent.style.fontWeight = '400';
    const source = document.createElement('button');
    source.style.fontWeight = '700';
    parent.append(source);
    document.body.append(parent);
    expect(getInheritedPortalStyle(source)).toContain('font-weight: 400');
  });

  test('serializes an explicit normal color scheme for a portaled surface', () => {
    const source = document.createElement('div');
    source.style.colorScheme = 'normal';
    document.body.append(source);

    expect(getInheritedPortalStyle(source)).toContain('color-scheme: normal');
  });

  test('keeps computed values for Cinder aliases with non-Cinder dependencies', () => {
    const source = document.createElement('div');
    source.style.setProperty('--brand-surface', 'red');
    source.style.setProperty('--cinder-surface', 'var(--brand-surface)');
    document.body.append(source);

    expect(getInheritedPortalStyle(source)).toContain('--cinder-surface: red');
    expect(getInheritedPortalStyle(source)).not.toContain('var(--brand-surface)');
  });

  test('preserves an explicit language on direct attachment copies', () => {
    const source = document.createElement('div');
    source.lang = 'en';
    const element = document.createElement('div');
    element.lang = 'fr';
    document.body.append(source, element);

    copyInheritedPortalAttributes(element, source, true);
    expect(element.lang).toBe('fr');
  });

  test('inherits computed direction when no explicit dir ancestor exists', () => {
    const source = document.createElement('div');
    source.style.direction = 'rtl';
    const element = document.createElement('div');
    document.body.append(source, element);

    copyInheritedPortalAttributes(element, source, true);

    expect(element.getAttribute('dir')).toBe('rtl');
  });

  test('inherits computed direction from a CSS class', () => {
    const stylesheet = document.createElement('style');
    stylesheet.textContent = '.portal-rtl { direction: rtl; }';
    document.head.append(stylesheet);
    const source = document.createElement('div');
    source.className = 'portal-rtl';
    const element = document.createElement('div');
    document.body.append(source, element);

    copyInheritedPortalAttributes(element, source, true);
    stylesheet.remove();

    expect(element.getAttribute('dir')).toBe('rtl');
  });

  test('prefers computed direction over the document default', () => {
    document.documentElement.setAttribute('dir', 'ltr');
    const source = document.createElement('div');
    source.style.direction = 'rtl';
    const element = document.createElement('div');
    document.body.append(source, element);

    copyInheritedPortalAttributes(element, source, true);

    expect(element.getAttribute('dir')).toBe('rtl');
  });

  test('preserves automatic direction from the document root', () => {
    document.documentElement.setAttribute('dir', 'auto');
    const source = document.createElement('div');
    source.style.direction = 'rtl';
    const element = document.createElement('div');
    document.body.append(source, element);

    copyInheritedPortalAttributes(element, source, true);

    expect(element.getAttribute('dir')).toBe('auto');
  });

  test('preserves case-insensitive automatic direction from the document root', () => {
    document.documentElement.setAttribute('dir', 'AUTO');
    const source = document.createElement('div');
    source.style.direction = 'rtl';
    const element = document.createElement('div');
    document.body.append(source, element);

    copyInheritedPortalAttributes(element, source, true);

    expect(element.getAttribute('dir')).toBe('auto');
  });

  test('inherits an explicit direction across a shadow host', () => {
    const host = document.createElement('div');
    host.setAttribute('dir', 'AUTO');
    const shadow = host.attachShadow({ mode: 'open' });
    const generatedWrapper = document.createElement('div');
    generatedWrapper.setAttribute('dir', 'ltr');
    generatedWrapper.setAttribute('data-cinder-portal-inherited-direction', 'true');
    const source = document.createElement('div');
    const element = document.createElement('div');
    generatedWrapper.append(source);
    shadow.append(generatedWrapper);
    document.body.append(host, element);

    copyInheritedPortalAttributes(element, source, true);

    expect(element.getAttribute('dir')).toBe('auto');
  });

  test('does not let a generated outer portal direction mask inner computed direction', () => {
    document.documentElement.setAttribute('dir', 'ltr');
    const outerWrapper = document.createElement('div');
    outerWrapper.setAttribute('dir', 'ltr');
    outerWrapper.setAttribute('data-cinder-portal-inherited-direction', 'true');
    const source = document.createElement('div');
    source.style.direction = 'rtl';
    const element = document.createElement('div');
    outerWrapper.append(source, element);
    document.body.append(outerWrapper);

    copyInheritedPortalAttributes(element, source, true);

    expect(element.getAttribute('dir')).toBe('rtl');
  });

  test('stops generated direction lookup at a shadow-root portal boundary', () => {
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });
    const destination = document.createElement('div');
    destination.setAttribute('dir', 'ltr');
    const generatedWrapper = document.createElement('div');
    generatedWrapper.setAttribute('dir', 'ltr');
    generatedWrapper.setAttribute('data-cinder-portal-inherited-direction', 'true');
    const source = document.createElement('div');
    source.style.direction = 'rtl';
    const element = document.createElement('div');
    generatedWrapper.append(source);
    destination.append(generatedWrapper);
    shadow.append(destination);
    document.body.append(host, element);

    copyInheritedPortalAttributes(element, source, true);

    expect(element.getAttribute('dir')).toBe('rtl');
  });

  test('inherits a generated outer portal direction without computed-style support', () => {
    Object.defineProperty(globalThis, 'getComputedStyle', {
      configurable: true,
      value: undefined,
    });
    const outerWrapper = document.createElement('div');
    outerWrapper.setAttribute('dir', 'rtl');
    outerWrapper.setAttribute('data-cinder-portal-inherited-direction', 'true');
    const source = document.createElement('div');
    const element = document.createElement('div');
    outerWrapper.append(source, element);
    document.body.append(outerWrapper);

    copyInheritedPortalAttributes(element, source, true);

    expect(element.getAttribute('dir')).toBe('rtl');
  });

  test('falls back to a generated shadow-root direction without computed-style support', () => {
    Object.defineProperty(globalThis, 'getComputedStyle', {
      configurable: true,
      value: undefined,
    });
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });
    const destination = document.createElement('div');
    destination.setAttribute('dir', 'ltr');
    const generatedWrapper = document.createElement('div');
    generatedWrapper.setAttribute('dir', 'rtl');
    generatedWrapper.setAttribute('data-cinder-portal-inherited-direction', 'true');
    const source = document.createElement('div');
    const element = document.createElement('div');
    generatedWrapper.append(source);
    destination.append(generatedWrapper);
    shadow.append(destination);
    document.body.append(host, element);

    copyInheritedPortalAttributes(element, source, true);

    expect(element.getAttribute('dir')).toBe('rtl');
  });

  test('preserves an initial direction on a direct portal attachment', async () => {
    const source = document.createElement('div');
    source.style.direction = 'ltr';
    const target = document.createElement('div');
    document.body.append(source, target);

    render(PortalAttachmentTest, {
      props: { source, target, initialDirection: 'rtl' },
    });
    await tick();

    expect(
      target.querySelector('[data-testid="direct-portal-attachment"]')?.getAttribute('dir'),
    ).toBe('rtl');
  });
});
