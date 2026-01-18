from sqlalchemy import Column, Integer, String, DateTime, func, Text, Boolean, JSON, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from db.base import Base

class DataCollection(Base):
    __tablename__ = "data_collections"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    owner = Column(String(255), nullable=True, index=True)  # Keycloak user ID
    group_id = Column(Integer, ForeignKey('groups.id', ondelete='SET NULL'), nullable=True)
    file_path = Column(String, nullable=False)
    file_type = Column(String, nullable=False)  # 'csv' or 'xlsx'
    columns = Column(Text)  # Store column names as JSON string
    row_count = Column(Integer)
    embeddings_status = Column(String, default='pending')  # pending, processing, completed, failed
    embeddings_metadata = Column(JSONB, default=dict)  # Store any metadata about embeddings
    embedding_model_id = Column(Integer, ForeignKey('models.id'), nullable=True)  # Reference to the embedding model used
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())
    
    embedding_model = relationship("Model", foreign_keys=[embedding_model_id])
    group = relationship("Group", backref="data_collections")
    
    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "owner": self.owner,
            "group_id": self.group_id,
            "file_type": self.file_type,
            "row_count": self.row_count,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }
