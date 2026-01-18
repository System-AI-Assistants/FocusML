from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import func, and_

from api.deps import get_current_user, require_platform_admin
from db.session import SessionLocal
from db.models.group import Group, GroupMember, GroupUsageLog
from services.keycloack_service import get_keycloak_admin
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/groups", tags=["Groups"])


# ============ Pydantic Schemas ============

class GroupCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    
    # Resource Limits (None = unlimited, -1 = disabled, positive = limit)
    max_assistants_created: Optional[int] = Field(default=None, ge=-1)
    max_assistants_running: Optional[int] = Field(default=None, ge=-1)
    max_data_collections: Optional[int] = Field(default=None, ge=-1)
    max_api_keys: Optional[int] = Field(default=None, ge=-1)
    max_widgets: Optional[int] = Field(default=None, ge=-1)
    max_storage_mb: Optional[int] = Field(default=None, ge=-1)
    
    # Hardware/Model Limits
    max_model_size_gb: Optional[float] = Field(default=None, ge=0)
    max_gpu_memory_gb: Optional[float] = Field(default=None, ge=0)
    max_cpu_cores: Optional[int] = Field(default=None, ge=-1)
    
    # API Usage Limits
    daily_api_requests: Optional[int] = Field(default=None, ge=-1)
    monthly_api_requests: Optional[int] = Field(default=None, ge=-1)
    
    # Token Limits
    daily_token_limit: Optional[int] = Field(default=None, ge=-1)
    monthly_token_limit: Optional[int] = Field(default=None, ge=-1)
    
    # Rate Limits
    requests_per_minute: Optional[int] = Field(default=None, ge=-1)
    requests_per_hour: Optional[int] = Field(default=None, ge=-1)
    
    # Feature Access
    can_create_assistants: bool = True
    can_run_assistants: bool = True
    can_upload_data: bool = True
    can_use_embeddings: bool = True
    can_use_rag: bool = True
    can_create_widgets: bool = True
    can_use_api: bool = True
    
    # Priority
    priority_level: int = Field(default=0, ge=0, le=10)  # Higher = more priority in queue


class GroupUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    is_active: Optional[bool] = None
    
    # Resource Limits (None = no change, -1 = disabled, positive = limit)
    max_assistants_created: Optional[int] = Field(None, ge=-1)
    max_assistants_running: Optional[int] = Field(None, ge=-1)
    max_data_collections: Optional[int] = Field(None, ge=-1)
    max_api_keys: Optional[int] = Field(None, ge=-1)
    max_widgets: Optional[int] = Field(None, ge=-1)
    max_storage_mb: Optional[int] = Field(None, ge=-1)
    
    # Hardware/Model Limits
    max_model_size_gb: Optional[float] = Field(None, ge=0)
    max_gpu_memory_gb: Optional[float] = Field(None, ge=0)
    max_cpu_cores: Optional[int] = Field(None, ge=-1)
    
    # API Usage Limits
    daily_api_requests: Optional[int] = Field(None, ge=-1)
    monthly_api_requests: Optional[int] = Field(None, ge=-1)
    
    # Token Limits
    daily_token_limit: Optional[int] = Field(None, ge=-1)
    monthly_token_limit: Optional[int] = Field(None, ge=-1)
    
    # Rate Limits
    requests_per_minute: Optional[int] = Field(None, ge=-1)
    requests_per_hour: Optional[int] = Field(None, ge=-1)
    
    # Feature Access
    can_create_assistants: Optional[bool] = None
    can_run_assistants: Optional[bool] = None
    can_upload_data: Optional[bool] = None
    can_use_embeddings: Optional[bool] = None
    can_use_rag: Optional[bool] = None
    can_create_widgets: Optional[bool] = None
    can_use_api: Optional[bool] = None
    
    # Priority
    priority_level: Optional[int] = Field(None, ge=0, le=10)


class GroupMemberResponse(BaseModel):
    id: int
    user_id: str
    username: Optional[str] = None
    email: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role: str
    joined_at: datetime
    is_active: bool
    
    class Config:
        from_attributes = True


class GroupResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    keycloak_group_id: Optional[str]
    created_at: datetime
    updated_at: datetime
    is_active: bool
    
    # Resource Limits (None = unlimited, -1 = disabled)
    max_assistants_created: Optional[int]
    max_assistants_running: Optional[int]
    max_data_collections: Optional[int]
    max_api_keys: Optional[int]
    max_widgets: Optional[int]
    max_storage_mb: Optional[int]
    current_storage_mb: float
    
    # Hardware/Model Limits
    max_model_size_gb: Optional[float]
    max_gpu_memory_gb: Optional[float]
    max_cpu_cores: Optional[int]
    
    # API Usage Limits
    daily_api_requests: Optional[int]
    monthly_api_requests: Optional[int]
    
    # Token Limits
    daily_token_limit: Optional[int]
    monthly_token_limit: Optional[int]
    
    # Rate Limits
    requests_per_minute: Optional[int]
    requests_per_hour: Optional[int]
    
    # Feature Access
    can_create_assistants: bool
    can_run_assistants: bool
    can_upload_data: bool
    can_use_embeddings: bool
    can_use_rag: bool
    can_create_widgets: bool
    can_use_api: bool
    
    # Priority
    priority_level: int
    
    # Stats
    member_count: int = 0
    
    class Config:
        from_attributes = True


class AddMemberRequest(BaseModel):
    user_id: str
    role: str = Field(default='member', pattern='^(member|admin|owner)$')


class UpdateMemberRequest(BaseModel):
    role: Optional[str] = Field(None, pattern='^(member|admin|owner)$')
    is_active: Optional[bool] = None
    custom_daily_token_limit: Optional[int] = Field(None, ge=0)
    custom_monthly_token_limit: Optional[int] = Field(None, ge=0)


class GroupUsageResponse(BaseModel):
    total_api_requests_today: int = 0
    total_api_requests_month: int = 0
    total_tokens_today: int = 0
    total_tokens_month: int = 0
    storage_used_mb: float = 0
    
    # Limits
    daily_api_limit: int = 0
    monthly_api_limit: int = 0
    daily_token_limit: int = 0
    monthly_token_limit: int = 0
    storage_limit_mb: int = 0


# ============ Helper Functions ============

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def build_group_response(group: Group, member_count: int = 0, full_token: str = None) -> GroupResponse:
    """Helper function to build GroupResponse from a Group model."""
    return GroupResponse(
        id=group.id,
        name=group.name,
        description=group.description,
        keycloak_group_id=group.keycloak_group_id,
        created_at=group.created_at,
        updated_at=group.updated_at,
        is_active=group.is_active,
        max_assistants_created=group.max_assistants_created,
        max_assistants_running=group.max_assistants_running,
        max_data_collections=group.max_data_collections,
        max_api_keys=group.max_api_keys,
        max_widgets=group.max_widgets,
        max_storage_mb=group.max_storage_mb,
        current_storage_mb=group.current_storage_mb,
        max_model_size_gb=group.max_model_size_gb,
        max_gpu_memory_gb=group.max_gpu_memory_gb,
        max_cpu_cores=group.max_cpu_cores,
        daily_api_requests=group.daily_api_requests,
        monthly_api_requests=group.monthly_api_requests,
        daily_token_limit=group.daily_token_limit,
        monthly_token_limit=group.monthly_token_limit,
        requests_per_minute=group.requests_per_minute,
        requests_per_hour=group.requests_per_hour,
        can_create_assistants=group.can_create_assistants,
        can_run_assistants=group.can_run_assistants,
        can_upload_data=group.can_upload_data,
        can_use_embeddings=group.can_use_embeddings,
        can_use_rag=group.can_use_rag,
        can_create_widgets=group.can_create_widgets,
        can_use_api=group.can_use_api,
        priority_level=group.priority_level,
        member_count=member_count
    )


def get_group_member_count(db: Session, group_id: int) -> int:
    return db.query(GroupMember).filter(
        GroupMember.group_id == group_id,
        GroupMember.is_active == True
    ).count()


def get_keycloak_user_info(keycloak_admin, user_id: str) -> dict:
    """Get user info from Keycloak by user ID."""
    try:
        user = keycloak_admin.get_user(user_id)
        return {
            'username': user.get('username'),
            'email': user.get('email'),
            'first_name': user.get('firstName'),
            'last_name': user.get('lastName')
        }
    except Exception as e:
        logger.warning(f"Could not fetch user info from Keycloak for {user_id}: {e}")
        return {}


