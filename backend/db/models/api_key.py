from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, func
from sqlalchemy.orm import relationship
from db.base import Base
import secrets
import hashlib


class APIKey(Base):
    __tablename__ = 'api_keys'

    id = Column(Integer, primary_key=True)
    assistant_id = Column(Integer, ForeignKey('assistants.id'), nullable=False)
    name = Column(String(255), nullable=False)  # User-friendly name for the key
    key_hash = Column(String(255), nullable=False, unique=True)  # Hashed version of the key
    key_prefix = Column(String(20), nullable=False)  # First 8 chars for display (e.g., "sk_live_abc")
    owner = Column(String(255), nullable=False)  # Keycloak user ID
    is_active = Column(Boolean, default=True, nullable=False)
    last_used_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    expires_at = Column(DateTime, nullable=True)
    usage_quota = Column(Integer, nullable=True)  # Max requests per period
    usage_period = Column(String(50), nullable=True)  # 'day', 'week', 'month'
    current_usage = Column(Integer, default=0)
    usage_reset_at = Column(DateTime, nullable=True)
    
    assistant = relationship("Assistant", back_populates="api_keys")
    usage_logs = relationship("APIUsageLog", back_populates="api_key", cascade="all, delete-orphan")
    whitelist_entries = relationship("APIKeyWhitelist", back_populates="api_key", cascade="all, delete-orphan")

    @staticmethod
    def generate_key(prefix="sk_live"):
        """Generate a new API key"""
        random_part = secrets.token_urlsafe(32)
        full_key = f"{prefix}_{random_part}"
        return full_key

    @staticmethod
    def hash_key(key: str) -> str:
        """Hash an API key for storage"""
        return hashlib.sha256(key.encode()).hexdigest()

    def verify_key(self, key: str) -> bool:
        """Verify if a provided key matches this API key"""
        return self.key_hash == self.hash_key(key)

    def mask_key(self) -> str:
        """Return a masked version of the key for display"""
        return f"{self.key_prefix}...{self.key_prefix[-4:] if len(self.key_prefix) >= 4 else '****'}"


class APIUsageLog(Base):
    __tablename__ = 'api_usage_logs'

    id = Column(Integer, primary_key=True)
    api_key_id = Column(Integer, ForeignKey('api_keys.id'), nullable=False)
    assistant_id = Column(Integer, ForeignKey('assistants.id'), nullable=False)
    endpoint = Column(String(255), nullable=False)
    method = Column(String(10), nullable=False)
    status_code = Column(Integer, nullable=False)
    response_time_ms = Column(Integer, nullable=True)  # Latency in milliseconds
    time_to_first_token_ms = Column(Integer, nullable=True)  # TTFT in milliseconds
    error_type = Column(String(100), nullable=True)  # 'rate_limit', 'auth_error', 'server_error', etc.
    ip_address = Column(String(45), nullable=True)  # IPv6 compatible
    user_agent = Column(String(500), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    
    api_key = relationship("APIKey", back_populates="usage_logs")
    assistant = relationship("Assistant")


class APIKeyWhitelist(Base):
    __tablename__ = 'api_key_whitelist'

    id = Column(Integer, primary_key=True)
    api_key_id = Column(Integer, ForeignKey('api_keys.id'), nullable=False)
    type = Column(String(20), nullable=False)  # 'domain' or 'ip'
    value = Column(String(255), nullable=False)  # Domain name or IP address
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    
    api_key = relationship("APIKey", back_populates="whitelist_entries")

