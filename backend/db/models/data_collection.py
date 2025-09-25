from sqlalchemy import Column, Integer, String, DateTime, func, Text
from db.base import Base

class DataCollection(Base):
    __tablename__ = "data_collections"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    file_type = Column(String, nullable=False)  # 'csv' or 'xlsx'
    columns = Column(Text)  # Store column names as JSON string
    row_count = Column(Integer)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "file_type": self.file_type,
            "row_count": self.row_count,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }
