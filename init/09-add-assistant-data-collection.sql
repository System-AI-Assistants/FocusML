-- Add data_collection_id column to assistants table
ALTER TABLE assistants
ADD COLUMN IF NOT EXISTS data_collection_id INTEGER NULL;

-- Add foreign key constraint
ALTER TABLE assistants
ADD CONSTRAINT fk_assistants_data_collection_id
FOREIGN KEY (data_collection_id) REFERENCES data_collections(id)
ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_assistants_data_collection_id ON assistants (data_collection_id);
