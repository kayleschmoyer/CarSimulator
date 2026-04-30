from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://garage:garage@localhost:5432/garage"
    redis_url: str = "redis://localhost:6379/0"
    anthropic_api_key: str = ""
    upload_dir: str = "./uploads"
    max_upload_size_mb: int = 100
    claude_model: str = "claude-opus-4-7"

    class Config:
        env_file = ".env"


settings = Settings()
