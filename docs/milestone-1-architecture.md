# Milestone 1 Architecture

## Overall System

```text
User Browser
    |
    v
React UI served by Spring Boot
    |
    v
Spring Boot Backend
    |-- Code Submission API
    |-- File Upload API
    |-- AI Gateway API
    |
    v
FastAPI AI Service
    |-- RAG Retriever
    |-- Secure Code Review Prompt
    |-- PR Summary Prompt
    |
    v
Local Knowledge Base + Vector Store
    |
    v
Ollama LLM
    |
    v
Review Report
```

## Agent Workflow

```text
Submitted Code
    |
    v
Code Analysis Agent
    - language detection
    - syntax sanity checks
    - code smell review
    |
    v
Security Agent
    - OWASP mapping
    - SQL Injection, XSS, CSRF
    - broken access control
    - hardcoded secrets
    |
    v
Remediation Agent
    - safer code suggestions
    - secure coding guidance
    |
    v
PR Summary Agent
    - issue summary
    - risk level
    - recommended changes
```

## Data Flow

```text
Paste or Upload Code
    |
    v
Spring Boot validates extension, language, size, and basic syntax
    |
    v
Spring Boot stores submitted source in uploads/
    |
    v
Spring Boot sends code to FastAPI /review
    |
    v
FastAPI retrieves matching chunks from knowledge-base/vector-store.json
    |
    v
FastAPI sends RAG context + code to Ollama
    |
    v
AI review response is returned to React UI
```

## Knowledge Base Design

```text
knowledge-base/
    owasp-top-10.md
    java-secure-coding.md
    python-secure-coding.md
    vector-store.json

Each document is split into chunks.
Each chunk stores:
    id
    source document
    text
    keyword vector
```

The current project uses a lightweight local JSON vector store so it can run without internet downloads. It can later be replaced by ChromaDB or FAISS with Sentence Transformers.
