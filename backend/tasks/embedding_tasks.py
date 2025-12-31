import pandas as pd
import logging
from typing import Dict, Any
from sqlalchemy.orm import Session
from core.embeddings import EmbeddingService
from db.models.data_collection import DataCollection
from core.config import settings
from db.session import SessionLocal

logger = logging.getLogger(__name__)

def process_embeddings_task(collection_id: int):
    """Background task to process embeddings for a data collection"""
    db = SessionLocal()
    try:
        # Get the collection
        collection = db.query(DataCollection).filter(DataCollection.id == collection_id).first()
        if not collection:
            logger.error(f"Collection {collection_id} not found")
            return
        
        # Get the embedding model name
        embedding_model_name = "nomic-embed-text"  # Default fallback
        if collection.embedding_model_id:
            if collection.embedding_model:
                embedding_model_name = collection.embedding_model.name
            else:
                # Reload the relationship
                db.refresh(collection)
                if collection.embedding_model:
                    embedding_model_name = collection.embedding_model.name
                else:
                    logger.warning(f"Embedding model {collection.embedding_model_id} not found, using default: nomic-embed-text")
        
        # Update status to processing
        collection.embeddings_status = 'processing'
        db.commit()
        
        # Initialize embedding service
        embedding_service = EmbeddingService(
            db_url=settings.TIMESCALE_DATABASE_URL,
            ollama_host=settings.OLLAMA_HOST
        )
        
        # Read the file
        if collection.file_type == 'csv':
            df = pd.read_csv(collection.file_path)
        elif collection.file_type in ['xlsx', 'xls']:
            df = pd.read_excel(collection.file_path)
        else:
            raise ValueError(f"Unsupported file type: {collection.file_type}")
        
        # Process the DataFrame with the selected embedding model
        table_name = f"embeddings_collection_{collection_id}"
        result = embedding_service.process_dataframe(df, collection_id, table_name, embedding_model_name=embedding_model_name)
        
        # Update collection status
        collection.embeddings_status = 'completed'
        collection.embeddings_metadata = {
            'table_name': table_name,
            'processed_at': result['timestamp'],
            'processed_rows': result['processed_rows'],
            'total_rows': result['total_rows'],
            'embedding_model': embedding_model_name
        }
        db.commit()
        
        logger.info(f"Successfully processed embeddings for collection {collection_id} using model {embedding_model_name}")
        
    except Exception as e:
        logger.error(f"Error processing embeddings for collection {collection_id}: {str(e)}")
        # Update status to failed
        collection.embeddings_status = 'failed'
        collection.embeddings_metadata = {
            "error": str(e),
            "status": "failed"
        }
        db.commit()
        logger.error(f"Error processing embeddings for collection {collection_id}: {str(e)}")
    finally:
        db.close()
