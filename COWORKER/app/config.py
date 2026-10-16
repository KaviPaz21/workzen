import sys
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


def frozen_app() -> bool:
    return bool(getattr(sys, "frozen", False))


def env_files() -> tuple[str, ...]:
    if frozen_app():
        bundled = Path(getattr(sys, "_MEIPASS", ".")) / ".env"
        beside = Path(sys.executable).parent / ".env"
        return (str(bundled), str(beside))
    return (".env",)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=env_files(), env_file_encoding="utf-8", extra="ignore")

    coworker_host: str = "127.0.0.1"
    coworker_port: int = 8765
    coworker_allowed_origins: list[str] = ["http://localhost:5173"]
    coworker_workspace: str = ""
    coworker_token_file: str = ""
    coworker_browser_channel: str = "chrome"
    coworker_headless: bool = False
    coworker_launch_apps: bool = True
    coworker_pairing_prompt: bool = True

    @property
    def workspace(self) -> Path:
        if self.coworker_workspace:
            return Path(self.coworker_workspace).expanduser()
        return Path.home() / "WorkZen Co-worker"

    @property
    def token_file(self) -> Path:
        if self.coworker_token_file:
            return Path(self.coworker_token_file).expanduser()
        return Path.home() / ".workzen-coworker" / "token"


@lru_cache
def get_settings() -> Settings:
    return Settings()
