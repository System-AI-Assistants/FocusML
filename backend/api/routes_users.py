from fastapi import APIRouter, Depends, HTTPException

from api.deps import get_current_user
from schemas.user import UserCreate
from services.keycloack_service import get_keycloak_admin

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/", dependencies=[Depends(get_current_user)])
def get_users():
    try:
        admin = get_keycloak_admin()
        if not admin:
            raise HTTPException(status_code=503, detail="Keycloak Admin client not available.")

        users = admin.get_users()
        return users
    except Exception as e:
        # Log the actual error for debugging
        print(f"Keycloak error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch users from Keycloak: {str(e)}")


@router.post("/", dependencies=[Depends(get_current_user)])
def create_user(user: UserCreate):
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
            "credentials": [{
                "type": "password",
                "value": user.password,
                "temporary": False
            }]
        }

        new_user_id = keycloak_admin.create_user(creds)
        return {"message": "User created successfully", "user_id": new_user_id}
    except Exception as e:
        print(f"Keycloak error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create user: {str(e)}")


@router.delete("/{user_id}", dependencies=[Depends(get_current_user)])
def delete_user(user_id: str):
    try:
        keycloak_admin = get_keycloak_admin()
        if not keycloak_admin:
            raise HTTPException(status_code=503, detail="Keycloak Admin client not available.")

        keycloak_admin.delete_user(user_id=user_id)
        return {"message": "User deleted successfully"}
    except Exception as e:
        print(f"Keycloak error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete user: {str(e)}")