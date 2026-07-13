# Milestone 1 — RAG Knowledge Base Setup

This project uses a lightweight local vector store (`knowledge-base/vector-store.json`) generated from the markdown documents in `knowledge-base/`.

## 1) Prerequisites
- Python installed
- (Recommended) create a virtual environment in `ai-service/`

## 2) Create venv & install dependencies
```bash
cd ai-service
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
```

## 3) Rebuild the vector store
```bash
cd ai-service
python build_knowledge_base.py
```

This will create/update:
- `knowledge-base/vector-store.json`

## 4) Start the FastAPI AI service (Ollama-backed)
Ensure Ollama is running locally, then:
```bash
cd ai-service
uvicorn app:app --reload --port 8000
```

FastAPI will:
- retrieve matching chunks from `vector-store.json`
- build a prompt including those chunks
- call Ollama at `http://localhost:11434/api/generate`

## 5) Verify retrieval (optional)
- `GET http://localhost:8000/knowledge/search?q=sql injection`

