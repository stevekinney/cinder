<script lang="ts" module>
  export const title = 'With front matter';
  export const description = 'Front matter changes render in their own collapsible section.';
</script>

<script lang="ts">
  import { DiffViewer } from '@lostgradient/cinder/diff-viewer';
  const original = `---
title: Getting Started
status: draft
tags:
  - docs
---

# Getting Started

Install the package and run the development server.`;

  const current = `---
title: Getting Started
status: published
tags:
  - docs
  - onboarding
---

# Getting Started

Install the package, run the development server, and open the playground.`;
</script>

<DiffViewer {original} {current} readonly />
