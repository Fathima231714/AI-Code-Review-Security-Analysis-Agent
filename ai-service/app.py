from __future__ import annotations

import io
import json
import os
import re
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Literal

import requests
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, StreamingResponse
from pydantic import AliasChoices, BaseModel, Field

ROOT = Path(__file__).resolve().parent.parent
KNOWLEDGE_DIR = Path(os.getenv("KB_DIR", str(ROOT / "knowledge-base"))).resolve()
CHROMA_DIR = Path(os.getenv("CHROMA_DIR", str(ROOT / "knowledge-base" / "chroma"))).resolve()
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434/api/generate")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3")

app = FastAPI(title="AI Code Review & Security Analysis Service", version="2.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:8080"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])


class CodeRequest(BaseModel):
    code: str = Field(min_length=1, max_length=500_000)
    language: str | None = None
    submission_id: str | None = Field(default=None, validation_alias=AliasChoices("submission_id", "submissionId"))


class QuestionRequest(BaseModel):
    question: str = Field(min_length=1, max_length=5_000)
    review_id: str | None = None


class Finding(BaseModel):
    id: str
    title: str
    category: Literal["security", "quality", "performance"]
    severity: Literal["critical", "high", "medium", "low", "info"]
    owasp: str | None = None
    line: int | None = None
    evidence: str
    explanation: str
    recommendation: str


class Remediation(BaseModel):
    finding_id: str
    title: str
    explanation: str
    before_code: str | None = None
    after_code: str


class SourceMatch(BaseModel):
    id: str
    source: str
    text: str
    score: float


class ReviewResult(BaseModel):
    code_quality: list[Finding]
    findings: list[Finding]
    remediations: list[Remediation]
    pr_summary: str
    severity_breakdown: dict[str, int]
    rag_matches: list[SourceMatch]
    llm_notes: str | None = None


class ReportRequest(BaseModel):
    review: ReviewResult
    file_name: str = "Submission"
    language: str = "unknown"


def line_number(code: str, index: int) -> int:
    return code.count("\n", 0, index) + 1


def call_ollama(prompt: str) -> str | None:
    try:
        response = requests.post(OLLAMA_URL, json={"model": OLLAMA_MODEL, "prompt": prompt, "stream": False, "options": {"temperature": 0.2}}, timeout=90)
        response.raise_for_status()
        return response.json().get("response", "").strip() or None
    except requests.RequestException:
        return None


class KnowledgeBase:
    """LangChain + ChromaDB retrieval, with a small JSON fallback for offline demo use."""
    def __init__(self):
        self.store = None
        self.error: str | None = None
        try:
            from langchain_chroma import Chroma
            from langchain_huggingface import HuggingFaceEmbeddings
            self.embeddings = HuggingFaceEmbeddings(model_name=os.getenv("EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2"))
            self.store = Chroma(collection_name="secure_coding", persist_directory=str(CHROMA_DIR), embedding_function=self.embeddings)
        except Exception as exc:  # dependencies/model can be unavailable during first offline run
            self.error = str(exc)

    def rebuild(self) -> tuple[int, str]:
        if not self.store:
            return self._rebuild_json(), "JSON fallback (install requirements for ChromaDB)"
        from langchain_core.documents import Document
        from langchain_text_splitters import RecursiveCharacterTextSplitter
        docs = []
        splitter = RecursiveCharacterTextSplitter(chunk_size=900, chunk_overlap=120)
        for path in sorted(KNOWLEDGE_DIR.glob("*.md")):
            docs.extend(splitter.create_documents([path.read_text(encoding="utf-8")], metadatas=[{"source": path.name}]))
        if docs:
            self.store.delete_collection()
            from langchain_chroma import Chroma
            self.store = Chroma.from_documents(docs, self.embeddings, collection_name="secure_coding", persist_directory=str(CHROMA_DIR))
        return len(docs), "LangChain + ChromaDB + SentenceTransformers"

    def _rebuild_json(self) -> int:
        items = []
        for path in sorted(KNOWLEDGE_DIR.glob("*.md")):
            text = re.sub(r"\s+", " ", path.read_text(encoding="utf-8")).strip()
            for i in range(0, len(text), 780):
                items.append({"id": f"{path.stem}-{i // 780 + 1}", "source": path.name, "text": text[i:i + 900]})
        (KNOWLEDGE_DIR / "vector-store.json").write_text(json.dumps(items, indent=2), encoding="utf-8")
        return len(items)

    def search(self, query: str, limit: int = 4) -> list[SourceMatch]:
        if self.store:
            try:
                pairs = self.store.similarity_search_with_relevance_scores(query, k=limit)
                return [SourceMatch(id=f"{doc.metadata.get('source', 'kb')}-{i}", source=doc.metadata.get("source", "knowledge-base"), text=doc.page_content, score=round(float(score), 4)) for i, (doc, score) in enumerate(pairs, 1)]
            except Exception:
                pass
        file = KNOWLEDGE_DIR / "vector-store.json"
        if not file.exists():
            self._rebuild_json()
        terms = set(re.findall(r"[a-zA-Z]{3,}", query.lower()))
        records = json.loads(file.read_text(encoding="utf-8")) if file.exists() else []
        ranked = sorted(records, key=lambda r: len(terms.intersection(set(re.findall(r"[a-zA-Z]{3,}", r["text"].lower())))), reverse=True)[:limit]
        return [SourceMatch(id=r["id"], source=r["source"], text=r["text"], score=round(1 / (i + 1), 3)) for i, r in enumerate(ranked)]


