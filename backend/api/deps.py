from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from typing import Optional
import logging

from services.keycloack_service import keycloak_openid

logger = logging.getLogger(__name__)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token", auto_error=False)

def get_current_user(request: Request):
    """
    Get current user - accepts either API key (from middleware) or Keycloak token.
    If request was authenticated via API key, return API key info.
    Otherwise, validate Keycloak token.
    """
    # IMPORTANT: Check if request was authenticated via API key FIRST (set by middleware)
    # This must be checked before attempting Keycloak validation
    has_api_key_auth = hasattr(request.state, 'authenticated_via_api_key') and getattr(request.state, 'authenticated_via_api_key', False)
    logger.info(f"[get_current_user] Path: {request.url.path}, has_api_key_auth: {has_api_key_auth}")
    
    if has_api_key_auth:
        # Return API key info from request state
        api_key = getattr(request.state, 'api_key', None)
        logger.info(f"[get_current_user] API key found in state: {api_key is not None}")
        if api_key:
            logger.info(f"[get_current_user] Returning API key auth for key id={api_key.id}")
            return {
                'sub': api_key.owner,
                'api_key_id': api_key.id,
                'assistant_id': api_key.assistant_id,
                'authenticated_via': 'api_key'
            }
    
    # Fall back to Keycloak token validation only if API key auth was not used
    # Extract token manually from Authorization header
    logger.info(f"[get_current_user] Falling back to Keycloak validation")
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        logger.warning("[get_current_user] No Bearer token in Authorization header")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    token = auth_header.replace("Bearer ", "").strip()
    logger.info(f"[get_current_user] Token prefix: {token[:20] if len(token) > 20 else token}...")
    
    try:
        token_info = keycloak_openid.introspect(token)
        if not token_info.get('active'):
            logger.warning("[get_current_user] Keycloak says token is not active")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token is not active",
                headers={"WWW-Authenticate": "Bearer"},
            )
        token_info['authenticated_via'] = 'keycloak'
        logger.info("[get_current_user] Keycloak token validated successfully")
        return token_info
    except HTTPException:
        raise
    except Exception as e:
        # If Keycloak validation fails, check again if API key was used
        # (in case middleware set state but we missed it)
        if hasattr(request.state, 'authenticated_via_api_key') and request.state.authenticated_via_api_key:
            api_key = getattr(request.state, 'api_key', None)
            if api_key:
                return {
                    'sub': api_key.owner,
                    'api_key_id': api_key.id,
                    'assistant_id': api_key.assistant_id,
                    'authenticated_via': 'api_key'
                }
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token is not active",
            headers={"WWW-Authenticate": "Bearer"},
        )
