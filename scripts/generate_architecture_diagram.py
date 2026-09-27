"""Generate standalone interactive docs/diagrams/architecture.html from arch_architecture.json and workflow.html shell."""
import json
import os
import re

def build_architecture_html():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    template_path = os.path.join(base_dir, "docs", "diagrams", "workflow.html")
    arch_json_path = os.path.join(base_dir, "docs", "diagrams", "arch_architecture.json")
    output_html_path = os.path.join(base_dir, "docs", "diagrams", "architecture.html")

    with open(arch_json_path, "r", encoding="utf-8") as f:
        spec = json.load(f)

    with open(template_path, "r", encoding="utf-8") as f:
        template = f.read()

    # Viewbox: 0 0 1400 680
    components = spec["components"]
    
    # Sigil icons
    sigils = {
        "external": '<rect x="2.5" y="5" width="8.5" height="8" rx="1.5"/><path d="M8 2.5h5.5V8M13.5 2.5 7.5 8.5"/>',
        "backend": '<path d="M6 3 3 8l3 5M10 3l3 5-3 5"/>',
        "database": '<ellipse cx="8" cy="4" rx="6" ry="2.5"/><path d="M2 4v8c0 1.38 2.69 2.5 6 2.5s6-1.12 6-2.5V4M2 8c0 1.38 2.69 2.5 6 2.5s6-1.12 6-2.5"/>',
        "messagebus": '<path d="M2 8h12M10 4l4 4-4 4M6 12 2 8l4-4"/>',
        "frontend": '<rect x="2" y="3" width="12" height="10" rx="1.5"/><path d="M2 6h12M5 4.5h.01M7 4.5h.01"/>'
    }

    # Generate Components SVG
    nodes_svg = []
    for step_idx, comp in enumerate(components):
        cid = comp["id"]
        x, y = comp["pos"]
        w, h = comp["size"]
        kind = comp["type"]
        lbl = comp["label"]
        sub = comp["sublabel"]
        tag = comp.get("tag", "")
        cx = x + w / 2
        sigil = sigils.get(kind, sigils["backend"])

        nodes_svg.append(f'''        <g id="node-{cid}" data-node-id="{cid}" data-node-label="{lbl}" tabindex="0" role="button" aria-label="Focus {lbl}, {sub}, {tag}" aria-pressed="false" data-node-kind="{kind}" data-node-sublabel="{sub}" data-node-tag="{tag}">
          <title>{lbl} · {sub} · {tag}</title>
          <rect x="{x}" y="{y}" width="{w}" height="{h}" rx="6" class="c-mask"/>
          <rect x="{x}" y="{y}" width="{w}" height="{h}" rx="6" class="c-{kind}" data-animate="node" style="--step:{step_idx}" stroke-width="1.5"/>
          <g aria-hidden="true" data-semantic-sigil="{kind}" class="semantic-sigil s-{kind}" transform="translate({x + 6} {y + 6}) scale(0.6875)">
            {sigil}
          </g>
          <text data-node-label="" data-detail-anchor="" x="{cx}" y="{y + 25}" class="t-primary" font-size="12" font-weight="600" text-anchor="middle">{lbl}</text>
          <text data-detail="context" x="{cx}" y="{y + 45}" class="t-muted" font-size="9" text-anchor="middle">{sub}</text>
          <text data-detail="fine" x="{cx}" y="{y + h - 14}" class="t-{kind}" font-size="8" font-weight="600" text-anchor="middle">{tag.upper()}</text>
        </g>''')
    nodes_str = "\n".join(nodes_svg)

    # Connections
    edges = [
        {"from": "nived", "to": "mithun", "label": "CodeChunk[] + CodeDNA", "variant": "emphasis", "step": 0, "path": "M 330 160 L 380 160"},
        {"from": "mithun", "to": "heytish", "label": "retrieve / rerank candidates", "variant": "emphasis", "step": 1, "path": "M 680 160 L 730 160"},
        {"from": "heytish", "to": "durga", "label": "SearchResponse + agent_trace[]", "variant": "emphasis", "step": 2, "path": "M 1030 150 L 1070 150"},
        {"from": "durga", "to": "heytish", "label": "/agent-query (REST)", "variant": "default", "step": 3, "path": "M 1070 195 L 1030 195"},
        {"from": "pipeline", "to": "nived", "label": "scan_and_chunk()", "variant": "default", "step": 4, "path": "M 250 315 L 250 265 Q 250 240 220 240 L 190 240"},
        {"from": "pipeline", "to": "mithun", "label": "build_indexes()", "variant": "default", "step": 5, "path": "M 420 315 L 420 280 Q 420 255 450 255 L 480 255"},
        {"from": "pipeline", "to": "heytish", "label": "build_call_graph()", "variant": "emphasis", "step": 6, "path": "M 540 365 L 750 365 Q 780 365 780 300 L 780 255"},
        {"from": "evaluation", "to": "pipeline", "label": "demo_repo corpus", "variant": "dashed", "step": 7, "path": "M 680 365 L 540 365"},
        {"from": "evaluation", "to": "durga", "label": "GET /evaluate metrics", "variant": "dashed", "step": 8, "path": "M 1050 315 L 1050 280 Q 1050 255 1100 255 L 1150 255"},
    ]

    edges_svg = []
    for idx, e in enumerate(edges):
        fr, to, lbl, var, step, path = e["from"], e["to"], e["label"], e["variant"], e["step"], e["path"]
        marker = f"url(#arrowhead-{var})" if var in ["emphasis", "dashed"] else "url(#arrowhead)"
        stroke_w = "1.8" if var == "emphasis" else "1.4"
        edges_svg.append(f'''        <path data-edge-from="{fr}" data-edge-to="{to}" data-edge-label="{lbl}" data-edge-key="{idx}" data-edge-id="{fr}_{to}" d="{path}" class="a-{var}" data-animate="edge" style="--step:{step}" stroke-width="{stroke_w}" marker-end="{marker}"/>''')
    edges_str = "\n".join(edges_svg)

    # Info cards HTML
    cards_html = []
    for c in spec["cards"]:
        dot = c["dot"]
        title = c["title"]
        items = "\n".join([f"          <li>&bull; {it}</li>" for it in c["items"]])
        cards_html.append(f'''      <div class="card">
        <div class="card-header">
          <div class="card-dot {dot}"></div>
          <h3>{title}</h3>
        </div>
        <ul>
{items}
        </ul>
      </div>''')
    cards_str = "\n\n".join(cards_html)

    # Assemble complete SVG
    arch_svg = f'''      <svg viewBox="0 0 1400 680" role="img" lang="en" aria-labelledby="archify-diagram-title archify-diagram-description" data-animation="trace" data-preset="signal-flow" data-quality-profile="standard">
        <title id="archify-diagram-title">Samsung PRISM Agentic Code Intelligence — System Architecture</title>
        <desc id="archify-diagram-description">NIVED (Parser) → MITHUN (Retrieval) → HEYTISH (Agent & Graph) → DURGA (API & UI)</desc>
        <defs>
          <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" class="m-default" />
          </marker>
          <marker id="arrowhead-emphasis" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" class="m-emphasis" />
          </marker>
          <marker id="arrowhead-security" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" class="m-security" />
          </marker>
          <marker id="arrowhead-dashed" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" class="m-dashed" />
          </marker>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" class="c-grid" stroke-width="0.5"/>
          </pattern>
        </defs>

        <!-- Background Grid -->
        <rect width="100%" height="100%" fill="url(#grid)" />

        <!-- Boundaries (behind everything) -->
        <rect data-graph-role="structural-frame" data-composition-frame-kind="region" data-composition-frame-id="0" data-composition-frame-label="Complete Integrated System (All 4 Pillars Present &amp; Connected)" x="20" y="40" width="1360" height="420" rx="12" class="c-region" stroke-width="1"/>
        <text x="36" y="62" class="t-dim" font-size="11" font-weight="600">Complete Integrated System (All 4 Pillars Present &amp; Connected)</text>

        <!-- Connection paths -->
{edges_str}

        <!-- Components -->
{nodes_str}

        <!-- Legend -->
        <g id="diagram-legend" class="diagram-legend" transform="translate(40, 580)">
          <g data-legend-semantic-kind="backend" data-legend-label="Core Component" data-legend-x="0">
            <rect x="0" y="0" width="14" height="9" rx="2" class="c-backend" stroke-width="1"/>
            <text x="22" y="8" class="t-muted" font-size="8" font-weight="500">Core Component</text>
          </g>
          <g data-legend-semantic-kind="database" data-legend-label="Data Store / Index" data-legend-x="140">
            <rect x="140" y="0" width="14" height="9" rx="2" class="c-database" stroke-width="1"/>
            <text x="162" y="8" class="t-muted" font-size="8" font-weight="500">Index / Benchmark</text>
          </g>
          <g data-legend-semantic-kind="frontend" data-legend-label="API & UI Deliverable" data-legend-x="280">
            <rect x="280" y="0" width="14" height="9" rx="2" class="c-frontend" stroke-width="1"/>
            <text x="302" y="8" class="t-muted" font-size="8" font-weight="500">API &amp; UI Deliverable</text>
          </g>
          <g data-legend-semantic-kind="messagebus" data-legend-label="Graph Hierarchy" data-legend-x="430">
            <rect x="430" y="0" width="14" height="9" rx="2" class="c-messagebus" stroke-width="1"/>
            <text x="452" y="8" class="t-muted" font-size="8" font-weight="500">Graph Structure</text>
          </g>
        </g>
      </svg>'''

    # Replace Title and Subtitle
    res = template
    res = re.sub(r'<title>.*?</title>', '<title>Samsung PRISM Agentic Code Intelligence — System Architecture Diagram</title>', res, count=1)
    res = re.sub(r'<h1>.*?</h1>', '<h1>Samsung PRISM Agentic Code Intelligence — System Architecture</h1>', res, count=1)
    res = re.sub(r'<p class="subtitle">.*?</p>', '<p class="subtitle">NIVED (Parser) → MITHUN (Retrieval) → HEYTISH (Agent & Graph) → DURGA (API & UI)</p>', res, count=1)
    
    # Replace guided views data
    guided_views_json = json.dumps(spec["meta"]["views"])
    res = re.sub(
        r'<script id="archify-guided-views-data" type="application/json">.*?</script>',
        lambda m: f'<script id="archify-guided-views-data" type="application/json">{guided_views_json}</script>',
        res,
        count=1
    )

    # Replace SVG block
    svg_pattern = r'(<div class="diagram-container"[^>]*>)\s*<svg.*?</svg>'
    res = re.sub(svg_pattern, r'\1\n' + arch_svg, res, flags=re.DOTALL)

    # Replace Cards block
    cards_pattern = r'(<div class="cards">).*?(</div>\s*<script id="archify-i18n")'
    new_cards_block = r'\1\n' + cards_str + '\n    ' + r'\2'
    res = re.sub(cards_pattern, new_cards_block, res, flags=re.DOTALL)

    # Write output HTML
    with open(output_html_path, "w", encoding="utf-8") as f:
        f.write(res)

    print(f"Successfully generated {output_html_path} ({len(res)} bytes)")

if __name__ == "__main__":
    build_architecture_html()
