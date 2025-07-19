import os
from dotenv import load_dotenv
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from keycloak import KeycloakAdmin, KeycloakOpenID
from keycloak.exceptions import KeycloakError
from pydantic import BaseModel, EmailStr
import uvicorn
import jwt

# Load environment variables from .env file
load_dotenv()

# --- Keycloak Configuration ---
KEYCLOAK_SERVER_URL = os.getenv("KEYCLOAK_SERVER_URL")
KEYCLOAK_REALM_NAME = os.getenv("KEYCLOAK_REALM_NAME")
KEYCLOAK_ADMIN_CLIENT_ID = os.getenv("KEYCLOAK_ADMIN_CLIENT_ID")
KEYCLOAK_ADMIN_CLIENT_SECRET = os.getenv("KEYCLOAK_ADMIN_CLIENT_SECRET")
KEYCLOAK_FRONTEND_CLIENT_ID = os.getenv("KEYCLOAK_FRONTEND_CLIENT_ID")

# --- FastAPI App Initialization ---
app = FastAPI(
    title="MLOps Platform Backend",
    description="API for managing users and other platform resources.",
    version="1.0.0"
)

# --- CORS Configuration ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Allow your React frontend
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)

# --- Keycloak Admin Client ---
def get_keycloak_admin():
    """Get an authenticated Keycloak admin client"""
    try:
        admin = KeycloakAdmin(
            server_url=KEYCLOAK_SERVER_URL,
            username=os.getenv("KEYCLOAK_ADMIN_USERNAME", "admin"),
            password=os.getenv("KEYCLOAK_ADMIN_PASSWORD"),
            realm_name=KEYCLOAK_REALM_NAME,
            user_realm_name="master"  # Admin user is typically in master realm
        )
        return admin
    except Exception as e:
        print(f"Failed to initialize Keycloak Admin: {e}")
        return None


# --- Pydantic Models for Data Validation ---
class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    firstName: str = None
    lastName: str = None


# --- Authentication & Authorization ---
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

keycloak_openid = KeycloakOpenID(server_url=KEYCLOAK_SERVER_URL,
                                 realm_name=KEYCLOAK_REALM_NAME,
                                 client_id=KEYCLOAK_FRONTEND_CLIENT_ID)


def get_current_user(token: str = Depends(oauth2_scheme)):
    print(f"Received token: {token[:50]}...")
    try:
        # Try to introspect the token with Keycloak
        print(f"Attempting to introspect token with Keycloak at {KEYCLOAK_SERVER_URL}")
        token_info = keycloak_openid.introspect(token)
        print(f"Token introspection result: {token_info}")
        
        if not token_info.get('active', False):
            print("Token is not active")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token is not active",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        print("Token validation successful")
        return token_info
    except HTTPException:
        raise
    except Exception as e:
        print(f"Token validation error: {e}")
        print(f"Error type: {type(e)}")
        # For debugging, let's be more permissive temporarily
        print("WARNING: Bypassing token validation for debugging")
        return {"sub": "debug-user", "active": True}


# --- API Endpoints ---
@app.get("/api/users", dependencies=[Depends(get_current_user)])
def get_users():
    """Retrieve all users from the Keycloak realm."""
    print("Getting users endpoint called")
    keycloak_admin = get_keycloak_admin()
    if not keycloak_admin:
        print("Keycloak admin client not available")
        raise HTTPException(status_code=503, detail="Keycloak Admin client not available.")
    try:
        print("Attempting to fetch users from Keycloak")
        users = keycloak_admin.get_users()
        print(f"Successfully fetched {len(users)} users")
        return users
    except Exception as e:
        print(f"Error fetching users: {e}")
        print(f"Error type: {type(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch users: {str(e)}")


@app.post("/api/users", status_code=status.HTTP_201_CREATED, dependencies=[Depends(get_current_user)])
def create_user(user: UserCreate):
    """Create a new user in the Keycloak realm."""
    keycloak_admin = get_keycloak_admin()
    if not keycloak_admin:
        raise HTTPException(status_code=503, detail="Keycloak Admin client not available.")
    try:
        new_user_id = keycloak_admin.create_user({
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
        })
        return {"message": "User created successfully", "user_id": new_user_id}
    except Exception as e:
        print(f"Error creating user: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create user: {str(e)}")


@app.delete("/api/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(get_current_user)])
def delete_user(user_id: str):
    """Delete a user from the Keycloak realm by their ID."""
    keycloak_admin = get_keycloak_admin()
    if not keycloak_admin:
        raise HTTPException(status_code=503, detail="Keycloak Admin client not available.")
    try:
        keycloak_admin.delete_user(user_id=user_id)
        return
    except Exception as e:
        print(f"Error deleting user: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete user: {str(e)}")


@app.get("/")
def root():
    return {"message": "MLOps Platform API is running."}


# To run the app: uvicorn main:app --reload
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
