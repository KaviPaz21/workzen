import asyncio
import logging
import math
import re
import time
from collections import Counter
from dataclasses import dataclass, field

from app.integrations.blob import BlobStorage
from app.utils.documents import extract_text

logger = logging.getLogger(__name__)

KNOWLEDGE_EXTENSIONS = (".pdf", ".docx", ".txt", ".md")
CHUNK_CHARACTERS = 900
REFRESH_SECONDS = 60
STOP_WORDS = frozenset(
    "a an and are as at be but by for from has have how i in is it its of on or that the this to was we what when where which who why will with you your".split()
)
TOKEN_PATTERN = re.compile(r"[a-z0-9]+")
BM25_K1 = 1.5
BM25_B = 0.75


@dataclass
class KnowledgeChunk:
    source: str
    text: str
    terms: Counter
    length: int


@dataclass
class KnowledgeHit:
    source: str
    text: str
    score: float


@dataclass
class IndexedDocument:
    etag: str
    chunks: list[KnowledgeChunk]


def tokenize(text: str) -> list[str]:
    return [token for token in TOKEN_PATTERN.findall(text.lower()) if token not in STOP_WORDS and len(token) > 1]


def split_into_chunks(text: str, size: int = CHUNK_CHARACTERS) -> list[str]:
    chunks: list[str] = []
    current = ""
    for paragraph in re.split(r"\n\s*\n|\r\n\s*\r\n", text):
        paragraph = " ".join(paragraph.split())
        if not paragraph:
            continue
        while len(paragraph) > size:
            cut = paragraph.rfind(" ", 0, size)
            cut = cut if cut > size // 2 else size
            if current:
                chunks.append(current)
                current = ""
            chunks.append(paragraph[:cut].strip())
            paragraph = paragraph[cut:].strip()
        if current and len(current) + len(paragraph) + 1 > size:
            chunks.append(current)
            current = ""
        current = f"{current} {paragraph}".strip()
    if current:
        chunks.append(current)
    return chunks


def build_chunks(source: str, text: str) -> list[KnowledgeChunk]:
    chunks = []
    for piece in split_into_chunks(text):
        tokens = tokenize(piece)
        if tokens:
            chunks.append(KnowledgeChunk(source=source, text=piece, terms=Counter(tokens), length=len(tokens)))
    return chunks


@dataclass
class KnowledgeIndex:
    documents: dict[str, IndexedDocument] = field(default_factory=dict)
    checked_at: float = 0.0
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)

    @property
    def document_count(self) -> int:
        return len(self.documents)

    async def refresh(self, storage: BlobStorage, force: bool = False) -> None:
        if not force and time.monotonic() - self.checked_at < REFRESH_SECONDS:
            return
        async with self.lock:
            if not force and time.monotonic() - self.checked_at < REFRESH_SECONDS:
                return
            listed = [info for info in await storage.list_documents() if info.name.lower().endswith(KNOWLEDGE_EXTENSIONS)]
            current = {info.name: info.etag for info in listed}
            for name in list(self.documents):
                if name not in current:
                    del self.documents[name]
            for info in listed:
                known = self.documents.get(info.name)
                if known and known.etag == info.etag:
                    continue
                try:
                    text = extract_text(info.name, await storage.download(info.name))
                except Exception:
                    logger.exception("Could not read knowledge document %s", info.name)
                    continue
                self.documents[info.name] = IndexedDocument(etag=info.etag, chunks=build_chunks(info.name, text))
            self.checked_at = time.monotonic()

    def search(self, query: str, limit: int) -> list[KnowledgeHit]:
        terms = list(dict.fromkeys(tokenize(query)))
        chunks = [chunk for document in self.documents.values() for chunk in document.chunks]
        if not terms or not chunks:
            return []
        average_length = sum(chunk.length for chunk in chunks) / len(chunks)
        frequency = {term: sum(1 for chunk in chunks if term in chunk.terms) for term in terms}
        hits = []
        for chunk in chunks:
            score = 0.0
            for term in terms:
                count = chunk.terms.get(term, 0)
                if count == 0:
                    continue
                idf = math.log(1 + (len(chunks) - frequency[term] + 0.5) / (frequency[term] + 0.5))
                score += idf * count * (BM25_K1 + 1) / (count + BM25_K1 * (1 - BM25_B + BM25_B * chunk.length / average_length))
            if score > 0:
                hits.append(KnowledgeHit(source=chunk.source, text=chunk.text, score=score))
        return sorted(hits, key=lambda hit: hit.score, reverse=True)[:limit]
