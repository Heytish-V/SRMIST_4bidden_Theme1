"""Generate standalone interactive docs/diagrams/dataflow.html from arch_dataflow.json and workflow.html shell."""
import json
import os
import re

def build_dataflow_html():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    workflow_path = os.path.join(base_dir, "docs", "diagrams", "workflow.html")
    dataflow_json_path = os.path.join(base_dir, "docs", "diagrams", "arch_dataflow.json")
    output_html_path = os.path.join(base_dir, "docs", "diagrams", "dataflow.html")

    with open(dataflow_json_path, "r", encoding="utf-8") as f:
        spec = json.load(f)

    with open(workflow_path, "r", encoding="utf-8") as f:
        template = f.read()

    # Layout geometry: 6 stages
    # Viewbox: 0 0 1460 720
    col_x = [30, 265, 500, 735, 970, 1205]
    col_w = 220
    stage_names = [s["label"] for s in spec["stages"]]

    # Node positions: (id -> {x, y, w, h, kind, label, sublabel})
    node_coords = {
        "source":       {"x": 60,   "y": 90,  "w": 160, "h": 56, "kind": "external",   "label": "Python Source",       "sublabel": "demo_repo/ & .py"},
        "ast_parser":   {"x": 60,   "y": 210, "w": 160, "h": 56, "kind": "backend",    "label": "AST Parser",          "sublabel": "parser/ast_parser.py"},
        "chunker":      {"x": 60,   "y": 340, "w": 160, "h": 56, "kind": "backend",    "label": "Semantic Chunker",   "sublabel": "CodeChunk[]"},

        "code_dna":     {"x": 295,  "y": 90,  "w": 160, "h": 56, "kind": "database",   "label": "CodeDNA Store",       "sublabel": "indexing/code_dna.py"},
        "call_graph":   {"x": 295,  "y": 210, "w": 160, "h": 56, "kind": "messagebus", "label": "Call Graph",         "sublabel": "graph/call_graph.py"},

        "dense_idx":    {"x": 530,  "y": 90,  "w": 160, "h": 56, "kind": "database",   "label": "FAISS Index",        "sublabel": "BGE-small dense"},
        "sparse_idx":   {"x": 530,  "y": 210, "w": 160, "h": 56, "kind": "database",   "label": "BM25 Index",         "sublabel": "rank-bm25 tokens"},

        "dense_search": {"x": 765,  "y": 90,  "w": 160, "h": 56, "kind": "backend",    "label": "Dense Search",        "sublabel": "retrieval/dense_search.py"},
        "sparse_search":{"x": 765,  "y": 210, "w": 160, "h": 56, "kind": "backend",    "label": "Sparse Search",       "sublabel": "retrieval/sparse_search.py"},
        "fusion":       {"x": 765,  "y": 340, "w": 160, "h": 56, "kind": "backend",    "label": "RRF Fusion",          "sublabel": "reciprocal_rank(k=60)"},

        "reranker":     {"x": 1000, "y": 90,  "w": 160, "h": 56, "kind": "backend",    "label": "Explainable Reranker","sublabel": "sem + bm25 + sym + graph"},
        "agent":        {"x": 1000, "y": 210, "w": 160, "h": 56, "kind": "backend",    "label": "Agent Controller",    "sublabel": "SEARCH→READ→EXPAND→RERANK"},
        "trace":        {"x": 1000, "y": 340, "w": 160, "h": 56, "kind": "database",   "label": "Agent Trace",         "sublabel": "4-step reasoning log"},

        "fastapi_app":  {"x": 1235, "y": 90,  "w": 160, "h": 56, "kind": "backend",    "label": "FastAPI Server",      "sublabel": "backend/app.py (/agent-query)"},
        "react_ui":     {"x": 1235, "y": 210, "w": 160, "h": 56, "kind": "frontend",   "label": "React Frontend",      "sublabel": "frontend/App.jsx + Monaco"},
        "why_result":   {"x": 1235, "y": 330, "w": 160, "h": 56, "kind": "frontend",   "label": "Why This Result?",    "sublabel": "Score attribution modal"},
        "eval_bench":   {"x": 1235, "y": 445, "w": 160, "h": 56, "kind": "database",   "label": "Benchmark Suite",     "sublabel": "evaluate_pipeline.py (100% Pass)"},
    }

    # Generate Stage Backgrounds
    stages_svg = []
    for i, name in enumerate(stage_names):
        x = col_x[i]
        stages_svg.append(f'''        <rect data-graph-role="structural-frame" data-composition-frame-kind="lane" data-composition-frame-id="stage-{i}" x="{x}" y="35" width="{col_w}" height="540" rx="10" class="c-lane" stroke-width="1"/>
        <text x="{x + 14}" y="57" class="t-dim" font-size="10" font-weight="600">0{i + 1} / {name}</text>''')
    stages_str = "\n".join(stages_svg)

    # Sigil icons for semantic kinds
    sigils = {
        "external": '<rect x="2.5" y="5" width="8.5" height="8" rx="1.5"/><path d="M8 2.5h5.5V8M13.5 2.5 7.5 8.5"/>',
        "backend": '<path d="M6 3 3 8l3 5M10 3l3 5-3 5"/>',
        "database": '<ellipse cx="8" cy="4" rx="6" ry="2.5"/><path d="M2 4v8c0 1.38 2.69 2.5 6 2.5s6-1.12 6-2.5V4M2 8c0 1.38 2.69 2.5 6 2.5s6-1.12 6-2.5"/>',
        "messagebus": '<path d="M2 8h12M10 4l4 4-4 4M6 12 2 8l4-4"/>',
        "frontend": '<rect x="2" y="3" width="12" height="10" rx="1.5"/><path d="M2 6h12M5 4.5h.01M7 4.5h.01"/>'
    }

    # Generate Nodes
    nodes_svg = []
    step_idx = 0
    for nid, n in node_coords.items():
        x, y, w, h = n["x"], n["y"], n["w"], n["h"]
        kind = n["kind"]
        lbl = n["label"]
        sub = n["sublabel"]
        cx = x + w / 2
        sigil = sigils.get(kind, sigils["backend"])
        nodes_svg.append(f'''        <g id="node-{nid}" data-node-id="{nid}" data-node-label="{lbl}" tabindex="0" role="button" aria-label="Focus {lbl}, {sub}" aria-pressed="false" data-node-kind="{kind}" data-node-sublabel="{sub}">
          <title>{lbl} · {sub}</title>
          <rect x="{x}" y="{y}" width="{w}" height="{h}" rx="6" class="c-mask"/>
          <rect x="{x}" y="{y}" width="{w}" height="{h}" rx="6" class="c-{kind}" data-animate="node" style="--step:{step_idx}" stroke-width="1.5"/>
          <g aria-hidden="true" data-semantic-sigil="{kind}" class="semantic-sigil s-{kind}" transform="translate({x + 6} {y + 6}) scale(0.6875)">
            {sigil}
          </g>
          <text data-node-label="" data-detail-anchor="" x="{cx}" y="{y + 23}" class="t-primary" font-size="11" font-weight="600" text-anchor="middle">{lbl}</text>
          <text data-detail="context" x="{cx}" y="{y + 40}" class="t-muted" font-size="8" text-anchor="middle">{sub}</text>
        </g>''')
        step_idx += 1
    nodes_str = "\n".join(nodes_svg)

    # Edge paths
    edges = [
        {"from": "source", "to": "ast_parser", "label": "read", "variant": "emphasis", "step": 0, "path": "M 140 146 L 140 210"},
        {"from": "ast_parser", "to": "chunker", "label": "AST tree", "variant": "default", "step": 1, "path": "M 140 266 L 140 340"},
        {"from": "chunker", "to": "code_dna", "label": "build_code_dna()", "variant": "emphasis", "step": 2, "path": "M 220 368 L 255 368 L 255 118 L 295 118"},
        {"from": "code_dna", "to": "call_graph", "label": "calls[]", "variant": "emphasis", "step": 3, "path": "M 375 146 L 375 210"},
        {"from": "chunker", "to": "dense_idx", "label": "embed + index", "variant": "default", "step": 4, "path": "M 220 375 L 485 375 L 485 118 L 530 118"},
        {"from": "chunker", "to": "sparse_idx", "label": "tokenize + index", "variant": "default", "step": 5, "path": "M 220 385 L 485 385 L 485 238 L 530 238"},
        {"from": "dense_idx", "to": "dense_search", "label": "vector search", "variant": "default", "step": 6, "path": "M 690 118 L 765 118"},
        {"from": "sparse_idx", "to": "sparse_search", "label": "lexical search", "variant": "default", "step": 7, "path": "M 690 238 L 765 238"},
        {"from": "dense_search", "to": "fusion", "label": "dense scores", "variant": "default", "step": 8, "path": "M 845 146 L 845 340"},
        {"from": "sparse_search", "to": "fusion", "label": "sparse scores", "variant": "default", "step": 9, "path": "M 845 266 L 845 340"},
        {"from": "fusion", "to": "reranker", "label": "top-k candidates", "variant": "emphasis", "step": 10, "path": "M 925 368 L 960 368 L 960 118 L 1000 118"},
        {"from": "code_dna", "to": "reranker", "label": "symbol & signature", "variant": "default", "step": 11, "path": "M 455 118 L 475 118 L 475 62 L 980 62 L 980 108 L 1000 108"},
        {"from": "call_graph", "to": "reranker", "label": "graph neighbors", "variant": "dashed", "step": 12, "path": "M 455 238 L 480 238 L 480 72 L 985 72 L 985 118 L 1000 118"},
        {"from": "reranker", "to": "agent", "label": "reranked scores", "variant": "emphasis", "step": 13, "path": "M 1080 146 L 1080 210"},
        {"from": "agent", "to": "trace", "label": "step trace[]", "variant": "dashed", "step": 14, "path": "M 1080 266 L 1080 340"},
        {"from": "react_ui", "to": "fastapi_app", "label": "POST query", "variant": "emphasis", "step": 15, "path": "M 1315 210 L 1315 146"},
        {"from": "fastapi_app", "to": "agent", "label": "controller.run()", "variant": "emphasis", "step": 16, "path": "M 1235 118 L 1190 118 L 1190 238 L 1160 238"},
        {"from": "agent", "to": "fastapi_app", "label": "SearchResponse", "variant": "emphasis", "step": 17, "path": "M 1160 220 L 1180 220 L 1180 100 L 1235 100"},
        {"from": "fastapi_app", "to": "react_ui", "label": "results + trace", "variant": "emphasis", "step": 18, "path": "M 1335 146 L 1335 210"},
        {"from": "react_ui", "to": "why_result", "label": "explain candidate", "variant": "default", "step": 19, "path": "M 1315 266 L 1315 330"},
        {"from": "eval_bench", "to": "fastapi_app", "label": "eval metrics", "variant": "dashed", "step": 20, "path": "M 1395 470 L 1420 470 L 1420 118 L 1395 118"},
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
    dataflow_svg = f'''      <svg viewBox="0 0 1460 720" role="img" lang="en" aria-labelledby="archify-diagram-title archify-diagram-description" data-animation="trace" data-preset="signal-flow" data-quality-profile="standard">
        <title id="archify-diagram-title">Agentic Code Intelligence — End-to-End Data Pipeline</title>
        <desc id="archify-diagram-description">Source → AST Chunker → CodeDNA & Call Graph → FAISS & BM25 → Bounded Agent → FastAPI & React UI</desc>
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

        <!-- Stages / Columns -->
{stages_str}

        <!-- Edge paths with Channel Routing -->
{edges_str}

        <!-- Dataflow Nodes -->
{nodes_str}

        <!-- Legend -->
        <g id="diagram-legend" class="diagram-legend" transform="translate(40, 600)">
          <g data-legend-semantic-kind="external" data-legend-label="Source / Input" data-legend-x="0">
            <rect x="0" y="0" width="14" height="9" rx="2" class="c-external" stroke-width="1"/>
            <text x="22" y="8" class="t-muted" font-size="8" font-weight="500">Source / Input</text>
          </g>
          <g data-legend-semantic-kind="backend" data-legend-label="Core Component" data-legend-x="110">
            <rect x="110" y="0" width="14" height="9" rx="2" class="c-backend" stroke-width="1"/>
            <text x="132" y="8" class="t-muted" font-size="8" font-weight="500">Core Component</text>
          </g>
          <g data-legend-semantic-kind="database" data-legend-label="Index / Data Store" data-legend-x="240">
            <rect x="240" y="0" width="14" height="9" rx="2" class="c-database" stroke-width="1"/>
            <text x="262" y="8" class="t-muted" font-size="8" font-weight="500">Index / Data Store</text>
          </g>
          <g data-legend-semantic-kind="messagebus" data-legend-label="Graph Hierarchy" data-legend-x="380">
            <rect x="380" y="0" width="14" height="9" rx="2" class="c-messagebus" stroke-width="1"/>
            <text x="402" y="8" class="t-muted" font-size="8" font-weight="500">Graph Structure</text>
          </g>
          <g data-legend-semantic-kind="frontend" data-legend-label="API & UI Deliverable" data-legend-x="510">
            <rect x="510" y="0" width="14" height="9" rx="2" class="c-frontend" stroke-width="1"/>
            <text x="532" y="8" class="t-muted" font-size="8" font-weight="500">API & UI Deliverable</text>
          </g>
        </g>
      </svg>'''

    # Replace Title and Desc in template
    res = template
    res = re.sub(r'<title>.*?</title>', '<title>Agentic Code Intelligence — End-to-End Data Pipeline Diagram</title>', res, count=1)
    res = re.sub(r'<h1>.*?</h1>', '<h1>Agentic Code Intelligence — End-to-End Data Pipeline</h1>', res, count=1)
    res = re.sub(r'<p class="subtitle">.*?</p>', '<p class="subtitle">Source → AST Chunker → CodeDNA & Call Graph → FAISS & BM25 → Bounded Agent → FastAPI & React UI</p>', res, count=1)
    
    # Replace guided views data
    guided_views_json = json.dumps(spec["meta"]["views"])
    res = re.sub(
        r'<script id="archify-guided-views-data" type="application/json">.*?</script>',
        lambda m: f'<script id="archify-guided-views-data" type="application/json">{guided_views_json}</script>',
        res,
        count=1
    )

    # Replace SVG block: between <div class="diagram-container"...> and </svg>
    svg_pattern = r'(<div class="diagram-container"[^>]*>)\s*<svg.*?</svg>'
    res = re.sub(svg_pattern, r'\1\n' + dataflow_svg, res, flags=re.DOTALL)

    # Replace Cards block: between <div class="cards"> and </div>\s*<!--
    cards_pattern = r'(<div class="cards">).*?(</div>\s*<script id="archify-i18n")'
    new_cards_block = r'\1\n' + cards_str + '\n    ' + r'\2'
    res = re.sub(cards_pattern, new_cards_block, res, flags=re.DOTALL)

    # Write output HTML
    with open(output_html_path, "w", encoding="utf-8") as f:
        f.write(res)

    print(f"Successfully generated {output_html_path} ({len(res)} bytes)")

if __name__ == "__main__":
    build_dataflow_html()
