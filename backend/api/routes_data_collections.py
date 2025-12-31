from fastapi import APIRouter, UploadFile, File, HTTPException, status, Response, BackgroundTasks, Form
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List, Optional
import os
import pandas as pd
import json
import uuid
import logging
import mimetypes

from db.session import SessionLocal
from db.models.data_collection import DataCollection
from db.models.model import Model
from tasks.embedding_tasks import process_embeddings_task

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
    file: UploadFile = File(...),
    embedding_model_id: Optional[int] = Form(None)
):
    db = SessionLocal()
    try:
        # Check if the file is valid
        if not file.filename or not allowed_file(file.filename):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid file type. Allowed types: {', '.join(ALLOWED_EXTENSIONS)}"
            )

        # Validate embedding_model_id if provided
        if embedding_model_id is not None:
            model = db.query(Model).filter(Model.id == embedding_model_id).first()
            if not model:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Embedding model with ID {embedding_model_id} not found"
                )
            # Check if the model is actually an embedding model
            if not model.family.tags or 'embedding' not in model.family.tags.lower():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Model {model.name} is not an embedding model"
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
                embeddings_status='pending',
                embedding_model_id=embedding_model_id
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
        result = []
        for collection in collections:
            collection_dict = {
                **collection.to_dict(),
                "embeddings_status": collection.embeddings_status,
                "embeddings_metadata": collection.embeddings_metadata or {}
            }
            # Add embedding model name if available
            if collection.embedding_model:
                collection_dict["embedding_model_name"] = collection.embedding_model.name
            elif collection.embeddings_metadata and collection.embeddings_metadata.get('embedding_model'):
                collection_dict["embedding_model_name"] = collection.embeddings_metadata.get('embedding_model')
            result.append(collection_dict)
        return result

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