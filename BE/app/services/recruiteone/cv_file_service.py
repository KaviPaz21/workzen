from dataclasses import dataclass

from app.core.errors import InvalidRequestError, NotFoundError
from app.integrations.blob import BlobStorage
from app.services.recruiteone.workspace_service import check_id
from app.utils.documents import extract_text


@dataclass
class CvFileService:
    blob_storage: BlobStorage
    max_upload_bytes: int

    def validate(self, file_name: str, data: bytes) -> None:
        if not data:
            raise InvalidRequestError("The uploaded file is empty")
        if len(data) > self.max_upload_bytes:
            raise InvalidRequestError("The uploaded file exceeds the maximum allowed size")
        if not extract_text(file_name, data):
            raise InvalidRequestError("No readable text was found in the uploaded file")

    async def store(self, candidate_id: str, file_name: str, data: bytes, content_type: str) -> None:
        check_id(candidate_id)
        self.validate(file_name, data)
        await self.blob_storage.upload(candidate_id, data, content_type)

    async def fetch(self, candidate_id: str) -> tuple[bytes, str]:
        check_id(candidate_id)
        found = await self.blob_storage.fetch(candidate_id)
        if found is None:
            raise NotFoundError(f"No CV file is stored for {candidate_id}")
        return found
