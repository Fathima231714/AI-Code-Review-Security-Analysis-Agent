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

1. Create the local environment file and set strong MySQL passwords. Docker Compose starts a persistent MySQL 8 database automatically; you do not need to start the Windows MySQL service for this mode. The password is intentionally not stored in this repository.

   ```powershell
   Copy-Item .env.example .env
   notepad .env
   ```

2. Choose the real chatbot provider. Set `GEMINI_API_KEY` in `.env` for broad natural-language answers, or run Ollama locally for an offline model. Without either provider the application remains usable, but the assistant is limited to its local secure-coding knowledge base.

   ```powershell
   ollama pull llama3
   ollama serve
   ```

3. Start the platform (the first build can take several minutes because it downloads the RAG embedding model and Python packages):

   ```powershell
   docker compose up --build
   ```

4. Open http://localhost:5173. The API is available at http://localhost:8080 and the AI service at http://localhost:8000. Docker keeps MySQL, uploaded files, and the Chroma index in named volumes across restarts.

The application detects Java or Python from source syntax automatically, runs deterministic security and quality checks, and displays a severity dashboard and risk radar. The chat assistant uses the active findings, chat history, and retrieved secure-coding sources in every answer. Gemini is used automatically when `GEMINI_API_KEY` is set; otherwise it uses Ollama.

## Run without Docker

Start MySQL, create database `code_review_ai`, then set `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`, and `DB_DRIVER=com.mysql.cj.jdbc.Driver`. In three terminals run:

```powershell
cd ai-service; python -m pip install -r requirements.txt; python build_knowledge_base.py; python -m uvicorn app:app --port 8000
cd springboot-backend\code-review-ai; .\mvnw.cmd spring-boot:run
cd react-frontend; npm install; npm run dev
```

## Notes

- The RAG collection persists in ChromaDB. First startup downloads the SentenceTransformers embedding model.
- Gemini is enabled with `GEMINI_API_KEY` and `GEMINI_MODEL`; Ollama is configured with `OLLAMA_URL` and `OLLAMA_MODEL`. Never commit real API keys.
- This project is an automated review aid, not a substitute for human security review or penetration testing.

## Quick verification

```powershell
docker compose ps
docker compose logs --tail 80 ai-service
Invoke-WebRequest http://localhost:8000/ | Select-Object StatusCode, Content
```

All four services (`mysql`, `ai-service`, `backend`, and `frontend`) should be running before opening the dashboard.

