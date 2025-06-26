import os
import subprocess

import ollama
import pandas as pd
from sqlalchemy import create_engine, inspect, text, exc
import streamlit as st


def get_db_dialect(url):
    """Parses a database URL and returns its dialect."""
    try:
        return url.split(":", 1)[0].split("+", 1)[0]
    except IndexError:
        return "unknown"


MODELS_BACKUP_FILE = "ollama_models.txt"


def fetch_base_models():
    """
    Fetches the list of base models from ollama.com, with file-based caching.
    """
    try:
        # Command to scrape base model names from the Ollama library
        command = "curl -s https://ollama.com/library | grep -Eo 'href=\"/library/[^\"]+' | sed 's|href=\"/library/||'"
        result = subprocess.run(command, shell=True, capture_output=True, text=True, check=True)
        models = sorted(list(set(result.stdout.strip().split('\n'))))  # Use set to remove duplicates

        # Cache the list to a file
        with open(MODELS_BACKUP_FILE, "w") as f:
            f.write("\n".join(models))
        return models
    except (subprocess.CalledProcessError, FileNotFoundError) as e:
        st.warning(f"Could not fetch models from ollama.com: {e}. Trying to load from backup file.", icon="⚠️")
        if os.path.exists(MODELS_BACKUP_FILE):
            with open(MODELS_BACKUP_FILE, "r") as f:
                return f.read().strip().split('\n')
        else:
            st.error(f"Backup file '{MODELS_BACKUP_FILE}' not found. Please check your internet connection.", icon="🚨")
            return []


def fetch_model_tags(base_model):
    """
    Fetches and filters specific, optimized tags for a given base model.
    """
    if not base_model:
        return []
    try:
        # Command to get and filter tags for the selected model
        # The filter removes generic tags, text-only, and certain quantization levels to get good performance models.
        # s https://ollama.com/library/{base_model}/tags
        command = f"""
        curl -s https://ollama.com/library/{base_model}/tags | \
        grep -o '{base_model}:[^" ]*q[^" ]*' | \
        grep -E -v 'text|base|fp|q[45]_[01]'
        """
        result = subprocess.run(command, shell=True, capture_output=True, text=True, check=True)
        tags = sorted(list(set(result.stdout.strip().split('\n'))))
        return tags if tags else [f"{base_model}:latest"]  # Fallback to latest if filter is too aggressive
    except (subprocess.CalledProcessError, FileNotFoundError) as e:
        st.error(f"Could not fetch tags for '{base_model}'. Error: {e}. You may need to select another model.",
                 icon="🚨")
        return [f"{base_model}:latest"]  # Provide a sensible default


def get_available_models():
    """Fetches the list of available Ollama models."""
    try:
        models = ollama.list()["models"]
        return [model["name"] for model in models]
    except Exception as e:
        st.error("Could not connect to Ollama. Please ensure it's running. Using fallback models.", icon="🚨")
        print(f"Ollama connection error: {e}")
        return ["mistral:latest", "llama3:latest", "gemma:latest", "phi3:latest"]


def initialize_session_state():
    """Initializes session state variables."""
    if "messages" not in st.session_state:
        st.session_state.messages = []
    if "app_stage" not in st.session_state:
        st.session_state.app_stage = "select_base_model"
    if "data_context" not in st.session_state:
        st.session_state.data_context = None
    if "selected_model" not in st.session_state:
        st.session_state.selected_model = ""
    if "base_model" not in st.session_state:
        st.session_state.base_model = None


# --- UI Components for each stage ---


