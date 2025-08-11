from typing import Optional, Dict, Any, List
import ollama
from mlflow.pyfunc import ChatModel
from mlflow.types.llm import ChatMessage, ChatCompletionResponse, ChatChoice
from mlflow.models import set_model

class OllamaModel(ChatModel):
    def __init__(self):

        self.model_name: Optional[str] = None
        self.base_url: str = "http://localhost:11434"
        self.client: Optional[ollama.Client] = None

    def load_context(self, context):
        cfg = getattr(context, "model_config", {}) or {}
        self.model_name = cfg.get("model_name", "mistral:7b")
        self.base_url   = cfg.get("ollama_host", self.base_url)
        # Create the client at load-time (not during pickling)
        self.client = ollama.Client(host=self.base_url)

    def _prepare_options(self, params):
        opts = {}
        if not params:
            return opts

        # Accept both dict and ChatParams
        if isinstance(params, dict):
            if params.get("max_tokens") is not None:
                opts["num_predict"] = params["max_tokens"]
            if params.get("temperature") is not None:
                opts["temperature"] = params["temperature"]
            if params.get("top_p") is not None:
                opts["top_p"] = params["top_p"]
            if params.get("stop") is not None:
                opts["stop"] = params["stop"]
            ci = params.get("custom_inputs") or {}
            if ci.get("seed") is not None:
                opts["seed"] = int(ci["seed"])
        else:
            # ChatParams object
            if getattr(params, "max_tokens", None) is not None:
                opts["num_predict"] = params.max_tokens
            if getattr(params, "temperature", None) is not None:
                opts["temperature"] = params.temperature
            if getattr(params, "top_p", None) is not None:
                opts["top_p"] = params.top_p
            if getattr(params, "stop", None) is not None:
                opts["stop"] = params.stop
            ci = getattr(params, "custom_inputs", None) or {}
            if ci.get("seed") is not None:
                opts["seed"] = int(ci["seed"])
        return opts

    def predict(self, context, messages, params=None):
        # Accept list[dict] or list[ChatMessage]
        if messages and not isinstance(messages[0], dict):
            messages = [{"role": m.role, "content": m.content} for m in messages]
        options = self._prepare_options(params)
        resp = self.client.chat(model=self.model_name, messages=messages, options=options)
        content = resp["message"]["content"]
        return ChatCompletionResponse(
            choices=[ChatChoice(index=0, message=ChatMessage(role="assistant", content=content))],
            model=self.model_name,
        )


set_model(OllamaModel())
