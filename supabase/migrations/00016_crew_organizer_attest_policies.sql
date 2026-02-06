-- Allow Crew to delete signatures for assigned events
CREATE POLICY "Crew can delete signatures for assigned events" ON nda_signatures
    FOR DELETE USING (
        is_crew() AND crew_has_event_access(event_id)
    );

-- Allow Crew to update event_guests status for assigned events
CREATE POLICY "Crew can update event guests for assigned events" ON event_guests
    FOR UPDATE USING (
        is_crew() AND crew_has_event_access(event_id)
    );

-- Allow Organizer to delete signatures for own events
CREATE POLICY "Organizer can delete signatures for own events" ON nda_signatures
    FOR DELETE USING (
        is_organizer() AND organizer_owns_event(event_id)
    );
