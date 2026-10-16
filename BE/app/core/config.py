from functools import lru_cache
from pathlib import Path

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "WorkZen API"
    app_env: str = "development"
    api_prefix: str = "/api/v1"
    cors_origins: list[str] = []
    max_upload_mb: int = 10

    cosmos_endpoint: str = ""
    cosmos_key: SecretStr = SecretStr("")
    cosmos_database: str = ""
    cosmos_container_jds: str = "jds"
    cosmos_container_vacancies: str = "vacancies"
    cosmos_container_candidates: str = "candidates"
    cosmos_container_evaluations: str = "evaluations"
    cosmos_container_records: str = "records"

    azure_storage_connection_string: SecretStr = SecretStr("")
    azure_storage_container_cvs: str = "cvs"
    azure_storage_container_kb: str = "knowledge"

    foundry_endpoint: str = ""
    foundry_api_key: SecretStr = SecretStr("")
    foundry_api_version: str = ""
    foundry_chat_deployment: str = ""
    foundry_evaluator_deployment: str = ""

    assistant_models: str = ""
    coworker_download_url: str = ""
    coworker_installer_path: str = ""

    @property
    def cosmos_configured(self) -> bool:
        return bool(self.cosmos_endpoint and self.cosmos_key.get_secret_value() and self.cosmos_database)

    @property
    def blob_configured(self) -> bool:
        return bool(self.azure_storage_connection_string.get_secret_value())

    @property
    def foundry_configured(self) -> bool:
        return bool(self.foundry_endpoint and self.foundry_api_key.get_secret_value() and self.foundry_chat_deployment)

    @property
    def assistant_model_list(self) -> list[str]:
        listed = [name.strip() for name in self.assistant_models.split(",") if name.strip()]
        if listed:
            return listed
        return [self.foundry_chat_deployment] if self.foundry_chat_deployment else []

    @property
    def coworker_installer_file(self) -> Path | None:
        if not self.coworker_installer_path:
            return None
        path = Path(self.coworker_installer_path).expanduser()
        return path if path.is_file() else None

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_mb * 1024 * 1024


@lru_cache
def get_settings() -> Settings:
    return Settings()
