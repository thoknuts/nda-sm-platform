-- Migration: Add guest_status field to event_guests table
-- This is for categorizing guests (VIP, Regular, etc.)

ALTER TABLE event_guests 
ADD COLUMN guest_status TEXT DEFAULT 'Regular';
