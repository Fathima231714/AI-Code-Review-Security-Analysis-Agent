# AI Code Review & Security Analysis Agent

A full-stack developer portal for reviewing Java and Python source code. It combines a React interface, Spring Boot API, multi-agent FastAPI service, MySQL persistence, LangChain/ChromaDB RAG, SentenceTransformers embeddings, and a Gemini or Ollama conversational assistant.

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

2. Choose an LLM provider. For Gemini, set `GEMINI_API_KEY` in `.env` (and optionally `GEMINI_MODEL`). Otherwise, prepare Ollama and keep it running:

   ```powershell
   ollama pull llama3
   ollama serve
   ```

3. Start the platform:

   ```powershell
   docker compose up --build
   ```

4. Open http://localhost:5173. The API is available at http://localhost:8080 and the AI service at http://localhost:8000.

The platform still performs deterministic security and quality checks when no LLM is available; the chat assistant falls back to local secure-coding guidance. Gemini is used automatically when `GEMINI_API_KEY` is set, otherwise it uses Ollama.

## Run without Docker

Start MySQL, create database `code_review_ai`, then set `DB_URL`, `DB_USERNAME`, and `DB_PASSWORD`. In three terminals run:

```powershell
cd ai-service; python -m pip install -r requirements.txt; python build_knowledge_base.py; python -m uvicorn app:app --port 8000
cd springboot-backend\code-review-ai; .\mvnw.cmd spring-boot:run
cd react-frontend; npm install; npm run dev
```

## Notes

- The RAG collection persists in ChromaDB. First startup downloads the SentenceTransformers embedding model.
- Gemini is enabled with `GEMINI_API_KEY` and `GEMINI_MODEL`; Ollama is configured with `OLLAMA_URL` and `OLLAMA_MODEL`. Never commit real API keys.
- This project is an automated review aid, not a substitute for human security review or penetration testing.