def handle_model_selection():
    """Displays UI for the two-step model and tag selection."""
    st.info("Welcome! First, choose a base model from the Ollama library.", icon="🤖")

    # Step 1: Select Base Model
    base_models = fetch_base_models()
    if not base_models:
        st.error(
            "Fatal: Could not retrieve any models to choose from. Please ensure you have an internet connection or a local model backup file.",
            icon="🔥")
        return

    base_model = st.selectbox(
        "Select a base model:",
        options=base_models,
        index=base_models.index(
            st.session_state.base_model) if st.session_state.base_model and st.session_state.base_model in base_models else None,
        placeholder="Choose a model...",
        key="base_model_selector"
    )

    if base_model:
        st.session_state.base_model = base_model

        # Step 2: Select a specific tag for the chosen base model
        with st.spinner(f"Fetching available tags for `{base_model}`..."):
            model_tags = fetch_model_tags(base_model)

        if not model_tags:
            st.warning(
                f"No suitable tags found for `{base_model}` after filtering. You may need to adjust the filter criteria or choose another model.",
                icon="⚠️")
            return

        selected_tag = st.selectbox(
            "Select a specific model tag/version:",
            options=model_tags,
            index=None,
            placeholder="Choose a version...",
        )

        if selected_tag:
            st.session_state.selected_model = selected_tag
            st.session_state.app_stage = "select_data_source"
            st.session_state.messages.append(
                {"role": "assistant", "content": f"Great! We'll be using the `{selected_tag}` model."}
            )
            st.rerun()


def handle_data_source_selection():
    """Displays UI for data source selection."""
    st.info("Next, how would you like to provide your data?", icon="💾")

    col1, col2 = st.columns(2)
    with col1:
        if st.button("Connect to a Database", use_container_width=True):
            st.session_state.app_stage = "connect_database"
            st.rerun()
    with col2:
        if st.button("Upload a File", use_container_width=True):
            st.session_state.app_stage = "upload_file"
            st.rerun()


def handle_database_connection():
    """Displays UI for database connection URL input."""
    st.info("Please provide your database connection URL.", icon="🔗")
    db_url = st.text_input("Database Connection URL (e.g., `sqlite:///mydb.db`)", key="db_url_input")

    if db_url:
        dialect = get_db_dialect(db_url)
        st.session_state.db_url = db_url
        st.session_state.messages.append(
            {"role": "assistant", "content": f"Detected database type: **{dialect}**. Let's proceed."}
        )
        st.session_state.app_stage = "select_db_slice"
        st.rerun()


def handle_db_slice_selection():
    """Displays UI for selecting how to slice the database data."""
    st.info("How do you want to select data from the database?", icon="🔪")
    col1, col2 = st.columns(2)
    with col1:
        if st.button("Select a Table", use_container_width=True):
            st.session_state.app_stage = "select_db_table"
            st.rerun()
    with col2:
        if st.button("Write a Custom SQL Query", use_container_width=True):
            st.session_state.app_stage = "custom_sql_query"
            st.rerun()


def handle_db_table_selection():
    """Displays UI for selecting a table from the database."""
    st.info("Fetching available tables from your database...", icon="📝")
    try:
        with st.spinner("Connecting to database and fetching table list..."):
            engine = create_engine(st.session_state.db_url)
            inspector = inspect(engine)
            tables = inspector.get_table_names()

        if not tables:
            st.error("No tables found in the database. Please check the connection URL or the database.", icon="🧐")
            st.session_state.app_stage = "select_db_slice"  # Go back
            if st.button("Go Back"):
                st.rerun()
            return

        selected_table = st.selectbox("Choose a table to load:", options=tables, index=None)

        if selected_table:
            with st.spinner(f"Loading data from table `{selected_table}`..."):
                df = pd.read_sql_table(selected_table, engine)
                st.session_state.data_context = df.to_csv(index=False)
                st.session_state.messages.append(
                    {"role": "assistant", "content": f"Successfully loaded data from table `{selected_table}`."}
                )
                st.session_state.app_stage = "ready_to_chat"
                st.rerun()

    except exc.SQLAlchemyError as e:
        st.error(
            f"Database Error: Could not connect or fetch tables. Please check your URL and network access. Details: {e}",
            icon="🔥")
        if st.button("Try Again"):
            st.session_state.app_stage = "connect_database"
            st.rerun()
    except Exception as e:
        st.error(f"An unexpected error occurred: {e}", icon="🔥")
        if st.button("Try Again"):
            st.session_state.app_stage = "connect_database"
            st.rerun()


