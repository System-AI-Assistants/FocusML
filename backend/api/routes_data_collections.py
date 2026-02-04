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
from tasks.embedding_tasks import process_embeddings_task
from core.text_chunking import TextChunker, ChunkingMethod
from core.document_parser import DocumentParser

logger = logging.getLogger(__name__)

router = APIRouter()

# Create uploads directory if it doesn't exist
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Tabular file extensions
TABULAR_EXTENSIONS = {"csv", "xlsx"}
# Document file extensions
DOCUMENT_EXTENSIONS = {"txt", "pdf", "docx"}
# All allowed extensions
ALLOWED_EXTENSIONS = TABULAR_EXTENSIONS | DOCUMENT_EXTENSIONS

def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS

def is_document_file(filename: str) -> bool:
    """Check if file is a document type (txt, pdf, docx)"""
    if "." not in filename:
        return False
    ext = filename.rsplit(".", 1)[1].lower()
    return ext in DOCUMENT_EXTENSIONS

def is_tabular_file(filename: str) -> bool:
    """Check if file is a tabular type (csv, xlsx)"""
    if "." not in filename:
        return False
    ext = filename.rsplit(".", 1)[1].lower()
    return ext in TABULAR_EXTENSIONS


@router.get("/chunking-methods/")
async def get_chunking_methods():
    """Get available chunking methods for document files"""
    return TextChunker.get_available_methods()


@router.post("/upload/")
async def upload_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    chunking_method: Optional[str] = Form(None),
    chunk_size: Optional[int] = Form(None),
    chunk_overlap: Optional[int] = Form(None)
):
    """
    Upload a file (tabular or document) for processing.
    
    For document files (txt, pdf, docx), you can specify:
    - chunking_method: 'fixed_size', 'sentence', 'paragraph', 'semantic', 'recursive'
    - chunk_size: Size of each chunk (for fixed_size and recursive methods)
    - chunk_overlap: Overlap between chunks
    """
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
            content = await file.read()
            buffer.write(content)

        try:
            # Determine if this is a document or tabular file
            if is_document_file(file.filename):
                # Process document file
                collection = await _process_document_upload(
                    db=db,
                    file_path=file_path,
                    file_ext=file_ext,
                    original_filename=file.filename,
                    chunking_method=chunking_method,
                    chunk_size=chunk_size,
                    chunk_overlap=chunk_overlap
                )
            else:
                # Process tabular file (csv, xlsx)
                collection = await _process_tabular_upload(
                    db=db,
                    file_path=file_path,
                    file_ext=file_ext,
                    original_filename=file.filename
                )

            # Start background task for embeddings
            background_tasks.add_task(
                process_embeddings_task,
                collection_id=collection.id
            )

            return {
                "id": collection.id,
                "name": collection.name,
                "file_type": collection.file_type,
                "content_type": collection.content_type,
                "row_count": collection.row_count,
                "chunking_method": collection.chunking_method,
                "document_metadata": collection.document_metadata,
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


async def _process_document_upload(
    db,
    file_path: str,
    file_ext: str,
    original_filename: str,
    chunking_method: Optional[str],
    chunk_size: Optional[int],
    chunk_overlap: Optional[int]
) -> DataCollection:
    """Process a document file (txt, pdf, docx) upload"""
    
    # Parse the document
    parser = DocumentParser()
    parsed_doc = parser.parse(file_path)
    
    # Set default chunking method if not provided
    if not chunking_method:
        chunking_method = ChunkingMethod.RECURSIVE.value
    
    # Validate chunking method
    valid_methods = [m.value for m in ChunkingMethod]
    if chunking_method not in valid_methods:
        raise ValueError(f"Invalid chunking method. Valid options: {', '.join(valid_methods)}")
    
    # Build chunking config
    chunking_config = {}
    if chunk_size is not None:
        chunking_config['chunk_size'] = chunk_size
    if chunk_overlap is not None:
        chunking_config['chunk_overlap'] = chunk_overlap
    
    # Perform chunking to get chunk count
    chunker = TextChunker()
    chunks = chunker.chunk(
        parsed_doc.content,
        method=ChunkingMethod(chunking_method),
        config=chunking_config if chunking_config else None
    )
    
    # Create document metadata
    document_metadata = {
        'word_count': parsed_doc.word_count,
        'char_count': parsed_doc.char_count,
        'page_count': parsed_doc.page_count,
        'chunk_count': len(chunks),
        **parsed_doc.metadata
    }
    
    # Create collection record
    collection = DataCollection(
        name=original_filename,
        file_path=file_path,
        file_type=file_ext,
        content_type='document',
        columns=None,  # Documents don't have columns
        row_count=len(chunks),  # Use chunk count as row count
        chunking_method=chunking_method,
        chunking_config=chunking_config if chunking_config else None,
        document_metadata=document_metadata,
        embeddings_status='pending'
    )
    
    db.add(collection)
    db.commit()
    db.refresh(collection)
    
    return collection


async def _process_tabular_upload(
    db,
    file_path: str,
    file_ext: str,
    original_filename: str
) -> DataCollection:
    """Process a tabular file (csv, xlsx) upload"""
    
    if file_ext == "csv":
        df = pd.read_csv(file_path)
    else:  # xlsx
        df = pd.read_excel(file_path)

    # Convert all columns to string and handle NaN values
    df = df.astype(str).fillna('')

    # Create collection record
    collection = DataCollection(
        name=original_filename,
        file_path=file_path,
        file_type=file_ext,
        content_type='tabular',
        columns=json.dumps(df.columns.tolist()),
        row_count=len(df),
        chunking_method=None,
        chunking_config=None,
        document_metadata=None,
        embeddings_status='pending'
    )

    db.add(collection)
    db.commit()
    db.refresh(collection)
    
    return collection

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
async def preview_collection(collection_id: int):
    """Preview the first few rows/chunks of a collection"""
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

            # Handle document files
            if collection.content_type == 'document':
                return await _preview_document(collection)
            
            # Handle tabular files
            if collection.file_type == 'csv':
                df = pd.read_csv(collection.file_path, nrows=50)
            else:  # xlsx
                df = pd.read_excel(collection.file_path, nrows=50)

            # Convert to list of dicts for JSON serialization
            return {
                "content_type": "tabular",
                "columns": df.columns.tolist(),
                "rows": df.fillna('').to_dict(orient='records'),
                "total_rows": len(df)
            }

        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error reading file: {str(e)}"
            )


async def _preview_document(collection: DataCollection) -> dict:
    """Preview a document file by showing its chunks"""
    parser = DocumentParser()
    parsed_doc = parser.parse(collection.file_path)
    
    # Get chunking config
    chunking_method = collection.chunking_method or ChunkingMethod.RECURSIVE.value
    chunking_config = collection.chunking_config or {}
    
    # Chunk the document
    chunker = TextChunker()
    chunks = chunker.chunk(
        parsed_doc.content,
        method=ChunkingMethod(chunking_method),
        config=chunking_config
    )
    
    # Limit preview to first 10 chunks
    preview_chunks = chunks[:10]
    
    return {
        "content_type": "document",
        "file_type": collection.file_type,
        "chunking_method": chunking_method,
        "document_metadata": collection.document_metadata,
        "chunks": [
            {
                "index": chunk.index,
                "content": chunk.content[:500] + "..." if len(chunk.content) > 500 else chunk.content,
                "full_length": len(chunk.content),
                "metadata": chunk.metadata
            }
            for chunk in preview_chunks
        ],
        "total_chunks": len(chunks),
        "preview_count": len(preview_chunks)
    }

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