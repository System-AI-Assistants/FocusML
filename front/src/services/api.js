//const API_BASE_URL = 'https://aiassistant.smartlilac.com/api';
const API_BASE_URL = 'http://localhost:8000';

// Data Collections API
export const getDataCollections = async (keycloak) => {
  try {
    const response = await fetch(`${API_BASE_URL}/data-collections/collections/`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${keycloak.token}`,
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching data collections:', error);
    throw error;
  }
};

// RAG Chat API
export const sendRAGChatMessage = async (keycloak, { collectionId, messages, model = 'mistral:7b' }) => {
  try {
    const response = await fetch(`${API_BASE_URL}/chat/rag/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${keycloak.token}`,
      },
      body: JSON.stringify({
        collection_id: collectionId,
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        model
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to send message');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error sending RAG chat message:', error);
    throw error;
  }
};

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
    const response = await fetch(`${API_BASE_URL}/models/ollama/`, {
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

export const createAssistant = async (keycloak, payload) => {
  if (!keycloak || !keycloak.token) {
    throw new Error('Keycloak not initialized or no token available');
  }

  const response = await fetch(`${API_BASE_URL}/assistants/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${keycloak.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to create assistant');
  }

  return await response.json();
};

export const getAssistantStatus = async (keycloak, assistantId) => {
    if (!keycloak || !keycloak.token) {
        throw new Error('Keycloak not initialized or no token available');
    }

    const response = await fetch(`${API_BASE_URL}/assistants/${assistantId}/status/`, {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${keycloak.token}`,
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to get assistant status');
    }

    return await response.json();
};

export const getAssistants = async (keycloak) => {
  if (!keycloak || !keycloak.token) {
    throw new Error('Keycloak not initialized or no token available');
  }

  const response = await fetch(`${API_BASE_URL}/assistants/`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${keycloak.token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to fetch assistants');
  }

  return await response.json();
};

export const getAssistantEndpoints = async (keycloak, assistantId) => {
  if (!keycloak || !keycloak.token) {
    throw new Error('Keycloak not initialized or no token available');
  }

  const response = await fetch(`${API_BASE_URL}/assistants/${assistantId}/endpoints/`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${keycloak.token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to fetch assistant endpoints');
  }

  return await response.json();
};

export const runAssistant = async (keycloak, assistantId) => {
  if (!keycloak || !keycloak.token) {
    throw new Error('Keycloak not initialized or no token available');
  }

  const response = await fetch(`${API_BASE_URL}/assistants/${assistantId}/run/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${keycloak.token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to run assistant');
  }

  return await response.json();
};

export const stopAssistant = async (keycloak, assistantId) => {
  if (!keycloak || !keycloak.token) {
    throw new Error('Keycloak not initialized or no token available');
  }

  const response = await fetch(`${API_BASE_URL}/assistants/${assistantId}/stop/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${keycloak.token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to stop assistant');
  }

  return await response.json();
};


export const sendChatMessage = async (keycloak, assistantId, messages) => {
  if (!keycloak || !keycloak.token) {
    throw new Error('Keycloak not initialized or no token available');
  }

  const response = await fetch(`${API_BASE_URL}/assistants/${assistantId}/chat/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${keycloak.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages,
      max_tokens: 512,
      temperature: 0.7,
      top_p: 0.9
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to send chat message');
  }

  return await response.json();
};

export async function fetchAssistant(keycloak, assistantId) {
    if (!keycloak || !keycloak.token) {
    throw new Error('Keycloak not initialized or no token available');
  }

  const res = await fetch(`${API_BASE_URL}/assistants/${assistantId}/`, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${keycloak.token}`,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json();
}

// Benchmarking APIs
export const getBenchmarkDatasets = async (keycloak) => {
  if (!keycloak || !keycloak.token) throw new Error('Keycloak not initialized or no token available');
  const res = await fetch(`${API_BASE_URL}/benchmarks/datasets/`, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${keycloak.token}`,
    },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

export const cancelBenchmarkRun = async (keycloak, runId) => {
  if (!keycloak || !keycloak.token) throw new Error('Keycloak not initialized or no token available');
  const res = await fetch(`${API_BASE_URL}/benchmarks/runs/${runId}/cancel/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${keycloak.token}`,
    },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

export const getBenchmarkRun = async (keycloak, runId) => {
  if (!keycloak || !keycloak.token) throw new Error('Keycloak not initialized or no token available');
  const res = await fetch(`${API_BASE_URL}/benchmarks/runs/${runId}/`, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${keycloak.token}`,
    },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

export const getBenchmarkRunLogs = async (keycloak, runId, offset = 0, limit = 100) => {
  if (!keycloak || !keycloak.token) throw new Error('Keycloak not initialized or no token available');
  const params = new URLSearchParams({ offset: String(offset), limit: String(limit) });
  const res = await fetch(`${API_BASE_URL}/benchmarks/runs/${runId}/logs/?${params.toString()}`, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${keycloak.token}`,
    },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

export const listBenchmarkRuns = async (keycloak) => {
  if (!keycloak || !keycloak.token) throw new Error('Keycloak not initialized or no token available');
  const res = await fetch(`${API_BASE_URL}/benchmarks/runs/`, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${keycloak.token}`,
    },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

export const createBenchmarkRun = async (keycloak, payload) => {
  if (!keycloak || !keycloak.token) throw new Error('Keycloak not initialized or no token available');
  const res = await fetch(`${API_BASE_URL}/benchmarks/runs/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${keycloak.token}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

// Add this to your api.js file

export const getStatistics = async (keycloak, period = '7days') => {
  if (!keycloak) {
    console.error('getStatistics: Keycloak instance is undefined');
    return null;
  }

  try {
    if (!keycloak.authenticated) {
      throw new Error('User is not authenticated');
    }

    console.log('Fetching statistics with token:', keycloak.token.substring(0, 20) + '...');

    const response = await fetch(`${API_BASE_URL}/statistics/?period=${period}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${keycloak.token}`,
      },
    });

    console.log('Statistics response status:', response.status, 'Status text:', response.statusText);

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}, StatusText: ${response.statusText}`);
    }

    const text = await response.text();
    console.log('Raw statistics response:', text);

    let data;
    try {
      data = text ? JSON.parse(text) : null;
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      return null;
    }

    console.log('Parsed statistics data:', data);
    return data;

  } catch (error) {
    console.error('Error in getStatistics:', {
      message: error.message,
      name: error.name,
      stack: error.stack,
    });
    return null;
  }
};

export const getEmbeddingModels = async (keycloak) => {
  if (!keycloak) {
    console.error('getEmbeddingModels: Keycloak instance is undefined');
    return [];
  }
  try {
    if (!keycloak.authenticated) {
      throw new Error('User is not authenticated');
    }
    const response = await fetch(`${API_BASE_URL}/models/embedding/`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${keycloak.token}`,
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching embedding models:', error);
    return [];
  }
};