def handle_custom_sql_query():
    """Displays UI for entering a custom SQL query."""
    st.info("Please enter your custom SQL query below.", icon="⌨️")
    query = st.text_area("SQL Query", height=200, placeholder="SELECT * FROM my_table WHERE condition = 'value';")

    if st.button("Run Query and Load Data"):
        if not query.strip():
            st.warning("Query cannot be empty.")
            return

        try:
            with st.spinner("Executing query and loading data..."):
                engine = create_engine(st.session_state.db_url)
                df = pd.read_sql_query(text(query), engine)
                st.session_state.data_context = df.to_csv(index=False)
                st.session_state.messages.append(
                    {"role": "assistant", "content": "Successfully loaded data from your custom SQL query."}
                )
                st.session_state.app_stage = "ready_to_chat"
                st.rerun()

        except exc.SQLAlchemyError as e:
            st.error(f"Database Error: The query failed. Please check your syntax and table/column names. Details: {e}",
                     icon="🔥")
        except Exception as e:
            st.error(f"An unexpected error occurred: {e}", icon="🔥")


def handle_file_upload():
    """Displays UI for file uploading."""
    st.info("Upload a file (CSV or TXT). The contents will be used as context.", icon="📄")
    uploaded_file = st.file_uploader(
        "Choose a file",
        type=["csv", "txt", "json"],
        accept_multiple_files=False
    )

    if uploaded_file is not None:
        with st.spinner(f"Processing `{uploaded_file.name}`..."):
            if uploaded_file.type == "text/csv":
                df = pd.read_csv(uploaded_file)
                st.session_state.data_context = df.to_csv(index=False)
            else:  # txt file
                st.session_state.data_context = uploaded_file.getvalue().decode("utf-8")

            st.session_state.messages.append(
                {"role": "assistant", "content": f"Successfully loaded data from file `{uploaded_file.name}`."}
            )
            st.session_state.app_stage = "ready_to_chat"
            st.rerun()


def main():
    """Main function to run the Streamlit app."""
    st.set_page_config(page_title="Universal ML Chat", layout="centered")
    st.title("Universal ML Chat 💬")
    initialize_session_state()

    for msg in st.session_state.messages:
        with st.chat_message(msg["role"]):
            st.markdown(msg["content"])

    # State machine for the application flow
    if st.session_state.app_stage == "select_base_model":
        handle_model_selection()
    elif st.session_state.app_stage == "select_data_source":
        handle_data_source_selection()
    elif st.session_state.app_stage == "connect_database":
        handle_database_connection()
    elif st.session_state.app_stage == "select_db_slice":
        handle_db_slice_selection()
    elif st.session_state.app_stage == "select_db_table":
        handle_db_table_selection()
    elif st.session_state.app_stage == "custom_sql_query":
        handle_custom_sql_query()
    elif st.session_state.app_stage == "upload_file":
        handle_file_upload()
    elif st.session_state.app_stage == "ready_to_chat":
        with st.expander("View Loaded Data Context"):
            st.text(st.session_state.data_context[:2000] + "..." if len(
                st.session_state.data_context) > 2000 else st.session_state.data_context)

        if prompt := st.chat_input("Ask a question about your data..."):
            st.session_state.messages.append({"role": "user", "content": prompt})
            with st.chat_message("user"):
                st.markdown(prompt)
            with st.chat_message("assistant"):
                message_placeholder = st.empty()
                full_response = ""
                with st.spinner("Thinking..."):
                    system_prompt = f"""You are an expert data analyst.
                    A user has provided the following data, enclosed in triple backticks:
                    ```
                    {st.session_state.data_context}
                    ```
                    Your task is to answer the user's questions based ONLY on this provided data.
                    If the answer cannot be found in the data, state that clearly.
                    """
                    messages_for_api = [{"role": "system", "content": system_prompt},
                                        {"role": "user", "content": prompt}]
                    try:
                        stream = ollama.chat(model=st.session_state.selected_model, messages=messages_for_api,
                                             stream=True)
                        for chunk in stream:
                            full_response += chunk["message"]["content"]
                            message_placeholder.markdown(full_response + "▌")
                        message_placeholder.markdown(full_response)
                    except Exception as e:
                        full_response = f"Error: Could not get a response from Ollama. Ensure the model '{st.session_state.selected_model}' is pulled locally (`ollama pull {st.session_state.selected_model}`). Details: {e}"
                        message_placeholder.error(full_response, icon="🔥")
            st.session_state.messages.append({"role": "assistant", "content": full_response})


if __name__ == "__main__":
    main()
