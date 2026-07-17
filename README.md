# AI Code Review & Security Analysis Agent

A full-stack developer portal for reviewing Java and Python source code. It combines a React interface, Spring Boot API, multi-agent FastAPI service, MySQL persistence, LangChain/ChromaDB RAG, SentenceTransformers embeddings, and Ollama Llama 3 (or an optional OpenAI-compatible gateway).

## Implemented modules

| Requirement | Implementation |
| --- | --- |
| Code submission | Paste or upload `.java` / `.py`, basic validation and safe upload storage |
| Code Analysis Agent | Long-line, decision-complexity, and swallowed-exception checks |
| Security Agent | SQL injection, XSS, CSRF, secrets, and access-control heuristics mapped to OWASP 2021 |
| Remediation Agent | Per-finding recommendation and corrected code snippet |
| PR Summary Agent | Severity breakdown and merge recommendation |
| RAG assistant | LangChain + ChromaDB + SentenceTransformers retrieval with source citations |
| Reports | Downloadable HTML and PDF reports |
| Storage | MySQL review/submission/chat persistence via Spring Data JPA |

## Run with Docker (recommended)

1. Create the local environment file and put your MySQL password in it. The password is intentionally not stored in this repository.

   ```powershell
   Copy-Item .env.example .env
   notepad .env
   ```

2. If using Ollama, prepare the model and keep Ollama running:

   ```powershell
   ollama pull llama3
   ollama serve
   ```

3. Start the platform:

   ```powershell
   docker compose up --build
   ```

4. Open http://localhost:5173. The API is available at http://localhost:8080 and the AI service at http://localhost:8000.

The platform still performs deterministic security and quality checks when Ollama is unavailable; only generated review notes and natural-language RAG answers require it.

## Run without Docker

Start MySQL, create database `code_review_ai`, then set `DB_URL`, `DB_USERNAME`, and `DB_PASSWORD`. In three terminals run:

```powershell
cd ai-service; python -m pip install -r requirements.txt; python build_knowledge_base.py; python -m uvicorn app:app --port 8000
cd springboot-backend\code-review-ai; .\mvnw.cmd spring-boot:run
cd react-frontend; npm install; npm run dev
```

## Notes

- The RAG collection persists in ChromaDB. First startup downloads the SentenceTransformers embedding model.
- Ollama is enabled with `OLLAMA_URL` and `OLLAMA_MODEL`. To use OpenAI instead, replace `call_ollama` in `ai-service/app.py` with the OpenAI LangChain chat client and set its API key as an environment variable; no key should be committed.
- This project is an automated review aid, not a substitute for human security review or penetration testing.
