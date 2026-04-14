-- ON-10: Full-text search across document vault contents
-- Adds extracted_text + generated tsvector column + GIN index

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS extracted_text text,
  ADD COLUMN IF NOT EXISTS extracted_text_tsv tsvector
    GENERATED ALWAYS AS (to_tsvector('english', coalesce(extracted_text, ''))) STORED;

CREATE INDEX IF NOT EXISTS idx_documents_extracted_text_tsv
  ON documents USING gin(extracted_text_tsv);
