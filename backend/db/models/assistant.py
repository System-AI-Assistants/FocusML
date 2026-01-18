from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship

from db.base import Base


class Assistant(Base):
    __tablename__ = 'assistants'

    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False)
    owner = Column(String(255), nullable=False)  # Keycloak user ID
    group_id = Column(Integer, ForeignKey('groups.id', ondelete='SET NULL'), nullable=True)
    data_collection_id = Column(Integer, ForeignKey('data_collections.id', ondelete='SET NULL'), nullable=True)  # Linked data collection
    database_url = Column(String(255), nullable=True)
    version = Column(String(50), nullable=True)
    stage = Column(String(50), nullable=True)
    model = Column(String(255), nullable=True)
    is_local = Column(Boolean, default=False, nullable=True)
    status = Column(String(50))
    mlflow_run_id = Column(String(255))
    create_time = Column(DateTime, server_default=func.now())
    last_modified = Column(DateTime, server_default=func.now(), onupdate=func.now())
    
    # Relationships
    api_keys = relationship("APIKey", back_populates="assistant", cascade="all, delete-orphan")
    group = relationship("Group", backref="assistants")
    data_collection = relationship("DataCollection", backref="assistants")
    