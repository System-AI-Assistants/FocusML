from fastapi import APIRouter, Depends
from sqlalchemy.exc import SQLAlchemyError

from backend.api.deps import get_current_user
from backend.db.models.model_family import ModelFamily
from backend.db.session import SessionLocal

router = APIRouter(prefix="/api/models", tags=["Models"])


@router.get("/ollama", dependencies=[Depends(get_current_user)])
def get_models():
    try:
        with SessionLocal() as session:
            families = session.query(ModelFamily).all()
            result = []
            for family in families:
                family_data = {
                    "name": family.name,
                    "description": family.description,
                    "icon": family.icon,
                    "url": family.url,
                    "installed": family.installed,
                    "models": [
                        {
                            "name": model.name,
                            "size": model.size,
                            "context": model.context,
                            "input": model.input_type
                        } for model in family.models
                    ]
                }
                result.append(family_data)
            return result
    except SQLAlchemyError as e:
        print(f"Error fetching models: {e}, type: {type(e)}")