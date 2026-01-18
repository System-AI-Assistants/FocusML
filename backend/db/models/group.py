from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Text, Float, Table
from sqlalchemy.orm import relationship
from db.base import Base


# Association table for many-to-many relationship between users and groups
user_group_association = Table(
    'user_group_association',
    Base.metadata,
    Column('user_id', String(255), primary_key=True),  # Keycloak user ID
    Column('group_id', Integer, ForeignKey('groups.id', ondelete='CASCADE'), primary_key=True),
    Column('added_at', DateTime, default=datetime.utcnow),
    Column('added_by', String(255), nullable=True)  # Who added this user to the group
)


class Group(Base):
    """
    Groups for organizing users and managing resource quotas.
    Synced with Keycloak groups for authentication/authorization.
    """
    __tablename__ = 'groups'

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)
    keycloak_group_id = Column(String(255), unique=True, nullable=True)  # Keycloak group ID for sync
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = Column(String(255), nullable=True)  # Keycloak user ID of creator
    is_active = Column(Boolean, default=True)
    
    # Resource Limits (NULL = unlimited, -1 = disabled, positive = limit)
    max_assistants_created = Column(Integer, nullable=True, default=None)  # Max assistants user can create
    max_assistants_running = Column(Integer, nullable=True, default=None)  # Max concurrently running
    max_data_collections = Column(Integer, nullable=True, default=None)
    max_api_keys = Column(Integer, nullable=True, default=None)
    max_widgets = Column(Integer, nullable=True, default=None)
    
    # Storage Limits
    max_storage_mb = Column(Integer, nullable=True, default=None)  # NULL = unlimited
    current_storage_mb = Column(Float, default=0)
    
    # Hardware/Model Limits
    max_model_size_gb = Column(Float, nullable=True, default=None)  # Max model size in GB (e.g., 7, 13, 70)
    max_gpu_memory_gb = Column(Float, nullable=True, default=None)  # Max GPU VRAM allowed
    max_cpu_cores = Column(Integer, nullable=True, default=None)  # Max CPU cores for inference
    
    # API Usage Limits (NULL = unlimited, -1 = disabled)
    daily_api_requests = Column(Integer, nullable=True, default=None)
    monthly_api_requests = Column(Integer, nullable=True, default=None)
    
    # Token Limits (for LLM usage)
    daily_token_limit = Column(Integer, nullable=True, default=None)
    monthly_token_limit = Column(Integer, nullable=True, default=None)
    
    # Rate Limits
    requests_per_minute = Column(Integer, nullable=True, default=None)
    requests_per_hour = Column(Integer, nullable=True, default=None)
    
    # Feature Access (True = enabled, False = disabled)
    can_create_assistants = Column(Boolean, default=True)
    can_run_assistants = Column(Boolean, default=True)
    can_upload_data = Column(Boolean, default=True)
    can_use_embeddings = Column(Boolean, default=True)
    can_use_rag = Column(Boolean, default=True)
    can_create_widgets = Column(Boolean, default=True)
    can_use_api = Column(Boolean, default=True)
    
    # Priority/Tier
    priority_level = Column(Integer, default=0)  # Higher = more priority in queue (0-10)
    
    # Relationships
    members = relationship(
        "GroupMember",
        back_populates="group",
        cascade="all, delete-orphan"
    )
    
    def __repr__(self):
        return f"<Group(id={self.id}, name='{self.name}', priority={self.priority_level})>"


class GroupMember(Base):
    """
    Tracks group membership with additional metadata.
    """
    __tablename__ = 'group_members'
    
    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey('groups.id', ondelete='CASCADE'), nullable=False)
    user_id = Column(String(255), nullable=False, index=True)  # Keycloak user ID
    
    # Metadata
    joined_at = Column(DateTime, default=datetime.utcnow)
    added_by = Column(String(255), nullable=True)  # Who added this user
    
    # Role within the group
    role = Column(String(50), default='member')  # member, admin, owner
    
    # User-specific overrides (null = use group default)
    custom_daily_token_limit = Column(Integer, nullable=True)
    custom_monthly_token_limit = Column(Integer, nullable=True)
    
    # Status
    is_active = Column(Boolean, default=True)
    
    # Relationships
    group = relationship("Group", back_populates="members")
    
    # Unique constraint: user can only be in a group once
    __table_args__ = (
        # Note: A user CAN be in multiple groups, but only once per group
        {'sqlite_autoincrement': True},
    )
    
    def __repr__(self):
        return f"<GroupMember(group_id={self.group_id}, user_id='{self.user_id}', role='{self.role}')>"


class GroupUsageLog(Base):
    """
    Tracks resource usage per group for quota enforcement.
    """
    __tablename__ = 'group_usage_logs'
    
    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey('groups.id', ondelete='CASCADE'), nullable=False)
    user_id = Column(String(255), nullable=True)  # Which user made the request
    
    # Timestamp
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    period_start = Column(DateTime, nullable=False)  # Start of the billing/quota period
    
    # Usage Type
    usage_type = Column(String(50), nullable=False)  # api_request, tokens, storage, etc.
    
    # Metrics
    count = Column(Integer, default=1)
    tokens_used = Column(Integer, default=0)
    storage_bytes = Column(Integer, default=0)
    
    # Request details (optional)
    endpoint = Column(String(255), nullable=True)
    assistant_id = Column(Integer, nullable=True)
    
    def __repr__(self):
        return f"<GroupUsageLog(group_id={self.group_id}, type='{self.usage_type}', count={self.count})>"
