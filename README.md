# AI Code Review and Security Analysis

Milestone 1 project for secure Java/Python code submission and RAG-assisted review.

## Modules

- `react-frontend`: React UI for paste/upload validation.
- `springboot-backend/code-review-ai`: Spring Boot REST API for code submission.
- `ai-service`: FastAPI service for RAG search and Ollama review.
- `knowledge-base`: Initial OWASP, Java, and Python secure coding documents.
- `docs`: Architecture diagrams and study notes.

## Run

```powershell
cd springboot-backend\code-review-ai
.\mvnw spring-boot:run
```

```powershell
cd react-frontend
npm install
npm run dev
```

```powershell
cd ai-service
python -m pip install -r requirements.txt
python build_knowledge_base.py
uvicorn app:app --reload --port 8000
```

Start Ollama separately when you want generated reviews:

```powershell
ollama pull llama3
ollama serve
```

## Key Endpoints

- `POST http://localhost:8080/api/submissions/paste`
- `POST http://localhost:8080/api/submissions/upload`
- `GET http://localhost:8000/knowledge/search?q=sql injection`
- `POST http://localhost:8000/review`
