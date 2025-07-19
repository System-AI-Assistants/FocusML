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
try:
    keycloak_admin = KeycloakAdmin(server_url=KEYCLOAK_SERVER_URL,
                                   client_id=KEYCLOAK_ADMIN_CLIENT_ID,
                                   realm_name=KEYCLOAK_REALM_NAME,
                                   client_secret_key=KEYCLOAK_ADMIN_CLIENT_SECRET,
                                   auto_refresh_token=['get', 'post', 'put', 'delete'])
except Exception as e:
    print(f"Failed to initialize Keycloak Admin: {e}")
    keycloak_admin = None


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
    try:
        # Get Keycloak public key to verify token signature
        keycloak_public_key = "-----BEGIN PUBLIC KEY-----\n" + keycloak_openid.public_key() + "\n-----END PUBLIC KEY-----"

        # Decode the token
        payload = jwt.decode(
            token,
            keycloak_public_key,
            algorithms=["RS256"],
            audience="account"  # or your frontend client_id
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Could not validate credentials: {e}")


# --- API Endpoints ---
@app.get("/api/users", dependencies=[Depends(get_current_user)])
def get_users():
    """Retrieve all users from the Keycloak realm."""
    if not keycloak_admin:
        raise HTTPException(status_code=503, detail="Keycloak Admin client not available.")
    try:
        users = keycloak_admin.get_users()
        return users
    except KeycloakError as e:
        raise HTTPException(status_code=e.response_code, detail=str(e))


@app.post("/api/users", status_code=status.HTTP_201_CREATED, dependencies=[Depends(get_current_user)])
def create_user(user: UserCreate):
    """Create a new user in the Keycloak realm."""
    if not keycloak_admin:
        raise HTTPException(status_code=503, detail="Keycloak Admin client not available.")
    try:
        new_user = keycloak_admin.create_user({
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
        return {"message": "User created successfully", "user_id": new_user}
    except KeycloakError as e:
        raise HTTPException(status_code=e.response_code, detail=str(e))


@app.delete("/api/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(get_current_user)])
def delete_user(user_id: str):
    """Delete a user from the Keycloak realm by their ID."""
    if not keycloak_admin:
        raise HTTPException(status_code=503, detail="Keycloak Admin client not available.")
    try:
        keycloak_admin.delete_user(user_id=user_id)
        return
    except KeycloakError as e:
        raise HTTPException(status_code=e.response_code, detail=str(e))


@app.get("/")
def root():
    return {"message": "MLOps Platform API is running."}


# To run the app: uvicorn main:app --reload
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
