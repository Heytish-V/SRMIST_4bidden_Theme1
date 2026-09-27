"""Generate standalone interactive docs/diagrams/workflow.html from arch_workflow.json and workflow.html shell."""
import json
import os
import re

def build_workflow_html():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    template_path = os.path.join(base_dir, "docs", "diagrams", "workflow.html")
    workflow_json_path = os.path.join(base_dir, "docs", "diagrams", "arch_workflow.json")
    output_html_path = os.path.join(base_dir, "docs", "diagrams", "workflow.html")

    with open(workflow_json_path, "r", encoding="utf-8") as f:
        spec = json.load(f)

    with open(template_path, "r", encoding="utf-8") as f:
        template = f.read()

    # Lanes
    lanes = [
        {"id": "ui",        "y": 35,  "h": 100, "label": "01 / React Frontend (DURGA)"},
        {"id": "api",       "y": 145, "h": 100, "label": "02 / FastAPI Server (DURGA)"},
        {"id": "agent",     "y": 255, "h": 100, "label": "03 / Agent Controller (HEYTISH)"},
        {"id": "retrieval", "y": 365, "h": 100, "label": "04 / Retrieval Core (MITHUN)"},
        {"id": "graph",     "y": 475, "h": 100, "label": "05 / AST & Call Graph (NIVED + HEYTISH)"},
    ]

    lanes_svg = []
    for lane in lanes:
        y, h, lbl = lane["y"], lane["h"], lane["label"]
        lanes_svg.append(f'''        <rect data-graph-role="structural-frame" data-composition-frame-kind="lane" data-composition-frame-id="{lane["id"]}" x="30" y="{y}" width="1380" height="{h}" rx="8" class="c-lane" stroke-width="1"/>
        <text x="44" y="{y + 20}" class="t-dim" font-size="10" font-weight="600">{lbl}</text>''')
    lanes_str = "\n".join(lanes_svg)

    # Sigils
    sigils = {
        "external": '<rect x="2.5" y="5" width="8.5" height="8" rx="1.5"/><path d="M8 2.5h5.5V8M13.5 2.5 7.5 8.5"/>',
        "backend": '<path d="M6 3 3 8l3 5M10 3l3 5-3 5"/>',
        "database": '<ellipse cx="8" cy="4" rx="6" ry="2.5"/><path d="M2 4v8c0 1.38 2.69 2.5 6 2.5s6-1.12 6-2.5V4M2 8c0 1.38 2.69 2.5 6 2.5s6-1.12 6-2.5"/>',
        "messagebus": '<path d="M2 8h12M10 4l4 4-4 4M6 12 2 8l4-4"/>',
        "frontend": '<rect x="2" y="3" width="12" height="10" rx="1.5"/><path d="M2 6h12M5 4.5h.01M7 4.5h.01"/>'
    }

    # Nodes coordinates
    nodes_meta = {
        "user_query":   {"x": 60,   "y": 60,  "w": 130, "h": 56, "kind": "external", "label": "User Query",        "sublabel": "Natural language query"},
        "fastapi_req":  {"x": 210,  "y": 170, "w": 150, "h": 56, "kind": "backend",  "label": "POST /agent-query", "sublabel": "backend/app.py"},
        "search":       {"x": 380,  "y": 390, "w": 150, "h": 56, "kind": "backend",  "label": "Step 1: SEARCH",    "sublabel": "retrieve(top_k=10)"},
        "read":         {"x": 550,  "y": 500, "w": 150, "h": 56, "kind": "backend",  "label": "Step 2: READ",      "sublabel": "tools.read(seed_id)"},
        "expand":       {"x": 720,  "y": 500, "w": 150, "h": 56, "kind": "backend",  "label": "Step 3: EXPAND",    "sublabel": "tools.expand(seed_id)"},
        "rerank":       {"x": 890,  "y": 390, "w": 160, "h": 56, "kind": "backend",  "label": "Step 4: RERANK",    "sublabel": "tools.rerank(candidates)"},
        "fastapi_res":  {"x": 1070, "y": 170, "w": 150, "h": 56, "kind": "backend",  "label": "FastAPI Response",  "sublabel": "SearchResponse + trace"},
        "results_view": {"x": 1240, "y": 60,  "w": 150, "h": 56, "kind": "frontend", "label": "Results & Source",  "sublabel": "Top-5 + Monaco viewer"},
        "why_modal":    {"x": 1240, "y": 170, "w": 150, "h": 56, "kind": "frontend", "label": "Why This Result?",  "sublabel": "Score attribution modal"},
        "trace_view":   {"x": 1070, "y": 60,  "w": 150, "h": 56, "kind": "database", "label": "Trace Timeline",    "sublabel": "4-step execution log"},
    }

    nodes_svg = []
    for step_idx, (nid, n) in enumerate(nodes_meta.items()):
        x, y, w, h = n["x"], n["y"], n["w"], n["h"]
        kind, lbl, sub = n["kind"], n["label"], n["sublabel"]
        cx = x + w / 2
        sigil = sigils.get(kind, sigils["backend"])
        nodes_svg.append(f'''        <g id="node-{nid}" data-node-id="{nid}" data-node-label="{lbl}" tabindex="0" role="button" aria-label="Focus {lbl}, {sub}" aria-pressed="false" data-node-kind="{kind}" data-node-sublabel="{sub}">
          <title>{lbl} · {sub}</title>
          <rect x="{x}" y="{y}" width="{w}" height="{h}" rx="6" class="c-mask"/>
          <rect x="{x}" y="{y}" width="{w}" height="{h}" rx="6" class="c-{kind}" data-animate="node" style="--step:{step_idx}" stroke-width="1.5"/>
          <g aria-hidden="true" data-semantic-sigil="{kind}" class="semantic-sigil s-{kind}" transform="translate({x + 6} {y + 6}) scale(0.6875)">
            {sigil}
          </g>
          <text data-node-label="" data-detail-anchor="" x="{cx}" y="{y + 24}" class="t-primary" font-size="11" font-weight="600" text-anchor="middle">{lbl}</text>
          <text data-detail="context" x="{cx}" y="{y + 42}" class="t-muted" font-size="8" text-anchor="middle">{sub}</text>
        </g>''')
    nodes_str = "\n".join(nodes_svg)

    # Edges
    edges = [
        {"from": "user_query",  "to": "fastapi_req", "label": "fetch('/agent-query')", "variant": "emphasis", "step": 0, "path": "M 190 88 L 285 88 L 285 170"},
        {"from": "fastapi_req", "to": "search",      "label": "controller.run()",       "variant": "emphasis", "step": 1, "path": "M 285 226 L 285 418 L 380 418"},
        {"from": "search",      "to": "read",        "label": "seed_id (top candidate)","variant": "emphasis", "step": 2, "path": "M 455 446 L 455 528 L 550 528"},
        {"from": "read",        "to": "expand",      "label": "CodeDNA lookup",         "variant": "emphasis", "step": 3, "path": "M 700 528 L 720 528"},
        {"from": "expand",      "to": "rerank",      "label": "neighbor IDs",           "variant": "default",  "step": 4, "path": "M 870 528 L 970 528 L 970 446"},
        {"from": "search",      "to": "rerank",      "label": "candidate IDs",          "variant": "default",  "step": 5, "path": "M 530 405 L 890 405"},
        {"from": "rerank",      "to": "fastapi_res", "label": "SearchResponse",         "variant": "emphasis", "step": 6, "path": "M 970 390 L 970 198 L 1070 198"},
        {"from": "fastapi_res", "to": "results_view","label": "render snippets",        "variant": "emphasis", "step": 7, "path": "M 1145 170 L 1145 88 L 1240 88"},
        {"from": "fastapi_res", "to": "why_modal",   "label": "attribution scores",     "variant": "default",  "step": 8, "path": "M 1220 198 L 1240 198"},
        {"from": "fastapi_res", "to": "trace_view",  "label": "agent_trace[]",          "variant": "dashed",   "step": 9, "path": "M 1145 170 L 1145 116"},
    ]

    edges_svg = []
    for idx, e in enumerate(edges):
        fr, to, lbl, var, step, path = e["from"], e["to"], e["label"], e["variant"], e["step"], e["path"]
        marker = f"url(#arrowhead-{var})" if var in ["emphasis", "dashed"] else "url(#arrowhead)"
        stroke_w = "1.8" if var == "emphasis" else "1.4"
        edges_svg.append(f'''        <path data-edge-from="{fr}" data-edge-to="{to}" data-edge-label="{lbl}" data-edge-key="{idx}" data-edge-id="{fr}_{to}" d="{path}" class="a-{var}" data-animate="edge" style="--step:{step}" stroke-width="{stroke_w}" marker-end="{marker}"/>''')
    edges_str = "\n".join(edges_svg)

    # Cards HTML
    cards_html = []
    for c in spec["cards"]:
        dot, title = c["dot"], c["title"]
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

    # Full SVG
    workflow_svg = f'''      <svg viewBox="0 0 1440 650" role="img" lang="en" aria-labelledby="archify-diagram-title archify-diagram-description" data-animation="trace" data-preset="signal-flow" data-quality-profile="standard">
        <title id="archify-diagram-title">Agentic Code Intelligence — End-to-End Workflow &amp; 4-Step State Machine</title>
        <desc id="archify-diagram-description">React UI → FastAPI (/agent-query) → SEARCH → READ → EXPAND → RERANK → WhyThisResult</desc>
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

        <!-- Lanes -->
{lanes_str}

        <!-- Edges -->
{edges_str}

        <!-- Nodes -->
{nodes_str}

        <!-- Legend -->
        <g id="diagram-legend" class="diagram-legend" transform="translate(40, 595)">
          <g data-legend-semantic-kind="external" data-legend-label="User Query" data-legend-x="0">
            <rect x="0" y="0" width="14" height="9" rx="2" class="c-external" stroke-width="1"/>
            <text x="22" y="8" class="t-muted" font-size="8" font-weight="500">Query Input</text>
          </g>
          <g data-legend-semantic-kind="backend" data-legend-label="Core State Step" data-legend-x="110">
            <rect x="110" y="0" width="14" height="9" rx="2" class="c-backend" stroke-width="1"/>
            <text x="132" y="8" class="t-muted" font-size="8" font-weight="500">Core State Step</text>
          </g>
          <g data-legend-semantic-kind="frontend" data-legend-label="UI Deliverable" data-legend-x="240">
            <rect x="240" y="0" width="14" height="9" rx="2" class="c-frontend" stroke-width="1"/>
            <text x="262" y="8" class="t-muted" font-size="8" font-weight="500">UI Deliverable</text>
          </g>
          <g data-legend-semantic-kind="database" data-legend-label="Trace Log" data-legend-x="360">
            <rect x="360" y="0" width="14" height="9" rx="2" class="c-database" stroke-width="1"/>
            <text x="382" y="8" class="t-muted" font-size="8" font-weight="500">Trace Log</text>
          </g>
        </g>
      </svg>'''

    # Replace Title and Subtitle
    res = template
    res = re.sub(r'<title>.*?</title>', '<title>Agentic Code Intelligence — End-to-End Workflow & State Machine Diagram</title>', res, count=1)
    res = re.sub(r'<h1>.*?</h1>', '<h1>Agentic Code Intelligence — End-to-End Workflow & State Machine</h1>', res, count=1)
    res = re.sub(r'<p class="subtitle">.*?</p>', '<p class="subtitle">React UI → FastAPI (/agent-query) → SEARCH → READ → EXPAND → RERANK → WhyThisResult</p>', res, count=1)
    
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
    res = re.sub(svg_pattern, r'\1\n' + workflow_svg, res, flags=re.DOTALL)

    # Replace Cards block
    cards_pattern = r'(<div class="cards">).*?(</div>\s*<script id="archify-i18n")'
    new_cards_block = r'\1\n' + cards_str + '\n    ' + r'\2'
    res = re.sub(cards_pattern, new_cards_block, res, flags=re.DOTALL)

    # Write output HTML
    with open(output_html_path, "w", encoding="utf-8") as f:
        f.write(res)

    print(f"Successfully generated {output_html_path} ({len(res)} bytes)")

if __name__ == "__main__":
    build_workflow_html()
