from pathlib import Path
from typing import List
import json
import math
import os
import re

import requests
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel


ROOT = Path(__file__).resolve().parent.parent
KNOWLEDGE_DIR = ROOT / "knowledge-base"
VECTOR_FILE = KNOWLEDGE_DIR / "vector-store.json"

# Allow moving knowledge base/vector store to external drive to save C:
KNOWLEDGE_BASE_DIR = Path(os.getenv("KB_DIR", str(KNOWLEDGE_DIR))).resolve()
VECTOR_FILE = Path(os.getenv("VECTOR_FILE", str(VECTOR_FILE))).resolve()

OLLAMA_URL = "http://localhost:11434/api/generate"
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3")

app = FastAPI(title="AI Code Review Service", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8080",
        "http://127.0.0.1:8080",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class CodeRequest(BaseModel):
    code: str
    language: str | None = None


class QuestionRequest(BaseModel):
    question: str


def tokenize(text: str) -> list[str]:
    return re.findall(r"[a-zA-Z][a-zA-Z0-9_]{2,}", text.lower())


def vectorize(text: str) -> dict[str, float]:
    vector: dict[str, float] = {}
    for token in tokenize(text):
        vector[token] = vector.get(token, 0.0) + 1.0
    return vector


def cosine(left: dict[str, float], right: dict[str, float]) -> float:
    numerator = sum(value * right.get(key, 0.0) for key, value in left.items())
    left_norm = math.sqrt(sum(value * value for value in left.values()))
    right_norm = math.sqrt(sum(value * value for value in right.values()))
    if left_norm == 0 or right_norm == 0:
        return 0.0
    return numerator / (left_norm * right_norm)


def load_store() -> list[dict]:
    if not VECTOR_FILE.exists():
        return []
    return json.loads(VECTOR_FILE.read_text(encoding="utf-8"))



def retrieve_context(query: str, limit: int = 4) -> list[dict]:
    query_vector = vectorize(query)
    scored = []
    for chunk in load_store():
        score = cosine(query_vector, chunk.get("vector", {}))
        if score > 0:
            scored.append({**chunk, "score": round(score, 4)})
    return sorted(scored, key=lambda item: item["score"], reverse=True)[:limit]


def call_ollama(prompt: str) -> str:
    response = requests.post(
        OLLAMA_URL,
        json={"model": OLLAMA_MODEL, "prompt": prompt, "stream": False},
        timeout=90,
    )
    response.raise_for_status()
    return response.json().get("response", "")


def local_security_review(code: str, language: str | None, matches: list[dict]) -> str:
    lower = code.lower()
    findings: list[str] = []

    if "select " in lower and ("+" in code or ".format(" in lower or "f\"" in code or "f'" in code):
        findings.append(
            "- SQL Injection: query text appears to be built with direct string interpolation or concatenation."
        )
    if "innerhtml" in lower or "document.write" in lower:
        findings.append("- XSS: code writes directly to HTML/DOM sinks.")
    if "csrf" in lower and ("disable" in lower or "false" in lower):
        findings.append("- CSRF: protection appears disabled or bypassed.")
    if any(secret in lower for secret in ["password", "apikey", "api_key", "secret", "token"]):
        findings.append("- Hardcoded Secrets: sensitive names are present in source code.")
    if "role" in lower and ("admin" in lower or "user" in lower) and "authorize" not in lower:
        findings.append("- Broken Access Control: role-sensitive logic should enforce server-side authorization.")

    if not findings:
        findings.append("- No obvious OWASP issue was detected by the local fallback scanner.")

    sources = ", ".join(sorted({match.get("source", "knowledge-base") for match in matches})) or "knowledge-base"

    return f"""Ollama could not generate on this machine, so this report uses the local RAG fallback scanner.

1. Code Quality
- Language detected: {language or "unknown"}.
- Keep validation, error handling, and security checks close to the backend trust boundary.

2. Security Issues
{chr(10).join(findings)}

3. Performance Improvements
- Avoid repeated string-building for queries or HTML output.
- Prefer prepared statements, safe template APIs, and framework security utilities.

4. Secure Remediation Steps
- Use parameterized queries for all database access.
- Do not hardcode passwords, API keys, tokens, or secrets.
- Keep CSRF protection enabled for browser-based state-changing requests.
- Validate authorization on the server for every protected action.
- Encode output before rendering user-controlled values.

5. Pull Request Summary
- Added secure-code review findings using RAG context from: {sources}.
- Recommended remediation follows OWASP and Java/Python secure coding guidance.
"""


@app.get("/")
def home():
    return {
        "status": "running",
        "service": "AI Code Review",
        "rag_chunks": len(load_store()),
        "ollama_model": OLLAMA_MODEL,
    }


@app.get("/knowledge/search")
def search_knowledge(q: str):
    return {"query": q, "matches": retrieve_context(q)}


@app.post("/ask")
def ask_knowledge(request: QuestionRequest):
    matches = retrieve_context(request.question)
    context = "\n\n".join(match["text"] for match in matches)
    prompt = f"""
You are a secure coding mentor. Answer using only the context below.
If the context is not enough, say what document should be added.

Context:
{context}

Question:
{request.question}
"""
    try:
        answer = call_ollama(prompt)
    except requests.RequestException as exc:
        answer = (
            "Ollama could not generate an answer on this machine. "
            f"Reason: {exc}. Relevant knowledge-base chunks are returned in matches."
        )
    return {"answer": answer, "matches": matches}


@app.post("/review")
def review_code(request: CodeRequest):
    query = f"{request.language or ''} secure code review OWASP SQL injection XSS CSRF hardcoded secrets\n{request.code}"
    matches = retrieve_context(query)
    context = "\n\n".join(match["text"] for match in matches)

    prompt = f"""
You are a senior secure-code reviewer.

Use this RAG context:
{context}

Review the code below and return:
1. Code Quality
2. Security Issues mapped to OWASP where possible
3. Performance Improvements
4. Secure Remediation Steps
5. Pull Request Summary

Code:
{request.code}
"""
    try:
        answer = call_ollama(prompt)
    except requests.RequestException:
        answer = local_security_review(request.code, request.language, matches)

    # Return structured JSON for Milestone completion (frontend can render response safely)
    return {
        "review": {
            "code_quality": None,
            "security_issues": None,
            "performance_improvements": None,
            "secure_remediation": None,
            "pr_summary": None,
            "raw_response": answer,
        },
        "response": answer,
        "rag_matches": matches,
    }

