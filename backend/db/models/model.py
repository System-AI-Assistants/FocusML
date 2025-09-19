from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship

from db.base import Base


class Model(Base):
    __tablename__ = 'models'

    id = Column(Integer, primary_key=True)
    family_id = Column(Integer, ForeignKey('model_families.id'), nullable=False)
    name = Column(String(255), nullable=False)
    size = Column(String(50))
    context = Column(String(50))
    input_type = Column(String(100))
    family = relationship("ModelFamily", back_populates="models")

    