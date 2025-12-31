from fastapi import APIRouter, Depends
from sqlalchemy.exc import SQLAlchemyError
from typing import List

from api.deps import get_current_user
from db.models.model_family import ModelFamily
from db.models.model import Model
from db.session import SessionLocal

router = APIRouter(prefix="/models", tags=["Models"])


@router.get("/ollama/", dependencies=[Depends(get_current_user)])
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


@router.get("/embedding/", dependencies=[Depends(get_current_user)])
def get_embedding_models():
    """Get all models that are embedding models (have 'embedding' in their family tags)"""
    try:
        with SessionLocal() as session:
            # Query families that have 'embedding' in their tags
            families = session.query(ModelFamily).filter(
                ModelFamily.tags.ilike('%embedding%')
            ).all()
            
            result = []
            for family in families:
                for model in family.models:
                    result.append({
                        "id": model.id,
                        "name": model.name,
                        "family_name": family.name,
                        "size": model.size,
                        "context": model.context,
                        "input": model.input_type
                    })
            return result
    except SQLAlchemyError as e:
        print(f"Error fetching embedding models: {e}, type: {type(e)}")
        return []
