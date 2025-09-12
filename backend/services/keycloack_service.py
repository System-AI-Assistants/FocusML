from keycloak import KeycloakAdmin, KeycloakOpenID
from core.config import settings


def get_keycloak_admin():
    return KeycloakAdmin(
        server_url=settings.KEYCLOAK_SERVER_URL,
        username=settings.KEYCLOAK_ADMIN_NAME,
        password=settings.KEYCLOAK_ADMIN_PASSWORD,
        realm_name=settings.KEYCLOAK_REALM_NAME,
        client_id=settings.KEYCLOAK_ADMIN_CLIENT_ID,
        client_secret_key=settings.KEYCLOAK_ADMIN_CLIENT_SECRET
    )


keycloak_openid = KeycloakOpenID(
    server_url=settings.KEYCLOAK_SERVER_URL,
    realm_name=settings.KEYCLOAK_REALM_NAME,
    client_id='confidential',
    client_secret_key=settings.KEYCLOAK_ADMIN_CLIENT_SECRET,
    verify=True
)
