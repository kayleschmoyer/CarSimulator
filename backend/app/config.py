from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    anthropic_api_key: str = ""
    upload_dir: str = "./uploads"
    max_upload_size_mb: int = 100
    claude_model: str = "claude-sonnet-4-6"

    class Config:
        # Check .env, .env.local, and the parent directory's .env.local
        env_file = [".env", ".env.local", "../.env.local", "../.env"]
        env_file_encoding = "utf-8"
        extra = "ignore"


settings = Settings()
