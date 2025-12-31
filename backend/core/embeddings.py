import pandas as pd
import psycopg2
from sqlalchemy import create_engine, text
from typing import Dict, Any
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

class EmbeddingService:
    def __init__(self, db_url: str, ollama_host: str = "http://host.docker.internal:11434"):
        self.db_url = db_url
        self.ollama_host = ollama_host
        self.engine = create_engine(db_url)

    def _get_connection(self):
        """Get a database connection with error handling"""
        class ConnectionWrapper:
            def __init__(self, engine):
                self.engine = engine
                self.conn = None
                
            def __enter__(self):
                try:
                    self.conn = self.engine.raw_connection()
                    logger.debug("Successfully established database connection")
                    return self.conn
                except Exception as e:
                    logger.error(f"Failed to establish database connection: {str(e)}")
                    logger.error(f"Database URL: {self.engine.url}")
                    raise
                    
            def __exit__(self, exc_type, exc_val, exc_tb):
                if self.conn is not None:
                    self.conn.close()
                    logger.debug("Database connection closed")
                    
        return ConnectionWrapper(self.engine)

    def create_embeddings_table(self, table_name: str, columns: list) -> None:
        """Create a table for storing document embeddings"""
        try:
            logger.info(f"Creating/updating table {table_name} with columns: {columns}")
            
            with self._get_connection() as conn:
                with conn.cursor() as cur:
                    # Start with ID and content columns
                    sql_columns = ["id SERIAL PRIMARY KEY", "content TEXT"]
                    
                    # Add original data columns
                    for col in columns:
                        if col not in ['id', 'content', 'embedding', 'created_at', 'collection_id']:
                            sql_columns.append(f'"{col}" TEXT')
                    
                    # Add embedding and metadata columns
                    sql_columns.extend([
                        "embedding VECTOR(768)",
                        "created_at TIMESTAMPTZ DEFAULT NOW()",
                        "collection_id INTEGER"
                    ])
                    
                    # First, check if table exists
                    table_exists_sql = """
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_schema = 'public' 
                        AND table_name = %s
                    );
                    """
                    
                    cur.execute(table_exists_sql, (table_name,))
                    table_exists = cur.fetchone()[0]
                    
                    if table_exists:
                        logger.info(f"Table {table_name} already exists, checking columns")
                        # Get existing columns
                        cur.execute("""
                            SELECT column_name 
                            FROM information_schema.columns 
                            WHERE table_name = %s;
                        """, (table_name,))
                        
                        existing_columns = [row[0] for row in cur.fetchall()]
                        logger.info(f"Existing columns in {table_name}: {existing_columns}")
                        
                        # Add any missing columns
                        for col in columns:
                            if col not in existing_columns and col not in ['id', 'content', 'embedding', 'created_at', 'collection_id']:
                                add_col_sql = f'ALTER TABLE {table_name} ADD COLUMN IF NOT EXISTS "{col}" TEXT;'
                                logger.info(f"Adding column {col} to table {table_name}")
                                cur.execute(add_col_sql)
                    else:
                        # Create new table
                        create_sql = f"""
                        CREATE TABLE {table_name} (
                            {', '.join(sql_columns)}
                        );
                        """
                        logger.info(f"Creating new table {table_name}")
                        cur.execute(create_sql)
                        logger.info(f"Successfully created table {table_name}")
                
                conn.commit()
                logger.info(f"Successfully updated table {table_name}")
                
        except Exception as e:
            logger.error(f"Error in create_embeddings_table for table {table_name}: {str(e)}", exc_info=True)
            raise

    def _build_embedding_sql(self, data: Dict[str, Any], embedding_model: str = "nomic-embed-text") -> str:
        """Build SQL for generating embeddings"""
        # Create a string representation of the data for embedding
        concat_fields = " || ' | ' || ".join([f"'{k}: ' || COALESCE(CAST(%({k})s AS TEXT), 'NULL')" 
                                             for k in data.keys()])
        
        return f"""
        ai.ollama_embed(
            '{embedding_model}',
            {concat_fields},
            host => '{self.ollama_host}'
        )
        """

    async def generate_response(self, messages, model: str = "mistral:7b") -> str:
        """
        Generate a response using the specified model and messages

        Args:
            messages: List of messages in the format [{"role": "user", "content": "..."}, ...]
            model: The model to use for generation (default: "mistral:7b")

        Returns:
            The generated response as a string
        """
        import httpx
        
        if not messages:
            raise ValueError("No messages provided for generation")
            
        if not model:
            model = "mistral:7b"
            logger.warning("No model specified, using default: mistral:7b")

        try:
            # Prepare the request to the LLM API
            url = f"{self.ollama_host.rstrip('/')}/api/chat"

            # Format messages for the API
            formatted_messages = [
                {"role": msg.role if hasattr(msg, 'role') else msg.get('role'), 
                 "content": msg.content if hasattr(msg, 'content') else msg.get('content')}
                for msg in messages
                if hasattr(msg, 'role') or 'role' in msg
            ]

            # Make the request to the LLM
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    url,
                    json={
                        "model": model,
                        "messages": formatted_messages,
                        "stream": False
                    },
                    timeout=60.0  # 60 second timeout
                )

                if response.status_code != 200:
                    error_msg = f"LLM API error: {response.status_code} - {response.text}"
                    logger.error(error_msg)
                    raise Exception(error_msg)

                result = response.json()
                return result.get("message", {}).get("content", "")
                
        except Exception as e:
            logger.error(f"Error in generate_response: {str(e)}")
            raise

    def process_dataframe(self, df: pd.DataFrame, collection_id: int, table_name: str, embedding_model_name: str = "nomic-embed-text") -> Dict[str, Any]:
        """Process a DataFrame and store its embeddings"""
        try:
            logger.info(f"Starting to process DataFrame for collection {collection_id} using embedding model: {embedding_model_name}")
            
            if df.empty:
                raise ValueError("DataFrame is empty")

            # Ensure all columns are strings for embedding
            df = df.astype(str)
            logger.debug(f"DataFrame columns: {df.columns.tolist()}")
            
            # Add collection_id to each row
            df['collection_id'] = collection_id
            
            # Create or update the embeddings table
            logger.info(f"Creating/updating embeddings table: {table_name}")
            self.create_embeddings_table(table_name, [col for col in df.columns if col != 'collection_id'])
            
            # Process in chunks to avoid memory issues
            chunk_size = 100
            total_rows = len(df)
            processed_rows = 0
            
            logger.info(f"Starting to process {total_rows} rows in chunks of {chunk_size}")
            
            with self._get_connection() as conn:
                cursor = conn.cursor()
                
                for i in range(0, len(df), chunk_size):
                    chunk = df.iloc[i:i + chunk_size]
                    logger.debug(f"Processing chunk {i//chunk_size + 1}/{(len(df)-1)//chunk_size + 1}")
                    
                    for _, row in chunk.iterrows():
                        row_dict = row.to_dict()
                        
                        # Build the SQL for inserting with embeddings
                        try:
                            embedding_sql = self._build_embedding_sql(row_dict, embedding_model=embedding_model_name)
                            
                            # Prepare the insert SQL
                            columns = [f'"{k}"' for k in row_dict.keys()]
                            placeholders = [f'%({k})s' for k in row_dict.keys()]
                            
                            insert_sql = f"""
                            INSERT INTO {table_name} (
                                {', '.join(columns)}, embedding
                            ) VALUES (
                                {', '.join(placeholders)}, {embedding_sql}
                            )
                            """
                            
                            cursor.execute(insert_sql, row_dict)
                            processed_rows += 1
                            
                        except Exception as e:
                            logger.error(f"Error processing row {processed_rows + 1} (chunk {i//chunk_size + 1}): {str(e)}")
                            logger.error(f"Row data: {row_dict}")
                            raise
                    
                    try:
                        conn.commit()
                        logger.info(f"Committed chunk {i//chunk_size + 1}: Processed {processed_rows}/{total_rows} rows")
                    except Exception as e:
                        logger.error(f"Error committing chunk {i//chunk_size + 1}: {str(e)}")
                        conn.rollback()
                        raise
            
            logger.info(f"Successfully processed {processed_rows}/{total_rows} rows for collection {collection_id}")
            return {
                "status": "completed",
                "processed_rows": processed_rows,
                "total_rows": total_rows,
                "timestamp": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error in process_dataframe for collection {collection_id}: {str(e)}", exc_info=True)
            raise
        
        return {
            "status": "completed",
            "processed_rows": processed_rows,
            "total_rows": total_rows,
            "timestamp": datetime.utcnow().isoformat()
        }
