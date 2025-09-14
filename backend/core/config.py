from pydantic_settings import BaseSettings # NEW

class Settings(BaseSettings):
    KEYCLOAK_SERVER_URL: str
    KEYCLOAK_REALM_NAME: str
    KEYCLOAK_ADMIN_CLIENT_ID: str
    KEYCLOAK_ADMIN_NAME: str
    KEYCLOAK_ADMIN_PASSWORD: str
    KEYCLOAK_ADMIN_CLIENT_SECRET: str
    KEYCLOAK_FRONTEND_CLIENT_ID: str
    MLFLOW_TRACKING_URI: str = "http://mlflow:5000"
    DB_URL: str

    class Config:
        env_file = ".env"

settings = Settings()


