import { message } from 'antd';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

/**
 * Query a data collection using RAG (Retrieval-Augmented Generation)
 * @param {Object} keycloak - Keycloak instance
 * @param {number} collectionId - ID of the collection to query
 * @param {string} query - The query string
 * @param {number} [topK=3] - Number of results to return
 * @param {string} [model='mistral:7b'] - Model to use for generation
 * @returns {Promise<Object>} - Response with generated answer and sources
 */
export const queryWithRAG = async (keycloak, collectionId, query, topK = 3, model = 'mistral:7b') => {
  try {
    if (!keycloak?.authenticated) {
      throw new Error('User is not authenticated');
    }

    console.log('Sending RAG query:', { collectionId, query, topK, model });
    
    const response = await fetch(`${API_BASE_URL}/data-collections/collections/${collectionId}/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${keycloak.token}`
      },
      body: JSON.stringify({
        query,
        top_k: topK,
        model
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('RAG query failed:', { status: response.status, data });
      throw new Error(data.detail || 'Failed to query with RAG');
    }

    console.log('RAG query successful:', data);
    return data;
    
  } catch (error) {
    console.error('Error in queryWithRAG:', error);
    message.error(error.message || 'Failed to process your query');
    throw error;
  }
};

/**
 * Get available data collections with their embedding status
 * @param {Object} keycloak - Keycloak instance
 * @returns {Promise<Array>} - List of data collections
 */
export const getDataCollections = async (keycloak) => {
  try {
    if (!keycloak?.authenticated) {
      throw new Error('User is not authenticated');
    }

    const response = await fetch(`${API_BASE_URL}/data-collections/collections/`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${keycloak.token}`
      }
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.detail || 'Failed to fetch data collections');
    }

    return data;
    
  } catch (error) {
    console.error('Error fetching data collections:', error);
    message.error('Failed to load data collections');
    throw error;
  }
};
