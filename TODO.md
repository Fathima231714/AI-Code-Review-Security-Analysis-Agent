# TODO — AI Code Review & Security Analysis Agent

## Roadmap (per approved plan)

### 1) FastAPI: multi-agent pipeline + structured JSON schema
- [ ] Define response schema: code_quality, findings[], remediation[], pr_summary, rag_matches
- [x] Implement Agents (function modules):
  - [x] CodeAnalysisAgent
  - [x] SecurityVulnerabilityAgent (OWASP mapping + severity scoring)
  - [x] RemediationAgent (before/after + corrected code examples)
  - [x] PRSummaryAgent (aggregated summary)
- [ ] Update `POST /review` to return structured JSON (not only raw text)
- [ ] Keep backward compatibility: still include `response` string field for UI

### 2) FastAPI: LangChain + ChromaDB + SentenceTransformers
- [ ] Replace custom vector-store fallback
- [ ] Implement ingestion pipeline from `knowledge-base/*.md`
- [ ] Use ChromaDB (persistent) + embeddings (SentenceTransformers)
- [ ] Update retrieval used by agents and chat

### 3) Conversational assistant (RAG Q&A)
- [ ] Ensure `POST /ask` uses updated retrieval
- [ ] Return citations/sources per response

### 4) Report generation (HTML/PDF)
- [ ] Add template-based HTML report endpoint
- [ ] Add PDF generation endpoint
- [ ] Return downloadable artifact info to Spring Boot

### 5) Spring Boot: DTO updates + persistence (MySQL)
- [ ] Update request/response models to store structured review results
- [ ] Add MySQL schema + JPA entities
- [ ] Persist submissions, findings, remediation, reports, chat messages
- [ ] Add endpoints to download reports

### 6) React: structured findings UI + assistant UI + export UI
- [ ] Refactor `ReviewApp.jsx` to render findings cards with severity filters
- [ ] Add “Remediation” section per finding with code blocks
- [ ] Add “Export HTML/PDF” buttons
- [ ] Add Chat Assistant component + chat history

### 7) Integration & validation
- [ ] Rebuild knowledge base / Chroma index
- [ ] End-to-end test: paste/upload -> review -> chat -> export report
- [ ] Performance checks + error handling hardening

