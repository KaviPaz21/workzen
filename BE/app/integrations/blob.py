from dataclasses import dataclass

from azure.core.exceptions import ResourceExistsError, ResourceNotFoundError
from azure.storage.blob import ContentSettings
from azure.storage.blob.aio import BlobServiceClient, ContainerClient

from app.core.config import Settings


@dataclass
class BlobStorage:
    container: ContainerClient

    async def upload(self, blob_name: str, data: bytes, content_type: str) -> str:
        await self.container.upload_blob(
            name=blob_name,
            data=data,
            overwrite=True,
            content_settings=ContentSettings(content_type=content_type),
        )
        return blob_name

    async def download(self, blob_name: str) -> bytes:
        stream = await self.container.download_blob(blob_name)
        return await stream.readall()

    async def fetch(self, blob_name: str) -> tuple[bytes, str] | None:
        try:
            stream = await self.container.download_blob(blob_name)
        except ResourceNotFoundError:
            return None
        data = await stream.readall()
        content_type = stream.properties.content_settings.content_type or "application/octet-stream"
        return data, content_type

    async def delete(self, blob_name: str) -> None:
        try:
            await self.container.delete_blob(blob_name)
        except ResourceNotFoundError:
            return


async def connect_blob_storage(settings: Settings) -> tuple[BlobServiceClient, BlobStorage]:
    service = BlobServiceClient.from_connection_string(settings.azure_storage_connection_string.get_secret_value())
    container = service.get_container_client(settings.azure_storage_container_cvs)
    try:
        await container.create_container()
    except ResourceExistsError:
        pass
    return service, BlobStorage(container=container)
