-- Create data_collections table
CREATE TABLE IF NOT EXISTS data_collections (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    table_name VARCHAR(255) NOT NULL,
    owner_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    embeddings_status VARCHAR(50) DEFAULT 'pending',
    embeddings_progress FLOAT DEFAULT 0,
    total_documents INTEGER DEFAULT 0,
    processed_documents INTEGER DEFAULT 0,
    config JSONB
);

-- Create an index on the table_name for faster lookups
CREATE INDEX IF NOT EXISTS idx_data_collections_table_name ON data_collections (table_name);

-- Create an index on the owner_id for faster filtering by owner
CREATE INDEX IF NOT EXISTS idx_data_collections_owner_id ON data_collections (owner_id);

-- Add a trigger to update the updated_at timestamp on row update
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'update_data_collections_updated_at'
    ) THEN
        CREATE TRIGGER update_data_collections_updated_at
        BEFORE UPDATE ON data_collections
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;
