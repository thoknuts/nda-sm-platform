-- Migration: Fix foreign key constraints to allow user deletion
-- Change constraints to SET NULL instead of blocking deletion

-- crew_invites.created_by - set to NULL when user is deleted
ALTER TABLE crew_invites 
DROP CONSTRAINT IF EXISTS crew_invites_created_by_fkey;

ALTER TABLE crew_invites 
ADD CONSTRAINT crew_invites_created_by_fkey 
FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- Make created_by nullable
ALTER TABLE crew_invites 
ALTER COLUMN created_by DROP NOT NULL;

-- crew_invites.used_by - set to NULL when user is deleted
ALTER TABLE crew_invites 
DROP CONSTRAINT IF EXISTS crew_invites_used_by_fkey;

ALTER TABLE crew_invites 
ADD CONSTRAINT crew_invites_used_by_fkey 
FOREIGN KEY (used_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- nda_signatures.verified_by - set to NULL when user is deleted
ALTER TABLE nda_signatures 
DROP CONSTRAINT IF EXISTS nda_signatures_verified_by_fkey;

ALTER TABLE nda_signatures 
ADD CONSTRAINT nda_signatures_verified_by_fkey 
FOREIGN KEY (verified_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- audit_log.actor_user_id - set to NULL when user is deleted
ALTER TABLE audit_log 
DROP CONSTRAINT IF EXISTS audit_log_actor_user_id_fkey;

ALTER TABLE audit_log 
ADD CONSTRAINT audit_log_actor_user_id_fkey 
FOREIGN KEY (actor_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
