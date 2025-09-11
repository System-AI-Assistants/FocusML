from keycloak import KeycloakAdmin
from keycloak import KeycloakOpenIDConnection

keycloak_connection = KeycloakOpenIDConnection(
                        server_url="http://localhost:8080/",
                        username='adam',
                        password='adam',
                        realm_name="mlops",
                        client_id="confidential",
                        client_secret_key="4YVrVPRmxcnCwqdcj7MbznH1P3OK0XgE",
                        verify=True)

keycloak_admin = KeycloakAdmin(connection=keycloak_connection)

users = keycloak_admin.get_users({})

print(users)