knowledge_base = KnowledgeBase()


def rebuild_knowledge_base() -> tuple[int, str]:
    return knowledge_base.rebuild()


def make_finding(number: int, title: str, category: str, severity: str, evidence: str, explanation: str, recommendation: str, code: str, index: int, owasp: str | None = None) -> Finding:
    return Finding(id=f"F-{number:03}", title=title, category=category, severity=severity, owasp=owasp, line=line_number(code, index), evidence=evidence.strip()[:300], explanation=explanation, recommendation=recommendation)


def security_agent(code: str) -> tuple[list[Finding], list[Remediation]]:
    findings: list[Finding] = []
    fixes: list[Remediation] = []
    rules = [
        (r"(?i)(select|insert|update|delete).*?(\+|\.format\(|f['\"])", "SQL Injection", "critical", "A03:2021 Injection", "Database query appears to concatenate untrusted input.", "Use prepared/parameterized statements; never construct query text from input.", "String sql = \"SELECT * FROM users WHERE name = ?\";\nPreparedStatement ps = connection.prepareStatement(sql);\nps.setString(1, username);", "query construction"),
        (r"(?i)(innerHTML|document\.write)\s*=?.*", "Cross-Site Scripting (XSS)", "high", "A03:2021 Injection", "A DOM HTML sink is used directly.", "Use safe text APIs or framework escaping for untrusted values.", "element.textContent = userSuppliedValue;", "DOM write"),
        (r"(?i)csrf\s*\(?\s*(disable|false)", "CSRF Protection Disabled", "high", "A01:2021 Broken Access Control", "CSRF protection appears disabled.", "Keep CSRF protection enabled for cookie-authenticated browser requests.", "http.csrf(csrf -> csrf.csrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse()));", "CSRF configuration"),
        (r"(?i)(password|api[_-]?key|secret|token)\s*=\s*['\"][^'\"]{4,}", "Hardcoded Secret", "high", "A02:2021 Cryptographic Failures", "A likely credential is embedded in source code.", "Move secrets to a managed secret store or protected environment variable and rotate the exposed value.", "String apiKey = System.getenv(\"API_KEY\");\nif (apiKey == null) throw new IllegalStateException(\"API_KEY is required\");", "secret assignment"),
    ]
    for pattern, title, severity, owasp, explanation, recommendation, after, label in rules:
        match = re.search(pattern, code, re.DOTALL)
        if match:
            finding = make_finding(len(findings) + 1, title, "security", severity, match.group(0), explanation, recommendation, code, match.start(), owasp)
            findings.append(finding)
            fixes.append(Remediation(finding_id=finding.id, title=f"Fix: {title}", explanation=recommendation, before_code=match.group(0).strip()[:300], after_code=after))
    role = re.search(r"(?i)\b(role|admin)\b", code)
    if role and not re.search(r"(?i)(@PreAuthorize|hasRole|authorize|isAuthorized)", code):
        finding = make_finding(len(findings) + 1, "Possible Broken Access Control", "security", "high", role.group(0), "Role-sensitive logic was found without an obvious server-side authorization guard.", "Enforce authorization at every protected endpoint/service operation.", code, role.start(), "A01:2021 Broken Access Control")
        findings.append(finding)
        fixes.append(Remediation(finding_id=finding.id, title="Fix: enforce authorization", explanation=finding.recommendation, after_code='@PreAuthorize("hasRole(\'ADMIN\')")\npublic ResponseEntity<?> adminOperation() { ... }'))
    return findings, fixes


