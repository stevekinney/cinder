import type { Manifest, ManifestComponent } from './generate-manifest.ts';
export const SYNTHETIC_COMPONENTS: ManifestComponent[] = [
  {
    name: 'Button',
    id: 'button',
    import: '@lostgradient/cinder',
    exportName: 'Button',
    category: 'action',
    status: 'stable',
    purpose: 'Primary interactive control for triggering actions or navigating via href.',
    tags: ['action', 'cta'],
    useWhen: ['Triggering a form submit.', 'Navigating with a button appearance.'],
    avoidWhen: [{ reason: 'Toggling on/off state.', alternative: 'toggle' }],
    related: ['button-group', 'copy-button'],
    hasConstraints: false,
    hasExamples: false,
    artifacts: {
      schema: 'src/components/button/button.schema.json',
      variables: 'src/components/button/button.variables.json',
    },
    a11y: {
      pattern: 'WAI-ARIA Button',
      keyboard: [{ keys: 'Enter / Space', action: 'Activates the button.' }],
      notes: ['Uses a native button element so the role and state are announced.'],
    },
  },
  {
    name: 'Modal',
    id: 'modal',
    import: '@lostgradient/cinder',
    exportName: 'Modal',
    category: 'overlay',
    status: 'stable',
    purpose: 'Full-screen dialog that blocks interaction with the page until dismissed.',
    tags: ['dialog', 'overlay'],
    useWhen: ['Requiring user acknowledgment before proceeding.'],
    avoidWhen: [{ reason: 'Showing brief transient feedback.' }],
    related: ['drawer', 'popover'],
    hasConstraints: true,
    hasExamples: true,
    artifacts: {
      schema: 'src/components/modal/modal.schema.json',
      variables: 'src/components/modal/modal.variables.json',
      examples: 'src/components/modal/modal.examples.json',
      constraints: 'src/components/modal/modal.constraints.json',
    },
  },
  {
    name: 'JsonViewer',
    id: 'json-viewer',
    import: '@lostgradient/cinder',
    exportName: 'JsonViewer',
    category: 'feedback',
    status: 'alpha',
    purpose: 'Expandable structured payload viewer for debugging operational data.',
    tags: ['json', 'debugging'],
    useWhen: ['Showing structured event details in an operational dashboard.'],
    avoidWhen: [{ reason: 'Showing tabular records.', alternative: 'data-table' }],
    related: ['feed'],
    hasConstraints: false,
    hasExamples: false,
    artifacts: {
      schema: 'src/components/json-viewer/json-viewer.schema.json',
      variables: 'src/components/json-viewer/json-viewer.variables.json',
    },
  },
];

export function buildSyntheticManifest(): Manifest {
  return {
    $schema: './src/schemas/manifest.schema.json',
    manifestVersion: 1,
    package: {
      name: '@lostgradient/cinder',
      framework: 'svelte',
      frameworkVersionRange: '>=5.56.0 <6',
      classPrefix: 'cinder-',
      cssVarPrefix: '--cinder-',
      tokenNamespaces: ['color', 'space', 'radius', 'ring', 'type', 'motion', 'shadow'],
      stylesEntry: '@lostgradient/cinder',
      schemaDialect: 'https://json-schema.org/draft/2020-12/schema',
    },
    categories: {
      action: {
        label: 'Actions',
        description: 'Controls that trigger operations, submit data, or navigate.',
      },
      overlay: {
        label: 'Overlays',
        description: 'Floating surfaces that layer above page content and require user dismissal.',
      },
      form: {
        label: 'Forms',
        description: 'Input controls and layout primitives for collecting structured user data.',
      },
      feedback: {
        label: 'Feedback',
        description: 'Non-interactive indicators that communicate status, progress, or results.',
      },
      navigation: {
        label: 'Navigation',
        description: 'Wayfinding controls that move users between views, sections, or steps.',
      },
      'data-display': {
        label: 'Data Display',
        description: 'Read-only presentational components for structured data and content.',
      },
      layout: {
        label: 'Layout',
        description: 'Structural primitives that control spacing, containment, and composition.',
      },
      typography: {
        label: 'Typography',
        description:
          'Text-rendering components that enforce hierarchy and typographic conventions.',
      },
      domain: {
        label: 'Domain',
        description: 'Application-specific components that encode product-level business concepts.',
      },
    },
    statusLevels: {
      stable: 'Public API under semver protection; breaking changes require a major version bump.',
      beta: 'API is near-final but may have breaking changes in minor versions before promotion.',
      alpha: 'Experimental; no stability guarantee and subject to removal or significant redesign.',
      'domain-suite':
        'A cohesive set of domain-specific components shipped together as a named suite with its own versioning cadence.',
    },
    overlapFamilies: {
      overlay: ['modal', 'drawer', 'popover'],
      notice: ['banner', 'alert', 'callout'],
      selection: ['toggle', 'checkbox', 'segmented-control'],
      hover: ['tooltip', 'popover'],
      tabs: ['tabs', 'segmented-control'],
    },
    components: SYNTHETIC_COMPONENTS,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
