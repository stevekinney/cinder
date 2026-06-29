<script lang="ts" module>
  export const title = 'Derived from heading region';
  export const description =
    'Automatically derives nested entries from headings in a target content region.';
</script>

<script lang="ts">
  import { TableOfContents } from '@lostgradient/cinder/table-of-contents';
</script>

<div style="display: grid; grid-template-columns: 16rem 1fr; gap: 1.5rem; align-items: start;">
  <aside style="position: sticky; top: 1rem;">
    <TableOfContents target="#toc-example-article" />
  </aside>

  <article id="toc-example-article" style="display: flex; flex-direction: column; gap: 2rem;">
    <section>
      <h2 id="overview">Overview</h2>
      <p style="margin: 0.5rem 0 0;">A quick summary of what this page covers.</p>
    </section>
    <section>
      <h2 id="setup">Setup</h2>
      <p style="margin: 0.5rem 0 0;">Install dependencies and configure your environment.</p>
      <h3 id="setup-install">Install packages</h3>
      <p style="margin: 0.5rem 0 0;">Install the dependencies needed for your project.</p>
      <h3 id="setup-configure">Configure project</h3>
      <p style="margin: 0.5rem 0 0;">Add and tune configuration values.</p>
    </section>
    <section>
      <h2 id="deployment">Deployment</h2>
      <p style="margin: 0.5rem 0 0;">Push your build to production.</p>
    </section>
  </article>
</div>
