-- Add logo_width setting to app_config
ALTER TABLE app_config 
ADD COLUMN IF NOT EXISTS logo_width INTEGER DEFAULT 200;
