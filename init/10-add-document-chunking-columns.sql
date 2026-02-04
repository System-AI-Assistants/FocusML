-- Migration to add document chunking support columns to data_collections table
-- Run this to add support for TXT, PDF, DOCX files with chunking

-- Add content_type column (tabular for csv/xlsx, document for txt/pdf/docx)
ALTER TABLE data_collections 
ADD COLUMN IF NOT EXISTS content_type VARCHAR(50) DEFAULT 'tabular';

-- Add chunking_method column (fixed_size, sentence, paragraph, semantic, recursive)
ALTER TABLE data_collections 
ADD COLUMN IF NOT EXISTS chunking_method VARCHAR(50);

-- Add chunking_config column (stores chunk_size, overlap, etc.)
ALTER TABLE data_collections 
ADD COLUMN IF NOT EXISTS chunking_config JSONB;

-- Add document_metadata column (stores word_count, page_count, etc.)
ALTER TABLE data_collections 
ADD COLUMN IF NOT EXISTS document_metadata JSONB;

-- Update existing records to have content_type based on file_type
UPDATE data_collections 
SET content_type = CASE 
    WHEN file_type IN ('txt', 'pdf', 'docx') THEN 'document'
    ELSE 'tabular'
END
WHERE content_type IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN data_collections.content_type IS 'Type of content: tabular (csv/xlsx) or document (txt/pdf/docx)';
COMMENT ON COLUMN data_collections.chunking_method IS 'Chunking method used: fixed_size, sentence, paragraph, semantic, recursive';
COMMENT ON COLUMN data_collections.chunking_config IS 'JSON config for chunking (chunk_size, overlap, etc.)';
COMMENT ON COLUMN data_collections.document_metadata IS 'Document metadata (word_count, page_count, char_count, etc.)';
