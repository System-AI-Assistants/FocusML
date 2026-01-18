-- Add owner and group_id columns to data_collections for RBAC
ALTER TABLE data_collections
ADD COLUMN IF NOT EXISTS owner VARCHAR(255) NULL;

ALTER TABLE data_collections
ADD COLUMN IF NOT EXISTS group_id INTEGER NULL;

-- Add foreign key constraint for group_id
ALTER TABLE data_collections
ADD CONSTRAINT fk_data_collections_group_id
FOREIGN KEY (group_id) REFERENCES groups(id)
ON DELETE SET NULL;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_data_collections_owner ON data_collections (owner);
CREATE INDEX IF NOT EXISTS idx_data_collections_group_id ON data_collections (group_id);
