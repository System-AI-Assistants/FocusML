from fastapi import APIRouter, Depends, HTTPException

from backend.api.deps import get_current_user
from backend.schemas.user import UserCreate
from backend.services.keycloack_service import get_keycloak_admin

router = APIRouter(prefix="/api/users", tags=["Users"])


@router.get("/", dependencies=[Depends(get_current_user)])
def get_users():
    admin = get_keycloak_admin()
    return admin.get_users()


@router.post("/", dependencies=[Depends(get_current_user)])
def create_user(user: UserCreate):
    keycloak_admin = get_keycloak_admin()
    if not keycloak_admin:
        raise HTTPException(status_code=503, detail="Keycloak Admin client not available.")
    try:
        creds = {
            "username": user.username,
            "email": user.email,
            "firstName": user.firstName,
            "lastName": user.lastName,
            "enabled": True,
            "credentials": [{
                "type": "password",
                "value": user.password,
                "temporary": False
            }]
        }

        new_user_id = keycloak_admin.create_user(creds)
        return {"message": "User created successfully", "user_id": new_user_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create user: {str(e)}")


@router.delete("{user_id}", dependencies=[Depends(get_current_user)])
def delete_user(user_id: str):
    keycloak_admin = get_keycloak_admin()
    if not keycloak_admin:
        raise HTTPException(status_code=503, detail="Keycloak Admin client not available.")
    try:
        keycloak_admin.delete_user(user_id=user_id)
        return
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete user: {str(e)}")
