-- Migration: Add end_date to events table for archiving functionality

-- Add end_date column to events table
ALTER TABLE events ADD COLUMN end_date DATE;

-- Update existing events to have end_date same as event_date (can be adjusted later)
UPDATE events SET end_date = event_date WHERE end_date IS NULL;

-- Make end_date required for future events
ALTER TABLE events ALTER COLUMN end_date SET NOT NULL;
