from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, Field, EmailStr

from api.deps import get_current_user, require_platform_admin, get_current_user_with_roles
from schemas.user import UserCreate
from services.keycloack_service import get_keycloak_admin
from db.session import SessionLocal
from db.models.group import GroupMember, Group
from db.models.assistant import Assistant
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/users", tags=["Users"])


# ============ Role Check Endpoint ============

@router.get("/me/roles/")
def get_my_roles(token_info: dict = Depends(get_current_user_with_roles)):
    """Get current user's roles and admin status."""
    return {
        "user_id": token_info.get('sub'),
        "username": token_info.get('preferred_username'),
        "is_admin": token_info.get('is_admin', False),
        "roles": token_info.get('roles', [])
    }


# ============ Pydantic Schemas ============

class UserUpdate(BaseModel):
    firstName: Optional[str] = None
    lastName: Optional[str] = None
    email: Optional[EmailStr] = None
    enabled: Optional[bool] = None


class UserResponse(BaseModel):
    id: str
    username: str
    email: Optional[str] = None
    firstName: Optional[str] = None
    lastName: Optional[str] = None
    enabled: bool = True
    createdTimestamp: Optional[int] = None
    emailVerified: bool = False
    groups: List[str] = []  # Group names
    group_ids: List[int] = []  # Database group IDs


class UserWithGroupsResponse(BaseModel):
    id: str
    username: str
    email: Optional[str] = None
    firstName: Optional[str] = None
    lastName: Optional[str] = None
    enabled: bool = True
    groups: List[dict] = []


class ResetPasswordRequest(BaseModel):
    password: str = Field(..., min_length=8)
    temporary: bool = False


class BulkAddToGroupRequest(BaseModel):
    user_ids: List[str]
    group_id: int
    role: str = Field(default='member', pattern='^(member|admin|owner)$')


# ============ User CRUD Endpoints ============

@router.get("/", dependencies=[Depends(require_platform_admin)])
def get_users(
    search: Optional[str] = None,
    first: int = 0,
    max: int = 100,
    enabled: Optional[bool] = None
):
    """Get all users with optional filtering."""
    try:
        admin = get_keycloak_admin()
        if not admin:
            raise HTTPException(status_code=503, detail="Keycloak Admin client not available.")

        query_params = {
            "first": first,
            "max": max
        }
        
        if search:
            query_params["search"] = search
        
        if enabled is not None:
            query_params["enabled"] = enabled

        users = admin.get_users(query_params)
        
        # Enrich with database group info
        db = SessionLocal()
        try:
            enriched_users = []
            for user in users:
                user_id = user.get('id')
                
                # Get groups from database
                memberships = db.query(GroupMember).filter(
                    GroupMember.user_id == user_id,
                    GroupMember.is_active == True
                ).all()
                
                group_ids = [m.group_id for m in memberships]
                group_names = []
                
                if group_ids:
                    groups = db.query(Group).filter(Group.id.in_(group_ids)).all()
                    group_names = [g.name for g in groups]
                
                enriched_users.append({
                    **user,
                    "group_ids": group_ids,
                    "groups": group_names
                })
            
            return enriched_users
        finally:
            db.close()
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Keycloak error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch users from Keycloak: {str(e)}")


@router.get("/count/", dependencies=[Depends(require_platform_admin)])
def get_user_count():
    """Get total user count."""
    try:
        admin = get_keycloak_admin()
        if not admin:
            raise HTTPException(status_code=503, detail="Keycloak Admin client not available.")

        count = admin.users_count()
        return {"count": count}
    except Exception as e:
        logger.error(f"Keycloak error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get user count: {str(e)}")


@router.get("/{user_id}/", response_model=UserWithGroupsResponse, dependencies=[Depends(require_platform_admin)])
def get_user(user_id: str):
    """Get a specific user by ID with their groups."""
    try:
        admin = get_keycloak_admin()
        if not admin:
            raise HTTPException(status_code=503, detail="Keycloak Admin client not available.")

        user = admin.get_user(user_id)
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Get groups from database
        db = SessionLocal()
        try:
            memberships = db.query(GroupMember).filter(
                GroupMember.user_id == user_id,
                GroupMember.is_active == True
            ).all()
            
            groups = []
            for membership in memberships:
                group = db.query(Group).filter(Group.id == membership.group_id).first()
                if group:
                    groups.append({
                        "id": group.id,
                        "name": group.name,
                        "role": membership.role,
                        "joined_at": membership.joined_at.isoformat() if membership.joined_at else None,
                        "priority_level": group.priority_level
                    })
            
            return UserWithGroupsResponse(
                id=user.get('id'),
                username=user.get('username'),
                email=user.get('email'),
                firstName=user.get('firstName'),
                lastName=user.get('lastName'),
                enabled=user.get('enabled', True),
                groups=groups
            )
        finally:
            db.close()
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Keycloak error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch user: {str(e)}")


