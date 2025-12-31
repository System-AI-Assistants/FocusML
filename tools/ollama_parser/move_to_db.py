import json
from sqlalchemy import create_engine, Column, Integer, String, Text, Boolean, ForeignKey
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from sqlalchemy.exc import SQLAlchemyError
import logging


Base = declarative_base()

# TODO: add model provider. e.g. Ollama
class ModelFamily(Base):
    __tablename__ = 'model_families'

    id = Column(Integer, primary_key=True)
    provider = Column(String(255))
    name = Column(String(255), unique=True, nullable=False)
    description = Column(Text)
    icon = Column(String(255))
    url = Column(String(255))
    tags = Column(String(255))
    installed = Column(Boolean)
    models = relationship("Model", back_populates="family")


class Model(Base):
    __tablename__ = 'models'

    id = Column(Integer, primary_key=True)
    family_id = Column(Integer, ForeignKey('model_families.id'), nullable=False)
    name = Column(String(255), nullable=False)
    size = Column(String(50))
    context = Column(String(50))
    input_type = Column(String(100))
    family = relationship("ModelFamily", back_populates="models")

def load_json_from_file(file_path):
    """Load JSON data from a file."""
    try:
        with open(file_path, 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"Error: File '{file_path}' not found.")
        return []
    except json.JSONDecodeError as e:
        print(f"Error decoding JSON from '{file_path}': {e}")
        return []

def create_database(engine):
    try:
        Base.metadata.create_all(engine)
    except SQLAlchemyError as e:
        print(f"Error creating tables: {e}")

def insert_data(session, data):

    try:
        for family_data in data:

            family = session.query(ModelFamily).filter_by(name=family_data['title']).first()
            if not family:

                family = ModelFamily(
                    name=family_data['title'],
                    description=family_data['description'],
                    icon=family_data['icon'],
                    url=family_data['url'],
                    installed=family_data['installed'],
                    tags=",".join(family_data['tags']),
                    provider='ollama'
                )
                session.add(family)
            else:

                family.description = family_data['description']
                family.icon = family_data['icon']
                family.url = family_data['url']
                family.installed = family_data['installed']
                family.tags = ",".join(family_data['tags'])
                family.provider = 'ollama'
            session.flush()


            for model_data in family_data['models']:
                model = session.query(Model).filter_by(family_id=family.id, name=model_data['name']).first()
                if 'cloud' in model_data['name']:
                    continue

                if not model:

                    model = Model(
                        family_id=family.id,
                        name=model_data['name'],
                        size=model_data['size'],
                        context=model_data['context'],
                        input_type=model_data['input'],
                       
                   
                    )
                    session.add(model)
                else:

                    model.size = model_data['size']
                    model.context = model_data['context']
                    model.input_type = model_data['input']
                    model.provider = 'ollama'
        session.commit()
    except SQLAlchemyError as e:
        print(f"Error inserting data: {e}")
        session.rollback()

def main():

    db_url = 'postgresql://keycloak:keycloak@localhost:5432/app_db'

    try:

        engine = create_engine(db_url)


        create_database(engine)


        Session = sessionmaker(bind=engine)
        session = Session()

        json_data = load_json_from_file('models2.json')
        insert_data(session, json_data)

        print("Data successfully inserted into PostgreSQL database.")

    except SQLAlchemyError as e:
        print(f"Database error: {e}")
    finally:
        if 'session' in locals():
            session.close()

if __name__ == "__main__":
    main()