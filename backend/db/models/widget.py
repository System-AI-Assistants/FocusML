from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, JSON, Float
from sqlalchemy.orm import relationship
from db.base import Base
import secrets
import hashlib
from datetime import datetime
from sqlalchemy import func


class Widget(Base):
    """Widget configuration for embeddable chat"""
    __tablename__ = 'widgets'

    id = Column(Integer, primary_key=True)
    assistant_id = Column(Integer, ForeignKey('assistants.id'), nullable=False)
    owner = Column(String(255), nullable=False)  # Keycloak user ID
    name = Column(String(255), nullable=False)
    
    # Token management
    token_hash = Column(String(255), nullable=False, unique=True)
    token_prefix = Column(String(20), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    last_used_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    expires_at = Column(DateTime, nullable=True)
    
    # Usage limits
    usage_quota = Column(Integer, nullable=True)  # Max requests per period
    usage_period = Column(String(50), nullable=True)  # 'day', 'week', 'month'
    current_usage = Column(Integer, default=0)
    usage_reset_at = Column(DateTime, nullable=True)
    
    # Domain whitelisting (JSON array of allowed domains)
    allowed_domains = Column(JSON, default=list)
    
    # UI Customization
    position = Column(String(20), default='bottom-right')  # bottom-right, bottom-left, top-right, top-left
    primary_color = Column(String(20), default='#1890ff')
    button_size = Column(Integer, default=60)  # pixels
    button_icon = Column(String(50), default='chat')  # chat, message, help, custom
    custom_icon_url = Column(String(500), nullable=True)
    avatar_url = Column(String(500), nullable=True)
    
    # Chat configuration
    start_message = Column(Text, nullable=True)  # Initial greeting message
    placeholder_text = Column(String(255), default='Type a message...')
    allow_attachments = Column(Boolean, default=False)
    max_attachment_size_mb = Column(Integer, default=5)
    allowed_attachment_types = Column(JSON, default=['image/jpeg', 'image/png', 'application/pdf'])
    
    # Session persistence
    enable_persistence = Column(Boolean, default=True)
    persistence_type = Column(String(20), default='local')  # 'local' (localStorage) or 'server'
    session_timeout_hours = Column(Integer, default=24)
    
    # Branding
    show_branding = Column(Boolean, default=True)
    custom_css = Column(Text, nullable=True)
    window_title = Column(String(255), default='Chat with us')
    
    # Relationships
    assistant = relationship("Assistant", backref="widgets")
    sessions = relationship("WidgetSession", back_populates="widget", cascade="all, delete-orphan")
    usage_logs = relationship("WidgetUsageLog", back_populates="widget", cascade="all, delete-orphan")

    @staticmethod
    def generate_token(prefix="wgt"):
        """Generate a new widget token"""
        random_part = secrets.token_urlsafe(32)
        full_token = f"{prefix}_{random_part}"
        return full_token

    @staticmethod
    def hash_token(token: str) -> str:
        """Hash a widget token for storage"""
        return hashlib.sha256(token.encode()).hexdigest()

    def verify_token(self, token: str) -> bool:
        """Verify if a provided token matches this widget"""
        return self.token_hash == self.hash_token(token)

    def mask_token(self) -> str:
        """Return a masked version of the token for display"""
        return f"{self.token_prefix}...****"


class WidgetSession(Base):
    """Chat sessions for widget users"""
    __tablename__ = 'widget_sessions'

    id = Column(Integer, primary_key=True)
    widget_id = Column(Integer, ForeignKey('widgets.id'), nullable=False)
    session_id = Column(String(255), unique=True, nullable=False)  # UUID for the session
    
    # Session identification
    visitor_id = Column(String(255), nullable=True)  # Anonymous visitor identifier
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(Text, nullable=True)
    referrer_url = Column(Text, nullable=True)
    
    # Session state
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    last_activity_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    ended_at = Column(DateTime, nullable=True)
    
    # Conversation summary (for history display)
    message_count = Column(Integer, default=0)
    summary = Column(Text, nullable=True)  # AI-generated summary of conversation
    
    # Relationships
    widget = relationship("Widget", back_populates="sessions")
    messages = relationship("WidgetMessage", back_populates="session", cascade="all, delete-orphan")


class WidgetMessage(Base):
    """Messages in widget chat sessions"""
    __tablename__ = 'widget_messages'

    id = Column(Integer, primary_key=True)
    session_id = Column(Integer, ForeignKey('widget_sessions.id'), nullable=False)
    
    role = Column(String(20), nullable=False)  # 'user', 'assistant', 'system'
    content = Column(Text, nullable=False)
    
    # Attachments (JSON array of attachment info)
    attachments = Column(JSON, default=list)
    
    # Metrics
    created_at = Column(DateTime, server_default=func.now())
    response_time_ms = Column(Integer, nullable=True)  # For assistant messages
    ttft_ms = Column(Integer, nullable=True)  # Time to first token
    
    # Relationships
    session = relationship("WidgetSession", back_populates="messages")


class WidgetUsageLog(Base):
    """Usage logs for widget requests"""
    __tablename__ = 'widget_usage_logs'

    id = Column(Integer, primary_key=True)
    widget_id = Column(Integer, ForeignKey('widgets.id'), nullable=False)
    session_id = Column(Integer, ForeignKey('widget_sessions.id'), nullable=True)
    
    endpoint = Column(String(255), nullable=False)
    method = Column(String(10), nullable=False)
    status_code = Column(Integer, nullable=False)
    response_time_ms = Column(Integer, nullable=True)
    ttft_ms = Column(Integer, nullable=True)
    error_type = Column(String(100), nullable=True)
    
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(String(500), nullable=True)
    referrer = Column(String(500), nullable=True)
    
    created_at = Column(DateTime, server_default=func.now())
    
    # Relationships
    widget = relationship("Widget", back_populates="usage_logs")

