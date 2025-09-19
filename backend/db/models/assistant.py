from sqlalchemy import Column, Integer, String, Boolean, DateTime, func

from db.base import Base


class Assistant(Base):
    __tablename__ = 'assistants'

    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False)
    owner = Column(String(255), nullable=False)  # Keycloak user ID
    database_url = Column(String(255))
    version = Column(String(50))
    stage = Column(String(50))
    model = Column(String(255), nullable=False)
    is_local = Column(Boolean, default=False)
    status = Column(String(50))
    mlflow_run_id = Column(String(255))
    create_time = Column(DateTime, server_default=func.now())
    last_modified = Column(DateTime, server_default=func.now(), onupdate=func.now())
    