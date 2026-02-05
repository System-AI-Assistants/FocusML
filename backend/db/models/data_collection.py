from sqlalchemy import Column, Integer, String, DateTime, func, Text, Boolean, JSON, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from db.base import Base

class DataCollection(Base):
    __tablename__ = "data_collections"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    file_type = Column(String, nullable=False)  # 'csv', 'xlsx', 'txt', 'pdf', 'docx'
    content_type = Column(String, default='tabular')  # 'tabular' for csv/xlsx, 'document' for txt/pdf/docx
    columns = Column(Text)  # Store column names as JSON string (for tabular data)
    row_count = Column(Integer)  # For tabular: row count, for documents: chunk count
    chunking_method = Column(String, default=None)  # 'fixed_size', 'sentence', 'paragraph', 'semantic', 'recursive'
    chunking_config = Column(JSONB, default=None)  # Chunking configuration (chunk_size, overlap, etc.)
    document_metadata = Column(JSONB, default=None)  # Document metadata (word count, page count, etc.)
    embeddings_status = Column(String, default='pending')  # pending, processing, completed, failed
    embeddings_metadata = Column(JSONB, default=dict)  # Store any metadata about embeddings
    embedding_model_id = Column(Integer, ForeignKey('models.id'), nullable=True)  # Reference to the embedding model used
    owner_id = Column(String(255), nullable=True)  # Keycloak user ID
    group_id = Column(Integer, ForeignKey('groups.id', ondelete='SET NULL'), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())
    
    embedding_model = relationship("Model", foreign_keys=[embedding_model_id])
    group = relationship("Group", backref="data_collections")
    
    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "file_type": self.file_type,
            "content_type": self.content_type,
            "row_count": self.row_count,
            "chunking_method": self.chunking_method,
            "chunking_config": self.chunking_config,
            "document_metadata": self.document_metadata,
            "owner_id": self.owner_id,
            "group_id": self.group_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }
