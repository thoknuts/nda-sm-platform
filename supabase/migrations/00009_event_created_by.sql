-- Migration: Add created_by to events for organizer ownership

-- Add created_by column to track who created the event
ALTER TABLE events ADD COLUMN created_by UUID REFERENCES auth.users(id);

-- Update existing events to be owned by the first admin (or leave null)
-- This is optional - existing events will have no owner
