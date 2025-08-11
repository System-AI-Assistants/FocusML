from pydantic import BaseModel


class ChatMessageRequest(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: list[ChatMessageRequest]
    max_tokens: int = None
    temperature: float = None
    top_p: float = None
    stop: list[str] = None
    custom_inputs: dict = None

class ChatResponse(BaseModel):
    choices: list[dict]
    model: str