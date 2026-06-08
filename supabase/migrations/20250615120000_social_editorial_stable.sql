-- Social editorial stabilization: separate planned date from actual publish timestamp
ALTER TABLE conteudos
  ADD COLUMN IF NOT EXISTS data_publicada_em timestamptz;

COMMENT ON COLUMN conteudos.data_publicacao IS 'Planned editorial date';
COMMENT ON COLUMN conteudos.data_publicada_em IS 'Actual publish timestamp when status becomes publicado';
