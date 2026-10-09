from dataclasses import dataclass
from pathlib import PurePath
from uuid import uuid4

from app.core.errors import InvalidRequestError
from app.integrations.blob import BlobStorage
from app.services.base import ResourceService
from app.utils.documents import extract_text


@dataclass
class CvPoolService(ResourceService):
    blob_storage: BlobStorage
    max_upload_bytes: int

    async def upload(
        self,
        file_name: str,
        content_type: str,
        data: bytes,
        full_name: str,
        email: str,
        current_title: str,
    ) -> dict:
        if not data:
            raise InvalidRequestError("The uploaded file is empty")
        if len(data) > self.max_upload_bytes:
            raise InvalidRequestError("The uploaded file exceeds the maximum allowed size")
        cv_text = extract_text(file_name, data)
        if not cv_text:
            raise InvalidRequestError("No readable text was found in the uploaded file")
        candidate_id = str(uuid4())
        safe_name = PurePath(file_name).name
        blob_name = await self.blob_storage.upload(f"{candidate_id}/{safe_name}", data, content_type)
        record = {
            "id": candidate_id,
            "full_name": full_name or PurePath(safe_name).stem,
            "email": email,
            "phone": "",
            "current_title": current_title,
            "skills": [],
            "file_name": safe_name,
            "blob_name": blob_name,
            "cv_text": cv_text,
            "status": "new",
        }
        return await super().create(record)

    async def delete(self, item_id: str) -> None:
        candidate = await self.get(item_id)
        await self.blob_storage.delete(candidate["blob_name"])
        await super().delete(item_id)
