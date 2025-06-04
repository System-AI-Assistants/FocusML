import ollama
from ollama import Options
from rich import print
import mlflow

mlflow.set_experiment("chatmodel-quickstart")

with mlflow.start_run():
    model_info = mlflow.pyfunc.log_model(
        "ollama_model",

        python_model="ollama_model.py",
        input_example={
            "messages": [{"role": "user", "content": "Hello, how are you?"}]
        },
    )

loaded_model = mlflow.pyfunc.load_model(model_info.model_uri)

result = loaded_model.predict(
    data={
        "messages": [{"role": "user", "content": "How to trace Mistral in MLflow?"}],
        "max_tokens": 25,
    }
)
print(result)

# response = ollama.chat(
#     model="mistral",
#     messages=[
#         {
#             "role": "user",
#             "content": "What is MLflow Tracking?",
#         }
#     ],
# )
#
# print(response)
