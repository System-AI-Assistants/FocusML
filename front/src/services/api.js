const BASE_URL = 'http://localhost:8000';

export const getModelFams = async (keycloak) => {
  if (!keycloak) {
    console.error('getModelFams: Keycloak instance is undefined');
    return [];
  }
  try {
    if (!keycloak.authenticated) {
      throw new Error('User is not authenticated');
    }
    console.log('Fetching models with token:', keycloak.token.substring(0, 20) + '...'); // Log partial token
    const response = await fetch(`${BASE_URL}/api/ollama-models/`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${keycloak.token}`,
      },
    });
    console.log('Response status:', response.status, 'Status text:', response.statusText); // Log status
    console.log('Response headers:', Object.fromEntries(response.headers.entries())); // Log headers
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}, StatusText: ${response.statusText}`);
    }
    const text = await response.text(); // Get raw response text
    console.log('Raw response text:', text); // Log raw text
    let data;
    try {
      data = text ? JSON.parse(text) : []; // Parse as array if text exists, else empty array
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      return [];
    }
    console.log('Parsed API response:', data); // Log parsed data
    if (!Array.isArray(data)) {
      console.warn('Response is not an array:', data);
      return [];
    }
    return data;
  } catch (error) {
    console.error('Error in getModelFams:', {
      message: error.message,
      name: error.name,
      stack: error.stack,
    });
    return [];
  }
};