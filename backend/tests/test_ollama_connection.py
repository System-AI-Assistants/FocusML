import unittest
import os
import socket
from unittest.mock import patch, MagicMock
import pytest
import ollama
from api.ollama_model import OllamaModel

def is_port_open(host, port):
    """Check if a port is open on the given host."""
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(2)
        result = sock.connect_ex((host, port))
        sock.close()
        return result == 0
    except Exception:
        return False

def skip_if_ollama_not_running():
    """Skip test if Ollama server is not running."""
    if not is_port_open('host.docker.internal', 11434):
        pytest.skip("Ollama server is not running. Please start Ollama on your host machine.")
    try:
        client = ollama.Client(host='http://host.docker.internal:11434')
        client.list()
    except Exception as e:
        pytest.skip(f"Could not connect to Ollama server: {str(e)}")

class TestOllamaConnection(unittest.TestCase):
    def setUp(self):
        """Set up test fixtures."""
        self.ollama = OllamaModel()
        self.ollama.model_name = "mistral:7b"  # Default model
        self.ollama.base_url = "http://localhost:11434/"
        self.ollama.client = ollama.Client(host=self.ollama.base_url)

    def test_connection_successful(self):
        """Test successful connection to Ollama server."""
        # Skip test if Ollama is not running
        skip_if_ollama_not_running()

        # Update base_url to use host.docker.internal for Docker to host communication
        self.ollama.base_url = "http://host.docker.internal:11434/"
        self.ollama.client = ollama.Client(host=self.ollama.base_url)

        try:
            # Test if server is reachable
            response = self.ollama.client.list()
            self.assertIsNotNone(response)
            print("✅ Successfully connected to Ollama server")

            # Test if model is available
            # The response is a dict with a 'models' key containing a list of model info
            models = response.get('models', [])

            # Print available models for debugging
            print("\nAvailable models in Ollama:")
            for model in models:
                print(f"- {model.get('name', 'unnamed')} (digest: {model.get('digest', 'unknown')})")

            if not models:
                self.skipTest("\n❌ No models found in Ollama. Please pull a model first with 'ollama pull mistral:7b'")

            # Check if our model is available
            expected_model = "mistral"  # Base model name without tag
            model_found = any(expected_model in model.get('name', '') for model in models)

            if not model_found:
                print(f"\n❌ Model '{expected_model}' not found in available models.")
                print("\nTo fix this, run the following command on your host machine:")
                print("  ollama pull mistral:7b")
                print("\nThen restart the Ollama service if needed.")
                self.skipTest(f"Model '{expected_model}' not found. Please pull it first.")

            print(f"\n✅ Model '{expected_model}' is available")

            # Test simple completion
            test_prompt = "Hello, this is a test. Respond with 'OK' if you received this."
            response = self.ollama.client.generate(
                model=self.ollama.model_name,
                prompt=test_prompt,
                max_tokens=10
            )
            self.assertIn('response', response)
            print("✅ Successfully got response from model")
            print(f"   Response: {response['response']}")

        except Exception as e:
            self.fail(f"Failed to connect to Ollama server: {str(e)}")

    @patch('ollama.Client.list')
    def test_connection_failure(self, mock_list):
        """Test connection failure handling."""
        # Skip if we can't mock (e.g., if Ollama is actually running)
        if is_port_open('host.docker.internal', 11434):
            self.skipTest("Skipping failure test because Ollama is running")

        # Mock a connection error
        mock_list.side_effect = Exception("Connection refused")

        with self.assertRaises(Exception) as context:
            self.ollama.client.list()
        self.assertIn("Connection refused", str(context.exception))
        print("✅ Correctly handled connection error")

if __name__ == "__main__":
    unittest.main()
