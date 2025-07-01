
-- Rename the column from landmark_image_url to image_url to match component expectations
ALTER TABLE interactions RENAME COLUMN landmark_image_url TO image_url;
