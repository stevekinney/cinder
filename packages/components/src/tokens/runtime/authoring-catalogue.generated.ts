/**
 * GENERATED FILE. Do not edit by hand.
 *
 * The token authoring catalogue: one record per public registry entry.
 * Regenerate: bun run --filter=@lostgradient/cinder tokens:generate
 */

import type { AuthoringCatalogue } from './authoring-types.ts';

export const AUTHORING_CATALOGUE: AuthoringCatalogue = {
  version: 1,
  dtcgVersion: '2025.10',
  contexts: [
    { id: 'light/default', theme: 'light', motion: 'default' },
    { id: 'light/reduced', theme: 'light', motion: 'reduced' },
    { id: 'light/forced-reduced-motion', theme: 'light', motion: 'forced-reduced-motion' },
    { id: 'dark/default', theme: 'dark', motion: 'default' },
    { id: 'dark/reduced', theme: 'dark', motion: 'reduced' },
    { id: 'dark/forced-reduced-motion', theme: 'dark', motion: 'forced-reduced-motion' },
  ],
  layerStacks: {
    'light/default': [
      { document: 'sets/foundation.tokens.json', kind: 'set', layer: 'sets.foundation' },
      { document: 'sets/semantic.tokens.json', kind: 'set', layer: 'sets.foundation' },
      { document: 'sets/colors.tokens.json', kind: 'set', layer: 'sets.foundation' },
      { document: 'sets/components.tokens.json', kind: 'set', layer: 'sets.foundation' },
      { document: 'themes/light.tokens.json', kind: 'modifier', layer: 'theme.light' },
      { document: 'modes/motion-default.tokens.json', kind: 'modifier', layer: 'motion.default' },
    ],
    'light/reduced': [
      { document: 'sets/foundation.tokens.json', kind: 'set', layer: 'sets.foundation' },
      { document: 'sets/semantic.tokens.json', kind: 'set', layer: 'sets.foundation' },
      { document: 'sets/colors.tokens.json', kind: 'set', layer: 'sets.foundation' },
      { document: 'sets/components.tokens.json', kind: 'set', layer: 'sets.foundation' },
      { document: 'themes/light.tokens.json', kind: 'modifier', layer: 'theme.light' },
      { document: 'modes/motion-reduced.tokens.json', kind: 'modifier', layer: 'motion.reduced' },
    ],
    'light/forced-reduced-motion': [
      { document: 'sets/foundation.tokens.json', kind: 'set', layer: 'sets.foundation' },
      { document: 'sets/semantic.tokens.json', kind: 'set', layer: 'sets.foundation' },
      { document: 'sets/colors.tokens.json', kind: 'set', layer: 'sets.foundation' },
      { document: 'sets/components.tokens.json', kind: 'set', layer: 'sets.foundation' },
      { document: 'themes/light.tokens.json', kind: 'modifier', layer: 'theme.light' },
      {
        document: 'modes/motion-forced-reduced.tokens.json',
        kind: 'modifier',
        layer: 'motion.forced-reduced-motion',
      },
    ],
    'dark/default': [
      { document: 'sets/foundation.tokens.json', kind: 'set', layer: 'sets.foundation' },
      { document: 'sets/semantic.tokens.json', kind: 'set', layer: 'sets.foundation' },
      { document: 'sets/colors.tokens.json', kind: 'set', layer: 'sets.foundation' },
      { document: 'sets/components.tokens.json', kind: 'set', layer: 'sets.foundation' },
      { document: 'themes/dark.tokens.json', kind: 'modifier', layer: 'theme.dark' },
      { document: 'modes/motion-default.tokens.json', kind: 'modifier', layer: 'motion.default' },
    ],
    'dark/reduced': [
      { document: 'sets/foundation.tokens.json', kind: 'set', layer: 'sets.foundation' },
      { document: 'sets/semantic.tokens.json', kind: 'set', layer: 'sets.foundation' },
      { document: 'sets/colors.tokens.json', kind: 'set', layer: 'sets.foundation' },
      { document: 'sets/components.tokens.json', kind: 'set', layer: 'sets.foundation' },
      { document: 'themes/dark.tokens.json', kind: 'modifier', layer: 'theme.dark' },
      { document: 'modes/motion-reduced.tokens.json', kind: 'modifier', layer: 'motion.reduced' },
    ],
    'dark/forced-reduced-motion': [
      { document: 'sets/foundation.tokens.json', kind: 'set', layer: 'sets.foundation' },
      { document: 'sets/semantic.tokens.json', kind: 'set', layer: 'sets.foundation' },
      { document: 'sets/colors.tokens.json', kind: 'set', layer: 'sets.foundation' },
      { document: 'sets/components.tokens.json', kind: 'set', layer: 'sets.foundation' },
      { document: 'themes/dark.tokens.json', kind: 'modifier', layer: 'theme.dark' },
      {
        document: 'modes/motion-forced-reduced.tokens.json',
        kind: 'modifier',
        layer: 'motion.forced-reduced-motion',
      },
    ],
  },
  profiles: {
    'aspect-ratio': {
      id: 'aspect-ratio',
      description: 'A strictly positive ratio.',
      types: ['number'],
      cssUsage: ['aspect-ratio'],
      range: { part: 'number', finite: true, min: 0, minExclusive: true },
    },
    blur: {
      id: 'blur',
      description: 'A non-negative blur radius.',
      types: ['dimension'],
      cssUsage: ['filter', 'backdrop-filter'],
      range: { part: 'dimension.value', finite: true, min: 0 },
    },
    'border-width': {
      id: 'border-width',
      description: 'A non-negative length.',
      types: ['dimension'],
      cssUsage: ['border-width', 'outline-width'],
      range: { part: 'dimension.value', finite: true, min: 0 },
    },
    color: {
      id: 'color',
      description: 'A color of any supported DTCG color space.',
      types: ['color'],
      cssUsage: ['color', 'background-color', 'border-color', 'outline-color', 'fill'],
    },
    duration: {
      id: 'duration',
      description: 'A non-negative time.',
      types: ['duration'],
      cssUsage: ['transition-duration', 'animation-duration'],
      range: { part: 'duration.value', finite: true, min: 0 },
    },
    easing: {
      id: 'easing',
      description: 'A cubic-bezier timing function.',
      types: ['cubicBezier'],
      cssUsage: ['transition-timing-function', 'animation-timing-function'],
    },
    'font-family': {
      id: 'font-family',
      description: 'An ordered font stack.',
      types: ['fontFamily'],
      cssUsage: ['font-family'],
    },
    'font-size': {
      id: 'font-size',
      description: 'A strictly positive length.',
      types: ['dimension'],
      cssUsage: ['font-size'],
      range: { part: 'dimension.value', finite: true, min: 0, minExclusive: true },
    },
    'font-weight': {
      id: 'font-weight',
      description: 'A weight from 1 to 1000, or a named DTCG weight.',
      types: ['fontWeight'],
      cssUsage: ['font-weight'],
      range: { part: 'fontWeight', finite: true, min: 1, max: 1000 },
      keywords: [
        'thin',
        'hairline',
        'extra-light',
        'ultra-light',
        'light',
        'normal',
        'regular',
        'book',
        'medium',
        'semi-bold',
        'demi-bold',
        'bold',
        'extra-bold',
        'ultra-bold',
        'black',
        'heavy',
        'extra-black',
        'ultra-black',
      ],
    },
    gap: {
      id: 'gap',
      description: 'A non-negative length.',
      types: ['dimension'],
      cssUsage: ['gap', 'row-gap', 'column-gap'],
      range: { part: 'dimension.value', finite: true, min: 0 },
    },
    height: {
      id: 'height',
      description: 'A non-negative length.',
      types: ['dimension'],
      cssUsage: ['height', 'block-size', 'min-height'],
      range: { part: 'dimension.value', finite: true, min: 0 },
    },
    'letter-spacing': {
      id: 'letter-spacing',
      description: 'A signed length.',
      types: ['dimension'],
      cssUsage: ['letter-spacing'],
      range: { part: 'dimension.value', finite: true },
    },
    'line-height': {
      id: 'line-height',
      description: 'A non-negative unitless multiplier.',
      types: ['number', 'dimension'],
      cssUsage: ['line-height'],
      range: { part: 'number', finite: true, min: 0 },
    },
    margin: {
      id: 'margin',
      description: 'A signed length.',
      types: ['dimension'],
      cssUsage: ['margin', 'margin-inline', 'margin-block'],
      range: { part: 'dimension.value', finite: true },
    },
    offset: {
      id: 'offset',
      description: 'A signed length.',
      types: ['dimension'],
      cssUsage: ['outline-offset', 'inset', 'translate'],
      range: { part: 'dimension.value', finite: true },
    },
    opacity: {
      id: 'opacity',
      description: 'A finite alpha between 0 and 1 inclusive.',
      types: ['number'],
      cssUsage: ['opacity'],
      range: { part: 'number', finite: true, min: 0, max: 1 },
    },
    padding: {
      id: 'padding',
      description: 'A non-negative length.',
      types: ['dimension'],
      cssUsage: ['padding', 'padding-block', 'padding-inline'],
      range: { part: 'dimension.value', finite: true, min: 0 },
    },
    radius: {
      id: 'radius',
      description: 'A non-negative length.',
      types: ['dimension'],
      cssUsage: ['border-radius'],
      range: { part: 'dimension.value', finite: true, min: 0 },
    },
    shadow: {
      id: 'shadow',
      description: 'One or more shadow layers.',
      types: ['shadow'],
      cssUsage: ['box-shadow'],
    },
    size: {
      id: 'size',
      description: 'A non-negative square extent.',
      types: ['dimension'],
      cssUsage: ['width', 'height', 'inline-size'],
      range: { part: 'dimension.value', finite: true, min: 0 },
    },
    spacing: {
      id: 'spacing',
      description: 'A non-negative spacing-scale step.',
      types: ['dimension'],
      cssUsage: ['padding', 'gap', 'margin'],
      range: { part: 'dimension.value', finite: true, min: 0 },
    },
    'tab-size': {
      id: 'tab-size',
      description: 'A non-negative tab width in characters.',
      types: ['number'],
      cssUsage: ['tab-size'],
      range: { part: 'number', finite: true, min: 0 },
    },
    width: {
      id: 'width',
      description: 'A non-negative length.',
      types: ['dimension', 'number'],
      cssUsage: ['width', 'inline-size', 'max-width'],
      range: { part: 'dimension.value', finite: true, min: 0 },
    },
    'z-index': {
      id: 'z-index',
      description: 'A signed 32-bit integer stacking order.',
      types: ['number'],
      cssUsage: ['z-index'],
      range: { part: 'number', finite: true, integer: true, min: -2147483648, max: 2147483647 },
    },
  },
  scales: {
    spacing: [
      'space.0',
      'space.2',
      'space.3',
      'space.4',
      'space.5',
      'space.6',
      'space.7',
      'space.8',
      'space.10',
      'space.12',
      'space.16',
      'space.20',
      'space.24',
      'space.32',
      'space.0-5',
      'space.one',
      'space.1-5',
      'space.2-5',
      'space.3-5',
    ],
    radius: ['radius.small', 'radius.medium', 'radius.large', 'radius.full'],
  },
  records: [
    {
      path: 'space.0',
      cssProperty: '--cinder-space-0',
      category: 'spacing',
      component: null,
      description: 'Zero spacing step, used to explicitly reset a spacing property.',
      themeAware: false,
      deprecated: false,
      profile: 'spacing',
      scale: 'spacing',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/foundation.tokens.json', path: 'space.0' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'space.0',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'inherited',
              declaredAt: { document: 'sets/foundation.tokens.json', path: 'space' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'space.2',
      cssProperty: '--cinder-space-2',
      category: 'spacing',
      component: null,
      description: 'Spacing scale step (8px).',
      themeAware: false,
      deprecated: false,
      profile: 'spacing',
      scale: 'spacing',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/foundation.tokens.json', path: 'space.2' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'space.2',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'inherited',
              declaredAt: { document: 'sets/foundation.tokens.json', path: 'space' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'space.3',
      cssProperty: '--cinder-space-3',
      category: 'spacing',
      component: null,
      description: 'Spacing scale step (12px).',
      themeAware: false,
      deprecated: false,
      profile: 'spacing',
      scale: 'spacing',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/foundation.tokens.json', path: 'space.3' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'space.3',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'inherited',
              declaredAt: { document: 'sets/foundation.tokens.json', path: 'space' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'space.4',
      cssProperty: '--cinder-space-4',
      category: 'spacing',
      component: null,
      description: 'Spacing scale step (16px).',
      themeAware: false,
      deprecated: false,
      profile: 'spacing',
      scale: 'spacing',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/foundation.tokens.json', path: 'space.4' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'space.4',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'inherited',
              declaredAt: { document: 'sets/foundation.tokens.json', path: 'space' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'space.5',
      cssProperty: '--cinder-space-5',
      category: 'spacing',
      component: null,
      description: 'Spacing scale step (20px).',
      themeAware: false,
      deprecated: false,
      profile: 'spacing',
      scale: 'spacing',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/foundation.tokens.json', path: 'space.5' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'space.5',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'inherited',
              declaredAt: { document: 'sets/foundation.tokens.json', path: 'space' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'space.6',
      cssProperty: '--cinder-space-6',
      category: 'spacing',
      component: null,
      description: 'Spacing scale step (24px).',
      themeAware: false,
      deprecated: false,
      profile: 'spacing',
      scale: 'spacing',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/foundation.tokens.json', path: 'space.6' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'space.6',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'inherited',
              declaredAt: { document: 'sets/foundation.tokens.json', path: 'space' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'space.7',
      cssProperty: '--cinder-space-7',
      category: 'spacing',
      component: null,
      description: 'Spacing scale step (28px).',
      themeAware: false,
      deprecated: false,
      profile: 'spacing',
      scale: 'spacing',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/foundation.tokens.json', path: 'space.7' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'space.7',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'inherited',
              declaredAt: { document: 'sets/foundation.tokens.json', path: 'space' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'space.8',
      cssProperty: '--cinder-space-8',
      category: 'spacing',
      component: null,
      description: 'Spacing scale step (32px).',
      themeAware: false,
      deprecated: false,
      profile: 'spacing',
      scale: 'spacing',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/foundation.tokens.json', path: 'space.8' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'space.8',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'inherited',
              declaredAt: { document: 'sets/foundation.tokens.json', path: 'space' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'space.10',
      cssProperty: '--cinder-space-10',
      category: 'spacing',
      component: null,
      description: 'Spacing scale step (40px).',
      themeAware: false,
      deprecated: false,
      profile: 'spacing',
      scale: 'spacing',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/foundation.tokens.json', path: 'space.10' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'space.10',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'inherited',
              declaredAt: { document: 'sets/foundation.tokens.json', path: 'space' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'space.12',
      cssProperty: '--cinder-space-12',
      category: 'spacing',
      component: null,
      description: 'Spacing scale step (48px).',
      themeAware: false,
      deprecated: false,
      profile: 'spacing',
      scale: 'spacing',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/foundation.tokens.json', path: 'space.12' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'space.12',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'inherited',
              declaredAt: { document: 'sets/foundation.tokens.json', path: 'space' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'space.16',
      cssProperty: '--cinder-space-16',
      category: 'spacing',
      component: null,
      description: 'Spacing scale step (64px).',
      themeAware: false,
      deprecated: false,
      profile: 'spacing',
      scale: 'spacing',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/foundation.tokens.json', path: 'space.16' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'space.16',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'inherited',
              declaredAt: { document: 'sets/foundation.tokens.json', path: 'space' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'space.20',
      cssProperty: '--cinder-space-20',
      category: 'spacing',
      component: null,
      description: 'Spacing scale step (80px).',
      themeAware: false,
      deprecated: false,
      profile: 'spacing',
      scale: 'spacing',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/foundation.tokens.json', path: 'space.20' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'space.20',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'inherited',
              declaredAt: { document: 'sets/foundation.tokens.json', path: 'space' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'space.24',
      cssProperty: '--cinder-space-24',
      category: 'spacing',
      component: null,
      description: 'Spacing scale step (96px).',
      themeAware: false,
      deprecated: false,
      profile: 'spacing',
      scale: 'spacing',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/foundation.tokens.json', path: 'space.24' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'space.24',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'inherited',
              declaredAt: { document: 'sets/foundation.tokens.json', path: 'space' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'space.32',
      cssProperty: '--cinder-space-32',
      category: 'spacing',
      component: null,
      description: 'Spacing scale step (128px).',
      themeAware: false,
      deprecated: false,
      profile: 'spacing',
      scale: 'spacing',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/foundation.tokens.json', path: 'space.32' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'space.32',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'inherited',
              declaredAt: { document: 'sets/foundation.tokens.json', path: 'space' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'space.0-5',
      cssProperty: '--cinder-space-0-5',
      category: 'spacing',
      component: null,
      description: 'Spacing scale half-step between 0 and 1 (2px).',
      themeAware: false,
      deprecated: false,
      profile: 'spacing',
      scale: 'spacing',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/foundation.tokens.json', path: 'space.0-5' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'space.0-5',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'inherited',
              declaredAt: { document: 'sets/foundation.tokens.json', path: 'space' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'space.one',
      cssProperty: '--cinder-space-1',
      category: 'spacing',
      component: null,
      description: 'Base spacing increment.',
      themeAware: false,
      deprecated: false,
      profile: 'spacing',
      scale: 'spacing',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/foundation.tokens.json', path: 'space.one' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'space.one',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'inherited',
              declaredAt: { document: 'sets/foundation.tokens.json', path: 'space' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'space.1-5',
      cssProperty: '--cinder-space-1-5',
      category: 'spacing',
      component: null,
      description: 'Spacing scale half-step between 1 and 2 (6px).',
      themeAware: false,
      deprecated: false,
      profile: 'spacing',
      scale: 'spacing',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/foundation.tokens.json', path: 'space.1-5' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'space.1-5',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'inherited',
              declaredAt: { document: 'sets/foundation.tokens.json', path: 'space' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'space.2-5',
      cssProperty: '--cinder-space-2-5',
      category: 'spacing',
      component: null,
      description: 'Spacing scale half-step between 2 and 3 (10px).',
      themeAware: false,
      deprecated: false,
      profile: 'spacing',
      scale: 'spacing',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/foundation.tokens.json', path: 'space.2-5' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'space.2-5',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'inherited',
              declaredAt: { document: 'sets/foundation.tokens.json', path: 'space' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'space.3-5',
      cssProperty: '--cinder-space-3-5',
      category: 'spacing',
      component: null,
      description: 'Spacing scale half-step between 3 and 4 (14px).',
      themeAware: false,
      deprecated: false,
      profile: 'spacing',
      scale: 'spacing',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/foundation.tokens.json', path: 'space.3-5' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'space.3-5',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'inherited',
              declaredAt: { document: 'sets/foundation.tokens.json', path: 'space' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'radius.small',
      cssProperty: '--cinder-radius-sm',
      category: 'radius',
      component: null,
      description: 'Compact control corner radius (6px).',
      themeAware: false,
      deprecated: false,
      profile: 'radius',
      scale: 'radius',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/foundation.tokens.json', path: 'radius.small' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'radius.small',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'inherited',
              declaredAt: { document: 'sets/semantic.tokens.json', path: 'radius' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'radius.medium',
      cssProperty: '--cinder-radius-md',
      category: 'radius',
      component: null,
      description: 'Default control corner radius.',
      themeAware: false,
      deprecated: false,
      profile: 'radius',
      scale: 'radius',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/foundation.tokens.json', path: 'radius.medium' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'radius.medium',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'inherited',
              declaredAt: { document: 'sets/semantic.tokens.json', path: 'radius' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'radius.large',
      cssProperty: '--cinder-radius-lg',
      category: 'radius',
      component: null,
      description: 'Surface-level corner radius for cards, dialogs, and other large panels (12px).',
      themeAware: false,
      deprecated: false,
      profile: 'radius',
      scale: 'radius',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/foundation.tokens.json', path: 'radius.large' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'radius.large',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'inherited',
              declaredAt: { document: 'sets/semantic.tokens.json', path: 'radius' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'radius.full',
      cssProperty: '--cinder-radius-full',
      category: 'radius',
      component: null,
      description: 'Fully rounded corner radius for pills and circular controls.',
      themeAware: false,
      deprecated: false,
      profile: 'radius',
      scale: 'radius',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/foundation.tokens.json', path: 'radius.full' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'radius.full',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'inherited',
              declaredAt: { document: 'sets/semantic.tokens.json', path: 'radius' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'radius.control',
      cssProperty: '--cinder-radius-control',
      category: 'radius',
      component: null,
      description: 'Default control corner radius alias.',
      themeAware: false,
      deprecated: false,
      profile: 'radius',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/semantic.tokens.json', path: 'radius.control' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'radius.control',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'inherited',
              declaredAt: { document: 'sets/semantic.tokens.json', path: 'radius' },
            },
            inputs: { aliases: ['radius.medium'], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'radius.surface',
      cssProperty: '--cinder-radius-surface',
      category: 'radius',
      component: null,
      description: 'Default surface corner radius alias.',
      themeAware: false,
      deprecated: false,
      profile: 'radius',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/semantic.tokens.json', path: 'radius.surface' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'radius.surface',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'inherited',
              declaredAt: { document: 'sets/semantic.tokens.json', path: 'radius' },
            },
            inputs: { aliases: ['radius.large'], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'shadow.small',
      cssProperty: '--cinder-shadow-sm',
      category: 'shadow',
      component: null,
      description:
        'Hairline elevation for barely-raised surfaces. Gained a second hairline layer and higher alphas in this refinement pass (light 0.08 -> 0.1 plus a new 0.06 layer; dark 0.06 -> 0.09 plus a new 0.05 layer) for deeper, crisper elevation. Light and dark themes carry distinct explicit values (see the theme modifier documents) alongside this `light-dark()` recipe.',
      themeAware: true,
      deprecated: false,
      profile: 'shadow',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'mixed',
        reason:
          'Some contexts emit a trusted CSS recipe and others a typed value; the DTCG value is exported, the recipe is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/light.tokens.json', path: 'shadow.small' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'shadow.small',
                via: 'declared',
              },
              {
                document: 'themes/light.tokens.json',
                kind: 'modifier',
                layer: 'theme.light',
                path: 'shadow.small',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'shadow',
              origin: 'inherited',
              declaredAt: { document: 'themes/light.tokens.json', path: 'shadow' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'shadow.small' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'shadow.small',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'shadow.small',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'shadow',
              origin: 'inherited',
              declaredAt: { document: 'themes/dark.tokens.json', path: 'shadow' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'shadow.medium',
      cssProperty: '--cinder-shadow-md',
      category: 'shadow',
      component: null,
      description: 'Mid elevation for raised surfaces such as popovers.',
      themeAware: true,
      deprecated: false,
      profile: 'shadow',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'mixed',
        reason:
          'Some contexts emit a trusted CSS recipe and others a typed value; the DTCG value is exported, the recipe is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/light.tokens.json', path: 'shadow.medium' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'shadow.medium',
                via: 'declared',
              },
              {
                document: 'themes/light.tokens.json',
                kind: 'modifier',
                layer: 'theme.light',
                path: 'shadow.medium',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'shadow',
              origin: 'inherited',
              declaredAt: { document: 'themes/light.tokens.json', path: 'shadow' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'shadow.medium' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'shadow.medium',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'shadow.medium',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'shadow',
              origin: 'inherited',
              declaredAt: { document: 'themes/dark.tokens.json', path: 'shadow' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'shadow.large',
      cssProperty: '--cinder-shadow-lg',
      category: 'shadow',
      component: null,
      description: 'High elevation for dialogs and drawers.',
      themeAware: true,
      deprecated: false,
      profile: 'shadow',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'mixed',
        reason:
          'Some contexts emit a trusted CSS recipe and others a typed value; the DTCG value is exported, the recipe is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/light.tokens.json', path: 'shadow.large' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'shadow.large',
                via: 'declared',
              },
              {
                document: 'themes/light.tokens.json',
                kind: 'modifier',
                layer: 'theme.light',
                path: 'shadow.large',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'shadow',
              origin: 'inherited',
              declaredAt: { document: 'themes/light.tokens.json', path: 'shadow' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'shadow.large' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'shadow.large',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'shadow.large',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'shadow',
              origin: 'inherited',
              declaredAt: { document: 'themes/dark.tokens.json', path: 'shadow' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'shadow.overlay',
      cssProperty: '--cinder-shadow-overlay',
      category: 'shadow',
      component: null,
      description:
        'Elevation for modal/drawer overlay panels. Dark mode uses a stronger black shadow rather than the light-neutral lift the other tiers use, since overlay panels sit above a dimmed backdrop rather than page content.',
      themeAware: true,
      deprecated: false,
      profile: 'shadow',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'mixed',
        reason:
          'Some contexts emit a trusted CSS recipe and others a typed value; the DTCG value is exported, the recipe is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/light.tokens.json', path: 'shadow.overlay' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'shadow.overlay',
                via: 'declared',
              },
              {
                document: 'themes/light.tokens.json',
                kind: 'modifier',
                layer: 'theme.light',
                path: 'shadow.overlay',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'shadow',
              origin: 'inherited',
              declaredAt: { document: 'themes/light.tokens.json', path: 'shadow' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'shadow.overlay' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'shadow.overlay',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'shadow.overlay',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'shadow',
              origin: 'inherited',
              declaredAt: { document: 'themes/dark.tokens.json', path: 'shadow' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'control.height.xs',
      cssProperty: '--cinder-control-height-xs',
      category: 'size',
      component: null,
      description: 'Extra-small control height (24px).',
      themeAware: false,
      deprecated: false,
      profile: 'height',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/foundation.tokens.json', path: 'control.height.xs' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'control.height.xs',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'inherited',
              declaredAt: { document: 'sets/foundation.tokens.json', path: 'control.height' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'control.height.sm',
      cssProperty: '--cinder-control-height-sm',
      category: 'size',
      component: null,
      description: 'Small control height; the toolbar default (32px).',
      themeAware: false,
      deprecated: false,
      profile: 'height',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/foundation.tokens.json', path: 'control.height.sm' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'control.height.sm',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'inherited',
              declaredAt: { document: 'sets/foundation.tokens.json', path: 'control.height' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'control.height.lg',
      cssProperty: '--cinder-control-height-lg',
      category: 'size',
      component: null,
      description: 'Large control height; clears the WCAG AAA touch target (44px).',
      themeAware: false,
      deprecated: false,
      profile: 'height',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/foundation.tokens.json', path: 'control.height.lg' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'control.height.lg',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'inherited',
              declaredAt: { document: 'sets/foundation.tokens.json', path: 'control.height' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'font.sans',
      cssProperty: '--cinder-font-sans',
      category: 'typography',
      component: null,
      description: 'Default UI font stack.',
      themeAware: false,
      deprecated: false,
      profile: 'font-family',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/foundation.tokens.json', path: 'font.sans' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'font.sans',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'fontFamily',
              origin: 'local',
              declaredAt: { document: 'sets/foundation.tokens.json', path: 'font.sans' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'font.mono',
      cssProperty: '--cinder-font-mono',
      category: 'typography',
      component: null,
      description: 'Monospace font stack for code surfaces.',
      themeAware: false,
      deprecated: false,
      profile: 'font-family',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/foundation.tokens.json', path: 'font.mono' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'font.mono',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'fontFamily',
              origin: 'local',
              declaredAt: { document: 'sets/foundation.tokens.json', path: 'font.mono' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'font.normal',
      cssProperty: '--cinder-font-normal',
      category: 'typography',
      component: null,
      description: 'Normal font weight.',
      themeAware: false,
      deprecated: false,
      profile: 'font-weight',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/foundation.tokens.json', path: 'font.normal' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'font.normal',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'fontWeight',
              origin: 'local',
              declaredAt: { document: 'sets/foundation.tokens.json', path: 'font.normal' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'font.medium',
      cssProperty: '--cinder-font-medium',
      category: 'typography',
      component: null,
      description: 'Medium font weight.',
      themeAware: false,
      deprecated: false,
      profile: 'font-weight',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/foundation.tokens.json', path: 'font.medium' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'font.medium',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'fontWeight',
              origin: 'local',
              declaredAt: { document: 'sets/foundation.tokens.json', path: 'font.medium' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'font.semibold',
      cssProperty: '--cinder-font-semibold',
      category: 'typography',
      component: null,
      description: 'Semibold font weight.',
      themeAware: false,
      deprecated: false,
      profile: 'font-weight',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/foundation.tokens.json', path: 'font.semibold' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'font.semibold',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'fontWeight',
              origin: 'local',
              declaredAt: { document: 'sets/foundation.tokens.json', path: 'font.semibold' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'font.bold',
      cssProperty: '--cinder-font-bold',
      category: 'typography',
      component: null,
      description: 'Bold font weight.',
      themeAware: false,
      deprecated: false,
      profile: 'font-weight',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/foundation.tokens.json', path: 'font.bold' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'font.bold',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'fontWeight',
              origin: 'local',
              declaredAt: { document: 'sets/foundation.tokens.json', path: 'font.bold' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'font.size.2xs',
      cssProperty: '--cinder-text-2xs',
      category: 'typography',
      component: null,
      description: 'Smallest font size (11px).',
      themeAware: false,
      deprecated: false,
      profile: 'font-size',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/foundation.tokens.json', path: 'font.size.2xs' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'font.size.2xs',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'inherited',
              declaredAt: { document: 'sets/foundation.tokens.json', path: 'font.size' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'font.size.xs',
      cssProperty: '--cinder-text-xs',
      category: 'typography',
      component: null,
      description: 'Extra-small font size (12px).',
      themeAware: false,
      deprecated: false,
      profile: 'font-size',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/foundation.tokens.json', path: 'font.size.xs' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'font.size.xs',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'inherited',
              declaredAt: { document: 'sets/foundation.tokens.json', path: 'font.size' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'font.size.sm',
      cssProperty: '--cinder-text-sm',
      category: 'typography',
      component: null,
      description: 'Small font size (13px).',
      themeAware: false,
      deprecated: false,
      profile: 'font-size',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/foundation.tokens.json', path: 'font.size.sm' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'font.size.sm',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'inherited',
              declaredAt: { document: 'sets/foundation.tokens.json', path: 'font.size' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'font.size.base',
      cssProperty: '--cinder-text-base',
      category: 'typography',
      component: null,
      description: 'Base body font size (14px).',
      themeAware: false,
      deprecated: false,
      profile: 'font-size',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/foundation.tokens.json', path: 'font.size.base' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'font.size.base',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'inherited',
              declaredAt: { document: 'sets/foundation.tokens.json', path: 'font.size' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'font.size.md',
      cssProperty: '--cinder-text-md',
      category: 'typography',
      component: null,
      description: 'Medium font size; the button ladder step between base and lg (15px).',
      themeAware: false,
      deprecated: false,
      profile: 'font-size',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/foundation.tokens.json', path: 'font.size.md' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'font.size.md',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'inherited',
              declaredAt: { document: 'sets/foundation.tokens.json', path: 'font.size' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'font.size.lg',
      cssProperty: '--cinder-text-lg',
      category: 'typography',
      component: null,
      description: 'Large font size (16px).',
      themeAware: false,
      deprecated: false,
      profile: 'font-size',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/foundation.tokens.json', path: 'font.size.lg' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'font.size.lg',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'inherited',
              declaredAt: { document: 'sets/foundation.tokens.json', path: 'font.size' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'font.size.xl',
      cssProperty: '--cinder-text-xl',
      category: 'typography',
      component: null,
      description: 'Extra-large font size (18px).',
      themeAware: false,
      deprecated: false,
      profile: 'font-size',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/foundation.tokens.json', path: 'font.size.xl' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'font.size.xl',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'inherited',
              declaredAt: { document: 'sets/foundation.tokens.json', path: 'font.size' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'font.size.2xl',
      cssProperty: '--cinder-text-2xl',
      category: 'typography',
      component: null,
      description: '2xl font size (20px).',
      themeAware: false,
      deprecated: false,
      profile: 'font-size',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/foundation.tokens.json', path: 'font.size.2xl' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'font.size.2xl',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'inherited',
              declaredAt: { document: 'sets/foundation.tokens.json', path: 'font.size' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'font.size.3xl',
      cssProperty: '--cinder-text-3xl',
      category: 'typography',
      component: null,
      description: '3xl font size (24px).',
      themeAware: false,
      deprecated: false,
      profile: 'font-size',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/foundation.tokens.json', path: 'font.size.3xl' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'font.size.3xl',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'inherited',
              declaredAt: { document: 'sets/foundation.tokens.json', path: 'font.size' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'font.size.4xl',
      cssProperty: '--cinder-text-4xl',
      category: 'typography',
      component: null,
      description: '4xl font size (30px).',
      themeAware: false,
      deprecated: false,
      profile: 'font-size',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/foundation.tokens.json', path: 'font.size.4xl' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'font.size.4xl',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'inherited',
              declaredAt: { document: 'sets/foundation.tokens.json', path: 'font.size' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'font.size.5xl',
      cssProperty: '--cinder-text-5xl',
      category: 'typography',
      component: null,
      description: '5xl font size (36px).',
      themeAware: false,
      deprecated: false,
      profile: 'font-size',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/foundation.tokens.json', path: 'font.size.5xl' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'font.size.5xl',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'inherited',
              declaredAt: { document: 'sets/foundation.tokens.json', path: 'font.size' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'leading.none',
      cssProperty: '--cinder-leading-none',
      category: 'typography',
      component: null,
      description: 'No extra line height.',
      themeAware: false,
      deprecated: false,
      profile: 'line-height',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/foundation.tokens.json', path: 'leading.none' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'leading.none',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'number',
              origin: 'inherited',
              declaredAt: { document: 'sets/foundation.tokens.json', path: 'leading' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'leading.tight',
      cssProperty: '--cinder-leading-tight',
      category: 'typography',
      component: null,
      description: 'Tight line height for headings.',
      themeAware: false,
      deprecated: false,
      profile: 'line-height',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/foundation.tokens.json', path: 'leading.tight' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'leading.tight',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'number',
              origin: 'inherited',
              declaredAt: { document: 'sets/foundation.tokens.json', path: 'leading' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'leading.snug',
      cssProperty: '--cinder-leading-snug',
      category: 'typography',
      component: null,
      description: 'Snug line height.',
      themeAware: false,
      deprecated: false,
      profile: 'line-height',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/foundation.tokens.json', path: 'leading.snug' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'leading.snug',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'number',
              origin: 'inherited',
              declaredAt: { document: 'sets/foundation.tokens.json', path: 'leading' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'leading.normal',
      cssProperty: '--cinder-leading-normal',
      category: 'typography',
      component: null,
      description: 'Default body line height.',
      themeAware: false,
      deprecated: false,
      profile: 'line-height',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/foundation.tokens.json', path: 'leading.normal' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'leading.normal',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'number',
              origin: 'inherited',
              declaredAt: { document: 'sets/foundation.tokens.json', path: 'leading' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'leading.relaxed',
      cssProperty: '--cinder-leading-relaxed',
      category: 'typography',
      component: null,
      description: 'Relaxed line height for long-form reading.',
      themeAware: false,
      deprecated: false,
      profile: 'line-height',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/foundation.tokens.json', path: 'leading.relaxed' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'leading.relaxed',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'number',
              origin: 'inherited',
              declaredAt: { document: 'sets/foundation.tokens.json', path: 'leading' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'tracking.normal',
      cssProperty: '--cinder-tracking-normal',
      category: 'typography',
      component: null,
      description: 'Default letter spacing (no adjustment).',
      themeAware: false,
      deprecated: false,
      profile: 'letter-spacing',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/foundation.tokens.json', path: 'tracking.normal' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'tracking.normal',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'local',
              declaredAt: { document: 'sets/foundation.tokens.json', path: 'tracking.normal' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'tracking.tight',
      cssProperty: '--cinder-tracking-tight',
      category: 'typography',
      component: null,
      description:
        'Tight letter-spacing, -0.01em. Expressed as a unitless number with an em recipe because DTCG dimension units are limited to px and rem.',
      themeAware: false,
      deprecated: false,
      profile: 'letter-spacing',
      disposition: {
        edit: 'recipe',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'trusted-recipe',
        reason: 'The DTCG value is exported; the trusted CSS recipe that governs emission is not.',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/foundation.tokens.json', path: 'tracking.tight' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'tracking.tight',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'number',
              origin: 'local',
              declaredAt: { document: 'sets/foundation.tokens.json', path: 'tracking.tight' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'tracking.wide',
      cssProperty: '--cinder-tracking-wide',
      category: 'typography',
      component: null,
      description:
        'Wide letter-spacing, 0.02em. Expressed as a unitless number with an em recipe because DTCG dimension units are limited to px and rem.',
      themeAware: false,
      deprecated: false,
      profile: 'letter-spacing',
      disposition: {
        edit: 'recipe',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'trusted-recipe',
        reason: 'The DTCG value is exported; the trusted CSS recipe that governs emission is not.',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/foundation.tokens.json', path: 'tracking.wide' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'tracking.wide',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'number',
              origin: 'local',
              declaredAt: { document: 'sets/foundation.tokens.json', path: 'tracking.wide' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'type.tab-size',
      cssProperty: '--cinder-type-tab-size',
      category: 'typography',
      component: null,
      description:
        'Tab width for monospace/code surfaces (`variant="code"` on Input/Textarea, CodeBlock). Tab characters render as this many spaces\' worth.',
      themeAware: false,
      deprecated: false,
      profile: 'tab-size',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/foundation.tokens.json', path: 'type.tab-size' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'type.tab-size',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'number',
              origin: 'local',
              declaredAt: { document: 'sets/foundation.tokens.json', path: 'type.tab-size' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'touch.target-min',
      cssProperty: '--cinder-touch-target-min',
      category: 'size',
      component: null,
      description: 'Minimum touch target size.',
      themeAware: false,
      deprecated: false,
      profile: 'size',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/foundation.tokens.json', path: 'touch.target-min' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'touch.target-min',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'local',
              declaredAt: { document: 'sets/foundation.tokens.json', path: 'touch.target-min' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'content.width',
      cssProperty: '--cinder-content-width',
      category: 'size',
      component: null,
      description:
        'Maximum inline size for primary page content. Caps line length and keeps content readable on wide viewports. Used by page layout styles; consumers can override per scope.',
      themeAware: false,
      deprecated: false,
      profile: 'width',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/foundation.tokens.json', path: 'content.width' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'content.width',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'inherited',
              declaredAt: { document: 'sets/foundation.tokens.json', path: 'content.width' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'content.width.narrow',
      cssProperty: '--cinder-content-width-narrow',
      category: 'size',
      component: null,
      description: 'Tighter centered column width.',
      themeAware: false,
      deprecated: false,
      profile: 'width',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/foundation.tokens.json', path: 'content.width.narrow' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'content.width.narrow',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'inherited',
              declaredAt: { document: 'sets/foundation.tokens.json', path: 'content.width' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'content.width.wide',
      cssProperty: '--cinder-content-width-wide',
      category: 'size',
      component: null,
      description: 'Roomier centered column width.',
      themeAware: false,
      deprecated: false,
      profile: 'width',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/foundation.tokens.json', path: 'content.width.wide' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'content.width.wide',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'inherited',
              declaredAt: { document: 'sets/foundation.tokens.json', path: 'content.width' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'content.width.prose',
      cssProperty: '--cinder-content-width-prose',
      category: 'layout',
      component: null,
      description:
        'Prose column width, 65ch — caps line length at a readable measure. Expressed as a unitless number with a ch recipe because DTCG dimension units are limited to px and rem.',
      themeAware: false,
      deprecated: false,
      profile: 'width',
      disposition: {
        edit: 'recipe',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'trusted-recipe',
        reason: 'The DTCG value is exported; the trusted CSS recipe that governs emission is not.',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/foundation.tokens.json', path: 'content.width.prose' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'content.width.prose',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'number',
              origin: 'local',
              declaredAt: { document: 'sets/foundation.tokens.json', path: 'content.width.prose' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'ease.standard',
      cssProperty: '--cinder-ease-standard',
      category: 'motion',
      component: null,
      description: 'Standard easing curve.',
      themeAware: false,
      deprecated: false,
      profile: 'easing',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/foundation.tokens.json', path: 'ease.standard' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'ease.standard',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'cubicBezier',
              origin: 'inherited',
              declaredAt: { document: 'sets/foundation.tokens.json', path: 'ease' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'ease.decelerate',
      cssProperty: '--cinder-ease-decelerate',
      category: 'motion',
      component: null,
      description: 'Decelerate-in easing curve.',
      themeAware: false,
      deprecated: false,
      profile: 'easing',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/foundation.tokens.json', path: 'ease.decelerate' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'ease.decelerate',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'cubicBezier',
              origin: 'inherited',
              declaredAt: { document: 'sets/foundation.tokens.json', path: 'ease' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'ease.accelerate',
      cssProperty: '--cinder-ease-accelerate',
      category: 'motion',
      component: null,
      description: 'Accelerate-out easing curve.',
      themeAware: false,
      deprecated: false,
      profile: 'easing',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/foundation.tokens.json', path: 'ease.accelerate' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'ease.accelerate',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'cubicBezier',
              origin: 'inherited',
              declaredAt: { document: 'sets/foundation.tokens.json', path: 'ease' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'ease.in-out',
      cssProperty: '--cinder-ease-in-out',
      category: 'motion',
      component: null,
      description: 'Ease-in-out curve.',
      themeAware: false,
      deprecated: false,
      profile: 'easing',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/foundation.tokens.json', path: 'ease.in-out' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'ease.in-out',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'cubicBezier',
              origin: 'inherited',
              declaredAt: { document: 'sets/foundation.tokens.json', path: 'ease' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'ease.spring',
      cssProperty: '--cinder-ease-spring',
      category: 'motion',
      component: null,
      description:
        'A fast, settled ease-out with no overshoot. Previously cubic-bezier(0.34, 1.56, 0.64, 1) — a back-ease whose y1=1.56 overshot to 156% of travel, which on the sheet/drawer (100%-of-panel translate) flung the panel past the viewport edge before settling. This curve keeps the snappy decelerate-in feel with no overshoot.',
      themeAware: false,
      deprecated: false,
      profile: 'easing',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/foundation.tokens.json', path: 'ease.spring' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'ease.spring',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'cubicBezier',
              origin: 'inherited',
              declaredAt: { document: 'sets/foundation.tokens.json', path: 'ease' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'motion.instant',
      cssProperty: '--cinder-duration-instant',
      category: 'motion',
      component: null,
      description: 'Instant (no) transition duration.',
      themeAware: false,
      deprecated: false,
      profile: 'duration',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: ['light/default', 'dark/default'],
          provenance: {
            winner: { document: 'sets/foundation.tokens.json', path: 'motion.instant' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'motion.instant',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'duration',
              origin: 'inherited',
              declaredAt: { document: 'sets/foundation.tokens.json', path: 'motion' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['light/reduced', 'dark/reduced'],
          provenance: {
            winner: { document: 'modes/motion-reduced.tokens.json', path: 'motion.instant' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'motion.instant',
                via: 'declared',
              },
              {
                document: 'modes/motion-reduced.tokens.json',
                kind: 'modifier',
                layer: 'motion.reduced',
                path: 'motion.instant',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'duration',
              origin: 'inherited',
              declaredAt: { document: 'modes/motion-reduced.tokens.json', path: 'motion' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['light/forced-reduced-motion', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'modes/motion-forced-reduced.tokens.json', path: 'motion.instant' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'motion.instant',
                via: 'declared',
              },
              {
                document: 'modes/motion-forced-reduced.tokens.json',
                kind: 'modifier',
                layer: 'motion.forced-reduced-motion',
                path: 'motion.instant',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'duration',
              origin: 'inherited',
              declaredAt: { document: 'modes/motion-forced-reduced.tokens.json', path: 'motion' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'motion.fast',
      cssProperty: '--cinder-duration-fast',
      category: 'motion',
      component: null,
      description: 'Fast interaction duration before a reduced-motion modifier applies.',
      themeAware: false,
      deprecated: false,
      profile: 'duration',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: ['light/default', 'dark/default'],
          provenance: {
            winner: { document: 'sets/foundation.tokens.json', path: 'motion.fast' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'motion.fast',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'duration',
              origin: 'inherited',
              declaredAt: { document: 'sets/foundation.tokens.json', path: 'motion' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['light/reduced', 'dark/reduced'],
          provenance: {
            winner: { document: 'modes/motion-reduced.tokens.json', path: 'motion.fast' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'motion.fast',
                via: 'declared',
              },
              {
                document: 'modes/motion-reduced.tokens.json',
                kind: 'modifier',
                layer: 'motion.reduced',
                path: 'motion.fast',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'duration',
              origin: 'inherited',
              declaredAt: { document: 'modes/motion-reduced.tokens.json', path: 'motion' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['light/forced-reduced-motion', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'modes/motion-forced-reduced.tokens.json', path: 'motion.fast' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'motion.fast',
                via: 'declared',
              },
              {
                document: 'modes/motion-forced-reduced.tokens.json',
                kind: 'modifier',
                layer: 'motion.forced-reduced-motion',
                path: 'motion.fast',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'duration',
              origin: 'inherited',
              declaredAt: { document: 'modes/motion-forced-reduced.tokens.json', path: 'motion' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'motion.normal',
      cssProperty: '--cinder-duration-normal',
      category: 'motion',
      component: null,
      description: 'Alias of the base transition duration.',
      themeAware: false,
      deprecated: false,
      profile: 'duration',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: ['light/default', 'dark/default'],
          provenance: {
            winner: { document: 'sets/foundation.tokens.json', path: 'motion.normal' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'motion.normal',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'duration',
              origin: 'inherited',
              declaredAt: { document: 'sets/foundation.tokens.json', path: 'motion' },
            },
            inputs: { aliases: ['motion.base'], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['light/reduced', 'dark/reduced'],
          provenance: {
            winner: { document: 'modes/motion-reduced.tokens.json', path: 'motion.normal' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'motion.normal',
                via: 'declared',
              },
              {
                document: 'modes/motion-reduced.tokens.json',
                kind: 'modifier',
                layer: 'motion.reduced',
                path: 'motion.normal',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'duration',
              origin: 'inherited',
              declaredAt: { document: 'modes/motion-reduced.tokens.json', path: 'motion' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['light/forced-reduced-motion', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'modes/motion-forced-reduced.tokens.json', path: 'motion.normal' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'motion.normal',
                via: 'declared',
              },
              {
                document: 'modes/motion-forced-reduced.tokens.json',
                kind: 'modifier',
                layer: 'motion.forced-reduced-motion',
                path: 'motion.normal',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'duration',
              origin: 'inherited',
              declaredAt: { document: 'modes/motion-forced-reduced.tokens.json', path: 'motion' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'motion.moderate',
      cssProperty: '--cinder-duration-moderate',
      category: 'motion',
      component: null,
      description: 'Moderate transition duration.',
      themeAware: false,
      deprecated: false,
      profile: 'duration',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: ['light/default', 'dark/default'],
          provenance: {
            winner: { document: 'sets/foundation.tokens.json', path: 'motion.moderate' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'motion.moderate',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'duration',
              origin: 'inherited',
              declaredAt: { document: 'sets/foundation.tokens.json', path: 'motion' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['light/reduced', 'dark/reduced'],
          provenance: {
            winner: { document: 'modes/motion-reduced.tokens.json', path: 'motion.moderate' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'motion.moderate',
                via: 'declared',
              },
              {
                document: 'modes/motion-reduced.tokens.json',
                kind: 'modifier',
                layer: 'motion.reduced',
                path: 'motion.moderate',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'duration',
              origin: 'inherited',
              declaredAt: { document: 'modes/motion-reduced.tokens.json', path: 'motion' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['light/forced-reduced-motion', 'dark/forced-reduced-motion'],
          provenance: {
            winner: {
              document: 'modes/motion-forced-reduced.tokens.json',
              path: 'motion.moderate',
            },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'motion.moderate',
                via: 'declared',
              },
              {
                document: 'modes/motion-forced-reduced.tokens.json',
                kind: 'modifier',
                layer: 'motion.forced-reduced-motion',
                path: 'motion.moderate',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'duration',
              origin: 'inherited',
              declaredAt: { document: 'modes/motion-forced-reduced.tokens.json', path: 'motion' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'motion.slow',
      cssProperty: '--cinder-duration-slow',
      category: 'motion',
      component: null,
      description: 'Slow transition duration.',
      themeAware: false,
      deprecated: false,
      profile: 'duration',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: ['light/default', 'dark/default'],
          provenance: {
            winner: { document: 'sets/foundation.tokens.json', path: 'motion.slow' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'motion.slow',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'duration',
              origin: 'inherited',
              declaredAt: { document: 'sets/foundation.tokens.json', path: 'motion' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['light/reduced', 'dark/reduced'],
          provenance: {
            winner: { document: 'modes/motion-reduced.tokens.json', path: 'motion.slow' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'motion.slow',
                via: 'declared',
              },
              {
                document: 'modes/motion-reduced.tokens.json',
                kind: 'modifier',
                layer: 'motion.reduced',
                path: 'motion.slow',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'duration',
              origin: 'inherited',
              declaredAt: { document: 'modes/motion-reduced.tokens.json', path: 'motion' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['light/forced-reduced-motion', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'modes/motion-forced-reduced.tokens.json', path: 'motion.slow' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'motion.slow',
                via: 'declared',
              },
              {
                document: 'modes/motion-forced-reduced.tokens.json',
                kind: 'modifier',
                layer: 'motion.forced-reduced-motion',
                path: 'motion.slow',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'duration',
              origin: 'inherited',
              declaredAt: { document: 'modes/motion-forced-reduced.tokens.json', path: 'motion' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'motion.spin',
      cssProperty: '--cinder-duration-spin',
      category: 'motion',
      component: null,
      description: 'Repeating spin animation duration.',
      themeAware: false,
      deprecated: false,
      profile: 'duration',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: ['light/default', 'dark/default'],
          provenance: {
            winner: { document: 'sets/foundation.tokens.json', path: 'motion.spin' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'motion.spin',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'duration',
              origin: 'inherited',
              declaredAt: { document: 'sets/foundation.tokens.json', path: 'motion' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['light/reduced', 'dark/reduced'],
          provenance: {
            winner: { document: 'modes/motion-reduced.tokens.json', path: 'motion.spin' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'motion.spin',
                via: 'declared',
              },
              {
                document: 'modes/motion-reduced.tokens.json',
                kind: 'modifier',
                layer: 'motion.reduced',
                path: 'motion.spin',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'duration',
              origin: 'inherited',
              declaredAt: { document: 'modes/motion-reduced.tokens.json', path: 'motion' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['light/forced-reduced-motion', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'modes/motion-forced-reduced.tokens.json', path: 'motion.spin' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'motion.spin',
                via: 'declared',
              },
              {
                document: 'modes/motion-forced-reduced.tokens.json',
                kind: 'modifier',
                layer: 'motion.forced-reduced-motion',
                path: 'motion.spin',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'duration',
              origin: 'inherited',
              declaredAt: { document: 'modes/motion-forced-reduced.tokens.json', path: 'motion' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'motion.pulse',
      cssProperty: '--cinder-duration-pulse',
      category: 'motion',
      component: null,
      description:
        'Repeating pulse animation duration, for the breathing opacity loop shared by status indicators and skeleton placeholders. Numerically equal to `motion.progress.ring.spin` today, but deliberately its own token: a pulse and a spinner are unrelated motions and either may be retuned without the other.',
      themeAware: false,
      deprecated: false,
      profile: 'duration',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: ['light/default', 'dark/default'],
          provenance: {
            winner: { document: 'sets/foundation.tokens.json', path: 'motion.pulse' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'motion.pulse',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'duration',
              origin: 'inherited',
              declaredAt: { document: 'sets/foundation.tokens.json', path: 'motion' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['light/reduced', 'dark/reduced'],
          provenance: {
            winner: { document: 'modes/motion-reduced.tokens.json', path: 'motion.pulse' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'motion.pulse',
                via: 'declared',
              },
              {
                document: 'modes/motion-reduced.tokens.json',
                kind: 'modifier',
                layer: 'motion.reduced',
                path: 'motion.pulse',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'duration',
              origin: 'inherited',
              declaredAt: { document: 'modes/motion-reduced.tokens.json', path: 'motion' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['light/forced-reduced-motion', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'modes/motion-forced-reduced.tokens.json', path: 'motion.pulse' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'motion.pulse',
                via: 'declared',
              },
              {
                document: 'modes/motion-forced-reduced.tokens.json',
                kind: 'modifier',
                layer: 'motion.forced-reduced-motion',
                path: 'motion.pulse',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'duration',
              origin: 'inherited',
              declaredAt: { document: 'modes/motion-forced-reduced.tokens.json', path: 'motion' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'motion.progress.bar.indeterminate',
      cssProperty: '--cinder-duration-progress-bar-indeterminate',
      category: 'motion',
      component: null,
      description: 'Repeating indeterminate progress-bar animation duration.',
      themeAware: false,
      deprecated: false,
      profile: 'duration',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: ['light/default', 'dark/default'],
          provenance: {
            winner: {
              document: 'sets/foundation.tokens.json',
              path: 'motion.progress.bar.indeterminate',
            },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'motion.progress.bar.indeterminate',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'duration',
              origin: 'inherited',
              declaredAt: { document: 'sets/foundation.tokens.json', path: 'motion' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['light/reduced', 'dark/reduced'],
          provenance: {
            winner: {
              document: 'modes/motion-reduced.tokens.json',
              path: 'motion.progress.bar.indeterminate',
            },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'motion.progress.bar.indeterminate',
                via: 'declared',
              },
              {
                document: 'modes/motion-reduced.tokens.json',
                kind: 'modifier',
                layer: 'motion.reduced',
                path: 'motion.progress.bar.indeterminate',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'duration',
              origin: 'inherited',
              declaredAt: { document: 'modes/motion-reduced.tokens.json', path: 'motion' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['light/forced-reduced-motion', 'dark/forced-reduced-motion'],
          provenance: {
            winner: {
              document: 'modes/motion-forced-reduced.tokens.json',
              path: 'motion.progress.bar.indeterminate',
            },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'motion.progress.bar.indeterminate',
                via: 'declared',
              },
              {
                document: 'modes/motion-forced-reduced.tokens.json',
                kind: 'modifier',
                layer: 'motion.forced-reduced-motion',
                path: 'motion.progress.bar.indeterminate',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'duration',
              origin: 'inherited',
              declaredAt: { document: 'modes/motion-forced-reduced.tokens.json', path: 'motion' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'motion.progress.ring.spin',
      cssProperty: '--cinder-duration-progress-ring-spin',
      category: 'motion',
      component: null,
      description: 'Repeating progress-ring spin animation duration.',
      themeAware: false,
      deprecated: false,
      profile: 'duration',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: ['light/default', 'dark/default'],
          provenance: {
            winner: { document: 'sets/foundation.tokens.json', path: 'motion.progress.ring.spin' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'motion.progress.ring.spin',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'duration',
              origin: 'inherited',
              declaredAt: { document: 'sets/foundation.tokens.json', path: 'motion' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['light/reduced', 'dark/reduced'],
          provenance: {
            winner: {
              document: 'modes/motion-reduced.tokens.json',
              path: 'motion.progress.ring.spin',
            },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'motion.progress.ring.spin',
                via: 'declared',
              },
              {
                document: 'modes/motion-reduced.tokens.json',
                kind: 'modifier',
                layer: 'motion.reduced',
                path: 'motion.progress.ring.spin',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'duration',
              origin: 'inherited',
              declaredAt: { document: 'modes/motion-reduced.tokens.json', path: 'motion' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['light/forced-reduced-motion', 'dark/forced-reduced-motion'],
          provenance: {
            winner: {
              document: 'modes/motion-forced-reduced.tokens.json',
              path: 'motion.progress.ring.spin',
            },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'motion.progress.ring.spin',
                via: 'declared',
              },
              {
                document: 'modes/motion-forced-reduced.tokens.json',
                kind: 'modifier',
                layer: 'motion.forced-reduced-motion',
                path: 'motion.progress.ring.spin',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'duration',
              origin: 'inherited',
              declaredAt: { document: 'modes/motion-forced-reduced.tokens.json', path: 'motion' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'motion.base',
      cssProperty: '--cinder-duration-base',
      category: 'motion',
      component: null,
      description: 'Base transition duration.',
      themeAware: false,
      deprecated: false,
      profile: 'duration',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: ['light/default', 'dark/default'],
          provenance: {
            winner: { document: 'sets/foundation.tokens.json', path: 'motion.base' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'motion.base',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'duration',
              origin: 'local',
              declaredAt: { document: 'sets/foundation.tokens.json', path: 'motion.base' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['light/reduced', 'dark/reduced'],
          provenance: {
            winner: { document: 'modes/motion-reduced.tokens.json', path: 'motion.base' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'motion.base',
                via: 'declared',
              },
              {
                document: 'modes/motion-reduced.tokens.json',
                kind: 'modifier',
                layer: 'motion.reduced',
                path: 'motion.base',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'duration',
              origin: 'local',
              declaredAt: { document: 'modes/motion-reduced.tokens.json', path: 'motion.base' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['light/forced-reduced-motion', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'modes/motion-forced-reduced.tokens.json', path: 'motion.base' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'motion.base',
                via: 'declared',
              },
              {
                document: 'modes/motion-forced-reduced.tokens.json',
                kind: 'modifier',
                layer: 'motion.forced-reduced-motion',
                path: 'motion.base',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'duration',
              origin: 'local',
              declaredAt: {
                document: 'modes/motion-forced-reduced.tokens.json',
                path: 'motion.base',
              },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'opacity.disabled',
      cssProperty: '--cinder-opacity-disabled',
      category: 'opacity',
      component: null,
      description: 'Opacity for disabled elements.',
      themeAware: false,
      deprecated: false,
      profile: 'opacity',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/foundation.tokens.json', path: 'opacity.disabled' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'opacity.disabled',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'number',
              origin: 'inherited',
              declaredAt: { document: 'sets/foundation.tokens.json', path: 'opacity' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'opacity.muted',
      cssProperty: '--cinder-opacity-muted',
      category: 'opacity',
      component: null,
      description: 'Opacity for muted elements.',
      themeAware: false,
      deprecated: false,
      profile: 'opacity',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/foundation.tokens.json', path: 'opacity.muted' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'opacity.muted',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'number',
              origin: 'inherited',
              declaredAt: { document: 'sets/foundation.tokens.json', path: 'opacity' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'opacity.faint',
      cssProperty: '--cinder-opacity-faint',
      category: 'opacity',
      component: null,
      description: 'Opacity for faint elements.',
      themeAware: false,
      deprecated: false,
      profile: 'opacity',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/foundation.tokens.json', path: 'opacity.faint' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'opacity.faint',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'number',
              origin: 'inherited',
              declaredAt: { document: 'sets/foundation.tokens.json', path: 'opacity' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'z.tooltip',
      cssProperty: '--cinder-z-tooltip',
      category: 'z-index',
      component: null,
      description: 'Tooltip layer.',
      themeAware: false,
      deprecated: false,
      profile: 'z-index',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/foundation.tokens.json', path: 'z.tooltip' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'z.tooltip',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'number',
              origin: 'inherited',
              declaredAt: { document: 'sets/foundation.tokens.json', path: 'z' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'z.dropdown',
      cssProperty: '--cinder-z-dropdown',
      category: 'z-index',
      component: null,
      description: 'Dropdown layer.',
      themeAware: false,
      deprecated: false,
      profile: 'z-index',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/foundation.tokens.json', path: 'z.dropdown' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'z.dropdown',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'number',
              origin: 'inherited',
              declaredAt: { document: 'sets/foundation.tokens.json', path: 'z' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'z.popover',
      cssProperty: '--cinder-z-popover',
      category: 'z-index',
      component: null,
      description: 'Popover layer.',
      themeAware: false,
      deprecated: false,
      profile: 'z-index',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/foundation.tokens.json', path: 'z.popover' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'z.popover',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'number',
              origin: 'inherited',
              declaredAt: { document: 'sets/foundation.tokens.json', path: 'z' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'z.backdrop',
      cssProperty: '--cinder-z-backdrop',
      category: 'z-index',
      component: null,
      description: 'Modal/drawer backdrop layer.',
      themeAware: false,
      deprecated: false,
      profile: 'z-index',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/foundation.tokens.json', path: 'z.backdrop' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'z.backdrop',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'number',
              origin: 'inherited',
              declaredAt: { document: 'sets/foundation.tokens.json', path: 'z' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'z.modal',
      cssProperty: '--cinder-z-modal',
      category: 'z-index',
      component: null,
      description: 'Modal/drawer panel layer.',
      themeAware: false,
      deprecated: false,
      profile: 'z-index',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/foundation.tokens.json', path: 'z.modal' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'z.modal',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'number',
              origin: 'inherited',
              declaredAt: { document: 'sets/foundation.tokens.json', path: 'z' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'z.toast',
      cssProperty: '--cinder-z-toast',
      category: 'z-index',
      component: null,
      description:
        'Toast layer, above modal so confirmations reach users even when a modal is open.',
      themeAware: false,
      deprecated: false,
      profile: 'z-index',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/foundation.tokens.json', path: 'z.toast' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'z.toast',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'number',
              origin: 'inherited',
              declaredAt: { document: 'sets/foundation.tokens.json', path: 'z' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'z.focused-affordance',
      cssProperty: '--cinder-z-focused-affordance',
      category: 'z-index',
      component: null,
      description: 'Focused-affordance layer.',
      themeAware: false,
      deprecated: false,
      profile: 'z-index',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/foundation.tokens.json', path: 'z.focused-affordance' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'z.focused-affordance',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'number',
              origin: 'inherited',
              declaredAt: { document: 'sets/foundation.tokens.json', path: 'z' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'z.drag-preview',
      cssProperty: '--cinder-z-drag-preview',
      category: 'z-index',
      component: null,
      description: 'Drag-preview layer, the topmost tier.',
      themeAware: false,
      deprecated: false,
      profile: 'z-index',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/foundation.tokens.json', path: 'z.drag-preview' },
            layers: [
              {
                document: 'sets/foundation.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'z.drag-preview',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'number',
              origin: 'inherited',
              declaredAt: { document: 'sets/foundation.tokens.json', path: 'z' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'surface.base',
      cssProperty: '--cinder-surface',
      category: 'color',
      component: null,
      description: 'Default semantic surface. Theme modifiers provide its dark value.',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'neutral', role: 'surface-base', anchor: false },
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'mixed',
        reason:
          'Some contexts emit a trusted CSS recipe and others a typed value; the DTCG value is exported, the recipe is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/light.tokens.json', path: 'surface.base' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'surface.base',
                via: 'declared',
              },
              {
                document: 'themes/light.tokens.json',
                kind: 'modifier',
                layer: 'theme.light',
                path: 'surface.base',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'inherited',
              declaredAt: { document: 'themes/light.tokens.json', path: 'surface' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'surface.base' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'surface.base',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'surface.base',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'inherited',
              declaredAt: { document: 'themes/dark.tokens.json', path: 'surface' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'surface.raised',
      cssProperty: '--cinder-surface-raised',
      category: 'color',
      component: null,
      description: 'Elevated semantic surface. Theme modifiers provide its dark value.',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'neutral', role: 'surface-raised', anchor: false },
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'mixed',
        reason:
          'Some contexts emit a trusted CSS recipe and others a typed value; the DTCG value is exported, the recipe is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/light.tokens.json', path: 'surface.raised' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'surface.raised',
                via: 'declared',
              },
              {
                document: 'themes/light.tokens.json',
                kind: 'modifier',
                layer: 'theme.light',
                path: 'surface.raised',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'inherited',
              declaredAt: { document: 'themes/light.tokens.json', path: 'surface' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'surface.raised' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'surface.raised',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'surface.raised',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'inherited',
              declaredAt: { document: 'themes/dark.tokens.json', path: 'surface' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'surface.raised.hover',
      cssProperty: '--cinder-surface-raised-hover',
      category: 'color',
      component: null,
      description:
        'Hover state of the raised surface. Light mode washes toward the accent; dark mode mixes toward white.',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'unknown', role: 'unknown', anchor: 'unknown' },
      disposition: {
        edit: 'recipe',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'trusted-recipe',
        reason: 'The DTCG value is exported; the trusted CSS recipe that governs emission is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/light.tokens.json', path: 'surface.raised.hover' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'surface.raised.hover',
                via: 'declared',
              },
              {
                document: 'themes/light.tokens.json',
                kind: 'modifier',
                layer: 'theme.light',
                path: 'surface.raised.hover',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'inherited',
              declaredAt: { document: 'themes/light.tokens.json', path: 'surface' },
            },
            inputs: {
              aliases: [],
              refs: [],
              extends: [],
              recipes: [
                { cssProperty: '--cinder-surface-raised', path: 'surface.raised' },
                { cssProperty: '--cinder-accent-solid', path: 'accent.solid' },
              ],
            },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'surface.raised.hover' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'surface.raised.hover',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'surface.raised.hover',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'inherited',
              declaredAt: { document: 'themes/dark.tokens.json', path: 'surface' },
            },
            inputs: {
              aliases: [],
              refs: [],
              extends: [],
              recipes: [{ cssProperty: '--cinder-surface-raised', path: 'surface.raised' }],
            },
          },
        },
      ],
    },
    {
      path: 'surface.raised.pressed',
      cssProperty: '--cinder-surface-raised-pressed',
      category: 'color',
      component: null,
      description:
        'Pressed state of the raised surface. Light mode washes toward the accent; dark mode mixes toward white.',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'unknown', role: 'unknown', anchor: 'unknown' },
      disposition: {
        edit: 'recipe',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'trusted-recipe',
        reason: 'The DTCG value is exported; the trusted CSS recipe that governs emission is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/light.tokens.json', path: 'surface.raised.pressed' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'surface.raised.pressed',
                via: 'declared',
              },
              {
                document: 'themes/light.tokens.json',
                kind: 'modifier',
                layer: 'theme.light',
                path: 'surface.raised.pressed',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'inherited',
              declaredAt: { document: 'themes/light.tokens.json', path: 'surface' },
            },
            inputs: {
              aliases: [],
              refs: [],
              extends: [],
              recipes: [
                { cssProperty: '--cinder-surface-raised', path: 'surface.raised' },
                { cssProperty: '--cinder-accent-solid', path: 'accent.solid' },
              ],
            },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'surface.raised.pressed' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'surface.raised.pressed',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'surface.raised.pressed',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'inherited',
              declaredAt: { document: 'themes/dark.tokens.json', path: 'surface' },
            },
            inputs: {
              aliases: [],
              refs: [],
              extends: [],
              recipes: [{ cssProperty: '--cinder-surface-raised', path: 'surface.raised' }],
            },
          },
        },
      ],
    },
    {
      path: 'surface.inset',
      cssProperty: '--cinder-surface-inset',
      category: 'color',
      component: null,
      description: 'Sunken region inside a card body (code blocks, wells, recessed sub-regions).',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'neutral', role: 'surface-inset', anchor: false },
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'mixed',
        reason:
          'Some contexts emit a trusted CSS recipe and others a typed value; the DTCG value is exported, the recipe is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/light.tokens.json', path: 'surface.inset' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'surface.inset',
                via: 'declared',
              },
              {
                document: 'themes/light.tokens.json',
                kind: 'modifier',
                layer: 'theme.light',
                path: 'surface.inset',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'inherited',
              declaredAt: { document: 'themes/light.tokens.json', path: 'surface' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'surface.inset' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'surface.inset',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'surface.inset',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'inherited',
              declaredAt: { document: 'themes/dark.tokens.json', path: 'surface' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'surface.hover',
      cssProperty: '--cinder-surface-hover',
      category: 'color',
      component: null,
      description:
        'Hover state of the default surface. Light mode washes toward the accent rather than darkening toward black: once the light ramp is anchored at white, its four resting tiers occupy only 0.040 lightness points, so a proportional lightness-only mix would be wider than the whole ramp it has to stay clear of. A light-mode hover that washes toward the brand accent separates by chroma and hue as well, staying legible at a lightness step small enough to fit the ramp.',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'unknown', role: 'unknown', anchor: 'unknown' },
      disposition: {
        edit: 'recipe',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'trusted-recipe',
        reason: 'The DTCG value is exported; the trusted CSS recipe that governs emission is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/light.tokens.json', path: 'surface.hover' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'surface.hover',
                via: 'declared',
              },
              {
                document: 'themes/light.tokens.json',
                kind: 'modifier',
                layer: 'theme.light',
                path: 'surface.hover',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'inherited',
              declaredAt: { document: 'themes/light.tokens.json', path: 'surface' },
            },
            inputs: {
              aliases: [],
              refs: [],
              extends: [],
              recipes: [
                { cssProperty: '--cinder-surface', path: 'surface.base' },
                { cssProperty: '--cinder-accent-solid', path: 'accent.solid' },
              ],
            },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'surface.hover' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'surface.hover',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'surface.hover',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'inherited',
              declaredAt: { document: 'themes/dark.tokens.json', path: 'surface' },
            },
            inputs: {
              aliases: [],
              refs: [],
              extends: [],
              recipes: [{ cssProperty: '--cinder-surface', path: 'surface.base' }],
            },
          },
        },
      ],
    },
    {
      path: 'surface.pressed',
      cssProperty: '--cinder-surface-pressed',
      category: 'color',
      component: null,
      description:
        'Pressed state of the default surface. Same accent-wash rationale as `surface.hover`, at a stronger mix percentage.',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'unknown', role: 'unknown', anchor: 'unknown' },
      disposition: {
        edit: 'recipe',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'trusted-recipe',
        reason: 'The DTCG value is exported; the trusted CSS recipe that governs emission is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/light.tokens.json', path: 'surface.pressed' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'surface.pressed',
                via: 'declared',
              },
              {
                document: 'themes/light.tokens.json',
                kind: 'modifier',
                layer: 'theme.light',
                path: 'surface.pressed',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'inherited',
              declaredAt: { document: 'themes/light.tokens.json', path: 'surface' },
            },
            inputs: {
              aliases: [],
              refs: [],
              extends: [],
              recipes: [
                { cssProperty: '--cinder-surface', path: 'surface.base' },
                { cssProperty: '--cinder-accent-solid', path: 'accent.solid' },
              ],
            },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'surface.pressed' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'surface.pressed',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'surface.pressed',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'inherited',
              declaredAt: { document: 'themes/dark.tokens.json', path: 'surface' },
            },
            inputs: {
              aliases: [],
              refs: [],
              extends: [],
              recipes: [{ cssProperty: '--cinder-surface', path: 'surface.base' }],
            },
          },
        },
      ],
    },
    {
      path: 'surface.inverse',
      cssProperty: '--cinder-surface-inverse',
      category: 'color',
      component: null,
      description:
        'Inverse surface, used by Tooltip to stay a dark overlay in both themes. Light arm mirrors the text/surface swap (dark bg, light fg); dark arm uses the elevated surface + near-white text so the tooltip reads as a dark elevated layer rather than inverting to light.',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'unknown', role: 'unknown', anchor: 'unknown' },
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'mixed',
        reason:
          'Some contexts emit a trusted CSS recipe and others a typed value; the DTCG value is exported, the recipe is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/light.tokens.json', path: 'surface.inverse' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'surface.inverse',
                via: 'declared',
              },
              {
                document: 'themes/light.tokens.json',
                kind: 'modifier',
                layer: 'theme.light',
                path: 'surface.inverse',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'inherited',
              declaredAt: { document: 'themes/light.tokens.json', path: 'surface' },
            },
            inputs: { aliases: ['text.default'], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'surface.inverse' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'surface.inverse',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'surface.inverse',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'inherited',
              declaredAt: { document: 'themes/dark.tokens.json', path: 'surface' },
            },
            inputs: { aliases: ['surface.raised'], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'surface.upcoming-marker',
      cssProperty: '--cinder-surface-upcoming-marker',
      category: 'color',
      component: null,
      description:
        'Upcoming step marker background. Keeps the inset treatment in light mode (surface-inset is visibly recessed vs surface), but lifts to surface in dark mode where surface-inset is nearly invisible against the dark stage.',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'unknown', role: 'unknown', anchor: 'unknown' },
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'mixed',
        reason:
          'Some contexts emit a trusted CSS recipe and others a typed value; the DTCG value is exported, the recipe is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/light.tokens.json', path: 'surface.upcoming-marker' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'surface.upcoming-marker',
                via: 'declared',
              },
              {
                document: 'themes/light.tokens.json',
                kind: 'modifier',
                layer: 'theme.light',
                path: 'surface.upcoming-marker',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'inherited',
              declaredAt: { document: 'themes/light.tokens.json', path: 'surface' },
            },
            inputs: { aliases: ['surface.inset'], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'surface.upcoming-marker' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'surface.upcoming-marker',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'surface.upcoming-marker',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'inherited',
              declaredAt: { document: 'themes/dark.tokens.json', path: 'surface' },
            },
            inputs: { aliases: ['surface.base'], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'surface.canvas',
      cssProperty: '--cinder-surface-canvas',
      category: 'color',
      component: null,
      description:
        'Page canvas background, distinct from `surface.base` (a card body). Sits on the surface ramp that runs inset -> bg -> surface -> raised. Light mode anchors that ramp at white (0.960 -> 0.984 -> 0.994 -> 1.000); dark mode runs the same ordering at low lightness.',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'neutral', role: 'surface-canvas', anchor: false },
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'mixed',
        reason:
          'Some contexts emit a trusted CSS recipe and others a typed value; the DTCG value is exported, the recipe is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/light.tokens.json', path: 'surface.canvas' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'surface.canvas',
                via: 'declared',
              },
              {
                document: 'themes/light.tokens.json',
                kind: 'modifier',
                layer: 'theme.light',
                path: 'surface.canvas',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: { document: 'themes/light.tokens.json', path: 'surface.canvas' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'surface.canvas' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'surface.canvas',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'surface.canvas',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: { document: 'themes/dark.tokens.json', path: 'surface.canvas' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'polarity.ink',
      cssProperty: '--cinder-polarity-ink',
      category: 'color',
      component: null,
      description:
        "The neutral ink that contrasts with the current theme's surfaces: black in light mode, white in dark mode. It is a complete color value, not a bare component triplet, so it can be assigned directly to any color-valued property and mixed with `color-mix()` to build a wash at any alpha. The scrollbar washes (track, thumb, thumb-hover) derive from this one token, so overriding it at :root or in a [data-theme] block re-polarizes them together; a subtree override does not reach them, because the washes are declared at :root and descendants inherit the already-resolved values. The shadow tokens are NOT derived from it and do not follow an override: shadow.small/medium/large carry independently tuned per-arm alphas (0.10 light against 0.09 dark, and so on) that one ink cannot express without changing what they paint.",
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'unknown', role: 'unknown', anchor: 'unknown' },
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'mixed',
        reason:
          'Some contexts emit a trusted CSS recipe and others a typed value; the DTCG value is exported, the recipe is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/light.tokens.json', path: 'polarity.ink' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'polarity.ink',
                via: 'declared',
              },
              {
                document: 'themes/light.tokens.json',
                kind: 'modifier',
                layer: 'theme.light',
                path: 'polarity.ink',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'inherited',
              declaredAt: { document: 'themes/light.tokens.json', path: 'polarity' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'polarity.ink' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'polarity.ink',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'polarity.ink',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'inherited',
              declaredAt: { document: 'themes/dark.tokens.json', path: 'polarity' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'border.ink',
      cssProperty: '--cinder-border-ink',
      category: 'color',
      component: null,
      description:
        "The single polarity-aware ink every neutral structural border tier is mixed from: a dark cool ink in light mode, a light cool ink in dark mode. `border.muted`, `border.control`, and `border.strong` are alpha steps over it, so each tier tracks the surface underneath it instead of being tuned per surface -- which is what holds each tier's contrast spread across the four legal surface tiers under 15% in both arms, against 29% for the opaque dark values it replaces. Overriding this one token at :root or in a [data-theme] block re-tints all three together; a subtree override does not reach them, because the tiers are declared at :root and descendants inherit the already-resolved values. The four HUED status borders (info, success, warning, danger) are deliberately NOT derived from it and stay opaque, because a translucent status border would take its hue from whatever it happened to sit on. Two neutral aliases do follow it and become translucent with it: status.neutral.border aliases border.control, and border.inverse's dark arm aliases border.strong.",
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'neutral', role: 'border-ink', anchor: false },
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'mixed',
        reason:
          'Some contexts emit a trusted CSS recipe and others a typed value; the DTCG value is exported, the recipe is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/light.tokens.json', path: 'border.ink' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'border.ink',
                via: 'declared',
              },
              {
                document: 'themes/light.tokens.json',
                kind: 'modifier',
                layer: 'theme.light',
                path: 'border.ink',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'inherited',
              declaredAt: { document: 'themes/light.tokens.json', path: 'border' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'border.ink' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'border.ink',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'border.ink',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'inherited',
              declaredAt: { document: 'themes/dark.tokens.json', path: 'border' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'border.control',
      cssProperty: '--cinder-border',
      category: 'color',
      component: null,
      description:
        "Functional control boundary that clears WCAG 1.4.11's 3:1 floor against every supported surface. It is the border of the secondary Button, whose fill is `surface.raised` -- white in light mode, a raised dark surface in dark mode -- so in both themes it is the only thing making that control read as a control. Composed as a 48% alpha step over `border.ink` rather than authored per arm, so it can no longer drift out of step with the other two tiers.",
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'unknown', role: 'unknown', anchor: 'unknown' },
      disposition: {
        edit: 'recipe',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'trusted-recipe',
        reason: 'The DTCG value is exported; the trusted CSS recipe that governs emission is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/light.tokens.json', path: 'border.control' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'border.control',
                via: 'declared',
              },
              {
                document: 'themes/light.tokens.json',
                kind: 'modifier',
                layer: 'theme.light',
                path: 'border.control',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'inherited',
              declaredAt: { document: 'themes/light.tokens.json', path: 'border' },
            },
            inputs: {
              aliases: [],
              refs: [],
              extends: [],
              recipes: [{ cssProperty: '--cinder-border-ink', path: 'border.ink' }],
            },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'border.control' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'border.control',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'border.control',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'inherited',
              declaredAt: { document: 'themes/dark.tokens.json', path: 'border' },
            },
            inputs: {
              aliases: [],
              refs: [],
              extends: [],
              recipes: [{ cssProperty: '--cinder-border-ink', path: 'border.ink' }],
            },
          },
        },
      ],
    },
    {
      path: 'border.faint',
      cssProperty: '--cinder-border-faint',
      category: 'color',
      component: null,
      description:
        'Decorative-only hairline. Never use as a control boundary: it is intentionally below the WCAG 1.4.11 3:1 non-text threshold.',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'neutral', role: 'border-faint', anchor: false },
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'mixed',
        reason:
          'Some contexts emit a trusted CSS recipe and others a typed value; the DTCG value is exported, the recipe is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/light.tokens.json', path: 'border.faint' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'border.faint',
                via: 'declared',
              },
              {
                document: 'themes/light.tokens.json',
                kind: 'modifier',
                layer: 'theme.light',
                path: 'border.faint',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'inherited',
              declaredAt: { document: 'themes/light.tokens.json', path: 'border' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'border.faint' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'border.faint',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'border.faint',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'inherited',
              declaredAt: { document: 'themes/dark.tokens.json', path: 'border' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'border.muted',
      cssProperty: '--cinder-border-muted',
      category: 'color',
      component: null,
      description:
        'Decorative divider that wants less weight than `border.control`. Clears a separate 1.4:1 floor against its backdrop. Composed as a 19% alpha step over `border.ink`.',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'unknown', role: 'unknown', anchor: 'unknown' },
      disposition: {
        edit: 'recipe',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'trusted-recipe',
        reason: 'The DTCG value is exported; the trusted CSS recipe that governs emission is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/light.tokens.json', path: 'border.muted' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'border.muted',
                via: 'declared',
              },
              {
                document: 'themes/light.tokens.json',
                kind: 'modifier',
                layer: 'theme.light',
                path: 'border.muted',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'inherited',
              declaredAt: { document: 'themes/light.tokens.json', path: 'border' },
            },
            inputs: {
              aliases: [],
              refs: [],
              extends: [],
              recipes: [{ cssProperty: '--cinder-border-ink', path: 'border.ink' }],
            },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'border.muted' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'border.muted',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'border.muted',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'inherited',
              declaredAt: { document: 'themes/dark.tokens.json', path: 'border' },
            },
            inputs: {
              aliases: [],
              refs: [],
              extends: [],
              recipes: [{ cssProperty: '--cinder-border-ink', path: 'border.ink' }],
            },
          },
        },
      ],
    },
    {
      path: 'border.strong',
      cssProperty: '--cinder-border-strong',
      category: 'color',
      component: null,
      description:
        "Stronger control boundary. Clears WCAG 1.4.11's 3:1 floor against every supported surface, like `border.control`, with more weight. Composed as a 58% alpha step over `border.ink`.",
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'unknown', role: 'unknown', anchor: 'unknown' },
      disposition: {
        edit: 'recipe',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'trusted-recipe',
        reason: 'The DTCG value is exported; the trusted CSS recipe that governs emission is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/light.tokens.json', path: 'border.strong' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'border.strong',
                via: 'declared',
              },
              {
                document: 'themes/light.tokens.json',
                kind: 'modifier',
                layer: 'theme.light',
                path: 'border.strong',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'inherited',
              declaredAt: { document: 'themes/light.tokens.json', path: 'border' },
            },
            inputs: {
              aliases: [],
              refs: [],
              extends: [],
              recipes: [{ cssProperty: '--cinder-border-ink', path: 'border.ink' }],
            },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'border.strong' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'border.strong',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'border.strong',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'inherited',
              declaredAt: { document: 'themes/dark.tokens.json', path: 'border' },
            },
            inputs: {
              aliases: [],
              refs: [],
              extends: [],
              recipes: [{ cssProperty: '--cinder-border-ink', path: 'border.ink' }],
            },
          },
        },
      ],
    },
    {
      path: 'border.inverse',
      cssProperty: '--cinder-border-inverse',
      category: 'color',
      component: null,
      description:
        'Border for surfaces using `surface.inverse` (Tooltip). Transparent in light mode; adds a 1px delineation in dark mode only.',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'unknown', role: 'unknown', anchor: 'unknown' },
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'mixed',
        reason:
          'Some contexts emit a trusted CSS recipe and others a typed value; the DTCG value is exported, the recipe is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/light.tokens.json', path: 'border.inverse' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'border.inverse',
                via: 'declared',
              },
              {
                document: 'themes/light.tokens.json',
                kind: 'modifier',
                layer: 'theme.light',
                path: 'border.inverse',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'inherited',
              declaredAt: { document: 'themes/light.tokens.json', path: 'border' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'border.inverse' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'border.inverse',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'border.inverse',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'inherited',
              declaredAt: { document: 'themes/dark.tokens.json', path: 'border' },
            },
            inputs: { aliases: ['border.strong'], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'text.muted',
      cssProperty: '--cinder-text-muted',
      category: 'color',
      component: null,
      description: 'Muted (secondary) text color.',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'neutral', role: 'text-muted', anchor: false },
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'mixed',
        reason:
          'Some contexts emit a trusted CSS recipe and others a typed value; the DTCG value is exported, the recipe is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/light.tokens.json', path: 'text.muted' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'text.muted',
                via: 'declared',
              },
              {
                document: 'themes/light.tokens.json',
                kind: 'modifier',
                layer: 'theme.light',
                path: 'text.muted',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'inherited',
              declaredAt: { document: 'themes/light.tokens.json', path: 'text' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'text.muted' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'text.muted',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'text.muted',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'inherited',
              declaredAt: { document: 'themes/dark.tokens.json', path: 'text' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'text.subtle',
      cssProperty: '--cinder-text-subtle',
      category: 'color',
      component: null,
      description: 'Subtle (tertiary) text color.',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'neutral', role: 'text-subtle', anchor: false },
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'mixed',
        reason:
          'Some contexts emit a trusted CSS recipe and others a typed value; the DTCG value is exported, the recipe is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/light.tokens.json', path: 'text.subtle' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'text.subtle',
                via: 'declared',
              },
              {
                document: 'themes/light.tokens.json',
                kind: 'modifier',
                layer: 'theme.light',
                path: 'text.subtle',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'inherited',
              declaredAt: { document: 'themes/light.tokens.json', path: 'text' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'text.subtle' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'text.subtle',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'text.subtle',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'inherited',
              declaredAt: { document: 'themes/dark.tokens.json', path: 'text' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'text.disabled',
      cssProperty: '--cinder-text-disabled',
      category: 'color',
      component: null,
      description:
        'Disabled text color. Clears the 3:1 UI floor in both themes even though disabled controls are exempt from WCAG text contrast; a disabled control still has to be visible as a control.',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'neutral', role: 'text-disabled', anchor: false },
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'mixed',
        reason:
          'Some contexts emit a trusted CSS recipe and others a typed value; the DTCG value is exported, the recipe is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/light.tokens.json', path: 'text.disabled' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'text.disabled',
                via: 'declared',
              },
              {
                document: 'themes/light.tokens.json',
                kind: 'modifier',
                layer: 'theme.light',
                path: 'text.disabled',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'inherited',
              declaredAt: { document: 'themes/light.tokens.json', path: 'text' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'text.disabled' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'text.disabled',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'text.disabled',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'inherited',
              declaredAt: { document: 'themes/dark.tokens.json', path: 'text' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'text.inverse',
      cssProperty: '--cinder-text-inverse',
      category: 'color',
      component: null,
      description: 'Text color for use on `surface.inverse` (Tooltip).',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'unknown', role: 'unknown', anchor: 'unknown' },
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'mixed',
        reason:
          'Some contexts emit a trusted CSS recipe and others a typed value; the DTCG value is exported, the recipe is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/light.tokens.json', path: 'text.inverse' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'text.inverse',
                via: 'declared',
              },
              {
                document: 'themes/light.tokens.json',
                kind: 'modifier',
                layer: 'theme.light',
                path: 'text.inverse',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'inherited',
              declaredAt: { document: 'themes/light.tokens.json', path: 'text' },
            },
            inputs: { aliases: ['surface.base'], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'text.inverse' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'text.inverse',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'text.inverse',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'inherited',
              declaredAt: { document: 'themes/dark.tokens.json', path: 'text' },
            },
            inputs: { aliases: ['text.default'], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'text.default',
      cssProperty: '--cinder-text-default',
      category: 'color',
      component: null,
      description: 'Default body text color.',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'neutral', role: 'text-default', anchor: true },
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'mixed',
        reason:
          'Some contexts emit a trusted CSS recipe and others a typed value; the DTCG value is exported, the recipe is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/light.tokens.json', path: 'text.default' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'text.default',
                via: 'declared',
              },
              {
                document: 'themes/light.tokens.json',
                kind: 'modifier',
                layer: 'theme.light',
                path: 'text.default',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: { document: 'themes/light.tokens.json', path: 'text.default' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'text.default' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'text.default',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'text.default',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: { document: 'themes/dark.tokens.json', path: 'text.default' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'fill.disabled',
      cssProperty: '--cinder-fill-disabled',
      category: 'color',
      component: null,
      description:
        'Neutral fill for disabled solid controls (disabled-checked checkbox/radio) so they stop misusing `text.disabled` (a text-lightness token) as an assertive fill. The glyph on top must use `text.disabled`, not `accent.contrast`: accent-contrast is dark ink in both arms and would be near-invisible on the dark-arm fill.',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'neutral', role: 'fill-disabled', anchor: false },
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'mixed',
        reason:
          'Some contexts emit a trusted CSS recipe and others a typed value; the DTCG value is exported, the recipe is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/light.tokens.json', path: 'fill.disabled' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'fill.disabled',
                via: 'declared',
              },
              {
                document: 'themes/light.tokens.json',
                kind: 'modifier',
                layer: 'theme.light',
                path: 'fill.disabled',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'inherited',
              declaredAt: { document: 'themes/light.tokens.json', path: 'fill' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'fill.disabled' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'fill.disabled',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'fill.disabled',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'inherited',
              declaredAt: { document: 'themes/dark.tokens.json', path: 'fill' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'accent.contrast',
      cssProperty: '--cinder-accent-contrast',
      category: 'color',
      component: null,
      description:
        'Label color for solid accent fills. Light arm flips to white (the indigo fill is dark enough); dark arm keeps dark ink against the bright dark-mode fill.',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'unknown', role: 'unknown', anchor: 'unknown' },
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'mixed',
        reason:
          'Some contexts emit a trusted CSS recipe and others a typed value; the DTCG value is exported, the recipe is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/light.tokens.json', path: 'accent.contrast' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'accent.contrast',
                via: 'declared',
              },
              {
                document: 'themes/light.tokens.json',
                kind: 'modifier',
                layer: 'theme.light',
                path: 'accent.contrast',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'inherited',
              declaredAt: { document: 'themes/light.tokens.json', path: 'accent' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'accent.contrast' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'accent.contrast',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'accent.contrast',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'inherited',
              declaredAt: { document: 'themes/dark.tokens.json', path: 'accent' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'accent.text',
      cssProperty: '--cinder-accent-text',
      category: 'color',
      component: null,
      description:
        'Accent used as text/icon on light surfaces. The light-mode fill accent (L=0.50) reads as a foreground at only ~4.7:1, just clearing AA, so this dedicated, slightly darker foreground token stays necessary for comfortable link/icon legibility. The dark arm matches the dark-mode accent fill.',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'accent', role: 'text', anchor: false },
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'mixed',
        reason:
          'Some contexts emit a trusted CSS recipe and others a typed value; the DTCG value is exported, the recipe is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/light.tokens.json', path: 'accent.text' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'accent.text',
                via: 'declared',
              },
              {
                document: 'themes/light.tokens.json',
                kind: 'modifier',
                layer: 'theme.light',
                path: 'accent.text',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'inherited',
              declaredAt: { document: 'themes/light.tokens.json', path: 'accent' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'accent.text' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'accent.text',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'accent.text',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'inherited',
              declaredAt: { document: 'themes/dark.tokens.json', path: 'accent' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'accent.text.hover',
      cssProperty: '--cinder-accent-text-hover',
      category: 'color',
      component: null,
      description:
        'Hover step for text/icon links, derived as a darker step of `accent.text` (not the bright fill-derived `accent.solid.hover`, which is lighter than the resting text color and drops below WCAG AA on near-white).',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'unknown', role: 'unknown', anchor: 'unknown' },
      disposition: {
        edit: 'recipe',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'trusted-recipe',
        reason: 'The DTCG value is exported; the trusted CSS recipe that governs emission is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/light.tokens.json', path: 'accent.text.hover' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'accent.text.hover',
                via: 'declared',
              },
              {
                document: 'themes/light.tokens.json',
                kind: 'modifier',
                layer: 'theme.light',
                path: 'accent.text.hover',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'inherited',
              declaredAt: { document: 'themes/light.tokens.json', path: 'accent' },
            },
            inputs: {
              aliases: [],
              refs: [],
              extends: [],
              recipes: [{ cssProperty: '--cinder-accent-text', path: 'accent.text' }],
            },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'accent.text.hover' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'accent.text.hover',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'accent.text.hover',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'inherited',
              declaredAt: { document: 'themes/dark.tokens.json', path: 'accent' },
            },
            inputs: {
              aliases: [],
              refs: [],
              extends: [],
              recipes: [{ cssProperty: '--cinder-accent-text', path: 'accent.text' }],
            },
          },
        },
      ],
    },
    {
      path: 'accent.solid',
      cssProperty: '--cinder-accent-solid',
      category: 'color',
      component: null,
      description: 'Brand accent fill color.',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'accent', role: 'solid', anchor: true },
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'mixed',
        reason:
          'Some contexts emit a trusted CSS recipe and others a typed value; the DTCG value is exported, the recipe is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/light.tokens.json', path: 'accent.solid' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'accent.solid',
                via: 'declared',
              },
              {
                document: 'themes/light.tokens.json',
                kind: 'modifier',
                layer: 'theme.light',
                path: 'accent.solid',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'inherited',
              declaredAt: { document: 'themes/light.tokens.json', path: 'accent.solid' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'accent.solid' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'accent.solid',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'accent.solid',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'inherited',
              declaredAt: { document: 'themes/dark.tokens.json', path: 'accent.solid' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'accent.solid.active',
      cssProperty: '--cinder-accent-solid-active',
      category: 'color',
      component: null,
      description:
        'Active/pressed step for solid accent fills, derived as a darker step of `accent.solid` (l - 0.15, c and h held constant).',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'unknown', role: 'unknown', anchor: 'unknown' },
      disposition: {
        edit: 'recipe',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'trusted-recipe',
        reason: 'The DTCG value is exported; the trusted CSS recipe that governs emission is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/light.tokens.json', path: 'accent.solid.active' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'accent.solid.active',
                via: 'declared',
              },
              {
                document: 'themes/light.tokens.json',
                kind: 'modifier',
                layer: 'theme.light',
                path: 'accent.solid.active',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'inherited',
              declaredAt: { document: 'themes/light.tokens.json', path: 'accent.solid.active' },
            },
            inputs: {
              aliases: [],
              refs: [],
              extends: [],
              recipes: [{ cssProperty: '--cinder-accent-solid', path: 'accent.solid' }],
            },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'accent.solid.active' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'accent.solid.active',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'accent.solid.active',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'inherited',
              declaredAt: { document: 'themes/dark.tokens.json', path: 'accent.solid.active' },
            },
            inputs: {
              aliases: [],
              refs: [],
              extends: [],
              recipes: [{ cssProperty: '--cinder-accent-solid', path: 'accent.solid' }],
            },
          },
        },
      ],
    },
    {
      path: 'accent.solid.active.on-fill',
      cssProperty: '--cinder-accent-solid-active-on-fill',
      category: 'color',
      component: null,
      description:
        'Pressed fill for solid accent surfaces that carry the `accent.contrast` label (primary Button, FloatingAction). Kept distinct from `accent.solid.active` so label-bearing and non-label consumers can diverge if ever needed.',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'unknown', role: 'unknown', anchor: 'unknown' },
      disposition: {
        edit: 'recipe',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'trusted-recipe',
        reason: 'The DTCG value is exported; the trusted CSS recipe that governs emission is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/light.tokens.json', path: 'accent.solid.active.on-fill' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'accent.solid.active.on-fill',
                via: 'declared',
              },
              {
                document: 'themes/light.tokens.json',
                kind: 'modifier',
                layer: 'theme.light',
                path: 'accent.solid.active.on-fill',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: {
                document: 'themes/light.tokens.json',
                path: 'accent.solid.active.on-fill',
              },
            },
            inputs: {
              aliases: [],
              refs: [],
              extends: [],
              recipes: [{ cssProperty: '--cinder-accent-solid', path: 'accent.solid' }],
            },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'accent.solid.active.on-fill' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'accent.solid.active.on-fill',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'accent.solid.active.on-fill',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: {
                document: 'themes/dark.tokens.json',
                path: 'accent.solid.active.on-fill',
              },
            },
            inputs: {
              aliases: [],
              refs: [],
              extends: [],
              recipes: [{ cssProperty: '--cinder-accent-solid', path: 'accent.solid' }],
            },
          },
        },
      ],
    },
    {
      path: 'accent.solid.hover',
      cssProperty: '--cinder-accent-solid-hover',
      category: 'color',
      component: null,
      description:
        'Hover step for solid accent fills, derived as a darker step of `accent.solid` (l - 0.08, c and h held constant).',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'unknown', role: 'unknown', anchor: 'unknown' },
      disposition: {
        edit: 'recipe',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'trusted-recipe',
        reason: 'The DTCG value is exported; the trusted CSS recipe that governs emission is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/light.tokens.json', path: 'accent.solid.hover' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'accent.solid.hover',
                via: 'declared',
              },
              {
                document: 'themes/light.tokens.json',
                kind: 'modifier',
                layer: 'theme.light',
                path: 'accent.solid.hover',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: { document: 'themes/light.tokens.json', path: 'accent.solid.hover' },
            },
            inputs: {
              aliases: [],
              refs: [],
              extends: [],
              recipes: [{ cssProperty: '--cinder-accent-solid', path: 'accent.solid' }],
            },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'accent.solid.hover' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'accent.solid.hover',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'accent.solid.hover',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: { document: 'themes/dark.tokens.json', path: 'accent.solid.hover' },
            },
            inputs: {
              aliases: [],
              refs: [],
              extends: [],
              recipes: [{ cssProperty: '--cinder-accent-solid', path: 'accent.solid' }],
            },
          },
        },
      ],
    },
    {
      path: 'accent.background',
      cssProperty: '--cinder-accent-background',
      category: 'color',
      component: null,
      description: 'Soft accent-tinted background, mixed 88% toward the current surface.',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'unknown', role: 'unknown', anchor: 'unknown' },
      disposition: {
        edit: 'recipe',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'trusted-recipe',
        reason: 'The DTCG value is exported; the trusted CSS recipe that governs emission is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/light.tokens.json', path: 'accent.background' },
            layers: [
              {
                document: 'sets/colors.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'accent.background',
                via: 'declared',
              },
              {
                document: 'themes/light.tokens.json',
                kind: 'modifier',
                layer: 'theme.light',
                path: 'accent.background',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: { document: 'themes/light.tokens.json', path: 'accent.background' },
            },
            inputs: {
              aliases: [],
              refs: [],
              extends: [],
              recipes: [
                { cssProperty: '--cinder-accent-solid', path: 'accent.solid' },
                { cssProperty: '--cinder-surface', path: 'surface.base' },
              ],
            },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'accent.background' },
            layers: [
              {
                document: 'sets/colors.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'accent.background',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'accent.background',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: { document: 'themes/dark.tokens.json', path: 'accent.background' },
            },
            inputs: {
              aliases: [],
              refs: [],
              extends: [],
              recipes: [
                { cssProperty: '--cinder-accent-solid', path: 'accent.solid' },
                { cssProperty: '--cinder-surface', path: 'surface.base' },
              ],
            },
          },
        },
      ],
    },
    {
      path: 'accent.border',
      cssProperty: '--cinder-accent-border',
      category: 'color',
      component: null,
      description: 'Soft accent-tinted border, the accent color mixed 60% toward transparent.',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'unknown', role: 'unknown', anchor: 'unknown' },
      disposition: {
        edit: 'recipe',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'trusted-recipe',
        reason: 'The DTCG value is exported; the trusted CSS recipe that governs emission is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/light.tokens.json', path: 'accent.border' },
            layers: [
              {
                document: 'sets/colors.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'accent.border',
                via: 'declared',
              },
              {
                document: 'themes/light.tokens.json',
                kind: 'modifier',
                layer: 'theme.light',
                path: 'accent.border',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: { document: 'themes/light.tokens.json', path: 'accent.border' },
            },
            inputs: {
              aliases: [],
              refs: [],
              extends: [],
              recipes: [{ cssProperty: '--cinder-accent-solid', path: 'accent.solid' }],
            },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'accent.border' },
            layers: [
              {
                document: 'sets/colors.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'accent.border',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'accent.border',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: { document: 'themes/dark.tokens.json', path: 'accent.border' },
            },
            inputs: {
              aliases: [],
              refs: [],
              extends: [],
              recipes: [{ cssProperty: '--cinder-accent-solid', path: 'accent.solid' }],
            },
          },
        },
      ],
    },
    {
      path: 'ring.width',
      cssProperty: '--cinder-ring-width',
      category: 'size',
      component: null,
      description:
        'Focus ring stroke width. A floor, not a preference: WCAG 2.4.13 wants an indicator at least as large as a 2px-thick perimeter of the control.',
      themeAware: false,
      deprecated: false,
      profile: 'border-width',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/semantic.tokens.json', path: 'ring.width' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'ring.width',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'local',
              declaredAt: { document: 'sets/semantic.tokens.json', path: 'ring.width' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'ring.offset',
      cssProperty: '--cinder-ring-offset',
      category: 'size',
      component: null,
      description:
        'Focus ring offset from the control edge. Zero: the ring sits directly on the control edge with no offset band, so focus reads as one tight 2px line rather than a 4px double band (COR-1498). Filled controls add a private 2px gap instead; see `ring.offset-color`. Emitted as `0px`, not a bare `0`, because the ring recipes add it to `--cinder-ring-width` inside `calc()`, where a unitless zero is a number and invalidates the sum.',
      themeAware: false,
      deprecated: false,
      profile: 'offset',
      disposition: {
        edit: 'recipe',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'trusted-recipe',
        reason: 'The DTCG value is exported; the trusted CSS recipe that governs emission is not.',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/semantic.tokens.json', path: 'ring.offset' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'ring.offset',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'local',
              declaredAt: { document: 'sets/semantic.tokens.json', path: 'ring.offset' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'ring.offset-color',
      cssProperty: '--cinder-ring-offset-color',
      category: 'color',
      component: null,
      description:
        'Color of the gap band between a focus ring and the control. Filled controls (a solid accent, danger or status fill on the focused element) paint a 2px gap in this color before the ring, so the accent-hued ring sits on the page instead of on a same-hue fill. Unfilled controls use `ring.offset`, which is zero, so they paint no gap. box-shadow cannot paint a transparent gap, so the band needs a real color; it is pinned to `surface.raised`, where controls overwhelmingly live.',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'unknown', role: 'unknown', anchor: 'unknown' },
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/light.tokens.json', path: 'ring.offset-color' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'ring.offset-color',
                via: 'declared',
              },
              {
                document: 'themes/light.tokens.json',
                kind: 'modifier',
                layer: 'theme.light',
                path: 'ring.offset-color',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: { document: 'themes/light.tokens.json', path: 'ring.offset-color' },
            },
            inputs: { aliases: ['surface.raised'], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'ring.offset-color' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'ring.offset-color',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'ring.offset-color',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: { document: 'themes/dark.tokens.json', path: 'ring.offset-color' },
            },
            inputs: { aliases: ['surface.raised'], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'ring.color',
      cssProperty: '--cinder-ring-color',
      category: 'color',
      component: null,
      description:
        "Focus ring color, relative to `accent.solid` so a consumer override re-derives the ring hue. Light arm clamps L to 0.55 for 3.56:1 against the widened ramp's darkest surface; `h` tracks the accent hue.",
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'unknown', role: 'unknown', anchor: 'unknown' },
      disposition: {
        edit: 'recipe',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'trusted-recipe',
        reason: 'The DTCG value is exported; the trusted CSS recipe that governs emission is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/light.tokens.json', path: 'ring.color' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'ring.color',
                via: 'declared',
              },
              {
                document: 'themes/light.tokens.json',
                kind: 'modifier',
                layer: 'theme.light',
                path: 'ring.color',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: { document: 'themes/light.tokens.json', path: 'ring.color' },
            },
            inputs: {
              aliases: [],
              refs: [],
              extends: [],
              recipes: [{ cssProperty: '--cinder-accent-solid', path: 'accent.solid' }],
            },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'ring.color' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'ring.color',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'ring.color',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: { document: 'themes/dark.tokens.json', path: 'ring.color' },
            },
            inputs: {
              aliases: [],
              refs: [],
              extends: [],
              recipes: [{ cssProperty: '--cinder-accent-solid', path: 'accent.solid' }],
            },
          },
        },
      ],
    },
    {
      path: 'ring.on-accent',
      cssProperty: '--cinder-ring-on-accent',
      category: 'color',
      component: null,
      description:
        'Ring color used by the FloatingAction primary variant, whose ring sits directly on its accent fill. Light arm is a near-black and dark arm a near-white, both strongly contrasting the page background. Against the fill itself it measures about 3:1 in light mode and about 2.5:1 in dark mode, so other filled controls use a `ring.offset-color` gap and the standard ring instead (focus-ring-policy.md).',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'unknown', role: 'unknown', anchor: 'unknown' },
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'mixed',
        reason:
          'Some contexts emit a trusted CSS recipe and others a typed value; the DTCG value is exported, the recipe is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/light.tokens.json', path: 'ring.on-accent' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'ring.on-accent',
                via: 'declared',
              },
              {
                document: 'themes/light.tokens.json',
                kind: 'modifier',
                layer: 'theme.light',
                path: 'ring.on-accent',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: { document: 'themes/light.tokens.json', path: 'ring.on-accent' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'ring.on-accent' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'ring.on-accent',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'ring.on-accent',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: { document: 'themes/dark.tokens.json', path: 'ring.on-accent' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'scrollbar.size',
      cssProperty: '--cinder-scrollbar-size',
      category: 'size',
      component: null,
      description: 'Scrollbar thickness.',
      themeAware: false,
      deprecated: false,
      profile: 'size',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/semantic.tokens.json', path: 'scrollbar.size' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'scrollbar.size',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'local',
              declaredAt: { document: 'sets/semantic.tokens.json', path: 'scrollbar.size' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'scrollbar.track',
      cssProperty: '--cinder-scrollbar-track',
      category: 'color',
      component: null,
      description: 'Scrollbar track color.',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'unknown', role: 'unknown', anchor: 'unknown' },
      disposition: {
        edit: 'recipe',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'trusted-recipe',
        reason: 'The DTCG value is exported; the trusted CSS recipe that governs emission is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/light.tokens.json', path: 'scrollbar.track' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'scrollbar.track',
                via: 'declared',
              },
              {
                document: 'themes/light.tokens.json',
                kind: 'modifier',
                layer: 'theme.light',
                path: 'scrollbar.track',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: { document: 'themes/light.tokens.json', path: 'scrollbar.track' },
            },
            inputs: {
              aliases: [],
              refs: [],
              extends: [],
              recipes: [{ cssProperty: '--cinder-polarity-ink', path: 'polarity.ink' }],
            },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'scrollbar.track' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'scrollbar.track',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'scrollbar.track',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: { document: 'themes/dark.tokens.json', path: 'scrollbar.track' },
            },
            inputs: {
              aliases: [],
              refs: [],
              extends: [],
              recipes: [{ cssProperty: '--cinder-polarity-ink', path: 'polarity.ink' }],
            },
          },
        },
      ],
    },
    {
      path: 'scrollbar.thumb',
      cssProperty: '--cinder-scrollbar-thumb',
      category: 'color',
      component: null,
      description: 'Scrollbar thumb color.',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'unknown', role: 'unknown', anchor: 'unknown' },
      disposition: {
        edit: 'recipe',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'trusted-recipe',
        reason: 'The DTCG value is exported; the trusted CSS recipe that governs emission is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/light.tokens.json', path: 'scrollbar.thumb' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'scrollbar.thumb',
                via: 'declared',
              },
              {
                document: 'themes/light.tokens.json',
                kind: 'modifier',
                layer: 'theme.light',
                path: 'scrollbar.thumb',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: { document: 'themes/light.tokens.json', path: 'scrollbar.thumb' },
            },
            inputs: {
              aliases: [],
              refs: [],
              extends: [],
              recipes: [{ cssProperty: '--cinder-polarity-ink', path: 'polarity.ink' }],
            },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'scrollbar.thumb' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'scrollbar.thumb',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'scrollbar.thumb',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: { document: 'themes/dark.tokens.json', path: 'scrollbar.thumb' },
            },
            inputs: {
              aliases: [],
              refs: [],
              extends: [],
              recipes: [{ cssProperty: '--cinder-polarity-ink', path: 'polarity.ink' }],
            },
          },
        },
      ],
    },
    {
      path: 'scrollbar.thumb-hover',
      cssProperty: '--cinder-scrollbar-thumb-hover',
      category: 'color',
      component: null,
      description: 'Scrollbar thumb hover color.',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'unknown', role: 'unknown', anchor: 'unknown' },
      disposition: {
        edit: 'recipe',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'trusted-recipe',
        reason: 'The DTCG value is exported; the trusted CSS recipe that governs emission is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/light.tokens.json', path: 'scrollbar.thumb-hover' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'scrollbar.thumb-hover',
                via: 'declared',
              },
              {
                document: 'themes/light.tokens.json',
                kind: 'modifier',
                layer: 'theme.light',
                path: 'scrollbar.thumb-hover',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: { document: 'themes/light.tokens.json', path: 'scrollbar.thumb-hover' },
            },
            inputs: {
              aliases: [],
              refs: [],
              extends: [],
              recipes: [{ cssProperty: '--cinder-polarity-ink', path: 'polarity.ink' }],
            },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'scrollbar.thumb-hover' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'scrollbar.thumb-hover',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'scrollbar.thumb-hover',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: { document: 'themes/dark.tokens.json', path: 'scrollbar.thumb-hover' },
            },
            inputs: {
              aliases: [],
              refs: [],
              extends: [],
              recipes: [{ cssProperty: '--cinder-polarity-ink', path: 'polarity.ink' }],
            },
          },
        },
      ],
    },
    {
      path: 'overlay.backdrop',
      cssProperty: '--cinder-overlay-backdrop',
      category: 'color',
      component: null,
      description: 'Overlay backdrop scrim color.',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'unknown', role: 'unknown', anchor: 'unknown' },
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'mixed',
        reason:
          'Some contexts emit a trusted CSS recipe and others a typed value; the DTCG value is exported, the recipe is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/light.tokens.json', path: 'overlay.backdrop' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'overlay.backdrop',
                via: 'declared',
              },
              {
                document: 'themes/light.tokens.json',
                kind: 'modifier',
                layer: 'theme.light',
                path: 'overlay.backdrop',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: { document: 'themes/light.tokens.json', path: 'overlay.backdrop' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'overlay.backdrop' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'overlay.backdrop',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'overlay.backdrop',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: { document: 'themes/dark.tokens.json', path: 'overlay.backdrop' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'overlay.blur',
      cssProperty: '--cinder-overlay-blur',
      category: 'size',
      component: null,
      description: 'Overlay backdrop blur radius.',
      themeAware: false,
      deprecated: false,
      profile: 'blur',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/semantic.tokens.json', path: 'overlay.blur' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'overlay.blur',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'local',
              declaredAt: { document: 'sets/semantic.tokens.json', path: 'overlay.blur' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'overlay.padding',
      cssProperty: '--cinder-overlay-padding',
      category: 'spacing',
      component: null,
      description: 'Overlay panel padding.',
      themeAware: false,
      deprecated: false,
      profile: 'padding',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/semantic.tokens.json', path: 'overlay.padding' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'overlay.padding',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'local',
              declaredAt: { document: 'sets/semantic.tokens.json', path: 'overlay.padding' },
            },
            inputs: { aliases: ['space.6'], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'overlay.radius',
      cssProperty: '--cinder-overlay-radius',
      category: 'radius',
      component: null,
      description: 'Overlay panel corner radius.',
      themeAware: false,
      deprecated: false,
      profile: 'radius',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/semantic.tokens.json', path: 'overlay.radius' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'overlay.radius',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'local',
              declaredAt: { document: 'sets/semantic.tokens.json', path: 'overlay.radius' },
            },
            inputs: { aliases: ['radius.large'], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'chart.series.1',
      cssProperty: '--cinder-chart-series-1',
      category: 'color',
      component: null,
      description: 'Chart series 1.',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'unknown', role: 'unknown', anchor: 'unknown' },
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'mixed',
        reason:
          'Some contexts emit a trusted CSS recipe and others a typed value; the DTCG value is exported, the recipe is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/light.tokens.json', path: 'chart.series.1' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'chart.series.1',
                via: 'declared',
              },
              {
                document: 'themes/light.tokens.json',
                kind: 'modifier',
                layer: 'theme.light',
                path: 'chart.series.1',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'inherited',
              declaredAt: { document: 'themes/light.tokens.json', path: 'chart.series' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'chart.series.1' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'chart.series.1',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'chart.series.1',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'inherited',
              declaredAt: { document: 'themes/dark.tokens.json', path: 'chart.series' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'chart.series.2',
      cssProperty: '--cinder-chart-series-2',
      category: 'color',
      component: null,
      description: 'Chart series 2.',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'unknown', role: 'unknown', anchor: 'unknown' },
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'mixed',
        reason:
          'Some contexts emit a trusted CSS recipe and others a typed value; the DTCG value is exported, the recipe is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/light.tokens.json', path: 'chart.series.2' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'chart.series.2',
                via: 'declared',
              },
              {
                document: 'themes/light.tokens.json',
                kind: 'modifier',
                layer: 'theme.light',
                path: 'chart.series.2',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'inherited',
              declaredAt: { document: 'themes/light.tokens.json', path: 'chart.series' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'chart.series.2' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'chart.series.2',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'chart.series.2',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'inherited',
              declaredAt: { document: 'themes/dark.tokens.json', path: 'chart.series' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'chart.series.3',
      cssProperty: '--cinder-chart-series-3',
      category: 'color',
      component: null,
      description: 'Chart series 3.',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'unknown', role: 'unknown', anchor: 'unknown' },
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'mixed',
        reason:
          'Some contexts emit a trusted CSS recipe and others a typed value; the DTCG value is exported, the recipe is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/light.tokens.json', path: 'chart.series.3' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'chart.series.3',
                via: 'declared',
              },
              {
                document: 'themes/light.tokens.json',
                kind: 'modifier',
                layer: 'theme.light',
                path: 'chart.series.3',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'inherited',
              declaredAt: { document: 'themes/light.tokens.json', path: 'chart.series' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'chart.series.3' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'chart.series.3',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'chart.series.3',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'inherited',
              declaredAt: { document: 'themes/dark.tokens.json', path: 'chart.series' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'chart.series.4',
      cssProperty: '--cinder-chart-series-4',
      category: 'color',
      component: null,
      description: 'Chart series 4.',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'unknown', role: 'unknown', anchor: 'unknown' },
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'mixed',
        reason:
          'Some contexts emit a trusted CSS recipe and others a typed value; the DTCG value is exported, the recipe is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/light.tokens.json', path: 'chart.series.4' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'chart.series.4',
                via: 'declared',
              },
              {
                document: 'themes/light.tokens.json',
                kind: 'modifier',
                layer: 'theme.light',
                path: 'chart.series.4',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'inherited',
              declaredAt: { document: 'themes/light.tokens.json', path: 'chart.series' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'chart.series.4' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'chart.series.4',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'chart.series.4',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'inherited',
              declaredAt: { document: 'themes/dark.tokens.json', path: 'chart.series' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'chart.series.5',
      cssProperty: '--cinder-chart-series-5',
      category: 'color',
      component: null,
      description: 'Chart series 5.',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'unknown', role: 'unknown', anchor: 'unknown' },
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'mixed',
        reason:
          'Some contexts emit a trusted CSS recipe and others a typed value; the DTCG value is exported, the recipe is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/light.tokens.json', path: 'chart.series.5' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'chart.series.5',
                via: 'declared',
              },
              {
                document: 'themes/light.tokens.json',
                kind: 'modifier',
                layer: 'theme.light',
                path: 'chart.series.5',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'inherited',
              declaredAt: { document: 'themes/light.tokens.json', path: 'chart.series' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'chart.series.5' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'chart.series.5',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'chart.series.5',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'inherited',
              declaredAt: { document: 'themes/dark.tokens.json', path: 'chart.series' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'chart.series.6',
      cssProperty: '--cinder-chart-series-6',
      category: 'color',
      component: null,
      description: 'Chart series 6.',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'unknown', role: 'unknown', anchor: 'unknown' },
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'mixed',
        reason:
          'Some contexts emit a trusted CSS recipe and others a typed value; the DTCG value is exported, the recipe is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/light.tokens.json', path: 'chart.series.6' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'chart.series.6',
                via: 'declared',
              },
              {
                document: 'themes/light.tokens.json',
                kind: 'modifier',
                layer: 'theme.light',
                path: 'chart.series.6',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'inherited',
              declaredAt: { document: 'themes/light.tokens.json', path: 'chart.series' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'chart.series.6' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'chart.series.6',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'chart.series.6',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'inherited',
              declaredAt: { document: 'themes/dark.tokens.json', path: 'chart.series' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'chart.series.7',
      cssProperty: '--cinder-chart-series-7',
      category: 'color',
      component: null,
      description: 'Chart series 7.',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'unknown', role: 'unknown', anchor: 'unknown' },
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'mixed',
        reason:
          'Some contexts emit a trusted CSS recipe and others a typed value; the DTCG value is exported, the recipe is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/light.tokens.json', path: 'chart.series.7' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'chart.series.7',
                via: 'declared',
              },
              {
                document: 'themes/light.tokens.json',
                kind: 'modifier',
                layer: 'theme.light',
                path: 'chart.series.7',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'inherited',
              declaredAt: { document: 'themes/light.tokens.json', path: 'chart.series' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'chart.series.7' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'chart.series.7',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'chart.series.7',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'inherited',
              declaredAt: { document: 'themes/dark.tokens.json', path: 'chart.series' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'chart.series.8',
      cssProperty: '--cinder-chart-series-8',
      category: 'color',
      component: null,
      description: 'Chart series 8.',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'unknown', role: 'unknown', anchor: 'unknown' },
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'mixed',
        reason:
          'Some contexts emit a trusted CSS recipe and others a typed value; the DTCG value is exported, the recipe is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/light.tokens.json', path: 'chart.series.8' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'chart.series.8',
                via: 'declared',
              },
              {
                document: 'themes/light.tokens.json',
                kind: 'modifier',
                layer: 'theme.light',
                path: 'chart.series.8',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'inherited',
              declaredAt: { document: 'themes/light.tokens.json', path: 'chart.series' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'chart.series.8' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'chart.series.8',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'chart.series.8',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'inherited',
              declaredAt: { document: 'themes/dark.tokens.json', path: 'chart.series' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'gap.stack',
      cssProperty: '--cinder-gap-stack',
      category: 'spacing',
      component: null,
      description: 'Default vertical stack gap.',
      themeAware: false,
      deprecated: false,
      profile: 'gap',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/semantic.tokens.json', path: 'gap.stack' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'gap.stack',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'inherited',
              declaredAt: { document: 'sets/semantic.tokens.json', path: 'gap' },
            },
            inputs: { aliases: ['space.3'], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'gap.inline',
      cssProperty: '--cinder-gap-inline',
      category: 'spacing',
      component: null,
      description: 'Default inline gap.',
      themeAware: false,
      deprecated: false,
      profile: 'gap',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/semantic.tokens.json', path: 'gap.inline' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'gap.inline',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'inherited',
              declaredAt: { document: 'sets/semantic.tokens.json', path: 'gap' },
            },
            inputs: { aliases: ['space.2'], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'pad.control',
      cssProperty: '--cinder-pad-control',
      category: 'spacing',
      component: null,
      description: 'Default control padding.',
      themeAware: false,
      deprecated: false,
      profile: 'padding',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/semantic.tokens.json', path: 'pad.control' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'pad.control',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'inherited',
              declaredAt: { document: 'sets/semantic.tokens.json', path: 'pad' },
            },
            inputs: { aliases: ['space.2-5'], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'pad.card',
      cssProperty: '--cinder-pad-card',
      category: 'spacing',
      component: null,
      description: 'Default card padding.',
      themeAware: false,
      deprecated: false,
      profile: 'padding',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/semantic.tokens.json', path: 'pad.card' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'pad.card',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'inherited',
              declaredAt: { document: 'sets/semantic.tokens.json', path: 'pad' },
            },
            inputs: { aliases: ['space.4'], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'status.success.contrast',
      cssProperty: '--cinder-status-success-contrast',
      category: 'color',
      component: null,
      description: 'Label color for solid success fills.',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'unknown', role: 'unknown', anchor: 'unknown' },
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'mixed',
        reason:
          'Some contexts emit a trusted CSS recipe and others a typed value; the DTCG value is exported, the recipe is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/light.tokens.json', path: 'status.success.contrast' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'status.success.contrast',
                via: 'declared',
              },
              {
                document: 'themes/light.tokens.json',
                kind: 'modifier',
                layer: 'theme.light',
                path: 'status.success.contrast',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: { document: 'themes/light.tokens.json', path: 'status.success.contrast' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'status.success.contrast' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'status.success.contrast',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'status.success.contrast',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: { document: 'themes/dark.tokens.json', path: 'status.success.contrast' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'status.success.solid',
      cssProperty: '--cinder-status-success-solid',
      category: 'color',
      component: null,
      description: 'Success status fill color.',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'success', role: 'solid', anchor: true },
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'mixed',
        reason:
          'Some contexts emit a trusted CSS recipe and others a typed value; the DTCG value is exported, the recipe is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/light.tokens.json', path: 'status.success.solid' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'status.success.solid',
                via: 'declared',
              },
              {
                document: 'themes/light.tokens.json',
                kind: 'modifier',
                layer: 'theme.light',
                path: 'status.success.solid',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'inherited',
              declaredAt: { document: 'themes/light.tokens.json', path: 'status.success.solid' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'status.success.solid' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'status.success.solid',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'status.success.solid',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'inherited',
              declaredAt: { document: 'themes/dark.tokens.json', path: 'status.success.solid' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'status.success.solid.active',
      cssProperty: '--cinder-status-success-solid-active',
      category: 'color',
      component: null,
      description: 'Active/pressed step for solid success fills.',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'success', role: 'solid-active', anchor: false },
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'mixed',
        reason:
          'Some contexts emit a trusted CSS recipe and others a typed value; the DTCG value is exported, the recipe is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/light.tokens.json', path: 'status.success.solid.active' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'status.success.solid.active',
                via: 'declared',
              },
              {
                document: 'themes/light.tokens.json',
                kind: 'modifier',
                layer: 'theme.light',
                path: 'status.success.solid.active',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: {
                document: 'themes/light.tokens.json',
                path: 'status.success.solid.active',
              },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'status.success.solid.active' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'status.success.solid.active',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'status.success.solid.active',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: {
                document: 'themes/dark.tokens.json',
                path: 'status.success.solid.active',
              },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'status.success.solid.hover',
      cssProperty: '--cinder-status-success-solid-hover',
      category: 'color',
      component: null,
      description: 'Hover step for solid success fills.',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'success', role: 'solid-hover', anchor: false },
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'mixed',
        reason:
          'Some contexts emit a trusted CSS recipe and others a typed value; the DTCG value is exported, the recipe is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/light.tokens.json', path: 'status.success.solid.hover' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'status.success.solid.hover',
                via: 'declared',
              },
              {
                document: 'themes/light.tokens.json',
                kind: 'modifier',
                layer: 'theme.light',
                path: 'status.success.solid.hover',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: {
                document: 'themes/light.tokens.json',
                path: 'status.success.solid.hover',
              },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'status.success.solid.hover' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'status.success.solid.hover',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'status.success.solid.hover',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: {
                document: 'themes/dark.tokens.json',
                path: 'status.success.solid.hover',
              },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'status.success.background',
      cssProperty: '--cinder-status-success-background',
      category: 'color',
      component: null,
      description: 'Soft success-tinted surface background.',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'success', role: 'background', anchor: false },
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'mixed',
        reason:
          'Some contexts emit a trusted CSS recipe and others a typed value; the DTCG value is exported, the recipe is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/light.tokens.json', path: 'status.success.background' },
            layers: [
              {
                document: 'sets/colors.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'status.success.background',
                via: 'declared',
              },
              {
                document: 'themes/light.tokens.json',
                kind: 'modifier',
                layer: 'theme.light',
                path: 'status.success.background',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: {
                document: 'themes/light.tokens.json',
                path: 'status.success.background',
              },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'status.success.background' },
            layers: [
              {
                document: 'sets/colors.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'status.success.background',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'status.success.background',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: {
                document: 'themes/dark.tokens.json',
                path: 'status.success.background',
              },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'status.success.text',
      cssProperty: '--cinder-status-success-text',
      category: 'color',
      component: null,
      description: 'Foreground color on the soft success surface.',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'success', role: 'text', anchor: false },
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'mixed',
        reason:
          'Some contexts emit a trusted CSS recipe and others a typed value; the DTCG value is exported, the recipe is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/light.tokens.json', path: 'status.success.text' },
            layers: [
              {
                document: 'sets/colors.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'status.success.text',
                via: 'declared',
              },
              {
                document: 'themes/light.tokens.json',
                kind: 'modifier',
                layer: 'theme.light',
                path: 'status.success.text',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: { document: 'themes/light.tokens.json', path: 'status.success.text' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'status.success.text' },
            layers: [
              {
                document: 'sets/colors.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'status.success.text',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'status.success.text',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: { document: 'themes/dark.tokens.json', path: 'status.success.text' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'status.success.border',
      cssProperty: '--cinder-status-success-border',
      category: 'color',
      component: null,
      description: 'Border color on the soft success surface.',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'success', role: 'border', anchor: false },
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'mixed',
        reason:
          'Some contexts emit a trusted CSS recipe and others a typed value; the DTCG value is exported, the recipe is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/light.tokens.json', path: 'status.success.border' },
            layers: [
              {
                document: 'sets/colors.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'status.success.border',
                via: 'declared',
              },
              {
                document: 'themes/light.tokens.json',
                kind: 'modifier',
                layer: 'theme.light',
                path: 'status.success.border',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: { document: 'themes/light.tokens.json', path: 'status.success.border' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'status.success.border' },
            layers: [
              {
                document: 'sets/colors.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'status.success.border',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'status.success.border',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: { document: 'themes/dark.tokens.json', path: 'status.success.border' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'status.success.subtle',
      cssProperty: '--cinder-status-success-subtle',
      category: 'color',
      component: null,
      description:
        'Success color moved toward the current text color. Derived in one polarity-aware recipe shared by all four status colors.',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'unknown', role: 'unknown', anchor: 'unknown' },
      disposition: {
        edit: 'recipe',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'trusted-recipe',
        reason: 'The DTCG value is exported; the trusted CSS recipe that governs emission is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/light.tokens.json', path: 'status.success.subtle' },
            layers: [
              {
                document: 'sets/colors.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'status.success.subtle',
                via: 'declared',
              },
              {
                document: 'themes/light.tokens.json',
                kind: 'modifier',
                layer: 'theme.light',
                path: 'status.success.subtle',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: { document: 'themes/light.tokens.json', path: 'status.success.subtle' },
            },
            inputs: {
              aliases: [],
              refs: [],
              extends: [],
              recipes: [
                { cssProperty: '--cinder-status-success-solid', path: 'status.success.solid' },
                { cssProperty: '--cinder-text-default', path: 'text.default' },
              ],
            },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'status.success.subtle' },
            layers: [
              {
                document: 'sets/colors.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'status.success.subtle',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'status.success.subtle',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: { document: 'themes/dark.tokens.json', path: 'status.success.subtle' },
            },
            inputs: {
              aliases: [],
              refs: [],
              extends: [],
              recipes: [
                { cssProperty: '--cinder-status-success-solid', path: 'status.success.solid' },
                { cssProperty: '--cinder-text-default', path: 'text.default' },
              ],
            },
          },
        },
      ],
    },
    {
      path: 'status.success.muted',
      cssProperty: '--cinder-status-success-muted',
      category: 'color',
      component: null,
      description:
        'Success color moved toward the current surface. Derived in one polarity-aware recipe shared by all four status colors.',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'unknown', role: 'unknown', anchor: 'unknown' },
      disposition: {
        edit: 'recipe',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'trusted-recipe',
        reason: 'The DTCG value is exported; the trusted CSS recipe that governs emission is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/light.tokens.json', path: 'status.success.muted' },
            layers: [
              {
                document: 'sets/colors.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'status.success.muted',
                via: 'declared',
              },
              {
                document: 'themes/light.tokens.json',
                kind: 'modifier',
                layer: 'theme.light',
                path: 'status.success.muted',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: { document: 'themes/light.tokens.json', path: 'status.success.muted' },
            },
            inputs: {
              aliases: [],
              refs: [],
              extends: [],
              recipes: [
                { cssProperty: '--cinder-status-success-solid', path: 'status.success.solid' },
                { cssProperty: '--cinder-surface', path: 'surface.base' },
              ],
            },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'status.success.muted' },
            layers: [
              {
                document: 'sets/colors.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'status.success.muted',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'status.success.muted',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: { document: 'themes/dark.tokens.json', path: 'status.success.muted' },
            },
            inputs: {
              aliases: [],
              refs: [],
              extends: [],
              recipes: [
                { cssProperty: '--cinder-status-success-solid', path: 'status.success.solid' },
                { cssProperty: '--cinder-surface', path: 'surface.base' },
              ],
            },
          },
        },
      ],
    },
    {
      path: 'status.warning.contrast',
      cssProperty: '--cinder-status-warning-contrast',
      category: 'color',
      component: null,
      description: 'Label color for solid warning fills.',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'unknown', role: 'unknown', anchor: 'unknown' },
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'mixed',
        reason:
          'Some contexts emit a trusted CSS recipe and others a typed value; the DTCG value is exported, the recipe is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/light.tokens.json', path: 'status.warning.contrast' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'status.warning.contrast',
                via: 'declared',
              },
              {
                document: 'themes/light.tokens.json',
                kind: 'modifier',
                layer: 'theme.light',
                path: 'status.warning.contrast',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: { document: 'themes/light.tokens.json', path: 'status.warning.contrast' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'status.warning.contrast' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'status.warning.contrast',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'status.warning.contrast',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: { document: 'themes/dark.tokens.json', path: 'status.warning.contrast' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'status.warning.solid',
      cssProperty: '--cinder-status-warning-solid',
      category: 'color',
      component: null,
      description: 'Warning status fill color.',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'warning', role: 'solid', anchor: true },
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'mixed',
        reason:
          'Some contexts emit a trusted CSS recipe and others a typed value; the DTCG value is exported, the recipe is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/light.tokens.json', path: 'status.warning.solid' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'status.warning.solid',
                via: 'declared',
              },
              {
                document: 'themes/light.tokens.json',
                kind: 'modifier',
                layer: 'theme.light',
                path: 'status.warning.solid',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'inherited',
              declaredAt: { document: 'themes/light.tokens.json', path: 'status.warning.solid' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'status.warning.solid' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'status.warning.solid',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'status.warning.solid',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'inherited',
              declaredAt: { document: 'themes/dark.tokens.json', path: 'status.warning.solid' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'status.warning.solid.active',
      cssProperty: '--cinder-status-warning-solid-active',
      category: 'color',
      component: null,
      description: 'Active/pressed step for solid warning fills.',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'warning', role: 'solid-active', anchor: false },
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'mixed',
        reason:
          'Some contexts emit a trusted CSS recipe and others a typed value; the DTCG value is exported, the recipe is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/light.tokens.json', path: 'status.warning.solid.active' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'status.warning.solid.active',
                via: 'declared',
              },
              {
                document: 'themes/light.tokens.json',
                kind: 'modifier',
                layer: 'theme.light',
                path: 'status.warning.solid.active',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: {
                document: 'themes/light.tokens.json',
                path: 'status.warning.solid.active',
              },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'status.warning.solid.active' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'status.warning.solid.active',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'status.warning.solid.active',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: {
                document: 'themes/dark.tokens.json',
                path: 'status.warning.solid.active',
              },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'status.warning.solid.hover',
      cssProperty: '--cinder-status-warning-solid-hover',
      category: 'color',
      component: null,
      description: 'Hover step for solid warning fills.',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'warning', role: 'solid-hover', anchor: false },
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'mixed',
        reason:
          'Some contexts emit a trusted CSS recipe and others a typed value; the DTCG value is exported, the recipe is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/light.tokens.json', path: 'status.warning.solid.hover' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'status.warning.solid.hover',
                via: 'declared',
              },
              {
                document: 'themes/light.tokens.json',
                kind: 'modifier',
                layer: 'theme.light',
                path: 'status.warning.solid.hover',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: {
                document: 'themes/light.tokens.json',
                path: 'status.warning.solid.hover',
              },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'status.warning.solid.hover' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'status.warning.solid.hover',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'status.warning.solid.hover',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: {
                document: 'themes/dark.tokens.json',
                path: 'status.warning.solid.hover',
              },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'status.warning.background',
      cssProperty: '--cinder-status-warning-background',
      category: 'color',
      component: null,
      description: 'Soft warning-tinted surface background.',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'warning', role: 'background', anchor: false },
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'mixed',
        reason:
          'Some contexts emit a trusted CSS recipe and others a typed value; the DTCG value is exported, the recipe is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/light.tokens.json', path: 'status.warning.background' },
            layers: [
              {
                document: 'sets/colors.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'status.warning.background',
                via: 'declared',
              },
              {
                document: 'themes/light.tokens.json',
                kind: 'modifier',
                layer: 'theme.light',
                path: 'status.warning.background',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: {
                document: 'themes/light.tokens.json',
                path: 'status.warning.background',
              },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'status.warning.background' },
            layers: [
              {
                document: 'sets/colors.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'status.warning.background',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'status.warning.background',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: {
                document: 'themes/dark.tokens.json',
                path: 'status.warning.background',
              },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'status.warning.text',
      cssProperty: '--cinder-status-warning-text',
      category: 'color',
      component: null,
      description: 'Foreground color on the soft warning surface.',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'warning', role: 'text', anchor: false },
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'mixed',
        reason:
          'Some contexts emit a trusted CSS recipe and others a typed value; the DTCG value is exported, the recipe is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/light.tokens.json', path: 'status.warning.text' },
            layers: [
              {
                document: 'sets/colors.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'status.warning.text',
                via: 'declared',
              },
              {
                document: 'themes/light.tokens.json',
                kind: 'modifier',
                layer: 'theme.light',
                path: 'status.warning.text',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: { document: 'themes/light.tokens.json', path: 'status.warning.text' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'status.warning.text' },
            layers: [
              {
                document: 'sets/colors.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'status.warning.text',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'status.warning.text',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: { document: 'themes/dark.tokens.json', path: 'status.warning.text' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'status.warning.border',
      cssProperty: '--cinder-status-warning-border',
      category: 'color',
      component: null,
      description: 'Border color on the soft warning surface.',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'warning', role: 'border', anchor: false },
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'mixed',
        reason:
          'Some contexts emit a trusted CSS recipe and others a typed value; the DTCG value is exported, the recipe is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/light.tokens.json', path: 'status.warning.border' },
            layers: [
              {
                document: 'sets/colors.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'status.warning.border',
                via: 'declared',
              },
              {
                document: 'themes/light.tokens.json',
                kind: 'modifier',
                layer: 'theme.light',
                path: 'status.warning.border',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: { document: 'themes/light.tokens.json', path: 'status.warning.border' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'status.warning.border' },
            layers: [
              {
                document: 'sets/colors.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'status.warning.border',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'status.warning.border',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: { document: 'themes/dark.tokens.json', path: 'status.warning.border' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'status.warning.subtle',
      cssProperty: '--cinder-status-warning-subtle',
      category: 'color',
      component: null,
      description:
        'Warning color moved toward the current text color. Derived in one polarity-aware recipe shared by all four status colors.',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'unknown', role: 'unknown', anchor: 'unknown' },
      disposition: {
        edit: 'recipe',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'trusted-recipe',
        reason: 'The DTCG value is exported; the trusted CSS recipe that governs emission is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/light.tokens.json', path: 'status.warning.subtle' },
            layers: [
              {
                document: 'sets/colors.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'status.warning.subtle',
                via: 'declared',
              },
              {
                document: 'themes/light.tokens.json',
                kind: 'modifier',
                layer: 'theme.light',
                path: 'status.warning.subtle',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: { document: 'themes/light.tokens.json', path: 'status.warning.subtle' },
            },
            inputs: {
              aliases: [],
              refs: [],
              extends: [],
              recipes: [
                { cssProperty: '--cinder-status-warning-solid', path: 'status.warning.solid' },
                { cssProperty: '--cinder-text-default', path: 'text.default' },
              ],
            },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'status.warning.subtle' },
            layers: [
              {
                document: 'sets/colors.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'status.warning.subtle',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'status.warning.subtle',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: { document: 'themes/dark.tokens.json', path: 'status.warning.subtle' },
            },
            inputs: {
              aliases: [],
              refs: [],
              extends: [],
              recipes: [
                { cssProperty: '--cinder-status-warning-solid', path: 'status.warning.solid' },
                { cssProperty: '--cinder-text-default', path: 'text.default' },
              ],
            },
          },
        },
      ],
    },
    {
      path: 'status.warning.muted',
      cssProperty: '--cinder-status-warning-muted',
      category: 'color',
      component: null,
      description:
        'Warning color moved toward the current surface. Derived in one polarity-aware recipe shared by all four status colors.',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'unknown', role: 'unknown', anchor: 'unknown' },
      disposition: {
        edit: 'recipe',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'trusted-recipe',
        reason: 'The DTCG value is exported; the trusted CSS recipe that governs emission is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/light.tokens.json', path: 'status.warning.muted' },
            layers: [
              {
                document: 'sets/colors.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'status.warning.muted',
                via: 'declared',
              },
              {
                document: 'themes/light.tokens.json',
                kind: 'modifier',
                layer: 'theme.light',
                path: 'status.warning.muted',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: { document: 'themes/light.tokens.json', path: 'status.warning.muted' },
            },
            inputs: {
              aliases: [],
              refs: [],
              extends: [],
              recipes: [
                { cssProperty: '--cinder-status-warning-solid', path: 'status.warning.solid' },
                { cssProperty: '--cinder-surface', path: 'surface.base' },
              ],
            },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'status.warning.muted' },
            layers: [
              {
                document: 'sets/colors.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'status.warning.muted',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'status.warning.muted',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: { document: 'themes/dark.tokens.json', path: 'status.warning.muted' },
            },
            inputs: {
              aliases: [],
              refs: [],
              extends: [],
              recipes: [
                { cssProperty: '--cinder-status-warning-solid', path: 'status.warning.solid' },
                { cssProperty: '--cinder-surface', path: 'surface.base' },
              ],
            },
          },
        },
      ],
    },
    {
      path: 'status.danger.contrast',
      cssProperty: '--cinder-status-danger-contrast',
      category: 'color',
      component: null,
      description:
        'Label color for solid danger fills. Dark-mode danger is ~72% lightness; pure white fails WCAG AA on it, so the dark arm uses a near-black ink instead.',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'unknown', role: 'unknown', anchor: 'unknown' },
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'mixed',
        reason:
          'Some contexts emit a trusted CSS recipe and others a typed value; the DTCG value is exported, the recipe is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/light.tokens.json', path: 'status.danger.contrast' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'status.danger.contrast',
                via: 'declared',
              },
              {
                document: 'themes/light.tokens.json',
                kind: 'modifier',
                layer: 'theme.light',
                path: 'status.danger.contrast',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: { document: 'themes/light.tokens.json', path: 'status.danger.contrast' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'status.danger.contrast' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'status.danger.contrast',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'status.danger.contrast',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: { document: 'themes/dark.tokens.json', path: 'status.danger.contrast' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'status.danger.solid',
      cssProperty: '--cinder-status-danger-solid',
      category: 'color',
      component: null,
      description: 'Danger status fill color.',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'danger', role: 'solid', anchor: true },
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'mixed',
        reason:
          'Some contexts emit a trusted CSS recipe and others a typed value; the DTCG value is exported, the recipe is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/light.tokens.json', path: 'status.danger.solid' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'status.danger.solid',
                via: 'declared',
              },
              {
                document: 'themes/light.tokens.json',
                kind: 'modifier',
                layer: 'theme.light',
                path: 'status.danger.solid',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'inherited',
              declaredAt: { document: 'themes/light.tokens.json', path: 'status.danger.solid' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'status.danger.solid' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'status.danger.solid',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'status.danger.solid',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'inherited',
              declaredAt: { document: 'themes/dark.tokens.json', path: 'status.danger.solid' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'status.danger.solid.active',
      cssProperty: '--cinder-status-danger-solid-active',
      category: 'color',
      component: null,
      description:
        'Active/pressed step for solid danger fills, explicitly authored and fitted to the in-gamut chroma maximum at this lightness.',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'danger', role: 'solid-active', anchor: false },
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'mixed',
        reason:
          'Some contexts emit a trusted CSS recipe and others a typed value; the DTCG value is exported, the recipe is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/light.tokens.json', path: 'status.danger.solid.active' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'status.danger.solid.active',
                via: 'declared',
              },
              {
                document: 'themes/light.tokens.json',
                kind: 'modifier',
                layer: 'theme.light',
                path: 'status.danger.solid.active',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: {
                document: 'themes/light.tokens.json',
                path: 'status.danger.solid.active',
              },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'status.danger.solid.active' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'status.danger.solid.active',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'status.danger.solid.active',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: {
                document: 'themes/dark.tokens.json',
                path: 'status.danger.solid.active',
              },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'status.danger.solid.hover',
      cssProperty: '--cinder-status-danger-solid-hover',
      category: 'color',
      component: null,
      description:
        'Hover step for solid danger fills, explicitly authored and fitted to the in-gamut chroma maximum at this lightness.',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'danger', role: 'solid-hover', anchor: false },
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'mixed',
        reason:
          'Some contexts emit a trusted CSS recipe and others a typed value; the DTCG value is exported, the recipe is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/light.tokens.json', path: 'status.danger.solid.hover' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'status.danger.solid.hover',
                via: 'declared',
              },
              {
                document: 'themes/light.tokens.json',
                kind: 'modifier',
                layer: 'theme.light',
                path: 'status.danger.solid.hover',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: {
                document: 'themes/light.tokens.json',
                path: 'status.danger.solid.hover',
              },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'status.danger.solid.hover' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'status.danger.solid.hover',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'status.danger.solid.hover',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: {
                document: 'themes/dark.tokens.json',
                path: 'status.danger.solid.hover',
              },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'status.danger.background',
      cssProperty: '--cinder-status-danger-background',
      category: 'color',
      component: null,
      description: 'Soft danger-tinted surface background.',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'danger', role: 'background', anchor: false },
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'mixed',
        reason:
          'Some contexts emit a trusted CSS recipe and others a typed value; the DTCG value is exported, the recipe is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/light.tokens.json', path: 'status.danger.background' },
            layers: [
              {
                document: 'sets/colors.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'status.danger.background',
                via: 'declared',
              },
              {
                document: 'themes/light.tokens.json',
                kind: 'modifier',
                layer: 'theme.light',
                path: 'status.danger.background',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: {
                document: 'themes/light.tokens.json',
                path: 'status.danger.background',
              },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'status.danger.background' },
            layers: [
              {
                document: 'sets/colors.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'status.danger.background',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'status.danger.background',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: { document: 'themes/dark.tokens.json', path: 'status.danger.background' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'status.danger.text',
      cssProperty: '--cinder-status-danger-text',
      category: 'color',
      component: null,
      description: 'Foreground color on the soft danger surface.',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'danger', role: 'text', anchor: false },
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'mixed',
        reason:
          'Some contexts emit a trusted CSS recipe and others a typed value; the DTCG value is exported, the recipe is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/light.tokens.json', path: 'status.danger.text' },
            layers: [
              {
                document: 'sets/colors.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'status.danger.text',
                via: 'declared',
              },
              {
                document: 'themes/light.tokens.json',
                kind: 'modifier',
                layer: 'theme.light',
                path: 'status.danger.text',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: { document: 'themes/light.tokens.json', path: 'status.danger.text' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'status.danger.text' },
            layers: [
              {
                document: 'sets/colors.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'status.danger.text',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'status.danger.text',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: { document: 'themes/dark.tokens.json', path: 'status.danger.text' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'status.danger.border',
      cssProperty: '--cinder-status-danger-border',
      category: 'color',
      component: null,
      description: 'Border color on the soft danger surface.',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'danger', role: 'border', anchor: false },
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'mixed',
        reason:
          'Some contexts emit a trusted CSS recipe and others a typed value; the DTCG value is exported, the recipe is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/light.tokens.json', path: 'status.danger.border' },
            layers: [
              {
                document: 'sets/colors.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'status.danger.border',
                via: 'declared',
              },
              {
                document: 'themes/light.tokens.json',
                kind: 'modifier',
                layer: 'theme.light',
                path: 'status.danger.border',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: { document: 'themes/light.tokens.json', path: 'status.danger.border' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'status.danger.border' },
            layers: [
              {
                document: 'sets/colors.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'status.danger.border',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'status.danger.border',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: { document: 'themes/dark.tokens.json', path: 'status.danger.border' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'status.danger.subtle',
      cssProperty: '--cinder-status-danger-subtle',
      category: 'color',
      component: null,
      description:
        'Danger color moved toward the current text color. Derived in one polarity-aware recipe shared by all four status colors.',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'unknown', role: 'unknown', anchor: 'unknown' },
      disposition: {
        edit: 'recipe',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'trusted-recipe',
        reason: 'The DTCG value is exported; the trusted CSS recipe that governs emission is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/light.tokens.json', path: 'status.danger.subtle' },
            layers: [
              {
                document: 'sets/colors.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'status.danger.subtle',
                via: 'declared',
              },
              {
                document: 'themes/light.tokens.json',
                kind: 'modifier',
                layer: 'theme.light',
                path: 'status.danger.subtle',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: { document: 'themes/light.tokens.json', path: 'status.danger.subtle' },
            },
            inputs: {
              aliases: [],
              refs: [],
              extends: [],
              recipes: [
                { cssProperty: '--cinder-status-danger-solid', path: 'status.danger.solid' },
                { cssProperty: '--cinder-text-default', path: 'text.default' },
              ],
            },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'status.danger.subtle' },
            layers: [
              {
                document: 'sets/colors.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'status.danger.subtle',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'status.danger.subtle',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: { document: 'themes/dark.tokens.json', path: 'status.danger.subtle' },
            },
            inputs: {
              aliases: [],
              refs: [],
              extends: [],
              recipes: [
                { cssProperty: '--cinder-status-danger-solid', path: 'status.danger.solid' },
                { cssProperty: '--cinder-text-default', path: 'text.default' },
              ],
            },
          },
        },
      ],
    },
    {
      path: 'status.danger.muted',
      cssProperty: '--cinder-status-danger-muted',
      category: 'color',
      component: null,
      description:
        'Danger color moved toward the current surface. Derived in one polarity-aware recipe shared by all four status colors.',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'unknown', role: 'unknown', anchor: 'unknown' },
      disposition: {
        edit: 'recipe',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'trusted-recipe',
        reason: 'The DTCG value is exported; the trusted CSS recipe that governs emission is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/light.tokens.json', path: 'status.danger.muted' },
            layers: [
              {
                document: 'sets/colors.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'status.danger.muted',
                via: 'declared',
              },
              {
                document: 'themes/light.tokens.json',
                kind: 'modifier',
                layer: 'theme.light',
                path: 'status.danger.muted',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: { document: 'themes/light.tokens.json', path: 'status.danger.muted' },
            },
            inputs: {
              aliases: [],
              refs: [],
              extends: [],
              recipes: [
                { cssProperty: '--cinder-status-danger-solid', path: 'status.danger.solid' },
                { cssProperty: '--cinder-surface', path: 'surface.base' },
              ],
            },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'status.danger.muted' },
            layers: [
              {
                document: 'sets/colors.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'status.danger.muted',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'status.danger.muted',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: { document: 'themes/dark.tokens.json', path: 'status.danger.muted' },
            },
            inputs: {
              aliases: [],
              refs: [],
              extends: [],
              recipes: [
                { cssProperty: '--cinder-status-danger-solid', path: 'status.danger.solid' },
                { cssProperty: '--cinder-surface', path: 'surface.base' },
              ],
            },
          },
        },
      ],
    },
    {
      path: 'status.info.contrast',
      cssProperty: '--cinder-status-info-contrast',
      category: 'color',
      component: null,
      description: 'Label color for solid info fills.',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'unknown', role: 'unknown', anchor: 'unknown' },
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'mixed',
        reason:
          'Some contexts emit a trusted CSS recipe and others a typed value; the DTCG value is exported, the recipe is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/light.tokens.json', path: 'status.info.contrast' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'status.info.contrast',
                via: 'declared',
              },
              {
                document: 'themes/light.tokens.json',
                kind: 'modifier',
                layer: 'theme.light',
                path: 'status.info.contrast',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: { document: 'themes/light.tokens.json', path: 'status.info.contrast' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'status.info.contrast' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'status.info.contrast',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'status.info.contrast',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: { document: 'themes/dark.tokens.json', path: 'status.info.contrast' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'status.info.solid',
      cssProperty: '--cinder-status-info-solid',
      category: 'color',
      component: null,
      description: 'Info status fill color.',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'info', role: 'solid', anchor: true },
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'mixed',
        reason:
          'Some contexts emit a trusted CSS recipe and others a typed value; the DTCG value is exported, the recipe is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/light.tokens.json', path: 'status.info.solid' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'status.info.solid',
                via: 'declared',
              },
              {
                document: 'themes/light.tokens.json',
                kind: 'modifier',
                layer: 'theme.light',
                path: 'status.info.solid',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'inherited',
              declaredAt: { document: 'themes/light.tokens.json', path: 'status.info.solid' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'status.info.solid' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'status.info.solid',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'status.info.solid',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'inherited',
              declaredAt: { document: 'themes/dark.tokens.json', path: 'status.info.solid' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'status.info.solid.active',
      cssProperty: '--cinder-status-info-solid-active',
      category: 'color',
      component: null,
      description: 'Active/pressed step for solid info fills.',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'info', role: 'solid-active', anchor: false },
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'mixed',
        reason:
          'Some contexts emit a trusted CSS recipe and others a typed value; the DTCG value is exported, the recipe is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/light.tokens.json', path: 'status.info.solid.active' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'status.info.solid.active',
                via: 'declared',
              },
              {
                document: 'themes/light.tokens.json',
                kind: 'modifier',
                layer: 'theme.light',
                path: 'status.info.solid.active',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: {
                document: 'themes/light.tokens.json',
                path: 'status.info.solid.active',
              },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'status.info.solid.active' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'status.info.solid.active',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'status.info.solid.active',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: { document: 'themes/dark.tokens.json', path: 'status.info.solid.active' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'status.info.solid.hover',
      cssProperty: '--cinder-status-info-solid-hover',
      category: 'color',
      component: null,
      description: 'Hover step for solid info fills.',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'info', role: 'solid-hover', anchor: false },
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'mixed',
        reason:
          'Some contexts emit a trusted CSS recipe and others a typed value; the DTCG value is exported, the recipe is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/light.tokens.json', path: 'status.info.solid.hover' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'status.info.solid.hover',
                via: 'declared',
              },
              {
                document: 'themes/light.tokens.json',
                kind: 'modifier',
                layer: 'theme.light',
                path: 'status.info.solid.hover',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: { document: 'themes/light.tokens.json', path: 'status.info.solid.hover' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'status.info.solid.hover' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'status.info.solid.hover',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'status.info.solid.hover',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: { document: 'themes/dark.tokens.json', path: 'status.info.solid.hover' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'status.info.background',
      cssProperty: '--cinder-status-info-background',
      category: 'color',
      component: null,
      description: 'Soft info-tinted surface background.',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'info', role: 'background', anchor: false },
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'mixed',
        reason:
          'Some contexts emit a trusted CSS recipe and others a typed value; the DTCG value is exported, the recipe is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/light.tokens.json', path: 'status.info.background' },
            layers: [
              {
                document: 'sets/colors.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'status.info.background',
                via: 'declared',
              },
              {
                document: 'themes/light.tokens.json',
                kind: 'modifier',
                layer: 'theme.light',
                path: 'status.info.background',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: { document: 'themes/light.tokens.json', path: 'status.info.background' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'status.info.background' },
            layers: [
              {
                document: 'sets/colors.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'status.info.background',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'status.info.background',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: { document: 'themes/dark.tokens.json', path: 'status.info.background' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'status.info.text',
      cssProperty: '--cinder-status-info-text',
      category: 'color',
      component: null,
      description: 'Foreground color on the soft info surface.',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'info', role: 'text', anchor: false },
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'mixed',
        reason:
          'Some contexts emit a trusted CSS recipe and others a typed value; the DTCG value is exported, the recipe is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/light.tokens.json', path: 'status.info.text' },
            layers: [
              {
                document: 'sets/colors.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'status.info.text',
                via: 'declared',
              },
              {
                document: 'themes/light.tokens.json',
                kind: 'modifier',
                layer: 'theme.light',
                path: 'status.info.text',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: { document: 'themes/light.tokens.json', path: 'status.info.text' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'status.info.text' },
            layers: [
              {
                document: 'sets/colors.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'status.info.text',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'status.info.text',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: { document: 'themes/dark.tokens.json', path: 'status.info.text' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'status.info.border',
      cssProperty: '--cinder-status-info-border',
      category: 'color',
      component: null,
      description: 'Border color on the soft info surface.',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'info', role: 'border', anchor: false },
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'mixed',
        reason:
          'Some contexts emit a trusted CSS recipe and others a typed value; the DTCG value is exported, the recipe is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/light.tokens.json', path: 'status.info.border' },
            layers: [
              {
                document: 'sets/colors.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'status.info.border',
                via: 'declared',
              },
              {
                document: 'themes/light.tokens.json',
                kind: 'modifier',
                layer: 'theme.light',
                path: 'status.info.border',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: { document: 'themes/light.tokens.json', path: 'status.info.border' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'status.info.border' },
            layers: [
              {
                document: 'sets/colors.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'status.info.border',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'status.info.border',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: { document: 'themes/dark.tokens.json', path: 'status.info.border' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'status.info.subtle',
      cssProperty: '--cinder-status-info-subtle',
      category: 'color',
      component: null,
      description:
        'Info color moved toward the current text color. Derived in one polarity-aware recipe shared by all four status colors.',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'unknown', role: 'unknown', anchor: 'unknown' },
      disposition: {
        edit: 'recipe',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'trusted-recipe',
        reason: 'The DTCG value is exported; the trusted CSS recipe that governs emission is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/light.tokens.json', path: 'status.info.subtle' },
            layers: [
              {
                document: 'sets/colors.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'status.info.subtle',
                via: 'declared',
              },
              {
                document: 'themes/light.tokens.json',
                kind: 'modifier',
                layer: 'theme.light',
                path: 'status.info.subtle',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: { document: 'themes/light.tokens.json', path: 'status.info.subtle' },
            },
            inputs: {
              aliases: [],
              refs: [],
              extends: [],
              recipes: [
                { cssProperty: '--cinder-status-info-solid', path: 'status.info.solid' },
                { cssProperty: '--cinder-text-default', path: 'text.default' },
              ],
            },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'status.info.subtle' },
            layers: [
              {
                document: 'sets/colors.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'status.info.subtle',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'status.info.subtle',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: { document: 'themes/dark.tokens.json', path: 'status.info.subtle' },
            },
            inputs: {
              aliases: [],
              refs: [],
              extends: [],
              recipes: [
                { cssProperty: '--cinder-status-info-solid', path: 'status.info.solid' },
                { cssProperty: '--cinder-text-default', path: 'text.default' },
              ],
            },
          },
        },
      ],
    },
    {
      path: 'status.info.muted',
      cssProperty: '--cinder-status-info-muted',
      category: 'color',
      component: null,
      description:
        'Info color moved toward the current surface. Derived in one polarity-aware recipe shared by all four status colors.',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'unknown', role: 'unknown', anchor: 'unknown' },
      disposition: {
        edit: 'recipe',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'trusted-recipe',
        reason: 'The DTCG value is exported; the trusted CSS recipe that governs emission is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/light.tokens.json', path: 'status.info.muted' },
            layers: [
              {
                document: 'sets/colors.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'status.info.muted',
                via: 'declared',
              },
              {
                document: 'themes/light.tokens.json',
                kind: 'modifier',
                layer: 'theme.light',
                path: 'status.info.muted',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: { document: 'themes/light.tokens.json', path: 'status.info.muted' },
            },
            inputs: {
              aliases: [],
              refs: [],
              extends: [],
              recipes: [
                { cssProperty: '--cinder-status-info-solid', path: 'status.info.solid' },
                { cssProperty: '--cinder-surface', path: 'surface.base' },
              ],
            },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'status.info.muted' },
            layers: [
              {
                document: 'sets/colors.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'status.info.muted',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'status.info.muted',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: { document: 'themes/dark.tokens.json', path: 'status.info.muted' },
            },
            inputs: {
              aliases: [],
              refs: [],
              extends: [],
              recipes: [
                { cssProperty: '--cinder-status-info-solid', path: 'status.info.solid' },
                { cssProperty: '--cinder-surface', path: 'surface.base' },
              ],
            },
          },
        },
      ],
    },
    {
      path: 'status.neutral.background',
      cssProperty: '--cinder-status-neutral-background',
      category: 'color',
      component: null,
      description:
        'Soft neutral-tinted surface background. Neutral retains the status-triple shape so components never need ad hoc surface mixing for the default variant.',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'neutral', role: 'status-neutral-background', anchor: false },
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'mixed',
        reason:
          'Some contexts emit a trusted CSS recipe and others a typed value; the DTCG value is exported, the recipe is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/light.tokens.json', path: 'status.neutral.background' },
            layers: [
              {
                document: 'sets/colors.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'status.neutral.background',
                via: 'declared',
              },
              {
                document: 'themes/light.tokens.json',
                kind: 'modifier',
                layer: 'theme.light',
                path: 'status.neutral.background',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: {
                document: 'themes/light.tokens.json',
                path: 'status.neutral.background',
              },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'status.neutral.background' },
            layers: [
              {
                document: 'sets/colors.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'status.neutral.background',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'status.neutral.background',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: {
                document: 'themes/dark.tokens.json',
                path: 'status.neutral.background',
              },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'status.neutral.text',
      cssProperty: '--cinder-status-neutral-text',
      category: 'color',
      component: null,
      description: 'Foreground color on the soft neutral surface.',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'unknown', role: 'unknown', anchor: 'unknown' },
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/light.tokens.json', path: 'status.neutral.text' },
            layers: [
              {
                document: 'sets/colors.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'status.neutral.text',
                via: 'declared',
              },
              {
                document: 'themes/light.tokens.json',
                kind: 'modifier',
                layer: 'theme.light',
                path: 'status.neutral.text',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: { document: 'themes/light.tokens.json', path: 'status.neutral.text' },
            },
            inputs: { aliases: ['text.default'], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'status.neutral.text' },
            layers: [
              {
                document: 'sets/colors.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'status.neutral.text',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'status.neutral.text',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: { document: 'themes/dark.tokens.json', path: 'status.neutral.text' },
            },
            inputs: { aliases: ['text.default'], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'status.neutral.border',
      cssProperty: '--cinder-status-neutral-border',
      category: 'color',
      component: null,
      description: 'Border color on the soft neutral surface.',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'unknown', role: 'unknown', anchor: 'unknown' },
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/light.tokens.json', path: 'status.neutral.border' },
            layers: [
              {
                document: 'sets/colors.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'status.neutral.border',
                via: 'declared',
              },
              {
                document: 'themes/light.tokens.json',
                kind: 'modifier',
                layer: 'theme.light',
                path: 'status.neutral.border',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: { document: 'themes/light.tokens.json', path: 'status.neutral.border' },
            },
            inputs: { aliases: ['border.control'], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'status.neutral.border' },
            layers: [
              {
                document: 'sets/colors.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'status.neutral.border',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'status.neutral.border',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: { document: 'themes/dark.tokens.json', path: 'status.neutral.border' },
            },
            inputs: { aliases: ['border.control'], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'severity.critical',
      cssProperty: '--cinder-severity-critical',
      category: 'color',
      component: null,
      description: 'Highest-severity badge foreground.',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'unknown', role: 'unknown', anchor: 'unknown' },
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'mixed',
        reason:
          'Some contexts emit a trusted CSS recipe and others a typed value; the DTCG value is exported, the recipe is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'sets/semantic.tokens.json', path: 'severity.critical' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'severity.critical',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'inherited',
              declaredAt: { document: 'sets/semantic.tokens.json', path: 'severity' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'severity.critical' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'severity.critical',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'severity.critical',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: { document: 'themes/dark.tokens.json', path: 'severity.critical' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'severity.critical-background',
      cssProperty: '--cinder-severity-critical-background',
      category: 'color',
      component: null,
      description: 'Highest-severity badge background.',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'unknown', role: 'unknown', anchor: 'unknown' },
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'mixed',
        reason:
          'Some contexts emit a trusted CSS recipe and others a typed value; the DTCG value is exported, the recipe is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'sets/semantic.tokens.json', path: 'severity.critical-background' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'severity.critical-background',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'inherited',
              declaredAt: { document: 'sets/semantic.tokens.json', path: 'severity' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'severity.critical-background' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'severity.critical-background',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'severity.critical-background',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: {
                document: 'themes/dark.tokens.json',
                path: 'severity.critical-background',
              },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'terminal.ansi-black',
      cssProperty: '--cinder-terminal-ansi-black',
      category: 'color',
      component: null,
      description: 'unknown',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'unknown', role: 'unknown', anchor: 'unknown' },
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'mixed',
        reason:
          'Some contexts emit a trusted CSS recipe and others a typed value; the DTCG value is exported, the recipe is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'sets/semantic.tokens.json', path: 'terminal.ansi-black' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'terminal.ansi-black',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'inherited',
              declaredAt: { document: 'sets/semantic.tokens.json', path: 'terminal' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'terminal.ansi-black' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'terminal.ansi-black',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'terminal.ansi-black',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: { document: 'themes/dark.tokens.json', path: 'terminal.ansi-black' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'terminal.ansi-red',
      cssProperty: '--cinder-terminal-ansi-red',
      category: 'color',
      component: null,
      description: 'unknown',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'unknown', role: 'unknown', anchor: 'unknown' },
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'mixed',
        reason:
          'Some contexts emit a trusted CSS recipe and others a typed value; the DTCG value is exported, the recipe is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'sets/semantic.tokens.json', path: 'terminal.ansi-red' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'terminal.ansi-red',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'inherited',
              declaredAt: { document: 'sets/semantic.tokens.json', path: 'terminal' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'terminal.ansi-red' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'terminal.ansi-red',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'terminal.ansi-red',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: { document: 'themes/dark.tokens.json', path: 'terminal.ansi-red' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'terminal.ansi-green',
      cssProperty: '--cinder-terminal-ansi-green',
      category: 'color',
      component: null,
      description: 'unknown',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'unknown', role: 'unknown', anchor: 'unknown' },
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'mixed',
        reason:
          'Some contexts emit a trusted CSS recipe and others a typed value; the DTCG value is exported, the recipe is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'sets/semantic.tokens.json', path: 'terminal.ansi-green' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'terminal.ansi-green',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'inherited',
              declaredAt: { document: 'sets/semantic.tokens.json', path: 'terminal' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'terminal.ansi-green' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'terminal.ansi-green',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'terminal.ansi-green',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: { document: 'themes/dark.tokens.json', path: 'terminal.ansi-green' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'terminal.ansi-yellow',
      cssProperty: '--cinder-terminal-ansi-yellow',
      category: 'color',
      component: null,
      description: 'unknown',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'unknown', role: 'unknown', anchor: 'unknown' },
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'mixed',
        reason:
          'Some contexts emit a trusted CSS recipe and others a typed value; the DTCG value is exported, the recipe is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'sets/semantic.tokens.json', path: 'terminal.ansi-yellow' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'terminal.ansi-yellow',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'inherited',
              declaredAt: { document: 'sets/semantic.tokens.json', path: 'terminal' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'terminal.ansi-yellow' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'terminal.ansi-yellow',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'terminal.ansi-yellow',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: { document: 'themes/dark.tokens.json', path: 'terminal.ansi-yellow' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'terminal.ansi-blue',
      cssProperty: '--cinder-terminal-ansi-blue',
      category: 'color',
      component: null,
      description: 'unknown',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'unknown', role: 'unknown', anchor: 'unknown' },
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'mixed',
        reason:
          'Some contexts emit a trusted CSS recipe and others a typed value; the DTCG value is exported, the recipe is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'sets/semantic.tokens.json', path: 'terminal.ansi-blue' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'terminal.ansi-blue',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'inherited',
              declaredAt: { document: 'sets/semantic.tokens.json', path: 'terminal' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'terminal.ansi-blue' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'terminal.ansi-blue',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'terminal.ansi-blue',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: { document: 'themes/dark.tokens.json', path: 'terminal.ansi-blue' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'terminal.ansi-magenta',
      cssProperty: '--cinder-terminal-ansi-magenta',
      category: 'color',
      component: null,
      description: 'unknown',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'unknown', role: 'unknown', anchor: 'unknown' },
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'mixed',
        reason:
          'Some contexts emit a trusted CSS recipe and others a typed value; the DTCG value is exported, the recipe is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'sets/semantic.tokens.json', path: 'terminal.ansi-magenta' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'terminal.ansi-magenta',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'inherited',
              declaredAt: { document: 'sets/semantic.tokens.json', path: 'terminal' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'terminal.ansi-magenta' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'terminal.ansi-magenta',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'terminal.ansi-magenta',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: { document: 'themes/dark.tokens.json', path: 'terminal.ansi-magenta' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'terminal.ansi-cyan',
      cssProperty: '--cinder-terminal-ansi-cyan',
      category: 'color',
      component: null,
      description: 'unknown',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'unknown', role: 'unknown', anchor: 'unknown' },
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'mixed',
        reason:
          'Some contexts emit a trusted CSS recipe and others a typed value; the DTCG value is exported, the recipe is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'sets/semantic.tokens.json', path: 'terminal.ansi-cyan' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'terminal.ansi-cyan',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'inherited',
              declaredAt: { document: 'sets/semantic.tokens.json', path: 'terminal' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'terminal.ansi-cyan' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'terminal.ansi-cyan',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'terminal.ansi-cyan',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: { document: 'themes/dark.tokens.json', path: 'terminal.ansi-cyan' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'terminal.ansi-white',
      cssProperty: '--cinder-terminal-ansi-white',
      category: 'color',
      component: null,
      description: 'unknown',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'unknown', role: 'unknown', anchor: 'unknown' },
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'mixed',
        reason:
          'Some contexts emit a trusted CSS recipe and others a typed value; the DTCG value is exported, the recipe is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'sets/semantic.tokens.json', path: 'terminal.ansi-white' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'terminal.ansi-white',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'inherited',
              declaredAt: { document: 'sets/semantic.tokens.json', path: 'terminal' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'terminal.ansi-white' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'terminal.ansi-white',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'terminal.ansi-white',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: { document: 'themes/dark.tokens.json', path: 'terminal.ansi-white' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'terminal.ansi-bright-black',
      cssProperty: '--cinder-terminal-ansi-bright-black',
      category: 'color',
      component: null,
      description: 'unknown',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'unknown', role: 'unknown', anchor: 'unknown' },
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'mixed',
        reason:
          'Some contexts emit a trusted CSS recipe and others a typed value; the DTCG value is exported, the recipe is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'sets/semantic.tokens.json', path: 'terminal.ansi-bright-black' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'terminal.ansi-bright-black',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'inherited',
              declaredAt: { document: 'sets/semantic.tokens.json', path: 'terminal' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'terminal.ansi-bright-black' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'terminal.ansi-bright-black',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'terminal.ansi-bright-black',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: {
                document: 'themes/dark.tokens.json',
                path: 'terminal.ansi-bright-black',
              },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'terminal.ansi-bright-red',
      cssProperty: '--cinder-terminal-ansi-bright-red',
      category: 'color',
      component: null,
      description: 'unknown',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'unknown', role: 'unknown', anchor: 'unknown' },
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'mixed',
        reason:
          'Some contexts emit a trusted CSS recipe and others a typed value; the DTCG value is exported, the recipe is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'sets/semantic.tokens.json', path: 'terminal.ansi-bright-red' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'terminal.ansi-bright-red',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'inherited',
              declaredAt: { document: 'sets/semantic.tokens.json', path: 'terminal' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'terminal.ansi-bright-red' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'terminal.ansi-bright-red',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'terminal.ansi-bright-red',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: { document: 'themes/dark.tokens.json', path: 'terminal.ansi-bright-red' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'terminal.ansi-bright-green',
      cssProperty: '--cinder-terminal-ansi-bright-green',
      category: 'color',
      component: null,
      description: 'unknown',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'unknown', role: 'unknown', anchor: 'unknown' },
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'mixed',
        reason:
          'Some contexts emit a trusted CSS recipe and others a typed value; the DTCG value is exported, the recipe is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'sets/semantic.tokens.json', path: 'terminal.ansi-bright-green' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'terminal.ansi-bright-green',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'inherited',
              declaredAt: { document: 'sets/semantic.tokens.json', path: 'terminal' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'terminal.ansi-bright-green' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'terminal.ansi-bright-green',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'terminal.ansi-bright-green',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: {
                document: 'themes/dark.tokens.json',
                path: 'terminal.ansi-bright-green',
              },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'terminal.ansi-bright-yellow',
      cssProperty: '--cinder-terminal-ansi-bright-yellow',
      category: 'color',
      component: null,
      description: 'unknown',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'unknown', role: 'unknown', anchor: 'unknown' },
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'mixed',
        reason:
          'Some contexts emit a trusted CSS recipe and others a typed value; the DTCG value is exported, the recipe is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'sets/semantic.tokens.json', path: 'terminal.ansi-bright-yellow' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'terminal.ansi-bright-yellow',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'inherited',
              declaredAt: { document: 'sets/semantic.tokens.json', path: 'terminal' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'terminal.ansi-bright-yellow' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'terminal.ansi-bright-yellow',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'terminal.ansi-bright-yellow',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: {
                document: 'themes/dark.tokens.json',
                path: 'terminal.ansi-bright-yellow',
              },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'terminal.ansi-bright-blue',
      cssProperty: '--cinder-terminal-ansi-bright-blue',
      category: 'color',
      component: null,
      description: 'unknown',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'unknown', role: 'unknown', anchor: 'unknown' },
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'mixed',
        reason:
          'Some contexts emit a trusted CSS recipe and others a typed value; the DTCG value is exported, the recipe is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'sets/semantic.tokens.json', path: 'terminal.ansi-bright-blue' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'terminal.ansi-bright-blue',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'inherited',
              declaredAt: { document: 'sets/semantic.tokens.json', path: 'terminal' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'terminal.ansi-bright-blue' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'terminal.ansi-bright-blue',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'terminal.ansi-bright-blue',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: {
                document: 'themes/dark.tokens.json',
                path: 'terminal.ansi-bright-blue',
              },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'terminal.ansi-bright-magenta',
      cssProperty: '--cinder-terminal-ansi-bright-magenta',
      category: 'color',
      component: null,
      description: 'unknown',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'unknown', role: 'unknown', anchor: 'unknown' },
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'mixed',
        reason:
          'Some contexts emit a trusted CSS recipe and others a typed value; the DTCG value is exported, the recipe is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'sets/semantic.tokens.json', path: 'terminal.ansi-bright-magenta' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'terminal.ansi-bright-magenta',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'inherited',
              declaredAt: { document: 'sets/semantic.tokens.json', path: 'terminal' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'terminal.ansi-bright-magenta' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'terminal.ansi-bright-magenta',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'terminal.ansi-bright-magenta',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: {
                document: 'themes/dark.tokens.json',
                path: 'terminal.ansi-bright-magenta',
              },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'terminal.ansi-bright-cyan',
      cssProperty: '--cinder-terminal-ansi-bright-cyan',
      category: 'color',
      component: null,
      description: 'unknown',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'unknown', role: 'unknown', anchor: 'unknown' },
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'mixed',
        reason:
          'Some contexts emit a trusted CSS recipe and others a typed value; the DTCG value is exported, the recipe is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'sets/semantic.tokens.json', path: 'terminal.ansi-bright-cyan' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'terminal.ansi-bright-cyan',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'inherited',
              declaredAt: { document: 'sets/semantic.tokens.json', path: 'terminal' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'terminal.ansi-bright-cyan' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'terminal.ansi-bright-cyan',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'terminal.ansi-bright-cyan',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: {
                document: 'themes/dark.tokens.json',
                path: 'terminal.ansi-bright-cyan',
              },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'terminal.ansi-bright-white',
      cssProperty: '--cinder-terminal-ansi-bright-white',
      category: 'color',
      component: null,
      description: 'unknown',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'unknown', role: 'unknown', anchor: 'unknown' },
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'mixed',
        reason:
          'Some contexts emit a trusted CSS recipe and others a typed value; the DTCG value is exported, the recipe is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'sets/semantic.tokens.json', path: 'terminal.ansi-bright-white' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'terminal.ansi-bright-white',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'inherited',
              declaredAt: { document: 'sets/semantic.tokens.json', path: 'terminal' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'terminal.ansi-bright-white' },
            layers: [
              {
                document: 'sets/semantic.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'terminal.ansi-bright-white',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'terminal.ansi-bright-white',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: {
                document: 'themes/dark.tokens.json',
                path: 'terminal.ansi-bright-white',
              },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'checker.base',
      cssProperty: '--cinder-checker-base',
      category: 'color',
      component: null,
      description:
        'Transparency checkerboard base tile, shared by color-domain components. Light mode preserves the historical white/gray grid; dark mode keeps the pattern visible without flashing a white backing inside dark chrome.',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'unknown', role: 'unknown', anchor: 'unknown' },
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'mixed',
        reason:
          'Some contexts emit a trusted CSS recipe and others a typed value; the DTCG value is exported, the recipe is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/light.tokens.json', path: 'checker.base' },
            layers: [
              {
                document: 'sets/colors.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'checker.base',
                via: 'declared',
              },
              {
                document: 'themes/light.tokens.json',
                kind: 'modifier',
                layer: 'theme.light',
                path: 'checker.base',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: { document: 'themes/light.tokens.json', path: 'checker.base' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'checker.base' },
            layers: [
              {
                document: 'sets/colors.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'checker.base',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'checker.base',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: { document: 'themes/dark.tokens.json', path: 'checker.base' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'checker.tile',
      cssProperty: '--cinder-checker-tile',
      category: 'color',
      component: null,
      description: 'Transparency checkerboard alternate tile.',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'unknown', role: 'unknown', anchor: 'unknown' },
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'mixed',
        reason:
          'Some contexts emit a trusted CSS recipe and others a typed value; the DTCG value is exported, the recipe is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/light.tokens.json', path: 'checker.tile' },
            layers: [
              {
                document: 'sets/colors.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'checker.tile',
                via: 'declared',
              },
              {
                document: 'themes/light.tokens.json',
                kind: 'modifier',
                layer: 'theme.light',
                path: 'checker.tile',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: { document: 'themes/light.tokens.json', path: 'checker.tile' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'checker.tile' },
            layers: [
              {
                document: 'sets/colors.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'checker.tile',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'checker.tile',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: { document: 'themes/dark.tokens.json', path: 'checker.tile' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'button.background',
      cssProperty: '--cinder-button-background',
      category: 'color',
      component: 'button',
      description: 'Secondary (default) button fill.',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'unknown', role: 'unknown', anchor: 'unknown' },
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/light.tokens.json', path: 'button.background' },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'button.background',
                via: 'declared',
              },
              {
                document: 'themes/light.tokens.json',
                kind: 'modifier',
                layer: 'theme.light',
                path: 'button.background',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: { document: 'themes/light.tokens.json', path: 'button.background' },
            },
            inputs: { aliases: ['surface.raised'], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'button.background' },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'button.background',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'button.background',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: { document: 'themes/dark.tokens.json', path: 'button.background' },
            },
            inputs: { aliases: ['surface.raised'], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'button.foreground',
      cssProperty: '--cinder-button-foreground',
      category: 'color',
      component: 'button',
      description: 'Secondary (default) button label color.',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'unknown', role: 'unknown', anchor: 'unknown' },
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/light.tokens.json', path: 'button.foreground' },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'button.foreground',
                via: 'declared',
              },
              {
                document: 'themes/light.tokens.json',
                kind: 'modifier',
                layer: 'theme.light',
                path: 'button.foreground',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: { document: 'themes/light.tokens.json', path: 'button.foreground' },
            },
            inputs: { aliases: ['text.default'], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'button.foreground' },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'button.foreground',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'button.foreground',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: { document: 'themes/dark.tokens.json', path: 'button.foreground' },
            },
            inputs: { aliases: ['text.default'], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'button.border',
      cssProperty: '--cinder-button-border',
      category: 'color',
      component: 'button',
      description: 'Secondary (default) button border.',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'unknown', role: 'unknown', anchor: 'unknown' },
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'mixed',
        reason:
          'Some contexts emit a trusted CSS recipe and others a typed value; the DTCG value is exported, the recipe is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/light.tokens.json', path: 'button.border' },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'button.border',
                via: 'declared',
              },
              {
                document: 'themes/light.tokens.json',
                kind: 'modifier',
                layer: 'theme.light',
                path: 'button.border',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: { document: 'themes/light.tokens.json', path: 'button.border' },
            },
            inputs: { aliases: ['border.control'], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'button.border' },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'button.border',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'button.border',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: { document: 'themes/dark.tokens.json', path: 'button.border' },
            },
            inputs: { aliases: ['border.strong'], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'button.radius',
      cssProperty: '--cinder-button-radius',
      category: 'radius',
      component: 'button',
      description: 'Default button corner radius.',
      themeAware: false,
      deprecated: false,
      profile: 'radius',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/components.tokens.json', path: 'button.radius' },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'button.radius',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'inherited',
              declaredAt: { document: 'sets/components.tokens.json', path: 'button.radius' },
            },
            inputs: { aliases: ['radius.medium'], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'button.radius.xs',
      cssProperty: '--cinder-button-radius-xs',
      category: 'radius',
      component: 'button',
      description: 'Extra-small button corner radius.',
      themeAware: false,
      deprecated: false,
      profile: 'radius',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/components.tokens.json', path: 'button.radius.xs' },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'button.radius.xs',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'inherited',
              declaredAt: { document: 'sets/components.tokens.json', path: 'button.radius' },
            },
            inputs: { aliases: ['radius.small'], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'button.radius.sm',
      cssProperty: '--cinder-button-radius-sm',
      category: 'radius',
      component: 'button',
      description: 'Small button corner radius.',
      themeAware: false,
      deprecated: false,
      profile: 'radius',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/components.tokens.json', path: 'button.radius.sm' },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'button.radius.sm',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'inherited',
              declaredAt: { document: 'sets/components.tokens.json', path: 'button.radius' },
            },
            inputs: { aliases: ['radius.small'], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'button.radius.md',
      cssProperty: '--cinder-button-radius-md',
      category: 'radius',
      component: 'button',
      description: 'Medium button corner radius.',
      themeAware: false,
      deprecated: false,
      profile: 'radius',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/components.tokens.json', path: 'button.radius.md' },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'button.radius.md',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'inherited',
              declaredAt: { document: 'sets/components.tokens.json', path: 'button.radius' },
            },
            inputs: { aliases: ['radius.medium'], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'button.radius.lg',
      cssProperty: '--cinder-button-radius-lg',
      category: 'radius',
      component: 'button',
      description: 'Large button corner radius.',
      themeAware: false,
      deprecated: false,
      profile: 'radius',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/components.tokens.json', path: 'button.radius.lg' },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'button.radius.lg',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'inherited',
              declaredAt: { document: 'sets/components.tokens.json', path: 'button.radius' },
            },
            inputs: { aliases: ['radius.medium'], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'button.radius.xl',
      cssProperty: '--cinder-button-radius-xl',
      category: 'radius',
      component: 'button',
      description: 'Extra-large button corner radius.',
      themeAware: false,
      deprecated: false,
      profile: 'radius',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/components.tokens.json', path: 'button.radius.xl' },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'button.radius.xl',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'inherited',
              declaredAt: { document: 'sets/components.tokens.json', path: 'button.radius' },
            },
            inputs: { aliases: ['radius.medium'], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'button.height.xs',
      cssProperty: '--cinder-button-height-xs',
      category: 'size',
      component: 'button',
      description: 'Extra-small button height (24px), aliasing the shared control-height tier.',
      themeAware: false,
      deprecated: false,
      profile: 'height',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/components.tokens.json', path: 'button.height.xs' },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'button.height.xs',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'inherited',
              declaredAt: { document: 'sets/components.tokens.json', path: 'button.height' },
            },
            inputs: { aliases: ['control.height.xs'], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'button.height.sm',
      cssProperty: '--cinder-button-height-sm',
      category: 'size',
      component: 'button',
      description: 'Small button height (28px).',
      themeAware: false,
      deprecated: false,
      profile: 'height',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/components.tokens.json', path: 'button.height.sm' },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'button.height.sm',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'inherited',
              declaredAt: { document: 'sets/components.tokens.json', path: 'button.height' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'button.height.md',
      cssProperty: '--cinder-button-height-md',
      category: 'size',
      component: 'button',
      description: 'Medium button height (32px).',
      themeAware: false,
      deprecated: false,
      profile: 'height',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/components.tokens.json', path: 'button.height.md' },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'button.height.md',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'inherited',
              declaredAt: { document: 'sets/components.tokens.json', path: 'button.height' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'button.height.lg',
      cssProperty: '--cinder-button-height-lg',
      category: 'size',
      component: 'button',
      description: 'Large button height (36px).',
      themeAware: false,
      deprecated: false,
      profile: 'height',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/components.tokens.json', path: 'button.height.lg' },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'button.height.lg',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'inherited',
              declaredAt: { document: 'sets/components.tokens.json', path: 'button.height' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'button.height.xl',
      cssProperty: '--cinder-button-height-xl',
      category: 'size',
      component: 'button',
      description: 'Extra-large button height (40px).',
      themeAware: false,
      deprecated: false,
      profile: 'height',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/components.tokens.json', path: 'button.height.xl' },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'button.height.xl',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'inherited',
              declaredAt: { document: 'sets/components.tokens.json', path: 'button.height' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'button.padding.x.xs',
      cssProperty: '--cinder-button-padding-x-xs',
      category: 'spacing',
      component: 'button',
      description: 'Extra-small button horizontal padding.',
      themeAware: false,
      deprecated: false,
      profile: 'padding',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/components.tokens.json', path: 'button.padding.x.xs' },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'button.padding.x.xs',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'inherited',
              declaredAt: { document: 'sets/components.tokens.json', path: 'button.padding' },
            },
            inputs: { aliases: ['space.1-5'], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'button.padding.x.sm',
      cssProperty: '--cinder-button-padding-x-sm',
      category: 'spacing',
      component: 'button',
      description: 'Small button horizontal padding.',
      themeAware: false,
      deprecated: false,
      profile: 'padding',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/components.tokens.json', path: 'button.padding.x.sm' },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'button.padding.x.sm',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'inherited',
              declaredAt: { document: 'sets/components.tokens.json', path: 'button.padding' },
            },
            inputs: { aliases: ['space.2'], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'button.padding.x.md',
      cssProperty: '--cinder-button-padding-x-md',
      category: 'spacing',
      component: 'button',
      description: 'Medium button horizontal padding.',
      themeAware: false,
      deprecated: false,
      profile: 'padding',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/components.tokens.json', path: 'button.padding.x.md' },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'button.padding.x.md',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'inherited',
              declaredAt: { document: 'sets/components.tokens.json', path: 'button.padding' },
            },
            inputs: { aliases: ['space.2-5'], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'button.padding.x.lg',
      cssProperty: '--cinder-button-padding-x-lg',
      category: 'spacing',
      component: 'button',
      description: 'Large button horizontal padding.',
      themeAware: false,
      deprecated: false,
      profile: 'padding',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/components.tokens.json', path: 'button.padding.x.lg' },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'button.padding.x.lg',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'inherited',
              declaredAt: { document: 'sets/components.tokens.json', path: 'button.padding' },
            },
            inputs: { aliases: ['space.3'], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'button.padding.x.xl',
      cssProperty: '--cinder-button-padding-x-xl',
      category: 'spacing',
      component: 'button',
      description: 'Extra-large button horizontal padding.',
      themeAware: false,
      deprecated: false,
      profile: 'padding',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/components.tokens.json', path: 'button.padding.x.xl' },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'button.padding.x.xl',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'inherited',
              declaredAt: { document: 'sets/components.tokens.json', path: 'button.padding' },
            },
            inputs: { aliases: ['space.3-5'], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'button.padding.y.xs',
      cssProperty: '--cinder-button-padding-y-xs',
      category: 'spacing',
      component: 'button',
      description: 'Extra-small button vertical padding.',
      themeAware: false,
      deprecated: false,
      profile: 'padding',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/components.tokens.json', path: 'button.padding.y.xs' },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'button.padding.y.xs',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'inherited',
              declaredAt: { document: 'sets/components.tokens.json', path: 'button.padding' },
            },
            inputs: { aliases: ['space.0-5'], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'button.padding.y.sm',
      cssProperty: '--cinder-button-padding-y-sm',
      category: 'spacing',
      component: 'button',
      description: 'Small button vertical padding.',
      themeAware: false,
      deprecated: false,
      profile: 'padding',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/components.tokens.json', path: 'button.padding.y.sm' },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'button.padding.y.sm',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'inherited',
              declaredAt: { document: 'sets/components.tokens.json', path: 'button.padding' },
            },
            inputs: { aliases: ['space.one'], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'button.padding.y.md',
      cssProperty: '--cinder-button-padding-y-md',
      category: 'spacing',
      component: 'button',
      description: 'Medium button vertical padding.',
      themeAware: false,
      deprecated: false,
      profile: 'padding',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/components.tokens.json', path: 'button.padding.y.md' },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'button.padding.y.md',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'inherited',
              declaredAt: { document: 'sets/components.tokens.json', path: 'button.padding' },
            },
            inputs: { aliases: ['space.1-5'], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'button.padding.y.lg',
      cssProperty: '--cinder-button-padding-y-lg',
      category: 'spacing',
      component: 'button',
      description: 'Large button vertical padding.',
      themeAware: false,
      deprecated: false,
      profile: 'padding',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/components.tokens.json', path: 'button.padding.y.lg' },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'button.padding.y.lg',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'inherited',
              declaredAt: { document: 'sets/components.tokens.json', path: 'button.padding' },
            },
            inputs: { aliases: ['space.2'], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'button.padding.y.xl',
      cssProperty: '--cinder-button-padding-y-xl',
      category: 'spacing',
      component: 'button',
      description: 'Extra-large button vertical padding.',
      themeAware: false,
      deprecated: false,
      profile: 'padding',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/components.tokens.json', path: 'button.padding.y.xl' },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'button.padding.y.xl',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'inherited',
              declaredAt: { document: 'sets/components.tokens.json', path: 'button.padding' },
            },
            inputs: { aliases: ['space.2-5'], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'button.font.size.xs',
      cssProperty: '--cinder-button-font-size-xs',
      category: 'typography',
      component: 'button',
      description: 'Extra-small button label font size.',
      themeAware: false,
      deprecated: false,
      profile: 'font-size',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/components.tokens.json', path: 'button.font.size.xs' },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'button.font.size.xs',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'inherited',
              declaredAt: { document: 'sets/components.tokens.json', path: 'button.font.size' },
            },
            inputs: { aliases: ['font.size.xs'], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'button.font.size.sm',
      cssProperty: '--cinder-button-font-size-sm',
      category: 'typography',
      component: 'button',
      description: 'Small button label font size.',
      themeAware: false,
      deprecated: false,
      profile: 'font-size',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/components.tokens.json', path: 'button.font.size.sm' },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'button.font.size.sm',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'inherited',
              declaredAt: { document: 'sets/components.tokens.json', path: 'button.font.size' },
            },
            inputs: { aliases: ['font.size.sm'], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'button.font.size.md',
      cssProperty: '--cinder-button-font-size-md',
      category: 'typography',
      component: 'button',
      description: 'Medium button label font size.',
      themeAware: false,
      deprecated: false,
      profile: 'font-size',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/components.tokens.json', path: 'button.font.size.md' },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'button.font.size.md',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'inherited',
              declaredAt: { document: 'sets/components.tokens.json', path: 'button.font.size' },
            },
            inputs: { aliases: ['font.size.sm'], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'button.font.size.lg',
      cssProperty: '--cinder-button-font-size-lg',
      category: 'typography',
      component: 'button',
      description: 'Large button label font size.',
      themeAware: false,
      deprecated: false,
      profile: 'font-size',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/components.tokens.json', path: 'button.font.size.lg' },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'button.font.size.lg',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'inherited',
              declaredAt: { document: 'sets/components.tokens.json', path: 'button.font.size' },
            },
            inputs: { aliases: ['font.size.md'], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'button.font.size.xl',
      cssProperty: '--cinder-button-font-size-xl',
      category: 'typography',
      component: 'button',
      description: 'Extra-large button label font size.',
      themeAware: false,
      deprecated: false,
      profile: 'font-size',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/components.tokens.json', path: 'button.font.size.xl' },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'button.font.size.xl',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'inherited',
              declaredAt: { document: 'sets/components.tokens.json', path: 'button.font.size' },
            },
            inputs: { aliases: ['font.size.lg'], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'toggle.track.off-resting',
      cssProperty: '--cinder-toggle-track-off-resting',
      category: 'color',
      component: 'toggle',
      description:
        'Toggle track color in the off, resting state. Light arm preserves the `border.muted` look; dark arm raises lightness for >=3:1 shape contrast against the surface.',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'unknown', role: 'unknown', anchor: 'unknown' },
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'mixed',
        reason:
          'Some contexts emit a trusted CSS recipe and others a typed value; the DTCG value is exported, the recipe is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/light.tokens.json', path: 'toggle.track.off-resting' },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'toggle.track.off-resting',
                via: 'declared',
              },
              {
                document: 'themes/light.tokens.json',
                kind: 'modifier',
                layer: 'theme.light',
                path: 'toggle.track.off-resting',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'inherited',
              declaredAt: { document: 'themes/light.tokens.json', path: 'toggle' },
            },
            inputs: { aliases: ['border.muted'], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'toggle.track.off-resting' },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'toggle.track.off-resting',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'toggle.track.off-resting',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'inherited',
              declaredAt: { document: 'themes/dark.tokens.json', path: 'toggle' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'toggle.track.off-hover-resting',
      cssProperty: '--cinder-toggle-track-off-hover-resting',
      category: 'color',
      component: 'toggle',
      description:
        'Toggle track color in the off state on hover. Steps up from `off-resting` to be distinguishable.',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'unknown', role: 'unknown', anchor: 'unknown' },
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'mixed',
        reason:
          'Some contexts emit a trusted CSS recipe and others a typed value; the DTCG value is exported, the recipe is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: {
              document: 'themes/light.tokens.json',
              path: 'toggle.track.off-hover-resting',
            },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'toggle.track.off-hover-resting',
                via: 'declared',
              },
              {
                document: 'themes/light.tokens.json',
                kind: 'modifier',
                layer: 'theme.light',
                path: 'toggle.track.off-hover-resting',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'inherited',
              declaredAt: { document: 'themes/light.tokens.json', path: 'toggle' },
            },
            inputs: { aliases: ['border.control'], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'toggle.track.off-hover-resting' },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'toggle.track.off-hover-resting',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'toggle.track.off-hover-resting',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'inherited',
              declaredAt: { document: 'themes/dark.tokens.json', path: 'toggle' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'accordion-item.trigger.gap',
      cssProperty: '--cinder-accordion-item-trigger-gap',
      category: 'spacing',
      component: 'accordion-item',
      description: "Gap between the trigger's disclosure icon and label.",
      themeAware: false,
      deprecated: false,
      profile: 'gap',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/components.tokens.json', path: 'accordion-item.trigger.gap' },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'accordion-item.trigger.gap',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'local',
              declaredAt: {
                document: 'sets/components.tokens.json',
                path: 'accordion-item.trigger.gap',
              },
            },
            inputs: { aliases: ['space.4'], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'accordion-item.trigger.padding-block',
      cssProperty: '--cinder-accordion-item-trigger-padding-block',
      category: 'spacing',
      component: 'accordion-item',
      description: 'Trigger block padding.',
      themeAware: false,
      deprecated: false,
      profile: 'padding',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: {
              document: 'sets/components.tokens.json',
              path: 'accordion-item.trigger.padding-block',
            },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'accordion-item.trigger.padding-block',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'local',
              declaredAt: {
                document: 'sets/components.tokens.json',
                path: 'accordion-item.trigger.padding-block',
              },
            },
            inputs: { aliases: ['space.4'], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'accordion-item.trigger.padding-inline',
      cssProperty: '--cinder-accordion-item-trigger-padding-inline',
      category: 'spacing',
      component: 'accordion-item',
      description: 'Trigger inline padding.',
      themeAware: false,
      deprecated: false,
      profile: 'padding',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: {
              document: 'sets/components.tokens.json',
              path: 'accordion-item.trigger.padding-inline',
            },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'accordion-item.trigger.padding-inline',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'local',
              declaredAt: {
                document: 'sets/components.tokens.json',
                path: 'accordion-item.trigger.padding-inline',
              },
            },
            inputs: { aliases: ['space.5'], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'accordion-item.trigger.font-size',
      cssProperty: '--cinder-accordion-item-trigger-font-size',
      category: 'typography',
      component: 'accordion-item',
      description: 'Trigger label font size.',
      themeAware: false,
      deprecated: false,
      profile: 'font-size',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: {
              document: 'sets/components.tokens.json',
              path: 'accordion-item.trigger.font-size',
            },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'accordion-item.trigger.font-size',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'local',
              declaredAt: {
                document: 'sets/components.tokens.json',
                path: 'accordion-item.trigger.font-size',
              },
            },
            inputs: { aliases: ['font.size.base'], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'accordion-item.trigger.font-weight',
      cssProperty: '--cinder-accordion-item-trigger-font-weight',
      category: 'typography',
      component: 'accordion-item',
      description: 'Trigger label font weight.',
      themeAware: false,
      deprecated: false,
      profile: 'font-weight',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: {
              document: 'sets/components.tokens.json',
              path: 'accordion-item.trigger.font-weight',
            },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'accordion-item.trigger.font-weight',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'fontWeight',
              origin: 'local',
              declaredAt: {
                document: 'sets/components.tokens.json',
                path: 'accordion-item.trigger.font-weight',
              },
            },
            inputs: { aliases: ['font.semibold'], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'accordion-item.panel.inner-padding-block-start',
      cssProperty: '--cinder-accordion-item-panel-inner-padding-block-start',
      category: 'spacing',
      component: 'accordion-item',
      description: 'Panel content padding, block-start edge.',
      themeAware: false,
      deprecated: false,
      profile: 'padding',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: {
              document: 'sets/components.tokens.json',
              path: 'accordion-item.panel.inner-padding-block-start',
            },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'accordion-item.panel.inner-padding-block-start',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'local',
              declaredAt: {
                document: 'sets/components.tokens.json',
                path: 'accordion-item.panel.inner-padding-block-start',
              },
            },
            inputs: { aliases: ['space.4'], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'accordion-item.panel.inner-padding-block-end',
      cssProperty: '--cinder-accordion-item-panel-inner-padding-block-end',
      category: 'spacing',
      component: 'accordion-item',
      description: 'Panel content padding, block-end edge.',
      themeAware: false,
      deprecated: false,
      profile: 'padding',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: {
              document: 'sets/components.tokens.json',
              path: 'accordion-item.panel.inner-padding-block-end',
            },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'accordion-item.panel.inner-padding-block-end',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'local',
              declaredAt: {
                document: 'sets/components.tokens.json',
                path: 'accordion-item.panel.inner-padding-block-end',
              },
            },
            inputs: { aliases: ['space.5'], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'accordion-item.panel.inner-padding-inline',
      cssProperty: '--cinder-accordion-item-panel-inner-padding-inline',
      category: 'spacing',
      component: 'accordion-item',
      description: 'Panel content inline padding.',
      themeAware: false,
      deprecated: false,
      profile: 'padding',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: {
              document: 'sets/components.tokens.json',
              path: 'accordion-item.panel.inner-padding-inline',
            },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'accordion-item.panel.inner-padding-inline',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'local',
              declaredAt: {
                document: 'sets/components.tokens.json',
                path: 'accordion-item.panel.inner-padding-inline',
              },
            },
            inputs: { aliases: ['space.5'], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'accordion-item.panel.font-size',
      cssProperty: '--cinder-accordion-item-panel-font-size',
      category: 'typography',
      component: 'accordion-item',
      description: 'Panel content font size.',
      themeAware: false,
      deprecated: false,
      profile: 'font-size',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: {
              document: 'sets/components.tokens.json',
              path: 'accordion-item.panel.font-size',
            },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'accordion-item.panel.font-size',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'local',
              declaredAt: {
                document: 'sets/components.tokens.json',
                path: 'accordion-item.panel.font-size',
              },
            },
            inputs: { aliases: ['font.size.base'], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'accordion-item.panel.line-height',
      cssProperty: '--cinder-accordion-item-panel-line-height',
      category: 'typography',
      component: 'accordion-item',
      description: 'Panel content line height.',
      themeAware: false,
      deprecated: false,
      profile: 'line-height',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: {
              document: 'sets/components.tokens.json',
              path: 'accordion-item.panel.line-height',
            },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'accordion-item.panel.line-height',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'number',
              origin: 'local',
              declaredAt: {
                document: 'sets/components.tokens.json',
                path: 'accordion-item.panel.line-height',
              },
            },
            inputs: { aliases: ['leading.normal'], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'action-row.padding-block',
      cssProperty: '--cinder-action-row-padding-block',
      category: 'spacing',
      component: 'action-row',
      description: 'Row block padding (default density).',
      themeAware: false,
      deprecated: false,
      profile: 'padding',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/components.tokens.json', path: 'action-row.padding-block' },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'action-row.padding-block',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'local',
              declaredAt: {
                document: 'sets/components.tokens.json',
                path: 'action-row.padding-block',
              },
            },
            inputs: { aliases: ['space.3'], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'action-row.padding-inline',
      cssProperty: '--cinder-action-row-padding-inline',
      category: 'spacing',
      component: 'action-row',
      description: 'Row inline padding (default density).',
      themeAware: false,
      deprecated: false,
      profile: 'padding',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/components.tokens.json', path: 'action-row.padding-inline' },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'action-row.padding-inline',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'local',
              declaredAt: {
                document: 'sets/components.tokens.json',
                path: 'action-row.padding-inline',
              },
            },
            inputs: { aliases: ['space.4'], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'action-row.layout.column-gap',
      cssProperty: '--cinder-action-row-layout-column-gap',
      category: 'spacing',
      component: 'action-row',
      description: 'Grid column gap between leading/body/trailing regions.',
      themeAware: false,
      deprecated: false,
      profile: 'gap',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: {
              document: 'sets/components.tokens.json',
              path: 'action-row.layout.column-gap',
            },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'action-row.layout.column-gap',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'local',
              declaredAt: {
                document: 'sets/components.tokens.json',
                path: 'action-row.layout.column-gap',
              },
            },
            inputs: { aliases: ['space.3'], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'action-row.layout.row-gap',
      cssProperty: '--cinder-action-row-layout-row-gap',
      category: 'spacing',
      component: 'action-row',
      description: 'Grid row gap between leading/body/trailing regions.',
      themeAware: false,
      deprecated: false,
      profile: 'gap',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/components.tokens.json', path: 'action-row.layout.row-gap' },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'action-row.layout.row-gap',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'local',
              declaredAt: {
                document: 'sets/components.tokens.json',
                path: 'action-row.layout.row-gap',
              },
            },
            inputs: { aliases: ['space.2'], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'action-row.body-gap',
      cssProperty: '--cinder-action-row-body-gap',
      category: 'spacing',
      component: 'action-row',
      description: 'Gap between title, description, and meta lines.',
      themeAware: false,
      deprecated: false,
      profile: 'gap',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/components.tokens.json', path: 'action-row.body-gap' },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'action-row.body-gap',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'local',
              declaredAt: { document: 'sets/components.tokens.json', path: 'action-row.body-gap' },
            },
            inputs: { aliases: ['space.one'], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'action-row.title-font-size',
      cssProperty: '--cinder-action-row-title-font-size',
      category: 'typography',
      component: 'action-row',
      description: 'Title font size.',
      themeAware: false,
      deprecated: false,
      profile: 'font-size',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/components.tokens.json', path: 'action-row.title-font-size' },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'action-row.title-font-size',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'local',
              declaredAt: {
                document: 'sets/components.tokens.json',
                path: 'action-row.title-font-size',
              },
            },
            inputs: { aliases: ['font.size.sm'], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'action-row.description-font-size',
      cssProperty: '--cinder-action-row-description-font-size',
      category: 'typography',
      component: 'action-row',
      description: 'Description font size.',
      themeAware: false,
      deprecated: false,
      profile: 'font-size',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: {
              document: 'sets/components.tokens.json',
              path: 'action-row.description-font-size',
            },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'action-row.description-font-size',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'local',
              declaredAt: {
                document: 'sets/components.tokens.json',
                path: 'action-row.description-font-size',
              },
            },
            inputs: { aliases: ['font.size.sm'], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'action-row.meta-font-size',
      cssProperty: '--cinder-action-row-meta-font-size',
      category: 'typography',
      component: 'action-row',
      description: 'Meta line font size.',
      themeAware: false,
      deprecated: false,
      profile: 'font-size',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/components.tokens.json', path: 'action-row.meta-font-size' },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'action-row.meta-font-size',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'local',
              declaredAt: {
                document: 'sets/components.tokens.json',
                path: 'action-row.meta-font-size',
              },
            },
            inputs: { aliases: ['font.size.xs'], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'action-row.trailing-gap',
      cssProperty: '--cinder-action-row-trailing-gap',
      category: 'spacing',
      component: 'action-row',
      description: 'Gap between items in the trailing region.',
      themeAware: false,
      deprecated: false,
      profile: 'gap',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/components.tokens.json', path: 'action-row.trailing-gap' },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'action-row.trailing-gap',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'local',
              declaredAt: {
                document: 'sets/components.tokens.json',
                path: 'action-row.trailing-gap',
              },
            },
            inputs: { aliases: ['space.2'], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'alert.info',
      cssProperty: '--cinder-alert-info',
      category: 'color',
      component: 'alert',
      description:
        'Alert `info` tone ring/status-base color, single-consumer (alert.css); encodes the light/dark pair directly here so alert.css stays var()-only.',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'unknown', role: 'unknown', anchor: 'unknown' },
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'mixed',
        reason:
          'Some contexts emit a trusted CSS recipe and others a typed value; the DTCG value is exported, the recipe is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/light.tokens.json', path: 'alert.info' },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'alert.info',
                via: 'declared',
              },
              {
                document: 'themes/light.tokens.json',
                kind: 'modifier',
                layer: 'theme.light',
                path: 'alert.info',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: { document: 'themes/light.tokens.json', path: 'alert.info' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'alert.info' },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'alert.info',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'alert.info',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: { document: 'themes/dark.tokens.json', path: 'alert.info' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'avatar-group.overlap',
      cssProperty: '--cinder-avatar-group-overlap',
      category: 'spacing',
      component: 'avatar-group',
      description: 'Horizontal overlap between stacked avatars.',
      themeAware: false,
      deprecated: false,
      profile: 'margin',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/components.tokens.json', path: 'avatar-group.overlap' },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'avatar-group.overlap',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'local',
              declaredAt: { document: 'sets/components.tokens.json', path: 'avatar-group.overlap' },
            },
            inputs: { aliases: ['space.3'], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'card.mobile-bleed',
      cssProperty: '--cinder-card-mobile-bleed',
      category: 'spacing',
      component: 'card',
      description:
        "Horizontal bleed a card's mobile layout extends past its container on each side.",
      themeAware: false,
      deprecated: false,
      profile: 'margin',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/components.tokens.json', path: 'card.mobile-bleed' },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'card.mobile-bleed',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'local',
              declaredAt: { document: 'sets/components.tokens.json', path: 'card.mobile-bleed' },
            },
            inputs: { aliases: ['space.4'], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'carousel.slide-size',
      cssProperty: '--cinder-carousel-slide-size',
      category: 'layout',
      component: 'carousel',
      description:
        'Slide inline-size as a percentage of the viewport. `$value` (100) is the percentage number, not a dimension -- CSS `100%` has no DTCG dimension representation. Excluded from the published resolved-context JSON (`nonRepresentableValue`) so a generic consumer does not apply a bare unitless `100` as a CSS length.',
      themeAware: false,
      deprecated: false,
      profile: 'width',
      disposition: {
        edit: 'css-only',
        cssExport: 'supported',
        dtcgExport: 'none',
        cssSerialization: 'trusted-recipe',
        cssValue: '100%',
        reason:
          'The real CSS value has no faithful DTCG representation; the token is excluded from resolved contexts and portable export.',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/components.tokens.json', path: 'carousel.slide-size' },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'carousel.slide-size',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'number',
              origin: 'local',
              declaredAt: { document: 'sets/components.tokens.json', path: 'carousel.slide-size' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'carousel.gap',
      cssProperty: '--cinder-carousel-gap',
      category: 'spacing',
      component: 'carousel',
      description: 'Gap between slides.',
      themeAware: false,
      deprecated: false,
      profile: 'gap',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/components.tokens.json', path: 'carousel.gap' },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'carousel.gap',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'local',
              declaredAt: { document: 'sets/components.tokens.json', path: 'carousel.gap' },
            },
            inputs: { aliases: ['space.3'], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'carousel.aspect-ratio',
      cssProperty: '--cinder-carousel-aspect-ratio',
      category: 'layout',
      component: 'carousel',
      description:
        'Slide aspect ratio (16:9). `$value` is the ratio as a number (16/9); `cssRecipe` emits the exact `16 / 9` CSS `aspect-ratio` syntax. Excluded from the published resolved-context JSON (`nonRepresentableValue`) so a generic consumer does not apply the bare ratio number as a CSS `aspect-ratio` value.',
      themeAware: false,
      deprecated: false,
      profile: 'aspect-ratio',
      disposition: {
        edit: 'css-only',
        cssExport: 'supported',
        dtcgExport: 'none',
        cssSerialization: 'trusted-recipe',
        cssValue: '16 / 9',
        reason:
          'The real CSS value has no faithful DTCG representation; the token is excluded from resolved contexts and portable export.',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/components.tokens.json', path: 'carousel.aspect-ratio' },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'carousel.aspect-ratio',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'number',
              origin: 'local',
              declaredAt: {
                document: 'sets/components.tokens.json',
                path: 'carousel.aspect-ratio',
              },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'carousel.dot-size',
      cssProperty: '--cinder-carousel-dot-size',
      category: 'size',
      component: 'carousel',
      description: 'Pagination dot hit-target size.',
      themeAware: false,
      deprecated: false,
      profile: 'size',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/components.tokens.json', path: 'carousel.dot-size' },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'carousel.dot-size',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'local',
              declaredAt: { document: 'sets/components.tokens.json', path: 'carousel.dot-size' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'code-block.background',
      cssProperty: '--cinder-code-block-background',
      category: 'color',
      component: 'code-block',
      description:
        "Code surface background. Light arm MUST stay pure `surface-raised` (not `surface-inset`) -- Shiki's github-light token colors measure their AA contrast against that surface with almost no margin; darkening it fails the axe sweep. See code-block.css for the full rationale. Dark arm uses `surface-inset` for the deeper github-dark ground.",
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'unknown', role: 'unknown', anchor: 'unknown' },
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'mixed',
        reason:
          'Some contexts emit a trusted CSS recipe and others a typed value; the DTCG value is exported, the recipe is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: { document: 'sets/components.tokens.json', path: 'code-block.background' },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'code-block.background',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: {
                document: 'sets/components.tokens.json',
                path: 'code-block.background',
              },
            },
            inputs: {
              aliases: ['surface.raised'],
              refs: [],
              extends: [],
              recipes: [
                { cssProperty: '--cinder-surface-raised', path: 'surface.raised' },
                { cssProperty: '--cinder-surface-inset', path: 'surface.inset' },
              ],
            },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'code-block.background' },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'code-block.background',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'code-block.background',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: { document: 'themes/dark.tokens.json', path: 'code-block.background' },
            },
            inputs: { aliases: ['surface.inset'], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'code-block.font-size',
      cssProperty: '--cinder-code-block-font-size',
      category: 'typography',
      component: 'code-block',
      description: 'Code text font size.',
      themeAware: false,
      deprecated: false,
      profile: 'font-size',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/components.tokens.json', path: 'code-block.font-size' },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'code-block.font-size',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'local',
              declaredAt: { document: 'sets/components.tokens.json', path: 'code-block.font-size' },
            },
            inputs: { aliases: ['font.size.sm'], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'code-block.height',
      cssProperty: '--cinder-code-block-height',
      category: 'size',
      component: 'code-block',
      description:
        "Block height. Real value is CSS `auto` (intrinsic content height); DTCG's dimension type has no keyword form, so `$value` is a non-authoritative placeholder and `cssRecipe` governs emission. Flagged in the CIN-472 PR body as a type-system limitation, not a design decision. Excluded from the published resolved-context JSON (`nonRepresentableValue`) so a generic consumer applying `$value` literally does not collapse the block to zero height.",
      themeAware: false,
      deprecated: false,
      profile: 'height',
      disposition: {
        edit: 'css-only',
        cssExport: 'supported',
        dtcgExport: 'none',
        cssSerialization: 'trusted-recipe',
        cssValue: 'auto',
        reason:
          'The real CSS value has no faithful DTCG representation; the token is excluded from resolved contexts and portable export.',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/components.tokens.json', path: 'code-block.height' },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'code-block.height',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'local',
              declaredAt: { document: 'sets/components.tokens.json', path: 'code-block.height' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'code-block.line-height',
      cssProperty: '--cinder-code-block-line-height',
      category: 'typography',
      component: 'code-block',
      description: 'Code text line height.',
      themeAware: false,
      deprecated: false,
      profile: 'line-height',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/components.tokens.json', path: 'code-block.line-height' },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'code-block.line-height',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'number',
              origin: 'local',
              declaredAt: {
                document: 'sets/components.tokens.json',
                path: 'code-block.line-height',
              },
            },
            inputs: { aliases: ['leading.relaxed'], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'code-block.padding',
      cssProperty: '--cinder-code-block-padding',
      category: 'spacing',
      component: 'code-block',
      description: 'Code viewport padding.',
      themeAware: false,
      deprecated: false,
      profile: 'padding',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/components.tokens.json', path: 'code-block.padding' },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'code-block.padding',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'local',
              declaredAt: { document: 'sets/components.tokens.json', path: 'code-block.padding' },
            },
            inputs: { aliases: ['space.4'], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'data-table.height',
      cssProperty: '--cinder-data-table-height',
      category: 'size',
      component: 'data-table',
      description: 'Default scroll-viewport height.',
      themeAware: false,
      deprecated: false,
      profile: 'height',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/components.tokens.json', path: 'data-table.height' },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'data-table.height',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'local',
              declaredAt: { document: 'sets/components.tokens.json', path: 'data-table.height' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'feed-event.rail-size',
      cssProperty: '--cinder-feed-event-rail-size',
      category: 'size',
      component: 'feed-event',
      description: 'Rail marker box size (width and height).',
      themeAware: false,
      deprecated: false,
      profile: 'size',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/components.tokens.json', path: 'feed-event.rail-size' },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'feed-event.rail-size',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'local',
              declaredAt: { document: 'sets/components.tokens.json', path: 'feed-event.rail-size' },
            },
            inputs: { aliases: ['space.6'], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'file-upload.background',
      cssProperty: '--cinder-file-upload-background',
      category: 'color',
      component: 'file-upload',
      description: 'Dropzone background.',
      themeAware: false,
      deprecated: false,
      profile: 'color',
      palette: { family: 'unknown', role: 'unknown', anchor: 'unknown' },
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/components.tokens.json', path: 'file-upload.background' },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'file-upload.background',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: {
                document: 'sets/components.tokens.json',
                path: 'file-upload.background',
              },
            },
            inputs: { aliases: ['surface.base'], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'file-upload.border-color',
      cssProperty: '--cinder-file-upload-border-color',
      category: 'color',
      component: 'file-upload',
      description: 'Dropzone border color.',
      themeAware: false,
      deprecated: false,
      profile: 'color',
      palette: { family: 'unknown', role: 'unknown', anchor: 'unknown' },
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/components.tokens.json', path: 'file-upload.border-color' },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'file-upload.border-color',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: {
                document: 'sets/components.tokens.json',
                path: 'file-upload.border-color',
              },
            },
            inputs: { aliases: ['border.control'], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'file-upload.progress.background',
      cssProperty: '--cinder-file-upload-progress-background',
      category: 'color',
      component: 'file-upload',
      description: 'Progress bar track background.',
      themeAware: false,
      deprecated: false,
      profile: 'color',
      palette: { family: 'unknown', role: 'unknown', anchor: 'unknown' },
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: {
              document: 'sets/components.tokens.json',
              path: 'file-upload.progress.background',
            },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'file-upload.progress.background',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: {
                document: 'sets/components.tokens.json',
                path: 'file-upload.progress.background',
              },
            },
            inputs: { aliases: ['surface.inset'], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'file-upload.progress.fill',
      cssProperty: '--cinder-file-upload-progress-fill',
      category: 'color',
      component: 'file-upload',
      description: 'Progress bar fill.',
      themeAware: false,
      deprecated: false,
      profile: 'color',
      palette: { family: 'unknown', role: 'unknown', anchor: 'unknown' },
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/components.tokens.json', path: 'file-upload.progress.fill' },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'file-upload.progress.fill',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: {
                document: 'sets/components.tokens.json',
                path: 'file-upload.progress.fill',
              },
            },
            inputs: { aliases: ['accent.solid'], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'kanban-board.column.width',
      cssProperty: '--cinder-kanban-column-width',
      category: 'size',
      component: 'kanban-board',
      description: 'Column inline-size.',
      themeAware: false,
      deprecated: false,
      profile: 'width',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/components.tokens.json', path: 'kanban-board.column.width' },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'kanban-board.column.width',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'local',
              declaredAt: {
                document: 'sets/components.tokens.json',
                path: 'kanban-board.column.width',
              },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'kanban-board.column.gap',
      cssProperty: '--cinder-kanban-column-gap',
      category: 'spacing',
      component: 'kanban-board',
      description: 'Gap between columns.',
      themeAware: false,
      deprecated: false,
      profile: 'gap',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/components.tokens.json', path: 'kanban-board.column.gap' },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'kanban-board.column.gap',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'local',
              declaredAt: {
                document: 'sets/components.tokens.json',
                path: 'kanban-board.column.gap',
              },
            },
            inputs: { aliases: ['space.4'], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'kanban-board.column.background',
      cssProperty: '--cinder-kanban-column-background',
      category: 'color',
      component: 'kanban-board',
      description: 'Column background.',
      themeAware: false,
      deprecated: false,
      profile: 'color',
      palette: { family: 'unknown', role: 'unknown', anchor: 'unknown' },
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: {
              document: 'sets/components.tokens.json',
              path: 'kanban-board.column.background',
            },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'kanban-board.column.background',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: {
                document: 'sets/components.tokens.json',
                path: 'kanban-board.column.background',
              },
            },
            inputs: { aliases: ['surface.raised'], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'kanban-board.card.background',
      cssProperty: '--cinder-kanban-card-background',
      category: 'color',
      component: 'kanban-board',
      description: 'Card background.',
      themeAware: false,
      deprecated: false,
      profile: 'color',
      palette: { family: 'unknown', role: 'unknown', anchor: 'unknown' },
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: {
              document: 'sets/components.tokens.json',
              path: 'kanban-board.card.background',
            },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'kanban-board.card.background',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: {
                document: 'sets/components.tokens.json',
                path: 'kanban-board.card.background',
              },
            },
            inputs: { aliases: ['surface.base'], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'kanban-board.board.scroll-edge',
      cssProperty: '--cinder-kanban-board-scroll-edge',
      category: 'color',
      component: 'kanban-board',
      description:
        'Horizontal scroll-edge fade gradient color -- `text-default` at 12% opacity, tracking whichever theme arm resolves.',
      themeAware: true,
      deprecated: false,
      profile: 'color',
      palette: { family: 'unknown', role: 'unknown', anchor: 'unknown' },
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'subset',
        cssSerialization: 'mixed',
        reason:
          'Some contexts emit a trusted CSS recipe and others a typed value; the DTCG value is exported, the recipe is not.',
      },
      variants: [
        {
          contexts: ['light/default', 'light/reduced', 'light/forced-reduced-motion'],
          provenance: {
            winner: {
              document: 'sets/components.tokens.json',
              path: 'kanban-board.board.scroll-edge',
            },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'kanban-board.board.scroll-edge',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: {
                document: 'sets/components.tokens.json',
                path: 'kanban-board.board.scroll-edge',
              },
            },
            inputs: {
              aliases: [],
              refs: [],
              extends: [],
              recipes: [{ cssProperty: '--cinder-text-default', path: 'text.default' }],
            },
          },
        },
        {
          contexts: ['dark/default', 'dark/reduced', 'dark/forced-reduced-motion'],
          provenance: {
            winner: { document: 'themes/dark.tokens.json', path: 'kanban-board.board.scroll-edge' },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'kanban-board.board.scroll-edge',
                via: 'declared',
              },
              {
                document: 'themes/dark.tokens.json',
                kind: 'modifier',
                layer: 'theme.dark',
                path: 'kanban-board.board.scroll-edge',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: {
                document: 'themes/dark.tokens.json',
                path: 'kanban-board.board.scroll-edge',
              },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'marquee.duration',
      cssProperty: '--cinder-marquee-duration',
      category: 'motion',
      component: 'marquee',
      description: 'Default scroll duration for one full loop.',
      themeAware: false,
      deprecated: false,
      profile: 'duration',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/components.tokens.json', path: 'marquee.duration' },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'marquee.duration',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'duration',
              origin: 'local',
              declaredAt: { document: 'sets/components.tokens.json', path: 'marquee.duration' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'marquee.gap',
      cssProperty: '--cinder-marquee-gap',
      category: 'spacing',
      component: 'marquee',
      description: 'Gap between marquee items.',
      themeAware: false,
      deprecated: false,
      profile: 'gap',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/components.tokens.json', path: 'marquee.gap' },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'marquee.gap',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'local',
              declaredAt: { document: 'sets/components.tokens.json', path: 'marquee.gap' },
            },
            inputs: { aliases: ['space.6'], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'modal.backdrop',
      cssProperty: '--cinder-modal-backdrop',
      category: 'color',
      component: 'modal',
      description:
        '`::backdrop` fill color override point. A consumer override should target `::backdrop` directly for cross-engine reliability.',
      themeAware: false,
      deprecated: false,
      profile: 'color',
      palette: { family: 'unknown', role: 'unknown', anchor: 'unknown' },
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/components.tokens.json', path: 'modal.backdrop' },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'modal.backdrop',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: { document: 'sets/components.tokens.json', path: 'modal.backdrop' },
            },
            inputs: { aliases: ['overlay.backdrop'], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'selectable-row.padding-block',
      cssProperty: '--cinder-selectable-row-padding-block',
      category: 'spacing',
      component: 'selectable-row',
      description: 'Row block padding (default density).',
      themeAware: false,
      deprecated: false,
      profile: 'padding',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: {
              document: 'sets/components.tokens.json',
              path: 'selectable-row.padding-block',
            },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'selectable-row.padding-block',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'local',
              declaredAt: {
                document: 'sets/components.tokens.json',
                path: 'selectable-row.padding-block',
              },
            },
            inputs: { aliases: ['space.3'], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'selectable-row.padding-inline',
      cssProperty: '--cinder-selectable-row-padding-inline',
      category: 'spacing',
      component: 'selectable-row',
      description: 'Row inline padding (default density).',
      themeAware: false,
      deprecated: false,
      profile: 'padding',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: {
              document: 'sets/components.tokens.json',
              path: 'selectable-row.padding-inline',
            },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'selectable-row.padding-inline',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'local',
              declaredAt: {
                document: 'sets/components.tokens.json',
                path: 'selectable-row.padding-inline',
              },
            },
            inputs: { aliases: ['space.4'], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'selectable-row.column-gap',
      cssProperty: '--cinder-selectable-row-column-gap',
      category: 'spacing',
      component: 'selectable-row',
      description: "Gap between the row's leading/primary/trailing regions.",
      themeAware: false,
      deprecated: false,
      profile: 'gap',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/components.tokens.json', path: 'selectable-row.column-gap' },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'selectable-row.column-gap',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'local',
              declaredAt: {
                document: 'sets/components.tokens.json',
                path: 'selectable-row.column-gap',
              },
            },
            inputs: { aliases: ['space.2'], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'selectable-row.content-gap',
      cssProperty: '--cinder-selectable-row-content-gap',
      category: 'spacing',
      component: 'selectable-row',
      description: 'Gap between primary content lines.',
      themeAware: false,
      deprecated: false,
      profile: 'gap',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/components.tokens.json', path: 'selectable-row.content-gap' },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'selectable-row.content-gap',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'local',
              declaredAt: {
                document: 'sets/components.tokens.json',
                path: 'selectable-row.content-gap',
              },
            },
            inputs: { aliases: ['space.one'], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'selectable-row.leading-gap',
      cssProperty: '--cinder-selectable-row-leading-gap',
      category: 'spacing',
      component: 'selectable-row',
      description: 'Gap between the leading control and label.',
      themeAware: false,
      deprecated: false,
      profile: 'gap',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/components.tokens.json', path: 'selectable-row.leading-gap' },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'selectable-row.leading-gap',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'local',
              declaredAt: {
                document: 'sets/components.tokens.json',
                path: 'selectable-row.leading-gap',
              },
            },
            inputs: { aliases: ['space.3'], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'selectable-row.trailing-actions-gap',
      cssProperty: '--cinder-selectable-row-trailing-actions-gap',
      category: 'spacing',
      component: 'selectable-row',
      description: 'Gap between trailing action items.',
      themeAware: false,
      deprecated: false,
      profile: 'gap',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: {
              document: 'sets/components.tokens.json',
              path: 'selectable-row.trailing-actions-gap',
            },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'selectable-row.trailing-actions-gap',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'local',
              declaredAt: {
                document: 'sets/components.tokens.json',
                path: 'selectable-row.trailing-actions-gap',
              },
            },
            inputs: { aliases: ['space.2'], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'side-navigation.list-gap',
      cssProperty: '--cinder-side-navigation-list-gap',
      category: 'spacing',
      component: 'side-navigation',
      description: 'Gap between top-level navigation items.',
      themeAware: false,
      deprecated: false,
      profile: 'gap',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/components.tokens.json', path: 'side-navigation.list-gap' },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'side-navigation.list-gap',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'local',
              declaredAt: {
                document: 'sets/components.tokens.json',
                path: 'side-navigation.list-gap',
              },
            },
            inputs: { aliases: ['space.one'], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'spinner.indicator',
      cssProperty: '--cinder-spinner-indicator',
      category: 'color',
      component: 'spinner',
      description:
        "Spinner arc color. Default is `currentColor` (inherits from context); the reduced-motion static state re-asserts the same track-color fallback explicitly. `$value` aliases `text.default` as the closest resolvable stand-in for `currentColor`'s typical resolution. Excluded from the published resolved-context JSON (`nonRepresentableValue`) so a generic consumer does not apply this fixed color in place of the real, context-inheriting `currentColor`.",
      themeAware: false,
      deprecated: false,
      profile: 'color',
      palette: { family: 'unknown', role: 'unknown', anchor: 'unknown' },
      disposition: {
        edit: 'css-only',
        cssExport: 'supported',
        dtcgExport: 'none',
        cssSerialization: 'trusted-recipe',
        cssValue: 'currentColor',
        reason:
          'The real CSS value has no faithful DTCG representation; the token is excluded from resolved contexts and portable export.',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/components.tokens.json', path: 'spinner.indicator' },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'spinner.indicator',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: { document: 'sets/components.tokens.json', path: 'spinner.indicator' },
            },
            inputs: { aliases: ['text.default'], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'spinner.size',
      cssProperty: '--cinder-spinner-size',
      category: 'size',
      component: 'spinner',
      description: 'Spinner diameter (md default; 24px).',
      themeAware: false,
      deprecated: false,
      profile: 'size',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/components.tokens.json', path: 'spinner.size' },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'spinner.size',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'local',
              declaredAt: { document: 'sets/components.tokens.json', path: 'spinner.size' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'statistic.row-gap',
      cssProperty: '--cinder-statistic-row-gap',
      category: 'spacing',
      component: 'statistic',
      description: 'Gap between label/value/change rows.',
      themeAware: false,
      deprecated: false,
      profile: 'gap',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/components.tokens.json', path: 'statistic.row-gap' },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'statistic.row-gap',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'local',
              declaredAt: { document: 'sets/components.tokens.json', path: 'statistic.row-gap' },
            },
            inputs: { aliases: ['space.one'], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'statistic.column-gap',
      cssProperty: '--cinder-statistic-column-gap',
      category: 'spacing',
      component: 'statistic',
      description: 'Gap between statistic columns when laid out inline.',
      themeAware: false,
      deprecated: false,
      profile: 'gap',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/components.tokens.json', path: 'statistic.column-gap' },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'statistic.column-gap',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'local',
              declaredAt: { document: 'sets/components.tokens.json', path: 'statistic.column-gap' },
            },
            inputs: { aliases: ['space.3'], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'statistic.label-font-size',
      cssProperty: '--cinder-statistic-label-font-size',
      category: 'typography',
      component: 'statistic',
      description: 'Label font size.',
      themeAware: false,
      deprecated: false,
      profile: 'font-size',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/components.tokens.json', path: 'statistic.label-font-size' },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'statistic.label-font-size',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'local',
              declaredAt: {
                document: 'sets/components.tokens.json',
                path: 'statistic.label-font-size',
              },
            },
            inputs: { aliases: ['font.size.sm'], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'statistic.value.font-size',
      cssProperty: '--cinder-statistic-value-font-size',
      category: 'typography',
      component: 'statistic',
      description: 'Value font size.',
      themeAware: false,
      deprecated: false,
      profile: 'font-size',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/components.tokens.json', path: 'statistic.value.font-size' },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'statistic.value.font-size',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'local',
              declaredAt: {
                document: 'sets/components.tokens.json',
                path: 'statistic.value.font-size',
              },
            },
            inputs: { aliases: ['font.size.4xl'], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'statistic.value.font-weight',
      cssProperty: '--cinder-statistic-value-font-weight',
      category: 'typography',
      component: 'statistic',
      description: 'Value font weight.',
      themeAware: false,
      deprecated: false,
      profile: 'font-weight',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: {
              document: 'sets/components.tokens.json',
              path: 'statistic.value.font-weight',
            },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'statistic.value.font-weight',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'fontWeight',
              origin: 'local',
              declaredAt: {
                document: 'sets/components.tokens.json',
                path: 'statistic.value.font-weight',
              },
            },
            inputs: { aliases: ['font.semibold'], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'statistic.value.line-height',
      cssProperty: '--cinder-statistic-value-line-height',
      category: 'typography',
      component: 'statistic',
      description: 'Value line height (unitless).',
      themeAware: false,
      deprecated: false,
      profile: 'line-height',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: {
              document: 'sets/components.tokens.json',
              path: 'statistic.value.line-height',
            },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'statistic.value.line-height',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'number',
              origin: 'local',
              declaredAt: {
                document: 'sets/components.tokens.json',
                path: 'statistic.value.line-height',
              },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'statistic.change.gap',
      cssProperty: '--cinder-statistic-change-gap',
      category: 'spacing',
      component: 'statistic',
      description: 'Gap between the change indicator icon and its label.',
      themeAware: false,
      deprecated: false,
      profile: 'gap',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/components.tokens.json', path: 'statistic.change.gap' },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'statistic.change.gap',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'local',
              declaredAt: { document: 'sets/components.tokens.json', path: 'statistic.change.gap' },
            },
            inputs: { aliases: ['space.one'], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'statistic.change.font-size',
      cssProperty: '--cinder-statistic-change-font-size',
      category: 'typography',
      component: 'statistic',
      description: 'Change indicator font size.',
      themeAware: false,
      deprecated: false,
      profile: 'font-size',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/components.tokens.json', path: 'statistic.change.font-size' },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'statistic.change.font-size',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'local',
              declaredAt: {
                document: 'sets/components.tokens.json',
                path: 'statistic.change.font-size',
              },
            },
            inputs: { aliases: ['font.size.sm'], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'statistic-group.gap',
      cssProperty: '--cinder-statistic-group-gap',
      category: 'spacing',
      component: 'statistic-group',
      description: 'Gap between statistic cards.',
      themeAware: false,
      deprecated: false,
      profile: 'gap',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/components.tokens.json', path: 'statistic-group.gap' },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'statistic-group.gap',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'local',
              declaredAt: { document: 'sets/components.tokens.json', path: 'statistic-group.gap' },
            },
            inputs: { aliases: ['space.4'], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'statistic-group.card-padding',
      cssProperty: '--cinder-statistic-group-card-padding',
      category: 'spacing',
      component: 'statistic-group',
      description: 'Padding inside each statistic card.',
      themeAware: false,
      deprecated: false,
      profile: 'padding',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: {
              document: 'sets/components.tokens.json',
              path: 'statistic-group.card-padding',
            },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'statistic-group.card-padding',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'local',
              declaredAt: {
                document: 'sets/components.tokens.json',
                path: 'statistic-group.card-padding',
              },
            },
            inputs: { aliases: ['space.4'], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'statistic-group.shared-cell-padding',
      cssProperty: '--cinder-statistic-group-shared-cell-padding',
      category: 'spacing',
      component: 'statistic-group',
      description: 'Padding inside each cell in the shared-border layout mode.',
      themeAware: false,
      deprecated: false,
      profile: 'padding',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: {
              document: 'sets/components.tokens.json',
              path: 'statistic-group.shared-cell-padding',
            },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'statistic-group.shared-cell-padding',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'local',
              declaredAt: {
                document: 'sets/components.tokens.json',
                path: 'statistic-group.shared-cell-padding',
              },
            },
            inputs: { aliases: ['space.4'], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'status-dot.color',
      cssProperty: '--cinder-status-dot-color',
      category: 'color',
      component: 'status-dot',
      description: 'Dot fill color (default, no status set).',
      themeAware: false,
      deprecated: false,
      profile: 'color',
      palette: { family: 'unknown', role: 'unknown', anchor: 'unknown' },
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/components.tokens.json', path: 'status-dot.color' },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'status-dot.color',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: { document: 'sets/components.tokens.json', path: 'status-dot.color' },
            },
            inputs: { aliases: ['text.muted'], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'status-dot.size',
      cssProperty: '--cinder-status-dot-size',
      category: 'size',
      component: 'status-dot',
      description: 'Dot diameter (md default; 10px).',
      themeAware: false,
      deprecated: false,
      profile: 'size',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/components.tokens.json', path: 'status-dot.size' },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'status-dot.size',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'local',
              declaredAt: { document: 'sets/components.tokens.json', path: 'status-dot.size' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'table-of-contents.link.color',
      cssProperty: '--cinder-table-of-contents-link-color',
      category: 'color',
      component: 'table-of-contents',
      description: 'Inactive link color.',
      themeAware: false,
      deprecated: false,
      profile: 'color',
      palette: { family: 'unknown', role: 'unknown', anchor: 'unknown' },
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: {
              document: 'sets/components.tokens.json',
              path: 'table-of-contents.link.color',
            },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'table-of-contents.link.color',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: {
                document: 'sets/components.tokens.json',
                path: 'table-of-contents.link.color',
              },
            },
            inputs: { aliases: ['text.muted'], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'table-of-contents.link.active-color',
      cssProperty: '--cinder-table-of-contents-link-active-color',
      category: 'color',
      component: 'table-of-contents',
      description: 'Active link color.',
      themeAware: false,
      deprecated: false,
      profile: 'color',
      palette: { family: 'unknown', role: 'unknown', anchor: 'unknown' },
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: {
              document: 'sets/components.tokens.json',
              path: 'table-of-contents.link.active-color',
            },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'table-of-contents.link.active-color',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: {
                document: 'sets/components.tokens.json',
                path: 'table-of-contents.link.active-color',
              },
            },
            inputs: { aliases: ['text.default'], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'table-of-contents.link.indent-step',
      cssProperty: '--cinder-table-of-contents-link-indent-step',
      category: 'spacing',
      component: 'table-of-contents',
      description: 'Indent added per heading-depth level.',
      themeAware: false,
      deprecated: false,
      profile: 'padding',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: {
              document: 'sets/components.tokens.json',
              path: 'table-of-contents.link.indent-step',
            },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'table-of-contents.link.indent-step',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'local',
              declaredAt: {
                document: 'sets/components.tokens.json',
                path: 'table-of-contents.link.indent-step',
              },
            },
            inputs: { aliases: ['space.3'], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'tree.drop-line-color',
      cssProperty: '--cinder-tree-drop-line-color',
      category: 'color',
      component: 'tree',
      description: 'Drop-target indicator line/ring color.',
      themeAware: false,
      deprecated: false,
      profile: 'color',
      palette: { family: 'unknown', role: 'unknown', anchor: 'unknown' },
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/components.tokens.json', path: 'tree.drop-line-color' },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'tree.drop-line-color',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'color',
              origin: 'local',
              declaredAt: { document: 'sets/components.tokens.json', path: 'tree.drop-line-color' },
            },
            inputs: { aliases: ['accent.solid'], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'tree.drop-line-thickness',
      cssProperty: '--cinder-tree-drop-line-thickness',
      category: 'size',
      component: 'tree',
      description: 'Drop-target indicator line thickness.',
      themeAware: false,
      deprecated: false,
      profile: 'border-width',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/components.tokens.json', path: 'tree.drop-line-thickness' },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'tree.drop-line-thickness',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'local',
              declaredAt: {
                document: 'sets/components.tokens.json',
                path: 'tree.drop-line-thickness',
              },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'tree.item-dragging-opacity',
      cssProperty: '--cinder-tree-item-dragging-opacity',
      category: 'opacity',
      component: 'tree',
      description: "Opacity of an item's row while being dragged.",
      themeAware: false,
      deprecated: false,
      profile: 'opacity',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/components.tokens.json', path: 'tree.item-dragging-opacity' },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'tree.item-dragging-opacity',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'number',
              origin: 'local',
              declaredAt: {
                document: 'sets/components.tokens.json',
                path: 'tree.item-dragging-opacity',
              },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
    {
      path: 'virtual-list.height',
      cssProperty: '--cinder-virtual-list-height',
      category: 'size',
      component: 'virtual-list',
      description: 'Default scroll-viewport height.',
      themeAware: false,
      deprecated: false,
      profile: 'height',
      disposition: {
        edit: 'supported',
        cssExport: 'supported',
        dtcgExport: 'complete',
        cssSerialization: 'typed-value',
      },
      variants: [
        {
          contexts: [
            'light/default',
            'light/reduced',
            'light/forced-reduced-motion',
            'dark/default',
            'dark/reduced',
            'dark/forced-reduced-motion',
          ],
          provenance: {
            winner: { document: 'sets/components.tokens.json', path: 'virtual-list.height' },
            layers: [
              {
                document: 'sets/components.tokens.json',
                kind: 'set',
                layer: 'sets.foundation',
                path: 'virtual-list.height',
                via: 'declared',
              },
            ],
            effectiveType: {
              type: 'dimension',
              origin: 'local',
              declaredAt: { document: 'sets/components.tokens.json', path: 'virtual-list.height' },
            },
            inputs: { aliases: [], refs: [], extends: [], recipes: [] },
          },
        },
      ],
    },
  ],
};
