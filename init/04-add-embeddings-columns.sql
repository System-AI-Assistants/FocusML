-- Add columns for tracking embeddings status
ALTER TABLE data_collections 
ADD COLUMN IF NOT EXISTS embeddings_status VARCHAR(50) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS embeddings_metadata JSONB DEFAULT '{}'::jsonb;
