-- Allow & character in sm_username
-- This migration updates the CHECK constraints to allow ampersand (&) in usernames

-- Drop and recreate the constraint on profiles table
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS sm_username_format;
ALTER TABLE profiles ADD CONSTRAINT sm_username_format CHECK (
    sm_username ~ '^[a-z&][a-z0-9._&-]{2,31}$' AND
    sm_username !~ '\.\.' AND
    sm_username !~ '--' AND
    sm_username !~ '__' AND
    sm_username !~ '&&' AND
    sm_username !~ '[._&-]$'
);

-- Drop and recreate the constraint on event_guests table
ALTER TABLE event_guests DROP CONSTRAINT IF EXISTS sm_username_format;
ALTER TABLE event_guests ADD CONSTRAINT sm_username_format CHECK (
    sm_username ~ '^[a-z&][a-z0-9._&-]{2,31}$' AND
    sm_username !~ '\.\.' AND
    sm_username !~ '--' AND
    sm_username !~ '__' AND
    sm_username !~ '&&' AND
    sm_username !~ '[._&-]$'
);