@router.get("/{user_id}/profile/", dependencies=[Depends(get_current_user)])
def get_user_profile(user_id: str, token_info: dict = Depends(get_current_user)):
    """
    Get a comprehensive user profile including groups, limits, and resources.
    Users can view their own profile, admins can view any profile.
    """
    from api.deps import is_platform_admin
    
    current_user_id = token_info.get('sub')
    
    # Check permissions: users can only view their own profile unless admin
    if current_user_id != user_id and not is_platform_admin(token_info):
        raise HTTPException(status_code=403, detail="You can only view your own profile")
    
    try:
        admin = get_keycloak_admin()
        if not admin:
            raise HTTPException(status_code=503, detail="Keycloak Admin client not available.")

        user = admin.get_user(user_id)
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        db = SessionLocal()
        try:
            # Get user's groups with full details
            memberships = db.query(GroupMember).filter(
                GroupMember.user_id == user_id,
                GroupMember.is_active == True
            ).all()
            
            groups = []
            effective_limits = {
                "max_assistants_created": None,
                "max_assistants_running": None,
                "max_data_collections": None,
                "max_storage_mb": None,
                "daily_token_limit": None,
                "monthly_token_limit": None,
                "max_model_size_gb": None,
                "max_gpu_memory_gb": None,
            }
            highest_priority = 0
            
            for membership in memberships:
                group = db.query(Group).filter(Group.id == membership.group_id).first()
                if group:
                    groups.append({
                        "id": group.id,
                        "name": group.name,
                        "role": membership.role,
                        "priority_level": group.priority_level,
                        "joined_at": membership.joined_at.isoformat() if membership.joined_at else None
                    })
                    
                    # Track highest priority group for effective limits
                    if group.priority_level > highest_priority:
                        highest_priority = group.priority_level
                        effective_limits = {
                            "max_assistants_created": group.max_assistants_created,
                            "max_assistants_running": group.max_assistants_running,
                            "max_data_collections": group.max_data_collections,
                            "max_storage_mb": group.max_storage_mb,
                            "daily_token_limit": group.daily_token_limit,
                            "monthly_token_limit": group.monthly_token_limit,
                            "max_model_size_gb": group.max_model_size_gb,
                            "max_gpu_memory_gb": group.max_gpu_memory_gb,
                        }
            
            # Get user's assistants
            assistants = db.query(Assistant).filter(Assistant.owner == user_id).all()
            assistant_list = [
                {
                    "id": a.id,
                    "name": a.name,
                    "model": a.model,
                    "status": a.status,
                    "created": a.create_time.isoformat() if a.create_time else None
                }
                for a in assistants
            ]
            
            # Calculate statistics
            stats = {
                "total_assistants": len(assistants),
                "running_assistants": len([a for a in assistants if a.status == 'running']),
                "total_groups": len(groups),
            }
            
            return {
                "id": user.get('id'),
                "username": user.get('username'),
                "email": user.get('email'),
                "firstName": user.get('firstName'),
                "lastName": user.get('lastName'),
                "enabled": user.get('enabled', True),
                "emailVerified": user.get('emailVerified', False),
                "createdTimestamp": user.get('createdTimestamp'),
                "groups": groups,
                "effective_limits": effective_limits,
                "assistants": assistant_list,
                "stats": stats
            }
        finally:
            db.close()
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to fetch user profile: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch user profile: {str(e)}")


@router.post("/", dependencies=[Depends(require_platform_admin)])
def create_user(user: UserCreate):
    """Create a new user."""
    try:
        keycloak_admin = get_keycloak_admin()
        if not keycloak_admin:
            raise HTTPException(status_code=503, detail="Keycloak Admin client not available.")

        creds = {
            "username": user.username,
            "email": user.email,
            "firstName": user.firstName,
            "lastName": user.lastName,
            "enabled": True,
            "emailVerified": False,
            "credentials": [{
                "type": "password",
                "value": user.password,
                "temporary": False
            }]
        }

        new_user_id = keycloak_admin.create_user(creds)
        return {"message": "User created successfully", "user_id": new_user_id}
    except Exception as e:
        logger.error(f"Keycloak error: {str(e)}")
        if "User exists" in str(e):
            raise HTTPException(status_code=400, detail="User with this username or email already exists")
        raise HTTPException(status_code=500, detail=f"Failed to create user: {str(e)}")


