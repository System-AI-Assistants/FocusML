from fastapi import APIRouter, UploadFile, File, HTTPException, status, Response, BackgroundTasks, Form, Depends, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import or_
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
from db.models.group import Group, GroupMember
from tasks.embedding_tasks import process_embeddings_task
from api.deps import get_current_user, is_platform_admin
from services.keycloack_service import get_keycloak_admin

logger = logging.getLogger(__name__)

router = APIRouter()

# Create uploads directory if it doesn't exist
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_EXTENSIONS = {"csv", "xlsx"}

def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def get_user_group_ids(session, user_id: str) -> List[int]:
    """Get all group IDs that a user is a member of."""
    memberships = session.query(GroupMember).filter(
        GroupMember.user_id == user_id,
        GroupMember.is_active == True
    ).all()
    return [m.group_id for m in memberships]


def user_can_access_collection(session, user_id: str, collection: DataCollection, token_info: dict = None) -> bool:
    """Check if a user can access a data collection."""
    # Platform admin can access all collections
    if token_info and is_platform_admin(token_info):
        return True
    
    if collection.owner is None:
        return True
    
    # Owner can always access
    if collection.owner == user_id:
        return True
    
    # If collection belongs to a group, check if user is a member
    if collection.group_id:
        user_groups = get_user_group_ids(session, user_id)
        if collection.group_id in user_groups:
            return True
    
    return False

@router.post("/upload/")
async def upload_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    embedding_model_id: Optional[int] = Form(None),
    group_id: Optional[int] = Form(None),
    token_info: dict = Depends(get_current_user)
):
    user_id = token_info.get('sub')
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
        
        # Validate group_id if provided
        if group_id is not None:
            user_group_ids = get_user_group_ids(db, user_id)
            if group_id not in user_group_ids:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You are not a member of the specified group"
                )
            group = db.query(Group).filter(Group.id == group_id).first()
            if not group:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Group not found"
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
                owner=user_id,
                group_id=group_id,
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
                "owner": collection.owner,
                "group_id": collection.group_id,
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
def list_collections(
    show_all: bool = Query(False, description="Show all collections (admin only)"),
    token_info: dict = Depends(get_current_user)
):
    """List data collections the current user can access."""
    with SessionLocal() as db:
        user_id = token_info.get('sub')
        user_is_admin = is_platform_admin(token_info)
        
        # If admin wants to see all collections
        if show_all and user_is_admin:
        collections = db.query(DataCollection).order_by(DataCollection.created_at.desc()).all()
        else:
            # Get user's group IDs
            user_group_ids = get_user_group_ids(db, user_id)
            
            # Query collections: owned by user OR belonging to user's groups OR legacy (no owner)
            query = db.query(DataCollection).filter(
                or_(
                    DataCollection.owner == user_id,
                    DataCollection.owner == None,
                    DataCollection.group_id.in_(user_group_ids) if user_group_ids else False
                )
            ).order_by(DataCollection.created_at.desc())
            collections = query.all()
        
        # Get owner usernames for all unique owners (only if showing all)
        owner_usernames = {}
        if show_all and user_is_admin:
            unique_owners = set(c.owner for c in collections if c.owner)
            try:
                admin = get_keycloak_admin()
                if admin:
                    for owner_id in unique_owners:
                        try:
                            user = admin.get_user(owner_id)
                            owner_usernames[owner_id] = user.get('username', owner_id[:8])
                        except Exception:
                            owner_usernames[owner_id] = owner_id[:8] if owner_id else None
            except Exception:
                pass
        
        result = []
        for collection in collections:
            collection_dict = {
            **collection.to_dict(),
                "owner_username": owner_usernames.get(collection.owner) if show_all else None,
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
def get_embedding_status(
    collection_id: int,
    token_info: dict = Depends(get_current_user)
):
    """Get the embedding status for a specific collection"""
    with SessionLocal() as db:
        user_id = token_info.get('sub')
        collection = db.query(DataCollection).filter(DataCollection.id == collection_id).first()
        if not collection:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Collection with ID {collection_id} not found"
            )
        
        # Check access permission
        if not user_can_access_collection(db, user_id, collection, token_info):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to access this collection"
            )

        return {
            "collection_id": collection.id,
            "name": collection.name,
            "embeddings_status": collection.embeddings_status,
            "embeddings_metadata": collection.embeddings_metadata or {}
        }

@router.get("/collections/{collection_id}/preview/")
async def preview_collection(
    collection_id: int,
    token_info: dict = Depends(get_current_user)
):
    """Preview the first few rows of a collection"""
    # Find the collection
    with SessionLocal() as db:
        user_id = token_info.get('sub')
        collection = db.query(DataCollection).filter(DataCollection.id == collection_id).first()
        if not collection:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Collection not found"
            )
        
        # Check access permission
        if not user_can_access_collection(db, user_id, collection, token_info):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to access this collection"
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
async def download_collection(
    collection_id: int,
    token_info: dict = Depends(get_current_user)
):
    """Download the original file"""
    with SessionLocal() as db:
        user_id = token_info.get('sub')
        # Find the collection
        collection = db.query(DataCollection).filter(DataCollection.id == collection_id).first()
        if not collection:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Collection not found"
            )
        
        # Check access permission
        if not user_can_access_collection(db, user_id, collection, token_info):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to access this collection"
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
async def delete_collection(
    collection_id: int,
    token_info: dict = Depends(get_current_user)
):
    """Delete a data collection and its associated file"""
    with SessionLocal() as db:
        user_id = token_info.get('sub')
        user_is_admin = is_platform_admin(token_info)
        
        # Find the collection
        collection = db.query(DataCollection).filter(DataCollection.id == collection_id).first()
        if not collection:
            error_msg = f"Collection with ID {collection_id} not found"
            print(error_msg)
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=error_msg
            )
        
        # Only owner or admin can delete (legacy collections with no owner can be deleted by anyone)
        if collection.owner is not None and collection.owner != user_id and not user_is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the owner or an admin can delete this collection"
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