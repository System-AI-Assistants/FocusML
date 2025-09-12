from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from services.keycloack_service import keycloak_openid

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

def get_current_user(token: str = Depends(oauth2_scheme)):
    token_info = keycloak_openid.introspect(token)
    if not token_info.get('active'):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token is not active",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return token_info
