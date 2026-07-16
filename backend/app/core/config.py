from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_env: str = "local"
    port: int = 8000

    database_url: str
    database_url_migrate: str = ""
    allowed_origin: str

    google_places_api_key: str = ""


settings = Settings()  # type: ignore[call-arg]  # fails fast at import time if required vars are missing
