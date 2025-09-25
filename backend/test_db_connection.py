import logging
from sqlalchemy import create_engine, text
from core.config import settings

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def test_db_connection():
    """Test database connection and check for required functions"""
    try:
        # Create engine using the timescale URL
        db_url = settings.TIMESCALE_DATABASE_URL
        logger.info(f"Connecting to database: {db_url}")
        
        engine = create_engine(db_url)
        
        # Test connection
        with engine.connect() as conn:
            # Check if the connection is working
            result = conn.execute(text("SELECT 1"))
            logger.info(f"Connection test result: {result.scalar()}")
            
            # Check if the ai.ollama_embed function exists
            try:
                result = conn.execute(text(
                    "SELECT proname FROM pg_proc WHERE proname = 'ollama_embed' AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'ai')"
                ))
                if result.scalar():
                    logger.info("Found ai.ollama_embed function")
                    
                    # Test a simple embedding
                    test_text = "This is a test"
                    try:
                        result = conn.execute(text(
                            f"SELECT ai.ollama_embed('nomic-embed-text', '{test_text}', host => '{settings.OLLAMA_HOST}');"
                        ))
                        embedding = result.scalar()
                        logger.info(f"Successfully generated embedding of length: {len(embedding) if embedding else 0}")
                        return True
                    except Exception as e:
                        logger.error(f"Error testing ai.ollama_embed function: {str(e)}")
                        return False
                else:
                    logger.error("ai.ollama_embed function not found in the database")
                    return False
                    
            except Exception as e:
                logger.error(f"Error checking for ai.ollama_embed function: {str(e)}")
                return False
                
    except Exception as e:
        logger.error(f"Database connection test failed: {str(e)}")
        return False

if __name__ == "__main__":
    success = test_db_connection()
    if success:
        logger.info("Database connection and function tests passed!")
    else:
        logger.error("Database connection or function tests failed!")