# ============ Group CRUD Endpoints ============

@router.post("/", response_model=GroupResponse, dependencies=[Depends(require_platform_admin)])
def create_group(
    group_data: GroupCreate,
    token_info: dict = Depends(require_platform_admin)
):
    """Create a new group with optional Keycloak sync."""
    db = SessionLocal()
    try:
        user_id = token_info.get('sub') or token_info.get('user_id')
        
        # Check if group name already exists
        existing = db.query(Group).filter(Group.name == group_data.name).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Group with this name already exists"
            )
        
        keycloak_group_id = None
        
        # Always create group in Keycloak
        try:
            keycloak_admin = get_keycloak_admin()
            if keycloak_admin:
                # Create group in Keycloak
                keycloak_admin.create_group({"name": group_data.name})
                # Get the created group's ID
                groups = keycloak_admin.get_groups()
                for g in groups:
                    if g.get('name') == group_data.name:
                        keycloak_group_id = g.get('id')
                        break
        except Exception as e:
            logger.warning(f"Could not sync group to Keycloak: {e}")
        
        # Create group in database
        group = Group(
            name=group_data.name,
            description=group_data.description,
            keycloak_group_id=keycloak_group_id,
            created_by=user_id,
            max_assistants_created=group_data.max_assistants_created,
            max_assistants_running=group_data.max_assistants_running,
            max_data_collections=group_data.max_data_collections,
            max_api_keys=group_data.max_api_keys,
            max_widgets=group_data.max_widgets,
            max_storage_mb=group_data.max_storage_mb,
            max_model_size_gb=group_data.max_model_size_gb,
            max_gpu_memory_gb=group_data.max_gpu_memory_gb,
            max_cpu_cores=group_data.max_cpu_cores,
            daily_api_requests=group_data.daily_api_requests,
            monthly_api_requests=group_data.monthly_api_requests,
            daily_token_limit=group_data.daily_token_limit,
            monthly_token_limit=group_data.monthly_token_limit,
            requests_per_minute=group_data.requests_per_minute,
            requests_per_hour=group_data.requests_per_hour,
            can_create_assistants=group_data.can_create_assistants,
            can_run_assistants=group_data.can_run_assistants,
            can_upload_data=group_data.can_upload_data,
            can_use_embeddings=group_data.can_use_embeddings,
            can_use_rag=group_data.can_use_rag,
            can_create_widgets=group_data.can_create_widgets,
            can_use_api=group_data.can_use_api,
            priority_level=group_data.priority_level
        )
        
        db.add(group)
        db.commit()
        db.refresh(group)
        
        return build_group_response(group, member_count=0)
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error creating group: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create group: {str(e)}"
        )
    finally:
        db.close()


@router.get("/", response_model=List[GroupResponse], dependencies=[Depends(require_platform_admin)])
def list_groups(
    include_inactive: bool = False,
    token_info: dict = Depends(require_platform_admin)
):
    """List all groups."""
    db = SessionLocal()
    try:
        query = db.query(Group)
        
        if not include_inactive:
            query = query.filter(Group.is_active == True)
        
        groups = query.order_by(Group.priority_level.desc(), Group.name).all()
        
        result = []
        for group in groups:
            member_count = get_group_member_count(db, group.id)
            result.append(build_group_response(group, member_count=member_count))
        
        return result
    finally:
        db.close()


@router.get("/{group_id}/", response_model=GroupResponse, dependencies=[Depends(require_platform_admin)])
def get_group(
    group_id: int,
    token_info: dict = Depends(require_platform_admin)
):
    """Get a specific group by ID."""
    db = SessionLocal()
    try:
        group = db.query(Group).filter(Group.id == group_id).first()
        
        if not group:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Group not found"
            )
        
        member_count = get_group_member_count(db, group.id)
        
        return build_group_response(group, member_count=member_count)
    finally:
        db.close()


