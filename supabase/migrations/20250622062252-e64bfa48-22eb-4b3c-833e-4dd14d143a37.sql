
-- Remove the redundant data_collection and analysis_results fields
ALTER TABLE public.interactions 
DROP COLUMN data_collection,
DROP COLUMN analysis_results;

-- Drop the indexes for these fields as well
DROP INDEX IF EXISTS idx_interactions_data_collection;
DROP INDEX IF EXISTS idx_interactions_analysis_results;
