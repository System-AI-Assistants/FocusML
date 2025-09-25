from fastapi import APIRouter, UploadFile, File, HTTPException, status, Response, BackgroundTasks, Depends, Header, Request
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Union, Any
from fastapi import Body
import os
import pandas as pd
import json
import uuid
import logging
import psycopg2
from psycopg2.extras import RealDictCursor
from sqlalchemy import text

from db.session import SessionLocal
from db.models.data_collection import DataCollection
from tasks.embedding_tasks import process_embeddings_task
from core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter()

# Create uploads directory if it doesn't exist
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_EXTENSIONS = {"csv", "xlsx"}

def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS

@router.post("/upload/")
async def upload_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...)
):
    db = SessionLocal()
    try:
        # Check if the file is valid
        if not file.filename or not allowed_file(file.filename):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid file type. Allowed types: {', '.join(ALLOWED_EXTENSIONS)}"
            )

        # Generate a unique filename
        file_ext = file.filename.rsplit(".", 1)[1].lower()
        unique_filename = f"{uuid.uuid4()}.{file_ext}"
        file_path = os.path.join(UPLOAD_DIR, unique_filename)

        # Ensure upload directory exists
        os.makedirs(os.path.dirname(file_path), exist_ok=True)

        # Save the file
        with open(file_path, "wb") as buffer:
            content = await file.read()  # Read the file content
            buffer.write(content)

        # Read the file to get metadata
        try:
            if file_ext == "csv":
                df = pd.read_csv(file_path)
            else:  # xlsx
                df = pd.read_excel(file_path)

            # Convert all columns to string and handle NaN values
            df = df.astype(str).fillna('')

            # Create a new collection record
            collection = DataCollection(
                name=file.filename,
                file_path=file_path,
                file_type=file_ext,
                columns=json.dumps(df.columns.tolist()),
                row_count=len(df),
                embeddings_status='pending'
            )

            db.add(collection)
            db.commit()
            db.refresh(collection)

            # Get the collection ID for the background task
            collection_id = collection.id

            # Start background task for embeddings
            background_tasks.add_task(
                process_embeddings_task,
                collection_id=collection_id
            )

            return {
                "id": collection.id,
                "name": collection.name,
                "file_type": collection.file_type,
                "row_count": collection.row_count,
                "created_at": collection.created_at.isoformat() if collection.created_at else None,
                "embeddings_status": collection.embeddings_status,
                "message": "File uploaded successfully. Embedding process has started in the background."
            }

        except Exception as e:
            # Clean up the uploaded file if there was an error
            if os.path.exists(file_path):
                os.remove(file_path)
            logger.error(f"Error processing file: {str(e)}")
            db.rollback()
            db.close()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error processing file: {str(e)}"
            )

    except HTTPException:
        db.close()
        raise
    except Exception as e:
        db.close()
        logger.error(f"Unexpected error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred: {str(e)}"
        )

@router.get("/collections/", response_model=List[dict])
def list_collections():
    """List all data collections"""
    with SessionLocal() as db:
        collections = db.query(DataCollection).order_by(DataCollection.created_at.desc()).all()
        return [{
            **collection.to_dict(),
            "embeddings_status": collection.embeddings_status,
            "embeddings_metadata": collection.embeddings_metadata or {}
        } for collection in collections]

@router.get("/collections/{collection_id}/embedding-status")
def get_embedding_status(collection_id: int):
    """Get the embedding status for a specific collection"""
    with SessionLocal() as db:
        collection = db.query(DataCollection).filter(DataCollection.id == collection_id).first()
        if not collection:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Collection with ID {collection_id} not found"
            )

        return {
            "collection_id": collection.id,
            "name": collection.name,
            "embeddings_status": collection.embeddings_status,
            "embeddings_metadata": collection.embeddings_metadata or {}
        }

