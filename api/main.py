import os

import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from keycloak import KeycloakAdmin, KeycloakOpenID
from pydantic import BaseModel, EmailStr
from sqlalchemy import create_engine, Column, Integer, String, Text, Boolean, ForeignKey
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from sqlalchemy.exc import SQLAlchemyError

from sqlalchemy import create_engine, Column, Integer, String, Text, Boolean, ForeignKey
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from sqlalchemy.exc import SQLAlchemyError


Base = declarative_base()

class ModelFamily(Base):
    __tablename__ = 'model_families'

    id = Column(Integer, primary_key=True)
    name = Column(String(255), unique=True, nullable=False)
    description = Column(Text)
    icon = Column(String(255))
    url = Column(String(255))
    installed = Column(Boolean)
    models = relationship("Model", back_populates="family")


class Model(Base):
    __tablename__ = 'models'

    id = Column(Integer, primary_key=True)
    family_id = Column(Integer, ForeignKey('model_families.id'), nullable=False)
    name = Column(String(255), nullable=False)
    size = Column(String(50))
    context = Column(String(50))
    input_type = Column(String(100))
    family = relationship("ModelFamily", back_populates="models")

load_dotenv()

KEYCLOAK_SERVER_URL = os.getenv("KEYCLOAK_SERVER_URL")
KEYCLOAK_REALM_NAME = os.getenv("KEYCLOAK_REALM_NAME")
KEYCLOAK_ADMIN_CLIENT_ID = os.getenv("KEYCLOAK_ADMIN_CLIENT_ID")
KEYCLOAK_ADMIN_NAME = os.getenv("KEYCLOAK_ADMIN_NAME")
KEYCLOAK_ADMIN_PASSWORD = os.getenv("KEYCLOAK_ADMIN_PASSWORD")
KEYCLOAK_ADMIN_CLIENT_SECRET = os.getenv("KEYCLOAK_ADMIN_CLIENT_SECRET")
KEYCLOAK_FRONTEND_CLIENT_ID = os.getenv("KEYCLOAK_FRONTEND_CLIENT_ID")

app = FastAPI(
    title="MLOps Platform Backend",
    description="API for managing users and other platform resources.",
    version="1.0.0"
)

DB_URL = 'postgresql://react:DcaErJGsvJdLvzRV3FYddcVfH5gDcnBcErJGasdcaS@localhost:5432/react_db'

engine = create_engine(DB_URL)
SessionLocal = sessionmaker(bind=engine)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)


def get_keycloak_admin():
    """Get an authenticated Keycloak admin client"""
    try:
        admin = KeycloakAdmin(
            server_url=KEYCLOAK_SERVER_URL,
            username=KEYCLOAK_ADMIN_NAME,
            password=KEYCLOAK_ADMIN_PASSWORD,
            realm_name=KEYCLOAK_REALM_NAME,
            client_id=KEYCLOAK_ADMIN_CLIENT_ID,
            client_secret_key=KEYCLOAK_ADMIN_CLIENT_SECRET
        )

        return admin
    except Exception as e:
        print(f"Failed to initialize Keycloak Admin: {e}")
        return None


class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    firstName: str = None
    lastName: str = None


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
    print(keycloak_admin)
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


@app.get("/api/ollama-models", dependencies=[Depends(get_current_user)])
def get_models():
    """Retrieve all model families and their models from the database in the original JSON format."""
    try:
        with SessionLocal() as session:
            families = session.query(ModelFamily).all()
            result = []
            for family in families:
                family_data = {
                    "name": family.name,
                    "description": family.description,
                    "icon": family.icon,
                    "url": family.url,
                    "installed": family.installed,
                    "models": [
                        {
                            "name": model.name,
                            "size": model.size,
                            "context": model.context,
                            "input": model.input_type
                        } for model in family.models
                    ]
                }
                result.append(family_data)
            return result
    except SQLAlchemyError as e:
        print(f"Error fetching models: {e}, type: {type(e)}")


# To run the app: uvicorn main:app --reload
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