@router.put("/{group_id}/", response_model=GroupResponse, dependencies=[Depends(require_platform_admin)])
def update_group(
    group_id: int,
    group_data: GroupUpdate,
    token_info: dict = Depends(require_platform_admin)
):
    """Update a group."""
    db = SessionLocal()
    try:
        group = db.query(Group).filter(Group.id == group_id).first()
        
        if not group:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Group not found"
            )
        
        # Update fields
        update_data = group_data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            if hasattr(group, field):
                setattr(group, field, value)
        
        # Sync name change to Keycloak if applicable
        if group_data.name and group.keycloak_group_id:
            try:
                keycloak_admin = get_keycloak_admin()
                if keycloak_admin:
                    keycloak_admin.update_group(
                        group.keycloak_group_id,
                        {"name": group_data.name}
                    )
            except Exception as e:
                logger.warning(f"Could not sync group update to Keycloak: {e}")
        
        db.commit()
        db.refresh(group)
        
        member_count = get_group_member_count(db, group.id)
        
        return build_group_response(group, member_count=member_count)
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error updating group: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update group: {str(e)}"
        )
    finally:
        db.close()


@router.delete("/{group_id}/", dependencies=[Depends(require_platform_admin)])
def delete_group(
    group_id: int,
    delete_from_keycloak: bool = True,
    token_info: dict = Depends(require_platform_admin)
):
    """Delete a group."""
    db = SessionLocal()
    try:
        group = db.query(Group).filter(Group.id == group_id).first()
        
        if not group:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Group not found"
            )
        
        # Delete from Keycloak if applicable
        if delete_from_keycloak and group.keycloak_group_id:
            try:
                keycloak_admin = get_keycloak_admin()
                if keycloak_admin:
                    keycloak_admin.delete_group(group.keycloak_group_id)
            except Exception as e:
                logger.warning(f"Could not delete group from Keycloak: {e}")
        
        db.delete(group)
        db.commit()
        
        return {"message": "Group deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error deleting group: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete group: {str(e)}"
        )
    finally:
        db.close()


# ============ Group Member Endpoints ============

@router.get("/{group_id}/members/", response_model=List[GroupMemberResponse], dependencies=[Depends(require_platform_admin)])
def list_group_members(
    group_id: int,
    include_inactive: bool = False,
    token_info: dict = Depends(require_platform_admin)
):
    """List all members of a group with Keycloak user info."""
    db = SessionLocal()
    try:
        group = db.query(Group).filter(Group.id == group_id).first()
        if not group:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Group not found"
            )
        
        query = db.query(GroupMember).filter(GroupMember.group_id == group_id)
        if not include_inactive:
            query = query.filter(GroupMember.is_active == True)
        
        members = query.order_by(GroupMember.joined_at.desc()).all()
        
        # Get Keycloak admin for user info
        keycloak_admin = None
        try:
            keycloak_admin = get_keycloak_admin()
        except Exception as e:
            logger.warning(f"Could not get Keycloak admin: {e}")
        
        result = []
        for member in members:
            user_info = {}
            if keycloak_admin:
                user_info = get_keycloak_user_info(keycloak_admin, member.user_id)
            
            result.append(GroupMemberResponse(
                id=member.id,
                user_id=member.user_id,
                username=user_info.get('username'),
                email=user_info.get('email'),
                first_name=user_info.get('first_name'),
                last_name=user_info.get('last_name'),
                role=member.role,
                joined_at=member.joined_at,
                is_active=member.is_active
            ))
        
        return result
    finally:
        db.close()


