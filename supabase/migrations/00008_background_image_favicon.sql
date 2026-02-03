-- Migration: Add background image and favicon to app_config

-- Add background_image_url column for cover background image
ALTER TABLE app_config ADD COLUMN background_image_url TEXT;

-- Add favicon_url column for custom favicon
ALTER TABLE app_config ADD COLUMN favicon_url TEXT;