def code_analysis_agent(code: str) -> list[Finding]:
    results: list[Finding] = []
    long_lines = [(i, line) for i, line in enumerate(code.splitlines(), 1) if len(line) > 140]
    if long_lines:
        i, line = long_lines[0]
        results.append(Finding(id="Q-001", title="Overly long line", category="quality", severity="low", line=i, evidence=line[:300], explanation="Long lines reduce readability and make reviews harder.", recommendation="Extract expressions or wrap the statement into named variables."))
    branches = len(re.findall(r"\b(if|else if|elif|for|while|case|catch)\b", code))
    if branches > 8:
        results.append(Finding(id="Q-002", title="Elevated decision complexity", category="quality", severity="medium", evidence=f"Detected {branches} branch keywords.", explanation="Many branches in one submission can indicate a method that is difficult to test.", recommendation="Split logic into focused methods and cover edge cases with tests."))
    if re.search(r"(?i)catch\s*\([^)]*\)\s*\{\s*\}", code) or re.search(r"(?i)except\s*:\s*(pass|$)", code):
        m = re.search(r"(?i)catch\s*\([^)]*\)\s*\{\s*\}|except\s*:\s*(pass|$)", code)
        results.append(make_finding(3, "Exception silently ignored", "quality", "medium", m.group(0), "Discarding failures hides operational and security problems.", "Handle expected exceptions, log safely, and return a meaningful error.", code, m.start()))
        results[-1].id = "Q-003"
    method_count = len(re.findall(r"(?m)^\s*(?:public|private|protected|static|async\s+)?(?:[\w<>\[\]]+\s+)?\w+\s*\([^)]*\)\s*\{|^\s*(?:async\s+)?def\s+\w+\s*\(", code))
    if method_count > 8:
        results.append(Finding(id="Q-004", title="God class / excessive responsibilities", category="quality", severity="medium", evidence=f"Detected {method_count} methods/functions in one submission.", explanation="A large number of responsibilities in one class or module makes change, testing, and reuse difficult.", recommendation="Split cohesive responsibilities into focused classes/modules with clear interfaces."))
    return results


def pr_summary_agent(security: list[Finding], quality: list[Finding]) -> tuple[str, dict[str, int]]:
    all_findings = security + quality
    breakdown = {level: sum(f.severity == level for f in all_findings) for level in ["critical", "high", "medium", "low", "info"]}
    blocker = breakdown["critical"] + breakdown["high"]
    summary = f"## AI Code Review Summary\n\nFound **{len(all_findings)}** issue(s): {breakdown['critical']} critical, {breakdown['high']} high, {breakdown['medium']} medium, and {breakdown['low']} low. "
    summary += "Request changes before merge: resolve critical/high security findings and rotate any exposed credentials." if blocker else "No merge-blocking issue was detected by the automated checks; review the recommendations before merging."
    return summary, breakdown


def run_review(request: CodeRequest) -> ReviewResult:
    matches = knowledge_base.search(f"{request.language or ''} OWASP secure coding SQL injection XSS access control {request.code}")
    # Independent agents run concurrently; their results are merged by the PR Summary Agent.
    with ThreadPoolExecutor(max_workers=2, thread_name_prefix="review-agent") as executor:
        security_future = executor.submit(security_agent, request.code)
        quality_future = executor.submit(code_analysis_agent, request.code)
        security, remediations = security_future.result()
        quality = quality_future.result()
    summary, breakdown = pr_summary_agent(security, quality)
    context = "\n".join(f"[{m.source}] {m.text[:500]}" for m in matches)
    llm_notes = call_ollama(f"You are a concise senior secure-code reviewer. Based only on this secure-coding context and the findings, give two actionable review notes.\nContext:\n{context}\nFindings:\n{json.dumps([f.model_dump() for f in security + quality])}")
    return ReviewResult(code_quality=quality, findings=security, remediations=remediations, pr_summary=summary, severity_breakdown=breakdown, rag_matches=matches, llm_notes=llm_notes)