@router.post("/{group_id}/members/", response_model=GroupMemberResponse, dependencies=[Depends(require_platform_admin)])
def add_member_to_group(
    group_id: int,
    member_data: AddMemberRequest,
    token_info: dict = Depends(require_platform_admin)
):
    """Add a user to a group."""
    db = SessionLocal()
    try:
        admin_user_id = token_info.get('sub') or token_info.get('user_id')
        
        group = db.query(Group).filter(Group.id == group_id).first()
        if not group:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Group not found"
            )
        
        # Check if user is already a member
        existing = db.query(GroupMember).filter(
            GroupMember.group_id == group_id,
            GroupMember.user_id == member_data.user_id
        ).first()
        
        if existing:
            if existing.is_active:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="User is already a member of this group"
                )
            else:
                # Reactivate membership
                existing.is_active = True
                existing.role = member_data.role
                existing.joined_at = datetime.utcnow()
                db.commit()
                db.refresh(existing)
                member = existing
        else:
            # Create new membership
            member = GroupMember(
                group_id=group_id,
                user_id=member_data.user_id,
                role=member_data.role,
                added_by=admin_user_id
            )
            db.add(member)
            db.commit()
            db.refresh(member)
        
        # Always sync to Keycloak if group has keycloak_group_id
        if group.keycloak_group_id:
            try:
                keycloak_admin = get_keycloak_admin()
                if keycloak_admin:
                    keycloak_admin.group_user_add(member_data.user_id, group.keycloak_group_id)
            except Exception as e:
                logger.warning(f"Could not sync member to Keycloak group: {e}")
        
        # Get user info from Keycloak
        user_info = {}
        try:
            keycloak_admin = get_keycloak_admin()
            if keycloak_admin:
                user_info = get_keycloak_user_info(keycloak_admin, member.user_id)
        except Exception:
            pass
        
        return GroupMemberResponse(
            id=member.id,
            user_id=member.user_id,
            username=user_info.get('username'),
            email=user_info.get('email'),
            first_name=user_info.get('first_name'),
            last_name=user_info.get('last_name'),
            role=member.role,
            joined_at=member.joined_at,
            is_active=member.is_active
        )
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error adding member to group: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to add member: {str(e)}"
        )
    finally:
        db.close()


@router.put("/{group_id}/members/{user_id}/", response_model=GroupMemberResponse, dependencies=[Depends(require_platform_admin)])
def update_group_member(
    group_id: int,
    user_id: str,
    member_data: UpdateMemberRequest,
    token_info: dict = Depends(require_platform_admin)
):
    """Update a group member's role or settings."""
    db = SessionLocal()
    try:
        member = db.query(GroupMember).filter(
            GroupMember.group_id == group_id,
            GroupMember.user_id == user_id
        ).first()
        
        if not member:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Member not found in this group"
            )
        
        # Update fields
        update_data = member_data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            if hasattr(member, field):
                setattr(member, field, value)
        
        db.commit()
        db.refresh(member)
        
        # Get user info from Keycloak
        user_info = {}
        try:
            keycloak_admin = get_keycloak_admin()
            if keycloak_admin:
                user_info = get_keycloak_user_info(keycloak_admin, member.user_id)
        except Exception:
            pass
        
        return GroupMemberResponse(
            id=member.id,
            user_id=member.user_id,
            username=user_info.get('username'),
            email=user_info.get('email'),
            first_name=user_info.get('first_name'),
            last_name=user_info.get('last_name'),
            role=member.role,
            joined_at=member.joined_at,
            is_active=member.is_active
        )
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error updating group member: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update member: {str(e)}"
        )
    finally:
        db.close()


@router.delete("/{group_id}/members/{user_id}/", dependencies=[Depends(require_platform_admin)])
def remove_member_from_group(
    group_id: int,
    user_id: str,
    token_info: dict = Depends(require_platform_admin)
):
    """Remove a user from a group."""
    db = SessionLocal()
    try:
        group = db.query(Group).filter(Group.id == group_id).first()
        if not group:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Group not found"
            )
        
        member = db.query(GroupMember).filter(
            GroupMember.group_id == group_id,
            GroupMember.user_id == user_id
        ).first()
        
        if not member:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Member not found in this group"
            )
        
        # Always remove from Keycloak if group has keycloak_group_id
        if group.keycloak_group_id:
            try:
                keycloak_admin = get_keycloak_admin()
                if keycloak_admin:
                    keycloak_admin.group_user_remove(user_id, group.keycloak_group_id)
            except Exception as e:
                logger.warning(f"Could not remove member from Keycloak group: {e}")
        
        db.delete(member)
        db.commit()
        
        return {"message": "Member removed from group successfully"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error removing member from group: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to remove member: {str(e)}"
        )
    finally:
        db.close()


# ============ User's Groups Endpoint ============

