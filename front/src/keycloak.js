import Keycloak from 'keycloak-js';

const keycloak = new Keycloak({
  url: 'https://aiassistant.smartlilac.com/auth/', 
  realm: 'master', 
  clientId: 'public', 
});

export default keycloak;
