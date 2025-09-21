import unittest
import socket
import requests

class TestOllamaSimple(unittest.TestCase):
    def test_ollama_connection(self):
        """Test simple connection to Ollama server on localhost:11434"""
        # Use host.docker.internal to connect to the host machine from inside Docker
        host = "host.docker.internal"
        port = 11434
        
        # Test if port is open
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(2)
            result = sock.connect_ex((host, port))
            sock.close()
            
            if result == 0:
                print(f"✅ Success: Port {port} is open on {host}")
                
                # Try to make an API request
                try:
                    response = requests.get(f"http://{host}:{port}/api/tags")
                    print(f"✅ Successfully connected to Ollama API. Status code: {response.status_code}")
                    print(f"   Response: {response.text[:200]}...")  # Print first 200 chars of response
                except Exception as e:
                    self.fail(f"Failed to connect to Ollama API: {str(e)}")
            else:
                self.fail(f"Port {port} is not open on {host}. Is Ollama running?")
                
        except Exception as e:
            self.fail(f"Socket error when trying to connect to {host}:{port}: {str(e)}")

if __name__ == "__main__":
    unittest.main()
