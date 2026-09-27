# 🚀 Samsung PRISM GenAI Hackathon 3.0 (2026–27)
## Theme 1: Agentic Code Intelligence

> **An explainable, CPU-optimized agentic code retrieval engine that combines AST-symbolic indexing, call-graph traversal, and hybrid dense-sparse search to locate, rank, and structurally verify code snippets across codebases and versions.**

---

## 📌 Overview & Architecture

Modern large codebases easily overwhelm standard LLM context windows, and naive vector RAG approaches suffer from semantic drift and lack awareness of code execution paths, syntax boundaries, and caller-callee hierarchies.

This system implements a multi-stage retrieval architecture:
1. **Tree-sitter AST Extraction & Code DNA**: Chunks strictly along syntactic boundaries (functions, classes, methods) with parameter, return, and call signature metadata.
2. **Dense & Sparse Hybrid Retrieval**: Combines sparse lexical matching (`rank-bm25`) and dense embeddings (`bge-small-en-v1.5` / FAISS) fused via **Reciprocal Rank Fusion (RRF)**.
3. **Directed Call-Graph & Structural Reasoning**: Models dependency hierarchies using NetworkX to answer structural and temporal queries (*e.g. "which function calls X before Y?"*).
4. **Bounded Agent State Machine**: Bounded 4-stage traversal (`SEARCH` → `READ` → `EXPAND` → `RERANK`) to iteratively follow dependency edges and verify relevance.
5. **Interactive UI & Benchmark Evaluation**: Streamlit / FastAPI + React UI with Monaco editor support, evaluated against MTEB `AppsRetrieval` (NDCG@10 / MRR).

```mermaid
flowchart LR
    subgraph P1["1. Parser & AST (Nived)"]
        direction TB
        AST["Tree-sitter AST Parser<br/><code>parser/ast_parser.py</code>"]
        Chunker["Semantic Chunker<br/><code>parser/chunker.py</code>"]
        DNA["CodeDNA Extractor<br/><code>indexing/code_dna.py</code>"]
        AST --> Chunker --> DNA
    end

    subgraph P2["2. Hybrid Retrieval (Mithun)"]
        direction TB
        FAISS["FAISS Dense Index<br/>(BGE-small-en-v1.5)"]
        BM25["BM25 Sparse Index<br/>(rank-bm25)"]
        RRF["Reciprocal Rank Fusion<br/><code>retrieval/fusion.py (k=60)</code>"]
        Rerank["Explainable Reranker<br/><code>retrieval/reranker.py</code>"]
        FAISS & BM25 --> RRF --> Rerank
    end

    subgraph P3["3. Agent & Call Graph (Heytish)"]
        direction TB
        Graph["NetworkX Call Graph<br/><code>graph/call_graph.py</code>"]
        Controller["Agentic Controller<br/><code>agent/controller.py</code>"]
        Tools["Agent Tools Loop<br/>SEARCH → READ → EXPAND → RERANK"]
        Graph --> Tools
        Controller --> Tools
    end

    subgraph P4["4. API & UI Layer (Durga)"]
        direction TB
        FastAPI["FastAPI REST Server<br/><code>backend/app.py</code><br/>(/agent-query, /trace, /evaluate)"]
        ReactUI["React Frontend UI<br/><code>frontend/src/App.jsx</code>"]
        WhyResult["Why This Result?<br/><code>components/WhyThisResult.jsx</code>"]
        FastAPI --> ReactUI --> WhyResult
    end

    subgraph Eval["Benchmark Suite (Evaluation)"]
        DemoRepo["demo_repo/<br/>(Synthetic E-Commerce)"]
        Benchmark["Pipeline Benchmark<br/><code>evaluation/evaluate_pipeline.py</code><br/>(100% Pass, 0.80 MRR@5)"]
        DemoRepo --> Benchmark
    end

    DNA ==>|CodeChunk[] + CodeDNA| P2
    DNA -->|calls[]| Graph
    Rerank ==>|Ranked Candidates| Controller
    Controller ==>|SearchResponse + trace| FastAPI
    Benchmark -.->|validate metrics| FastAPI
```

> 📊 **Interactive Visual Architecture & Workflow Diagrams (Archify Standalone HTML):**
> - [System Architecture Diagram (Interactive HTML)](docs/diagrams/architecture.html) — Full component wiring across all 4 pillars, pipeline caching, and evaluation suite.
> - [Agent State Machine Workflow (Interactive HTML)](docs/diagrams/workflow.html) — End-to-end 4-stage bounded execution (`SEARCH` $\to$ `READ` $\to$ `EXPAND` $\to$ `RERANK`) with UI delivery.
> - [Dataflow Pipeline Diagram (Interactive HTML)](docs/diagrams/dataflow.html) — Complete 6-stage dataflow from AST chunking to FAISS/BM25 indexes, RRF fusion, FastAPI, and React explainability.

---

## 👥 Team & Modules

