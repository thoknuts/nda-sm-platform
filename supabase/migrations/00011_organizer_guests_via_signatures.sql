-- Migration: Allow organizers to view guests via nda_signatures for their own events

-- This policy allows organizers to see guest data when viewing signatures
CREATE POLICY "Organizer can view guests via signatures" ON guests
    FOR SELECT USING (
        is_organizer() AND EXISTS (
            SELECT 1 FROM nda_signatures ns
            WHERE organizer_owns_event(ns.event_id) AND ns.guest_id = guests.id
        )
    );
