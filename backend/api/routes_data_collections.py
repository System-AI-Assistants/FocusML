from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, status, Response
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List
import os
import pandas as pd
from datetime import datetime
import json
import uuid
import mimetypes

from db.session import SessionLocal

from db.models.data_collection import DataCollection

router = APIRouter()

# Create uploads directory if it doesn't exist
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_EXTENSIONS = {"csv", "xlsx"}

def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS

@router.post("/upload/")
async def upload_file(
    file: UploadFile = File(...)
):
    with SessionLocal() as db:
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

            try:
                # Read the file to get metadata
                if file_ext == "csv":
                    df = pd.read_csv(file_path)
                else:  # xlsx
                    df = pd.read_excel(file_path)

                # Create database record
                db_collection = DataCollection(
                    name=file.filename,
                    file_path=file_path,
                    file_type=file_ext,
                    columns=json.dumps(df.columns.tolist()),
                    row_count=len(df)
                )

                db.add(db_collection)
                db.commit()
                db.refresh(db_collection)

                return {"message": "File uploaded successfully", "id": db_collection.id}

            except Exception as e:
                db.rollback()
                # Clean up the file if something went wrong
                if os.path.exists(file_path):
                    os.remove(file_path)
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Error processing file: {str(e)}"
                )

        except HTTPException:
            raise
        except Exception as e:
            # Clean up the file if something went wrong
            if os.path.exists(file_path):
                os.remove(file_path)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Unexpected error: {str(e)}"
            )

@router.get("/collections/", response_model=List[dict])
def list_collections():
    """List all data collections"""
    with SessionLocal() as db:
        collections = db.query(DataCollection).order_by(DataCollection.created_at.desc()).all()
        return [collection.to_dict() for collection in collections]

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

@router.delete("/collections/{collection_id}/")
def delete_collection(collection_id: int, ):
    """Delete a data collection and its associated file"""
    with SessionLocal() as db:
        # Find the collection
        collection = db.query(DataCollection).filter(DataCollection.id == collection_id).first()
        if not collection:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Collection not found"
            )

        try:
            # Delete the file if it exists
            if collection.file_path and os.path.exists(collection.file_path):
                os.remove(collection.file_path)

            # Delete the database record
            db.delete(collection)
            db.commit()

            return {"message": "Collection deleted successfully"}

        except Exception as e:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error deleting collection: {str(e)}"
            )