@router.get("/collections/{collection_id}/preview/")
async def preview_collection(collection_id: int, ):
    """Preview the first few rows of a collection"""
    # Find the collection
    with SessionLocal() as db:
        collection = db.query(DataCollection).filter(DataCollection.id == collection_id).first()
        if not collection:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Collection not found"
            )

        try:
            if not os.path.exists(collection.file_path):
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="File not found"
                )

            # Read the file
            if collection.file_type == 'csv':
                df = pd.read_csv(collection.file_path, nrows=50)  # Limit to first 50 rows for preview
            else:  # xlsx
                df = pd.read_excel(collection.file_path, nrows=50)  # Limit to first 50 rows for preview

            # Convert to list of dicts for JSON serialization
            return {
                "columns": df.columns.tolist(),
                "rows": df.fillna('').to_dict(orient='records'),
                "total_rows": len(df)
            }

        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error reading file: {str(e)}"
            )

@router.get("/collections/{collection_id}/download/")
async def download_collection(collection_id: int, ):
    """Download the original file"""
    with SessionLocal() as db:
        # Find the collection
        collection = db.query(DataCollection).filter(DataCollection.id == collection_id).first()
        if not collection:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Collection not found"
            )

        if not os.path.exists(collection.file_path):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="File not found"
            )

        # Determine the MIME type based on file extension
        mime_type, _ = mimetypes.guess_type(collection.file_path)

        # Set the filename for download
        filename = os.path.basename(collection.file_path)

        return FileResponse(
            path=collection.file_path,
            media_type=mime_type or 'application/octet-stream',
            filename=filename,
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            }
        )

@router.delete("/collections/{collection_id}")
async def delete_collection(collection_id: int):
    """Delete a data collection and its associated file"""
    with SessionLocal() as db:
        # Find the collection
        collection = db.query(DataCollection).filter(DataCollection.id == collection_id).first()
        if not collection:
            error_msg = f"Collection with ID {collection_id} not found"
            print(error_msg)
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=error_msg
            )

        print(f"Found collection: {collection.name} (ID: {collection.id})")
        print(f"File path: {collection.file_path}")

        try:
            # Delete the file if it exists
            if collection.file_path:
                file_path = os.path.abspath(collection.file_path)
                print(f"Attempting to delete file: {file_path}")
                
                if os.path.exists(file_path):
                    try:
                        os.remove(file_path)
                        print(f"Successfully deleted file: {file_path}")
                    except Exception as e:
                        error_msg = f"Warning: Could not delete file {file_path}: {str(e)}"
                        print(error_msg)
                        # Continue with DB deletion even if file deletion fails
                else:
                    print(f"File not found at path: {file_path}")

            # Delete the database record
            print("Deleting database record...")
            db.delete(collection)
            db.commit()
            print("Database record deleted successfully")

            return {"message": "Collection deleted successfully"}

        except Exception as e:
            db.rollback()
            error_msg = f"Error deleting collection {collection_id}: {str(e)}"
            print(error_msg)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=error_msg
            )


class RAGQuery(BaseModel):
    query: str
    top_k: int = 3
    model: str = "mistral:7b"
    assistant_id: Optional[str] = None


