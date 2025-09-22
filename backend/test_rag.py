import pandas as pd
import psycopg2
from sqlalchemy import create_engine, Table, Column, Integer, Text, MetaData

mirfa = pd.read_excel('test_files/Mirfa -WaterLoggers.xlsx')

mirfa.info()


def connect_db():
    return psycopg2.connect(  # use the credentials of your postgresql database
        host='localhost',
        database='postgres',
        user='postgres',
        password='password',
        port='5433'
    )


def create_table_from_df(df: pd.DataFrame, table_name: str = "documents"):
    with connect_db() as conn:
        with conn.cursor() as cur:
            # Start with ID column
            sql = f"CREATE TABLE IF NOT EXISTS {table_name} (id SERIAL PRIMARY KEY"

            # Add columns based on DataFrame
            for col in df.columns:
                sql += f", {col} TEXT"

            # Add embedding column (TimescaleDB VECTOR)
            sql += ", embedding VECTOR(768));"

            cur.execute(sql)
        conn.commit()


def build_embedding_sql(data: dict):
    """
Returns SQL snippet for embedding using Ollama.
Concatenates all text fields with ' - ' and calls ollama_embed.
    """
    concat_fields = " || ', ' || ".join([f"'{k}=' || %({k})s" for k in data.keys()])
    return f"ai.ollama_embed('nomic-embed-text', {concat_fields}, host=>'http://host.docker.internal:11434')"


def insert_df_with_embeddings(df: pd.DataFrame, table_name: str = "documents"):
    conn = connect_db()
    cur = conn.cursor()

    for _, row in df.iterrows():
        data = row.to_dict()
        columns_str = ', '.join(data.keys())
        embedding_sql = build_embedding_sql(data)

        sql = f"""
            INSERT INTO {table_name} ({columns_str}, embedding)
            VALUES ({', '.join([f"%({k})s" for k in data.keys()])}, {embedding_sql});
            """

        # VALUES ({', '.join([f"%({k})s" for k in data.keys()])}, {embedding_sql});
        # """

        cur.execute(sql, data)
        conn.commit()

    cur.close()
    conn.close()


def retrieve_and_generate_response(
    query: str,
    table_name: str = "documents",
    top_k: int = 3,
    model: str = "mistral:7b",
    embedding_model: str = "nomic-embed-text"
):
    """
    Retrieve top-k relevant rows from a table (all columns except embeddings) and generate
    a response using the specified Ollama model.

    Parameters:
    - query: the user's query
    - table_name: the table to search
    - top_k: number of relevant documents to retrieve
    - model: Ollama model to generate the response
    - embedding_model: Ollama embedding model to embed the query
    """
    with connect_db() as conn:
        with conn.cursor() as cur:
            # 1️⃣ Get column names dynamically (excluding embedding)
            cur.execute(f"""
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = %s
                  AND column_name != 'embedding'
                ORDER BY ordinal_position;
            """, (table_name,))
            columns = [row[0] for row in cur.fetchall()]
            if not columns:
                raise ValueError(f"No columns found in table {table_name} besides embedding")

            columns_str = ", ".join(columns)

            # 2️⃣ Embed the query
            cur.execute("""
                SELECT ai.ollama_embed(
                        %s::text,
                        %s::text,
                        host=>'http://host.docker.internal:11434'::text
                );
            """, (embedding_model, query))
            query_embedding = cur.fetchone()[0]

            # 3️⃣ Retrieve top-k relevant rows based on cosine similarity
            cur.execute(f"""
                SELECT {columns_str}, 1 - (embedding <=> %s) AS similarity
                FROM {table_name}
                ORDER BY similarity DESC
                LIMIT %s;
            """, (query_embedding, top_k))

            rows = cur.fetchall()
            if not rows:
                return {"rows": [], "response": "No relevant documents found."}

            # 4️⃣ Prepare context for generation
            context_lines = []
            for row in rows:
                # Pair column names and values: col=value
                context_lines.append(", ".join(f"{col}={val}" for col, val in zip(columns, row[:-1])))
            context = "\n\n".join(context_lines)

            # 5️⃣ Generate response
            prompt = f"Query: {query}\nContext:\n{context}"
            cur.execute("""
                SELECT ai.ollama_generate(
                        %s::text,
                        %s::text,
                        host=>'http://host.docker.internal:11434'::text
                );
            """, (model, prompt))
            model_response = cur.fetchone()[0]

            # 6️⃣ Return both the retrieved rows (as list of dicts) and model response
            results = [dict(zip(columns, row[:-1])) for row in rows]
            return {"rows": results, "response": model_response['response']}


# create_table_from_df(mirfa)
# insert_df_with_embeddings(mirfa)
query = "When was the TEMP1 = 999"
response = retrieve_and_generate_response(query, top_k=3, model="mistral:7b")
print(response)