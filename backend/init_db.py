from db.session import engine, init_db
from db.base import Base

def init():
    # Import all models here to ensure they are registered with SQLAlchemy
    import db.models.data_collection
    
    # Create all tables
    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    print("Database tables created successfully!")

if __name__ == "__main__":
    init()