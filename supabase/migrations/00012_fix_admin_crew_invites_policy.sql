-- Migration: Fix admin access to all crew invites
-- Ensure all admins can manage ALL crew invites, not just their own

-- Drop the conflicting policies if they exist
DROP POLICY IF EXISTS "Admin can manage crew invites" ON crew_invites;
DROP POLICY IF EXISTS "Organizers can insert crew invites" ON crew_invites;
DROP POLICY IF EXISTS "Organizers can read own crew invites" ON crew_invites;
DROP POLICY IF EXISTS "Organizers can update own crew invites" ON crew_invites;
DROP POLICY IF EXISTS "Organizers can delete own crew invites" ON crew_invites;

-- Create new unified policies

-- Admin has full access to ALL crew invites
CREATE POLICY "Admin full access to crew invites"
ON crew_invites
FOR ALL
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

-- Organizers can insert their own crew invites
CREATE POLICY "Organizers can insert own crew invites"
ON crew_invites
FOR INSERT
TO authenticated
WITH CHECK (
  is_organizer() AND auth.uid() = created_by
);

-- Organizers can read their own crew invites
CREATE POLICY "Organizers can read own crew invites"
ON crew_invites
FOR SELECT
TO authenticated
USING (
  is_organizer() AND created_by = auth.uid()
);

-- Organizers can update their own crew invites
CREATE POLICY "Organizers can update own crew invites"
ON crew_invites
FOR UPDATE
TO authenticated
USING (
  is_organizer() AND created_by = auth.uid()
);

-- Organizers can delete their own crew invites
CREATE POLICY "Organizers can delete own crew invites"
ON crew_invites
FOR DELETE
TO authenticated
USING (
  is_organizer() AND created_by = auth.uid()
);
