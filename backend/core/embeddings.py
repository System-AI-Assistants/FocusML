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

    def _build_embedding_sql(self, data: Dict[str, Any]) -> str:
        """Build SQL for generating embeddings"""
        # Create a string representation of the data for embedding
        concat_fields = " || ' | ' || ".join([f"'{k}: ' || COALESCE(CAST(%({k})s AS TEXT), 'NULL')" 
                                             for k in data.keys()])
        
        return f"""
        ai.ollama_embed(
            'nomic-embed-text',
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

    def process_dataframe(self, df: pd.DataFrame, collection_id: int, table_name: str) -> Dict[str, Any]:
        """Process a DataFrame and store its embeddings"""
        try:
            logger.info(f"Starting to process DataFrame for collection {collection_id}")
            
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
                            embedding_sql = self._build_embedding_sql(row_dict)
                            
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

    def create_document_embeddings_table(self, table_name: str) -> None:
        """Create a table for storing document chunk embeddings"""
        try:
            logger.info(f"Creating document embeddings table: {table_name}")
            
            with self._get_connection() as conn:
                with conn.cursor() as cur:
                    # Check if table exists
                    table_exists_sql = """
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_schema = 'public' 
                        AND table_name = %s
                    );
                    """
                    cur.execute(table_exists_sql, (table_name,))
                    table_exists = cur.fetchone()[0]
                    
                    if not table_exists:
                        # Create table for document chunks
                        create_sql = f"""
                        CREATE TABLE {table_name} (
                            id SERIAL PRIMARY KEY,
                            chunk_index INTEGER,
                            content TEXT NOT NULL,
                            start_char INTEGER,
                            end_char INTEGER,
                            chunking_method TEXT,
                            filename TEXT,
                            file_type TEXT,
                            embedding VECTOR(768),
                            created_at TIMESTAMPTZ DEFAULT NOW(),
                            collection_id INTEGER,
                            metadata JSONB
                        );
                        """
                        cur.execute(create_sql)
                        logger.info(f"Created document embeddings table: {table_name}")
                    else:
                        logger.info(f"Table {table_name} already exists")
                
                conn.commit()
                
        except Exception as e:
            logger.error(f"Error creating document embeddings table {table_name}: {str(e)}", exc_info=True)
            raise

    def process_document_chunks(
        self, 
        df: pd.DataFrame, 
        collection_id: int, 
        table_name: str,
        document_metadata: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """Process document chunks and store their embeddings"""
        try:
            logger.info(f"Starting to process document chunks for collection {collection_id}")
            
            if df.empty:
                raise ValueError("No chunks to process")
            
            # Create the document embeddings table
            self.create_document_embeddings_table(table_name)
            
            total_chunks = len(df)
            processed_chunks = 0
            batch_size = 50  # Smaller batches for document chunks
            
            logger.info(f"Processing {total_chunks} document chunks")
            
            with self._get_connection() as conn:
                cursor = conn.cursor()
                
                for i in range(0, len(df), batch_size):
                    batch = df.iloc[i:i + batch_size]
                    
                    for _, row in batch.iterrows():
                        try:
                            content = str(row.get('content', ''))
                            if not content.strip():
                                logger.warning(f"Skipping empty chunk at index {row.get('chunk_index', 'unknown')}")
                                continue
                            
                            # Build embedding SQL for content only
                            embedding_sql = f"""
                            ai.ollama_embed(
                                'nomic-embed-text',
                                %(content)s,
                                host => '{self.ollama_host}'
                            )
                            """
                            
                            # Prepare insert data
                            insert_data = {
                                'chunk_index': int(row.get('chunk_index', 0)),
                                'content': content,
                                'start_char': int(row.get('start_char', 0)),
                                'end_char': int(row.get('end_char', 0)),
                                'chunking_method': str(row.get('chunking_method', '')),
                                'filename': document_metadata.get('filename', '') if document_metadata else '',
                                'file_type': document_metadata.get('file_type', '') if document_metadata else '',
                                'collection_id': collection_id
                            }
                            
                            insert_sql = f"""
                            INSERT INTO {table_name} (
                                chunk_index, content, start_char, end_char, 
                                chunking_method, filename, file_type, collection_id, embedding
                            ) VALUES (
                                %(chunk_index)s, %(content)s, %(start_char)s, %(end_char)s,
                                %(chunking_method)s, %(filename)s, %(file_type)s, %(collection_id)s,
                                {embedding_sql}
                            )
                            """
                            
                            cursor.execute(insert_sql, insert_data)
                            processed_chunks += 1
                            
                        except Exception as e:
                            logger.error(f"Error processing chunk {row.get('chunk_index', 'unknown')}: {str(e)}")
                            raise
                    
                    conn.commit()
                    logger.info(f"Processed {processed_chunks}/{total_chunks} chunks")
            
            logger.info(f"Successfully processed {processed_chunks}/{total_chunks} chunks for collection {collection_id}")
            return {
                "status": "completed",
                "processed_rows": processed_chunks,
                "total_rows": total_chunks,
                "timestamp": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error in process_document_chunks for collection {collection_id}: {str(e)}", exc_info=True)
            raise
