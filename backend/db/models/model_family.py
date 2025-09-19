from sqlalchemy import Column, Integer, String, Boolean, Text
from sqlalchemy.orm import relationship

from db.base import Base


class ModelFamily(Base):
    __tablename__ = 'model_families'

    id = Column(Integer, primary_key=True)
    name = Column(String(255), unique=True, nullable=False)
    description = Column(Text)
    icon = Column(String(255))
    url = Column(String(255))
    installed = Column(Boolean)
    models = relationship("Model", back_populates="family")
    