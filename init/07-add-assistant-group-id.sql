-- Add group_id column to assistants table for RBAC
-- Assistants can optionally belong to a group, allowing group members to access them

ALTER TABLE assistants 
ADD COLUMN IF NOT EXISTS group_id INTEGER REFERENCES groups(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_assistants_group_id ON assistants(group_id);
CREATE INDEX IF NOT EXISTS idx_assistants_owner ON assistants(owner);
