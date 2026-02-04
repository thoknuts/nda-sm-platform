-- Migration: Allow organizers to create and manage their own crew invites

-- Allow organizers to insert crew invites
CREATE POLICY "Organizers can insert crew invites"
ON crew_invites
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = created_by
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role IN ('admin', 'organizer')
  )
);

-- Allow organizers to read their own crew invites
CREATE POLICY "Organizers can read own crew invites"
ON crew_invites
FOR SELECT
TO authenticated
USING (
  created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Allow organizers to update their own crew invites (for revoking)
CREATE POLICY "Organizers can update own crew invites"
ON crew_invites
FOR UPDATE
TO authenticated
USING (
  created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Allow organizers to delete their own crew invites
CREATE POLICY "Organizers can delete own crew invites"
ON crew_invites
FOR DELETE
TO authenticated
USING (
  created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role = 'admin'
  )
);