@router.put("/{user_id}/", dependencies=[Depends(require_platform_admin)])
def update_user(user_id: str, user_data: UserUpdate):
    """Update an existing user."""
    try:
        keycloak_admin = get_keycloak_admin()
        if not keycloak_admin:
            raise HTTPException(status_code=503, detail="Keycloak Admin client not available.")

        # Build update payload
        update_payload = {}
        if user_data.firstName is not None:
            update_payload["firstName"] = user_data.firstName
        if user_data.lastName is not None:
            update_payload["lastName"] = user_data.lastName
        if user_data.email is not None:
            update_payload["email"] = user_data.email
        if user_data.enabled is not None:
            update_payload["enabled"] = user_data.enabled

        keycloak_admin.update_user(user_id, update_payload)
        return {"message": "User updated successfully"}
    except Exception as e:
        logger.error(f"Keycloak error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to update user: {str(e)}")


@router.delete("/{user_id}/", dependencies=[Depends(require_platform_admin)])
def delete_user(user_id: str):
    """Delete a user."""
    try:
        keycloak_admin = get_keycloak_admin()
        if not keycloak_admin:
            raise HTTPException(status_code=503, detail="Keycloak Admin client not available.")

        # Also remove from all groups in database
        db = SessionLocal()
        try:
            db.query(GroupMember).filter(GroupMember.user_id == user_id).delete()
            db.commit()
        finally:
            db.close()

        keycloak_admin.delete_user(user_id=user_id)
        return {"message": "User deleted successfully"}
    except Exception as e:
        logger.error(f"Keycloak error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete user: {str(e)}")


@router.post("/{user_id}/reset-password/", dependencies=[Depends(require_platform_admin)])
def reset_user_password(user_id: str, password_data: ResetPasswordRequest):
    """Reset a user's password."""
    try:
        keycloak_admin = get_keycloak_admin()
        if not keycloak_admin:
            raise HTTPException(status_code=503, detail="Keycloak Admin client not available.")

        keycloak_admin.set_user_password(
            user_id,
            password_data.password,
            temporary=password_data.temporary
        )
        return {"message": "Password reset successfully"}
    except Exception as e:
        logger.error(f"Keycloak error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to reset password: {str(e)}")


@router.post("/{user_id}/toggle-enabled/", dependencies=[Depends(require_platform_admin)])
def toggle_user_enabled(user_id: str):
    """Toggle a user's enabled status."""
    try:
        keycloak_admin = get_keycloak_admin()
        if not keycloak_admin:
            raise HTTPException(status_code=503, detail="Keycloak Admin client not available.")

        user = keycloak_admin.get_user(user_id)
        current_status = user.get('enabled', True)
        
        keycloak_admin.update_user(user_id, {"enabled": not current_status})
        return {
            "message": f"User {'disabled' if current_status else 'enabled'} successfully",
            "enabled": not current_status
        }
    except Exception as e:
        logger.error(f"Keycloak error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to toggle user status: {str(e)}")


@router.post("/{user_id}/send-verify-email/", dependencies=[Depends(require_platform_admin)])
def send_verification_email(user_id: str):
    """Send email verification to user."""
    try:
        keycloak_admin = get_keycloak_admin()
        if not keycloak_admin:
            raise HTTPException(status_code=503, detail="Keycloak Admin client not available.")

        keycloak_admin.send_verify_email(user_id)
        return {"message": "Verification email sent successfully"}
    except Exception as e:
        logger.error(f"Keycloak error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to send verification email: {str(e)}")


# ============ Bulk Operations ============

