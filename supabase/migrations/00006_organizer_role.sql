-- Migration: Add Organizer role
-- Organizer can create events, manage guestlists for own events, and assign crew to own events

-- Add 'organizer' to user_role enum
ALTER TYPE user_role ADD VALUE 'organizer';

-- Add created_by column to events table to track who created the event
ALTER TABLE events ADD COLUMN created_by UUID REFERENCES auth.users(id);

-- Helper function to check if user is organizer
CREATE OR REPLACE FUNCTION is_organizer()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM profiles 
        WHERE user_id = auth.uid() AND role = 'organizer'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if organizer owns the event
CREATE OR REPLACE FUNCTION organizer_owns_event(p_event_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM events 
        WHERE id = p_event_id AND created_by = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update is_crew to also return true for organizer (organizers have crew capabilities)
CREATE OR REPLACE FUNCTION is_crew()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM profiles 
        WHERE user_id = auth.uid() AND role IN ('crew', 'organizer')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- EVENTS POLICIES for Organizer
CREATE POLICY "Organizer can create events" ON events
    FOR INSERT WITH CHECK (is_organizer() AND created_by = auth.uid());

CREATE POLICY "Organizer can view own events" ON events
    FOR SELECT USING (is_organizer() AND created_by = auth.uid());

CREATE POLICY "Organizer can update own events" ON events
    FOR UPDATE USING (is_organizer() AND created_by = auth.uid());

CREATE POLICY "Organizer can delete own events" ON events
    FOR DELETE USING (is_organizer() AND created_by = auth.uid());

-- EVENT_GUESTS POLICIES for Organizer
CREATE POLICY "Organizer can manage event guests for own events" ON event_guests
    FOR ALL USING (is_organizer() AND organizer_owns_event(event_id));

-- CREW_EVENT_ACCESS POLICIES for Organizer (can assign crew to own events)
CREATE POLICY "Organizer can manage crew access for own events" ON crew_event_access
    FOR ALL USING (is_organizer() AND organizer_owns_event(event_id));

-- NDA_SIGNATURES POLICIES for Organizer
CREATE POLICY "Organizer can view signatures for own events" ON nda_signatures
    FOR SELECT USING (is_organizer() AND organizer_owns_event(event_id));

CREATE POLICY "Organizer can verify signatures for own events" ON nda_signatures
    FOR UPDATE USING (
        is_organizer() AND 
        organizer_owns_event(event_id) AND
        verified_at IS NULL
    )
    WITH CHECK (
        verified_by = auth.uid() AND
        verified_at IS NOT NULL
    );

-- KIOSK_SESSIONS POLICIES for Organizer
CREATE POLICY "Organizer can manage kiosk sessions for own events" ON kiosk_sessions
    FOR ALL USING (
        is_organizer() AND 
        crew_user_id = auth.uid() AND
        organizer_owns_event(event_id)
    );

-- GUESTS POLICIES for Organizer (can view guests for own events)
CREATE POLICY "Organizer can view guests for own events" ON guests
    FOR SELECT USING (
        is_organizer() AND EXISTS (
            SELECT 1 FROM event_guests eg
            WHERE organizer_owns_event(eg.event_id) AND eg.phone = guests.phone
        )
    );

-- APP_CONFIG POLICIES for Organizer
CREATE POLICY "Organizer can view app config" ON app_config
    FOR SELECT USING (is_organizer());

-- PROFILES POLICIES for Organizer (can view crew profiles for assignment)
CREATE POLICY "Organizer can view crew profiles" ON profiles
    FOR SELECT USING (is_organizer() AND role = 'crew');

-- Fix: Allow crew to view guests via nda_signatures for their assigned events
-- This is needed for the attestation page to show guest names
CREATE POLICY "Crew can view guests via signatures" ON guests
    FOR SELECT USING (
        is_crew() AND EXISTS (
            SELECT 1 FROM nda_signatures ns
            JOIN crew_event_access cea ON cea.event_id = ns.event_id
            WHERE cea.crew_user_id = auth.uid() AND ns.guest_id = guests.id
        )
    );
