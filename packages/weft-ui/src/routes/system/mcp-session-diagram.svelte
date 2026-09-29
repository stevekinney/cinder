<script lang="ts">
  /**
   * MCP session-protocol sequence diagram (plan §7.3 app-local net-new: "one
   * static themed SVG (initialize → token → continued requests → 403 on
   * mismatch)"; design `Weft UI.dc.html` "System" § DISCOVERY). Static
   * and app-local by design — this documents the wire choreography every MCP
   * client goes through, not a data-driven render of anything the server
   * exposes.
   */
</script>

<svg
  viewBox="0 0 360 190"
  role="img"
  aria-label="MCP session protocol: client sends initialize, server returns a session token, the client includes the token on subsequent requests, and a missing or mismatched token gets a 403."
  class="weft-mcp-diagram"
>
  <text x="4" y="14" class="weft-mcp-diagram__lane-label">Client</text>
  <text x="356" y="14" text-anchor="end" class="weft-mcp-diagram__lane-label">Server</text>

  <!-- initialize -> -->
  <line
    x1="4"
    y1="42"
    x2="340"
    y2="42"
    class="weft-mcp-diagram__arrow-line weft-mcp-diagram__arrow-line--accent"
  />
  <polygon
    points="340,42 332,38 332,46"
    class="weft-mcp-diagram__arrowhead weft-mcp-diagram__arrowhead--accent"
  />
  <text x="4" y="34" class="weft-mcp-diagram__arrow-label weft-mcp-diagram__arrow-label--accent"
    >initialize →</text
  >

  <!-- <- session token -->
  <line
    x1="20"
    y1="80"
    x2="356"
    y2="80"
    class="weft-mcp-diagram__arrow-line weft-mcp-diagram__arrow-line--success"
  />
  <polygon
    points="20,80 28,76 28,84"
    class="weft-mcp-diagram__arrowhead weft-mcp-diagram__arrowhead--success"
  />
  <text
    x="356"
    y="72"
    text-anchor="end"
    class="weft-mcp-diagram__arrow-label weft-mcp-diagram__arrow-label--success"
    >← session token</text
  >

  <!-- request + token -> -->
  <line
    x1="4"
    y1="118"
    x2="340"
    y2="118"
    class="weft-mcp-diagram__arrow-line weft-mcp-diagram__arrow-line--accent"
  />
  <polygon
    points="340,118 332,114 332,122"
    class="weft-mcp-diagram__arrowhead weft-mcp-diagram__arrowhead--accent"
  />
  <text x="4" y="110" class="weft-mcp-diagram__arrow-label weft-mcp-diagram__arrow-label--accent"
    >request + token →</text
  >

  <!-- <- 403 if missing/mismatched -->
  <line
    x1="20"
    y1="156"
    x2="356"
    y2="156"
    class="weft-mcp-diagram__arrow-line weft-mcp-diagram__arrow-line--danger"
  />
  <polygon
    points="20,156 28,152 28,160"
    class="weft-mcp-diagram__arrowhead weft-mcp-diagram__arrowhead--danger"
  />
  <text
    x="356"
    y="148"
    text-anchor="end"
    class="weft-mcp-diagram__arrow-label weft-mcp-diagram__arrow-label--danger"
    >← 403 if missing/mismatched</text
  >

  <circle cx="4" cy="42" r="4" class="weft-mcp-diagram__dot weft-mcp-diagram__dot--accent" />
  <circle cx="356" cy="80" r="4" class="weft-mcp-diagram__dot weft-mcp-diagram__dot--success" />
  <circle cx="4" cy="118" r="4" class="weft-mcp-diagram__dot weft-mcp-diagram__dot--accent" />
  <circle cx="356" cy="156" r="4" class="weft-mcp-diagram__dot weft-mcp-diagram__dot--danger" />
</svg>

<style>
  .weft-mcp-diagram {
    width: 100%;
    height: auto;
    max-width: 420px;
  }

  .weft-mcp-diagram__lane-label {
    font-size: 9px;
    font-weight: 600;
    fill: var(--cinder-text-subtle);
  }

  .weft-mcp-diagram__arrow-line {
    stroke-width: 1;
  }

  .weft-mcp-diagram__arrow-line--accent {
    stroke: var(--cinder-accent);
  }

  .weft-mcp-diagram__arrow-line--success {
    stroke: var(--cinder-success);
  }

  .weft-mcp-diagram__arrow-line--danger {
    stroke: var(--cinder-danger);
  }

  .weft-mcp-diagram__arrowhead--accent {
    fill: var(--cinder-accent);
  }

  .weft-mcp-diagram__arrowhead--success {
    fill: var(--cinder-success);
  }

  .weft-mcp-diagram__arrowhead--danger {
    fill: var(--cinder-danger);
  }

  .weft-mcp-diagram__arrow-label {
    font-family: var(--cinder-font-mono);
    font-size: 9px;
  }

  .weft-mcp-diagram__arrow-label--accent {
    fill: var(--cinder-accent-text);
  }

  .weft-mcp-diagram__arrow-label--success {
    fill: var(--cinder-color-success-fg);
  }

  .weft-mcp-diagram__arrow-label--danger {
    fill: var(--cinder-color-danger-fg);
  }

  .weft-mcp-diagram__dot--accent {
    fill: var(--cinder-accent);
  }

  .weft-mcp-diagram__dot--success {
    fill: var(--cinder-success);
  }

  .weft-mcp-diagram__dot--danger {
    fill: var(--cinder-danger);
  }
</style>
