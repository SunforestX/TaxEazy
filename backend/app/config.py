from typing import Optional, Union

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # Database
    database_url: str = "postgresql+psycopg2://sunforest:sunforest123@localhost:5432/sunforest"
    
    # Security
    secret_key: str = "dev-secret-key-change-in-production"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7
    algorithm: str = "HS256"
    
    # Environment
    environment: str = "development"
    debug: bool = True
    
    # Storage
    upload_dir: str = "/app/uploads"
    max_upload_size_mb: int = 50
    
    # CORS
    cors_origins: Union[list[str], str] = ["http://localhost:3000", "http://127.0.0.1:3000"]
    
    # Xero Integration
    xero_client_id: Optional[str] = None
    xero_client_secret: Optional[str] = None
    xero_redirect_uri: Optional[str] = None
    xero_scopes: str = "openid profile email accounting.transactions accounting.contacts accounting.settings offline_access"
    
    # Encryption
    encryption_key: Optional[str] = None
    
    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: Union[list[str], str]) -> list[str]:
        """Parse CORS origins from comma-separated string or return list."""
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v
    
    @model_validator(mode="after")
    def set_debug_for_production(self) -> "Settings":
        """Automatically disable debug in production environment."""
        if self.environment == "production":
            self.debug = False
        return self
    
    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