@router.get("/user/{user_id}/", response_model=List[GroupResponse], dependencies=[Depends(require_platform_admin)])
def get_user_groups(
    user_id: str,
    token_info: dict = Depends(require_platform_admin)
):
    """Get all groups a user belongs to."""
    db = SessionLocal()
    try:
        memberships = db.query(GroupMember).filter(
            GroupMember.user_id == user_id,
            GroupMember.is_active == True
        ).all()
        
        group_ids = [m.group_id for m in memberships]
        
        if not group_ids:
            return []
        
        groups = db.query(Group).filter(
            Group.id.in_(group_ids),
            Group.is_active == True
        ).all()
        
        result = []
        for group in groups:
            member_count = get_group_member_count(db, group.id)
            result.append(build_group_response(group, member_count=member_count))
        
        return result
    finally:
        db.close()


# ============ Group Usage/Statistics Endpoint ============

@router.get("/{group_id}/usage/", response_model=GroupUsageResponse, dependencies=[Depends(require_platform_admin)])
def get_group_usage(
    group_id: int,
    token_info: dict = Depends(require_platform_admin)
):
    """Get current usage statistics for a group."""
    db = SessionLocal()
    try:
        group = db.query(Group).filter(Group.id == group_id).first()
        if not group:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Group not found"
            )
        
        today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        month_start = today.replace(day=1)
        
        # Get API request counts
        api_requests_today = db.query(func.sum(GroupUsageLog.count)).filter(
            GroupUsageLog.group_id == group_id,
            GroupUsageLog.usage_type == 'api_request',
            GroupUsageLog.timestamp >= today
        ).scalar() or 0
        
        api_requests_month = db.query(func.sum(GroupUsageLog.count)).filter(
            GroupUsageLog.group_id == group_id,
            GroupUsageLog.usage_type == 'api_request',
            GroupUsageLog.timestamp >= month_start
        ).scalar() or 0
        
        # Get token counts
        tokens_today = db.query(func.sum(GroupUsageLog.tokens_used)).filter(
            GroupUsageLog.group_id == group_id,
            GroupUsageLog.usage_type == 'tokens',
            GroupUsageLog.timestamp >= today
        ).scalar() or 0
        
        tokens_month = db.query(func.sum(GroupUsageLog.tokens_used)).filter(
            GroupUsageLog.group_id == group_id,
            GroupUsageLog.usage_type == 'tokens',
            GroupUsageLog.timestamp >= month_start
        ).scalar() or 0
        
        return GroupUsageResponse(
            total_api_requests_today=api_requests_today,
            total_api_requests_month=api_requests_month,
            total_tokens_today=tokens_today,
            total_tokens_month=tokens_month,
            storage_used_mb=group.current_storage_mb,
            daily_api_limit=group.daily_api_requests,
            monthly_api_limit=group.monthly_api_requests,
            daily_token_limit=group.daily_token_limit,
            monthly_token_limit=group.monthly_token_limit,
            storage_limit_mb=group.max_storage_mb
        )
    finally:
        db.close()


# ============ Sync with Keycloak ============

@router.post("/sync-keycloak/", dependencies=[Depends(require_platform_admin)])
def sync_groups_from_keycloak(
    token_info: dict = Depends(require_platform_admin)
):
    """Import groups from Keycloak that don't exist in the database."""
    db = SessionLocal()
    try:
        keycloak_admin = get_keycloak_admin()
        if not keycloak_admin:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Keycloak Admin client not available"
            )
        
        keycloak_groups = keycloak_admin.get_groups()
        imported = 0
        
        for kg in keycloak_groups:
            # Check if group already exists
            existing = db.query(Group).filter(
                Group.keycloak_group_id == kg.get('id')
            ).first()
            
            if not existing:
                # Also check by name
                existing_by_name = db.query(Group).filter(
                    Group.name == kg.get('name')
                ).first()
                
                if existing_by_name:
                    # Link existing group to Keycloak
                    existing_by_name.keycloak_group_id = kg.get('id')
                else:
                    # Create new group
                    group = Group(
                        name=kg.get('name'),
                        keycloak_group_id=kg.get('id'),
                        created_by=token_info.get('sub')
                    )
                    db.add(group)
                    imported += 1
        
        db.commit()
        
        return {
            "message": f"Sync completed. Imported {imported} new groups.",
            "imported_count": imported
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error syncing groups from Keycloak: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to sync groups: {str(e)}"
        )
    finally:
        db.close()
