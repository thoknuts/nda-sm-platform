-- Add guest_type column to event_guests
CREATE TYPE guest_type AS ENUM ('par', 'single_mann', 'single_kvinne', 'vip');

ALTER TABLE event_guests ADD COLUMN guest_type guest_type;
