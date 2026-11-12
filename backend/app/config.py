"""Central settings, read from backend/.env. The only place the OpenAI client is configured."""
from functools import lru_cache
from pathlib import Path

from openai import AsyncOpenAI
from pydantic_settings import BaseSettings, SettingsConfigDict

# backend/.env, resolved from this file so the app starts from any directory.
ENV_FILE = Path(__file__).resolve().parent.parent / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ENV_FILE, extra="ignore")

    # Required. The app fails at startup if this is missing from .env.
    OPENAI_API_KEY: str

    # Classification is a small, cheap call; execution writes the real answer.
    GATE_MODEL: str = "gpt-4o-mini"
    EXECUTION_MODEL: str = "gpt-4o"

    LLM_TIMEOUT_S: float = 60.0
    MAX_RETRIES: int = 2

    # Comma-separated list of origins allowed to call the API.
    ALLOWED_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"

    @property
    def allowed_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",") if origin.strip()]


settings = Settings()


@lru_cache
def get_client() -> AsyncOpenAI:
    """The single place the OpenAI client is configured: key, timeout and retries.
    Cached, so every agent shares one client and its connection pool."""
    return AsyncOpenAI(
        api_key=settings.OPENAI_API_KEY,
        timeout=settings.LLM_TIMEOUT_S,
        max_retries=settings.MAX_RETRIES,
    )
