import mlflow
from mlflow.pyfunc import ChatModel
from mlflow.types.llm import ChatMessage, ChatCompletionResponse, ChatChoice
from mlflow.models import set_model
import ollama
from ollama import Options


import mlflow
from mlflow.pyfunc import ChatModel
from mlflow.types.llm import ChatMessage, ChatCompletionResponse, ChatChoice
from mlflow.models import set_model
import ollama
from ollama import Options


class OllamaModel(ChatModel):
    def __init__(self):
        self.model_name = None
        self.client = None

    def load_context(self, context):
        self.model_name = "mistral:7b"
        self.client = ollama.Client()

    def _prepare_options(self, params):
        # Prepare options from params
        options = {}
        if params:
            if params.max_tokens is not None:
                options["num_predict"] = params.max_tokens
            if params.temperature is not None:
                options["temperature"] = params.temperature
            if params.top_p is not None:
                options["top_p"] = params.top_p
            if params.stop is not None:
                options["stop"] = params.stop

            if params.custom_inputs is not None:
                options["seed"] = int(params.custom_inputs.get("seed", None))

        return Options(**options)

    def predict(self, context, messages, params=None):
        ollama_messages = [
            {"role": msg.role, "content": msg.content} for msg in messages
        ]
        options = self._prepare_options(params)

        # Call Ollama
        response = self.client.chat(
            model=self.model_name, messages=ollama_messages, options=options
        )

        # Prepare the ChatCompletionResponse
        return ChatCompletionResponse(
            choices=[ChatChoice(index=0, message=ChatMessage(role="assistant", content=response["message"].content))],
            model=self.model_name,
        )


set_model(OllamaModel())