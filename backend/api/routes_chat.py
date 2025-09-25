from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
from pydantic import BaseModel
from sqlalchemy.orm import Session
from db.session import SessionLocal
from core.config import settings
from core.embeddings import EmbeddingService
import logging
import psycopg2
from psycopg2.extras import RealDictCursor

logger = logging.getLogger(__name__)
router = APIRouter()

class ChatMessage(BaseModel):
    role: str
    content: str

class RAGChatRequest(BaseModel):
    collection_id: int
    messages: List[ChatMessage]
    model: str = "mistral:7b"

def get_connection(use_timescale=False):
    """Get a database connection"""
    if use_timescale:
        # Connect to TimescaleDB for embeddings
        conn = psycopg2.connect(
            host=settings.TIMESCALE_DB_HOST,
            port=settings.TIMESCALE_DB_PORT,
            dbname=settings.TIMESCALE_DB_NAME,
            user=settings.TIMESCALE_DB_USER,
            password=settings.TIMESCALE_DB_PASSWORD
        )
    else:
        # Connect to main PostgreSQL for metadata
        from urllib.parse import urlparse
        db_url = settings.DB_URL
        result = urlparse(db_url)
        
        conn = psycopg2.connect(
            host=result.hostname or 'localhost',
            port=result.port or 5432,
            dbname=result.path[1:],  # Remove leading slash
            user=result.username or 'postgres',
            password=result.password or ''
        )
    return conn

def retrieve_relevant_documents(query: str, collection_id: int, top_k: int = 3) -> List[dict]:
    """Retrieve relevant documents from the specified collection"""
    # First get collection metadata from main PostgreSQL
    meta_conn = get_connection(use_timescale=False)
    try:
        with meta_conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Get the collection info
            cur.execute("""
                SELECT file_path 
                FROM data_collections 
                WHERE id = %s AND embeddings_status = 'completed'
            """, (collection_id,))
            
            result = cur.fetchone()
            if not result:
                raise HTTPException(status_code=404, detail="Collection not found or embeddings not ready")
    finally:
        meta_conn.close()
    
    # Now query embeddings from TimescaleDB
    table_name = f"embeddings_collection_{collection_id}"
    conn = get_connection(use_timescale=True)
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Get the column names for the table
            cur.execute("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = %s 
                AND column_name NOT IN ('id', 'embedding', 'created_at')
            """, (table_name,))
            
            columns = [row['column_name'] for row in cur.fetchall()]
            if not columns:
                raise HTTPException(status_code=400, detail="No queryable columns found in collection")
            
            # Create a query that searches the embeddings
            # This is a simplified version - you might want to use a more sophisticated search
            search_sql = f"""
                WITH query_embedding AS (
                    SELECT ai.ollama_embed('nomic-embed-text', %s, host => %s) AS embedding
                )
                SELECT {', '.join(f't."{col}"' for col in columns)}
                FROM {table_name} t, query_embedding
                ORDER BY t.embedding <=> query_embedding.embedding
                LIMIT %s
            """
            
            cur.execute(search_sql, (query, settings.OLLAMA_HOST, top_k))
            results = cur.fetchall()
            
            # Convert results to a list of dictionaries
            return [dict(row) for row in results]
    except Exception as e:
        logger.error(f"Error retrieving documents: {str(e)}")
        raise HTTPException(status_code=500, detail="Error retrieving documents")
    finally:
        conn.close()

@router.post("/rag/")
async def rag_chat(request: RAGChatRequest):
    db = SessionLocal()
    try:
        """
        Handle a chat request with RAG (Retrieval-Augmented Generation)
        """
        # Get the latest user message
        if not request.messages:
            raise HTTPException(status_code=400, detail="No messages provided")
        
        user_message = next((msg for msg in reversed(request.messages) if msg.role == "user"), None)
        if not user_message:
            raise HTTPException(status_code=400, detail="No user message found in conversation")
        
        # Retrieve relevant documents
        relevant_docs = retrieve_relevant_documents(
            query=user_message.content,
            collection_id=request.collection_id
        )
        
        # Format the context from relevant documents
        context = "\n\n".join([
            "\n".join([f"{k}: {v}" for k, v in doc.items() if v is not None])
            for doc in relevant_docs
        ])
        
        # Prepare the prompt with context
        system_prompt = f"""You are a helpful assistant that answers questions based on the provided context.
        If you don't know the answer, just say that you don't know, don't try to make up an answer.
        
        Context:
        {context}
        
        Question: {user_message.content}
        Answer:"""
        
        # Initialize the embedding service with TimescaleDB for embeddings
        embedding_service = EmbeddingService(
            db_url=settings.TIMESCALE_DATABASE_URL,
            ollama_host=settings.OLLAMA_HOST
        )
        
        # Prepare the messages for the model
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message.content}
        ]
        
        # Generate the response using the model
        response = await embedding_service.generate_response(
            messages=messages,
            model=request.model
        )
        
        # Format the response to match the expected format
        return {
            "choices": [{
                "message": {
                    "role": "assistant",
                    "content": response
                }
            }]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in RAG chat: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()