@router.post("/collections/{collection_id}/query")
async def query_collection_with_rag(
    collection_id: int,
    request: Request,
    token: str = Header(..., alias="Authorization"),
    rag_query: RAGQuery = Body(...)
):
    try:
        # Log basic request info
        print(f"\n=== RAG Request for collection {collection_id} ===")
        
        # Process token
        token = token.replace('Bearer ', '') if token.startswith('Bearer ') else token
        
        # Convert query to dict and validate
        query_data = rag_query.dict()
        
        # Log the request
        print(f"Query: {query_data['query']}")
        print(f"Model: {query_data['model']}")
        print(f"Top K: {query_data['top_k']}")
        
        # Basic validation
        if not query_data['query'].strip():
            raise ValueError("Query cannot be empty")

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid request: {str(e)}"
        )
    """Query a collection using RAG (Retrieval-Augmented Generation)"""
    with SessionLocal() as db:
        try:
            # Get the collection
            collection = db.query(DataCollection).filter(DataCollection.id == collection_id).first()
            if not collection:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Collection with id {collection_id} not found"
                )

            if collection.embeddings_status != "completed":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Embeddings not ready for collection {collection_id}"
                )

            # Connect to TimescaleDB
            conn = psycopg2.connect(
                host=settings.TIMESCALE_DB_HOST,
                port=settings.TIMESCALE_DB_PORT,
                dbname=settings.TIMESCALE_DB_NAME,
                user=settings.TIMESCALE_DB_USER,
                password=settings.TIMESCALE_DB_PASSWORD
            )

            try:
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    # Get the table name for this collection
                    table_name = f"embeddings_collection_{collection_id}"

                    # First, get the embedding for the query
                    cur.execute("""
                        SELECT ai.ollama_embed(
                            'nomic-embed-text',
                            %s,
                            host => %s
                        ) AS embedding;
                    """, (rag_query.query, settings.OLLAMA_HOST))

                    result = cur.fetchone()
                    if not result or not result['embedding']:
                        raise HTTPException(
                            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail="Failed to generate embedding for query"
                        )

                    query_embedding = result['embedding']

                    # First check if metadata column exists
                    cur.execute("""
                        SELECT column_name
                        FROM information_schema.columns
                        WHERE table_name = %s AND column_name = 'metadata';
                    """, (table_name,))
                    has_metadata = bool(cur.fetchone())

                    # Build the query based on whether metadata column exists
                    if has_metadata:
                        query = f"""
                            SELECT content,
                                   embedding <=> %s::vector AS distance,
                                   metadata
                            FROM {table_name}
                            ORDER BY embedding <=> %s
                            LIMIT %s;
                        """
                    else:
                        query = f"""
                            SELECT content,
                                   embedding <=> %s::vector AS distance
                            FROM {table_name}
                            ORDER BY embedding <=> %s
                            LIMIT %s;
                        """

                    # Execute the appropriate query
                    cur.execute(query, (query_embedding, query_embedding, rag_query.top_k))

                    results = cur.fetchall()

                    # Format the results
                    sources = []
                    for idx, row in enumerate(results):
                        source = {
                            'content': row.get('content', ''),
                            'distance': float(row.get('distance', 1.0))
                        }
                        # Only add metadata if it exists in the row
                        if 'metadata' in row:
                            source['metadata'] = row['metadata']
                        sources.append(source)

                    # Prepare the context for the LLM
                    context = "\n\n".join([f"Source {i+1}: {src['content']}" for i, src in enumerate(sources)])

                    # Generate a response using the LLM
                    prompt = f"""You are a helpful assistant that answers questions based on the provided context.

                    Context:
                    {context}

                    Question: {rag_query.query}

                    Answer the question based on the context above. If the context doesn't contain the answer, say "I don't know".
                    """

                    # Get the assistant's model
                    with SessionLocal() as db_session:
                        # Get the specified assistant or fall back to the first active one
                        query = db_session.query(Assistant).filter(
                            Assistant.owner == token_info.get('sub'),
                            Assistant.status == 'running'
                        )

                        if rag_query.assistant_id:
                            query = query.filter(Assistant.id == rag_query.assistant_id)

                        assistant = query.first()

                        if not assistant or not assistant.mlflow_run_id:
                            raise HTTPException(
                                status_code=status.HTTP_400_BAD_REQUEST,
                                detail="No active assistant found. Please start an assistant first."
                            )

                        try:
                            # Load the assistant's model
                            model = mlflow.pyfunc.load_model(f"runs:/{assistant.mlflow_run_id}/model")

                            # Prepare the chat messages
                            messages = [
                                {"role": "system", "content": "You are a helpful assistant that answers questions based on the provided context."},
                                {"role": "user", "content": f"Context:\n{context}\n\nQuestion: {rag_query.query}\n\nAnswer the question based on the context above. If the context doesn't contain the answer, say 'I don't know'."}
                            ]

                            # Call the model
                            result = model.predict({"messages": messages}, {
                                "max_tokens": 512,
                                "temperature": 0.7,
                                "top_p": 0.9
                            })

                            # Extract the response
                            if isinstance(result, dict) and 'choices' in result and len(result['choices']) > 0:
                                response = result['choices'][0].get('message', {}).get('content', 'No response')
                            else:
                                response = str(result)

                        except Exception as e:
                            logger.error(f"Error calling assistant model: {str(e)}")
                            response = f"I'm sorry, there was an error generating a response: {str(e)}"

                    return {
                        'response': response,
                        'sources': sources
                    }

            finally:
                conn.close()

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error querying collection {collection_id}: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error querying collection: {str(e)}"
            )