from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError

DATABASE_URL = "postgresql://amazon:RYPrai7wBbDeQJ3J@212.6.44.122:5432/amazon"


def test_db_connection():
    try:
        engine = create_engine(DATABASE_URL)
        with engine.connect() as connection:
            result = connection.execute(text("SELECT 1"))
            print("✅ Database connection successful:", result.scalar() == 1)
    except SQLAlchemyError as e:
        print("❌ Database connection failed:", str(e))


if __name__ == "__main__":
    test_db_connection()
