"""Build the persistent ChromaDB secure-coding knowledge base."""
from app import rebuild_knowledge_base


if __name__ == "__main__":
    count, backend = rebuild_knowledge_base()
    print(f"Indexed {count} secure-coding chunks using {backend}.")
