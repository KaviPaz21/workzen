import io
from pathlib import Path

from docx import Document
from pypdf import PdfReader

from app.core.errors import InvalidRequestError

SUPPORTED_EXTENSIONS = {".pdf", ".docx", ".txt"}


def extract_text(file_name: str, data: bytes) -> str:
    extension = Path(file_name).suffix.lower()
    if extension == ".pdf":
        reader = PdfReader(io.BytesIO(data))
        return "\n".join(page.extract_text() or "" for page in reader.pages).strip()
    if extension == ".docx":
        document = Document(io.BytesIO(data))
        return "\n".join(paragraph.text for paragraph in document.paragraphs).strip()
    if extension == ".txt":
        return data.decode("utf-8", errors="ignore").strip()
    raise InvalidRequestError("Unsupported file type. Upload a PDF, DOCX or TXT file.")