@router.post("/bulk/add-to-group/", dependencies=[Depends(require_platform_admin)])
def bulk_add_users_to_group(
    request: BulkAddToGroupRequest,
    token_info: dict = Depends(require_platform_admin)
):
    """Add multiple users to a group."""
    db = SessionLocal()
    try:
        admin_user_id = token_info.get('sub') or token_info.get('user_id')
        
        group = db.query(Group).filter(Group.id == request.group_id).first()
        if not group:
            raise HTTPException(status_code=404, detail="Group not found")
        
        added = 0
        skipped = 0
        
        for user_id in request.user_ids:
            existing = db.query(GroupMember).filter(
                GroupMember.group_id == request.group_id,
                GroupMember.user_id == user_id
            ).first()
            
            if existing:
                if not existing.is_active:
                    existing.is_active = True
                    existing.role = request.role
                    added += 1
                else:
                    skipped += 1
            else:
                member = GroupMember(
                    group_id=request.group_id,
                    user_id=user_id,
                    role=request.role,
                    added_by=admin_user_id
                )
                db.add(member)
                added += 1
        
        db.commit()
        
        # Sync to Keycloak if group has keycloak_group_id
        if group.keycloak_group_id:
            try:
                keycloak_admin = get_keycloak_admin()
                if keycloak_admin:
                    for user_id in request.user_ids:
                        try:
                            keycloak_admin.group_user_add(user_id, group.keycloak_group_id)
                        except Exception as e:
                            logger.warning(f"Could not add user {user_id} to Keycloak group: {e}")
            except Exception as e:
                logger.warning(f"Could not sync to Keycloak: {e}")
        
        return {
            "message": f"Added {added} users to group, skipped {skipped} (already members)",
            "added": added,
            "skipped": skipped
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error bulk adding users to group: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to add users to group: {str(e)}")
    finally:
        db.close()


@router.post("/bulk/remove-from-group/", dependencies=[Depends(require_platform_admin)])
def bulk_remove_users_from_group(
    user_ids: List[str],
    group_id: int,
    token_info: dict = Depends(require_platform_admin)
):
    """Remove multiple users from a group."""
    db = SessionLocal()
    try:
        group = db.query(Group).filter(Group.id == group_id).first()
        if not group:
            raise HTTPException(status_code=404, detail="Group not found")
        
        removed = db.query(GroupMember).filter(
            GroupMember.group_id == group_id,
            GroupMember.user_id.in_(user_ids)
        ).delete(synchronize_session=False)
        
        db.commit()
        
        # Sync to Keycloak if group has keycloak_group_id
        if group.keycloak_group_id:
            try:
                keycloak_admin = get_keycloak_admin()
                if keycloak_admin:
                    for user_id in user_ids:
                        try:
                            keycloak_admin.group_user_remove(user_id, group.keycloak_group_id)
                        except Exception as e:
                            logger.warning(f"Could not remove user {user_id} from Keycloak group: {e}")
            except Exception as e:
                logger.warning(f"Could not sync to Keycloak: {e}")
        
        return {
            "message": f"Removed {removed} users from group",
            "removed": removed
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error bulk removing users from group: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to remove users from group: {str(e)}")
    finally:
        db.close()


# ============ Current User Endpoint ============

@router.get("/me/", dependencies=[Depends(get_current_user)])
def get_current_user_info(token_info: dict = Depends(get_current_user)):
    """Get information about the currently authenticated user."""
    try:
        user_id = token_info.get('sub') or token_info.get('user_id')
        
        keycloak_admin = get_keycloak_admin()
        if not keycloak_admin:
            raise HTTPException(status_code=503, detail="Keycloak Admin client not available.")

        user = keycloak_admin.get_user(user_id)
        
        # Get groups from database
        db = SessionLocal()
        try:
            memberships = db.query(GroupMember).filter(
                GroupMember.user_id == user_id,
                GroupMember.is_active == True
            ).all()
            
            groups = []
            for membership in memberships:
                group = db.query(Group).filter(Group.id == membership.group_id).first()
                if group:
                    groups.append({
                        "id": group.id,
                        "name": group.name,
                        "role": membership.role,
                        "priority_level": group.priority_level,
                        "limits": {
                            "max_assistants": group.max_assistants_created,
                            "max_data_collections": group.max_data_collections,
                            "daily_token_limit": group.daily_token_limit,
                            "monthly_token_limit": group.monthly_token_limit
                        }
                    })
            
            return {
                "id": user.get('id'),
                "username": user.get('username'),
                "email": user.get('email'),
                "firstName": user.get('firstName'),
                "lastName": user.get('lastName'),
                "enabled": user.get('enabled', True),
                "emailVerified": user.get('emailVerified', False),
                "groups": groups
            }
        finally:
            db.close()
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting current user info: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get user info: {str(e)}")