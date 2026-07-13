from pathlib import Path
import json
import re


ROOT = Path(__file__).resolve().parent.parent
KNOWLEDGE_DIR = ROOT / "knowledge-base"
VECTOR_FILE = KNOWLEDGE_DIR / "vector-store.json"


def tokenize(text: str) -> list[str]:
    return re.findall(r"[a-zA-Z][a-zA-Z0-9_]{2,}", text.lower())


def vectorize(text: str) -> dict[str, float]:
    vector: dict[str, float] = {}
    for token in tokenize(text):
        vector[token] = vector.get(token, 0.0) + 1.0
    return vector


def chunk_text(text: str, size: int = 900, overlap: int = 120) -> list[str]:
    normalized = re.sub(r"\s+", " ", text).strip()
    chunks = []
    start = 0
    while start < len(normalized):
        end = min(start + size, len(normalized))
        chunks.append(normalized[start:end])
        if end == len(normalized):
            break
        start = max(0, end - overlap)
    return chunks


def main() -> None:
    records = []
    for path in sorted(KNOWLEDGE_DIR.glob("*.md")):
        text = path.read_text(encoding="utf-8")
        for index, chunk in enumerate(chunk_text(text), start=1):
            records.append(
                {
                    "id": f"{path.stem}-{index}",
                    "source": path.name,
                    "text": chunk,
                    "vector": vectorize(chunk),
                }
            )
    VECTOR_FILE.write_text(json.dumps(records, indent=2), encoding="utf-8")
    print(f"Created {VECTOR_FILE} with {len(records)} searchable chunks.")


if __name__ == "__main__":
    main()
