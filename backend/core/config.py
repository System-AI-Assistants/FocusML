from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    # Keycloak Settings
    KEYCLOAK_SERVER_URL: str
    KEYCLOAK_REALM_NAME: str
    KEYCLOAK_ADMIN_CLIENT_ID: str
    KEYCLOAK_ADMIN_NAME: str
    KEYCLOAK_ADMIN_PASSWORD: str
    KEYCLOAK_ADMIN_CLIENT_SECRET: str
    KEYCLOAK_FRONTEND_CLIENT_ID: str
    
    # Database Settings
    DB_URL: str
    
    # TimescaleDB Settings
    TIMESCALE_DB_HOST: str = "timescaledb"
    TIMESCALE_DB_PORT: int = 5433
    TIMESCALE_DB_NAME: str = "postgres"
    TIMESCALE_DB_USER: str = "postgres"
    TIMESCALE_DB_PASSWORD: str = "password"
    
    # Embedding Settings
    OLLAMA_HOST: str = "http://host.docker.internal:11434"
    EMBEDDING_MODEL: str = "nomic-embed-text"
    
    # MLflow
    MLFLOW_TRACKING_URI: str = "http://mlflow:5000"
    
    @property
    def TIMESCALE_DATABASE_URL(self) -> str:
        return f"postgresql://{self.TIMESCALE_DB_USER}:{self.TIMESCALE_DB_PASSWORD}@{self.TIMESCALE_DB_HOST}:{self.TIMESCALE_DB_PORT}/{self.TIMESCALE_DB_NAME}"

    class Config:
        env_file = ".env"

settings = Settings()