| Member | Focus Area | Key Deliverables & Plans |
| :--- | :--- | :--- |
| **Heytish** | Integration & Agent Graph | Agent Controller (`SEARCH` $\to$ `READ` $\to$ `EXPAND` $\to$ `RERANK`), NetworkX Call Graph, Structural Query Engine, Pipeline Wiring ([View Plan](Implementation%20Plans/HEYTISH_INTEGRATION_AGENT.md)) |
| **Nived** | Parser & AST Indexing | Tree-sitter Parser, Code DNA Extractor, AST Chunker along syntax boundaries ([View Plan](Implementation%20Plans/NIVED_PARSER_AST_INDEXING.md)) |
| **Mithun** | Retrieval & ML Core | FAISS Dense Vector Index, BM25 Sparse Index, RRF Fusion ($k=60$), Explainable Reranker ([View Plan](Implementation%20Plans/MITHUN_RETRIEVAL_ML_CORE.md)) |
| **Durga** | API & Frontend UI | FastAPI REST Endpoints, Interactive React UI, "Why This Result?" Explainability Modal, Benchmark Suite ([View Plan](Implementation%20Plans/DURGA_FRONTEND_API_EVALUATION.md)) |

---

## 📂 Repository Structure

```text
├── agent/                                  # Bounded Agent Controller & Tools Loop
│   ├── controller.py                       # SEARCH → READ → EXPAND → RERANK state machine
│   └── tools.py                            # Agent tools wrapper (retrieve, read, expand, rerank)
├── backend/                                # FastAPI Backend Service
│   ├── app.py                              # REST endpoints (/query, /agent-query, /trace, /source, /evaluate)
│   └── schemas.py                          # Pydantic contracts for queries, responses, and traces
├── demo_repo/                              # Synthetic Multi-tier E-commerce Codebase for Benchmarking
│   ├── api/routes.py                       # Authentication & order routes
│   ├── auth/ (crypto.py, service.py)       # Password hashing & JWT validation
│   ├── db/ (connection.py, query_executor.py) # Connection pool & query execution
│   └── orders/checkout.py                  # Order processing, validation & cancellation
├── docs/
│   ├── diagrams/                           # Interactive HTML Diagrams & Archify Specs
│   │   ├── architecture.html               # Interactive System Architecture Diagram
│   │   ├── workflow.html                   # Interactive 4-Stage Agent State Machine Diagram
│   │   ├── dataflow.html                   # Interactive End-to-End Data Pipeline Diagram
│   │   ├── arch_architecture.json          # System Architecture Specification (Archify)
│   │   ├── arch_workflow.json              # Agent Workflow Specification (Archify)
│   │   └── arch_dataflow.json              # Data Pipeline Specification (Archify)
│   ├── PARSER_DEMO.md                      # Parser Demo Walkthrough
│   └── PARSER_INTEGRATION.md               # Parser Integration Guide
├── evaluation/                             # End-to-End Evaluation Suite
│   ├── evaluate_pipeline.py                # 10-query benchmark runner across 4 categories
│   └── eval_results.json                   # Verified benchmark metrics (100% Pass, 0.80 MRR)
├── frontend/                               # Interactive React + Tailwind UI
│   ├── src/App.jsx                         # Main Search, 4-Stage Trace Timeline & Code Inspector
│   └── src/components/WhyThisResult.jsx    # Explainability breakdown & score attribution
├── graph/                                  # Dependency & Call Graph Engine
│   └── call_graph.py                       # NetworkX DiGraph builder & caller-callee resolution
├── indexing/                               # CodeDNA & Version Management
│   ├── code_dna.py                         # AST symbol metadata (params, calls, imports, signatures)
│   └── version_manager.py                  # Codebase diffing & incremental indexing
├── parser/                                 # Tree-sitter AST & Semantic Chunking
│   ├── ast_parser.py                       # AST node visitor and extraction
│   └── chunker.py                          # Boundary-aware function & class chunker
├── retrieval/                              # Hybrid Dense + Sparse Search Engine
│   ├── dense_search.py                     # BGE-small-en-v1.5 + FAISS vector index
│   ├── sparse_search.py                    # rank-bm25 lexical inverted index
│   ├── fusion.py                           # Reciprocal Rank Fusion (RRF, k=60)
│   ├── reranker.py                         # Explainable multi-factor scoring (sem, bm25, sym, graph)
│   └── engine.py                           # Unified RetrievalEngine orchestrator
├── scripts/                                # Standalone Generators & Benchmark Scripts
│   ├── generate_architecture_diagram.py    # Generates docs/diagrams/architecture.html
│   ├── generate_dataflow_diagram.py        # Generates docs/diagrams/dataflow.html
│   ├── generate_workflow_diagram.py        # Generates docs/diagrams/workflow.html
│   └── benchmark_performance.py            # Parser micro-benchmarks
├── pipeline_wiring.py                      # Master pipeline scan, index build, and agent caching
└── README.md
```

---

## 🎯 Benchmark Results (`evaluation/eval_results.json`)

Evaluated against the synthetic multi-tier benchmark repository (`demo_repo/`) across 10 realistic queries spanning semantic search, symbol lookup, call-chains, and structural ordering:

| Metric | Target | Achieved Result | Status |
| :--- | :--- | :--- | :--- |
| **Pass Rate** | $\ge 90\%$ | **100% (10 / 10 queries)** | ✅ Passed |
| **MRR@5** | $\ge 0.70$ | **0.80** | ✅ Exceeded |
| **Recall@5** | $\ge 0.75$ | **0.80** | ✅ Exceeded |
| **File Recall@5** | $\ge 0.80$ | **0.85** | ✅ Exceeded |
| **Median Latency** | $\le 500\text{ ms}$ | **33.6 ms (CPU)** | ⚡ 15x faster than target |
| **P95 Latency** | $\le 2000\text{ ms}$ | **177.7 ms (CPU)** | ⚡ 11x faster than target |
| **Hardware** | Zero GPU / CPU-only | **100% CPU Compatible** | ✅ Verified |

