import Keycloak from 'keycloak-js';

const keycloak = new Keycloak({
  url: 'http://localhost:8080/', // Update this if your Keycloak server runs elsewhere
  realm: 'mlops', // Change to your realm
  clientId: 'public', // Change to your clientId
});

export default keycloak;
