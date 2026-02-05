-- Add embedding_model_id column to data_collections table
ALTER TABLE data_collections 
ADD COLUMN IF NOT EXISTS embedding_model_id INTEGER REFERENCES models(id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_data_collections_embedding_model_id 
ON data_collections(embedding_model_id);
