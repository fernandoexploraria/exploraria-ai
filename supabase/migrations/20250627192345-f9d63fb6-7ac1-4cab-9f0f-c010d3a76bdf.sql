
-- Phase 1: Database Schema Enhancement (Fixed - No trigram operators)
-- Add destination_details JSONB column to generated_tours table
ALTER TABLE public.generated_tours 
ADD COLUMN destination_details JSONB;

-- Add standard GIN index for the entire destination_details JSONB
CREATE INDEX idx_generated_tours_destination_details_gin 
ON public.generated_tours USING GIN (destination_details);

-- Add B-tree index for exact placeId matches (more efficient for equality)
CREATE INDEX idx_generated_tours_destination_place_id_btree 
ON public.generated_tours USING BTREE ((destination_details->>'placeId'));

-- Add a check constraint to ensure destination_details has required structure when present
ALTER TABLE public.generated_tours 
ADD CONSTRAINT check_destination_details_structure 
CHECK (
  destination_details IS NULL OR 
  (
    destination_details ? 'placeId' AND
    jsonb_typeof(destination_details->'placeId') = 'string'
  )
);