def render_report(report: ReportRequest) -> str:
    review = report.review
    rows = "".join(f"<tr><td>{f.severity.upper()}</td><td>{f.title}</td><td>{f.owasp or '—'}</td><td>{f.evidence}</td><td>{f.recommendation}</td></tr>" for f in review.findings + review.code_quality)
    fixes = "".join(f"<section><h3>{r.title}</h3><p>{r.explanation}</p><pre>{r.after_code}</pre></section>" for r in review.remediations)
    return f"""<!doctype html><html><head><meta charset='utf-8'><title>Code Review Report</title><style>body{{font:15px Arial;margin:36px;color:#172033}}h1{{color:#1d4ed8}}table{{border-collapse:collapse;width:100%}}th,td{{border:1px solid #ccd5e1;padding:8px;text-align:left;vertical-align:top}}th{{background:#eaf1ff}}pre{{background:#0f172a;color:#e2e8f0;padding:12px;white-space:pre-wrap}}.meta{{color:#526078}}</style></head><body><h1>AI Code Review & Security Analysis</h1><p class='meta'>File: {report.file_name} · Language: {report.language}</p><h2>Pull Request Summary</h2><p>{review.pr_summary}</p><h2>Severity Breakdown</h2><p>{', '.join(f'{k}: {v}' for k,v in review.severity_breakdown.items())}</p><h2>Findings</h2><table><thead><tr><th>Severity</th><th>Finding</th><th>OWASP</th><th>Evidence</th><th>Recommendation</th></tr></thead><tbody>{rows or '<tr><td colspan=5>No findings</td></tr>'}</tbody></table><h2>Remediation Roadmap</h2>{fixes or '<p>No specific remediation generated.</p>'}</body></html>"""


@app.get("/")
def home():
    return {"status": "running", "service": "AI Code Review", "rag_backend": "LangChain + ChromaDB" if knowledge_base.store else "offline JSON fallback", "ollama_model": OLLAMA_MODEL}


@app.post("/knowledge/rebuild")
def rebuild():
    count, backend = rebuild_knowledge_base()
    return {"chunks": count, "backend": backend}


@app.get("/knowledge/search")
def search_knowledge(q: str):
    return {"query": q, "matches": [m.model_dump() for m in knowledge_base.search(q)]}


@app.post("/ask")
def ask_knowledge(request: QuestionRequest):
    matches = knowledge_base.search(request.question)
    context = "\n\n".join(f"Source: {m.source}\n{m.text}" for m in matches)
    answer = call_ollama(f"You are a secure coding assistant. Answer only from this context, cite source filenames, and be concise.\n\n{context}\n\nQuestion: {request.question}")
    if not answer:
        answer = "Ollama is unavailable. Relevant secure-coding guidance is listed in the cited sources below."
    return {"answer": answer, "citations": [{"source": m.source, "id": m.id, "score": m.score} for m in matches], "matches": [m.model_dump() for m in matches]}


@app.post("/review")
def review_code(request: CodeRequest):
    review = run_review(request)
    return {"review": review.model_dump(), "response": review.pr_summary, "rag_matches": [m.model_dump() for m in review.rag_matches]}


@app.post("/reports/html", response_class=HTMLResponse)
def html_report(request: ReportRequest):
    return HTMLResponse(render_report(request), headers={"Content-Disposition": "attachment; filename=code-review-report.html"})


@app.post("/reports/pdf")
def pdf_report(request: ReportRequest):
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer
        from reportlab.lib.styles import getSampleStyleSheet
    except ImportError as exc:
        raise HTTPException(503, "PDF support is not installed. Run pip install -r requirements.txt") from exc
    output = io.BytesIO(); doc = SimpleDocTemplate(output, pagesize=A4); styles = getSampleStyleSheet()
    story = [Paragraph("AI Code Review & Security Analysis", styles["Title"]), Paragraph(f"File: {request.file_name} ({request.language})", styles["Normal"]), Spacer(1, 12), Paragraph(request.review.pr_summary.replace("\n", "<br/>"), styles["BodyText"])]
    for finding in request.review.findings + request.review.code_quality:
        story += [Spacer(1, 8), Paragraph(f"{finding.severity.upper()}: {finding.title}", styles["Heading3"]), Paragraph(finding.explanation + " " + finding.recommendation, styles["BodyText"])]
    doc.build(story); output.seek(0)
    return StreamingResponse(output, media_type="application/pdf", headers={"Content-Disposition": "attachment; filename=code-review-report.pdf"})
