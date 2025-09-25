from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from core.config import settings
from db.base import Base

engine = create_engine(settings.DB_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db():
    Base.metadata.create_all(bind=engine)
    
