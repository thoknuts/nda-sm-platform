-- RLS Policies for SM NDA Sign
-- Enable RLS on all tables

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE guests_phone_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE crew_event_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE crew_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE nda_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE kiosk_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM profiles 
        WHERE user_id = auth.uid() AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user is crew
CREATE OR REPLACE FUNCTION is_crew()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM profiles 
        WHERE user_id = auth.uid() AND role = 'crew'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if crew has access to event
CREATE OR REPLACE FUNCTION crew_has_event_access(p_event_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM crew_event_access 
        WHERE crew_user_id = auth.uid() AND event_id = p_event_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- PROFILES POLICIES
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admin can view all profiles" ON profiles
    FOR SELECT USING (is_admin());

CREATE POLICY "Admin can manage profiles" ON profiles
    FOR ALL USING (is_admin());

CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = user_id);

-- GUESTS POLICIES (sensitive - mostly via edge functions)
CREATE POLICY "Admin can manage guests" ON guests
    FOR ALL USING (is_admin());

CREATE POLICY "Crew can view guests for assigned events" ON guests
    FOR SELECT USING (
        is_crew() AND EXISTS (
            SELECT 1 FROM event_guests eg
            JOIN crew_event_access cea ON cea.event_id = eg.event_id
            WHERE cea.crew_user_id = auth.uid() AND eg.phone = guests.phone
        )
    );

-- GUESTS_PHONE_HISTORY POLICIES
CREATE POLICY "Admin can view phone history" ON guests_phone_history
    FOR SELECT USING (is_admin());

CREATE POLICY "Admin can insert phone history" ON guests_phone_history
    FOR INSERT WITH CHECK (is_admin());

-- EVENTS POLICIES
CREATE POLICY "Admin can manage events" ON events
    FOR ALL USING (is_admin());

CREATE POLICY "Crew can view assigned events" ON events
    FOR SELECT USING (
        is_crew() AND crew_has_event_access(id)
    );

-- EVENT_GUESTS POLICIES
CREATE POLICY "Admin can manage event guests" ON event_guests
    FOR ALL USING (is_admin());

CREATE POLICY "Crew can view event guests for assigned events" ON event_guests
    FOR SELECT USING (
        is_crew() AND crew_has_event_access(event_id)
    );

-- CREW_EVENT_ACCESS POLICIES
CREATE POLICY "Admin can manage crew event access" ON crew_event_access
    FOR ALL USING (is_admin());

CREATE POLICY "Crew can view own event access" ON crew_event_access
    FOR SELECT USING (auth.uid() = crew_user_id);

-- CREW_INVITES POLICIES
CREATE POLICY "Admin can manage crew invites" ON crew_invites
    FOR ALL USING (is_admin());

-- APP_CONFIG POLICIES
CREATE POLICY "Admin can manage app config" ON app_config
    FOR ALL USING (is_admin());

CREATE POLICY "Crew can view app config" ON app_config
    FOR SELECT USING (is_crew());

-- NDA_SIGNATURES POLICIES
CREATE POLICY "Admin can manage signatures" ON nda_signatures
    FOR ALL USING (is_admin());

CREATE POLICY "Crew can view signatures for assigned events" ON nda_signatures
    FOR SELECT USING (
        is_crew() AND crew_has_event_access(event_id)
    );

CREATE POLICY "Crew can verify signatures for assigned events" ON nda_signatures
    FOR UPDATE USING (
        is_crew() AND 
        crew_has_event_access(event_id) AND
        verified_at IS NULL
    )
    WITH CHECK (
        verified_by = auth.uid() AND
        verified_at IS NOT NULL
    );

-- KIOSK_SESSIONS POLICIES
CREATE POLICY "Admin can manage kiosk sessions" ON kiosk_sessions
    FOR ALL USING (is_admin());

CREATE POLICY "Crew can manage own kiosk sessions for assigned events" ON kiosk_sessions
    FOR ALL USING (
        is_crew() AND 
        crew_user_id = auth.uid() AND
        crew_has_event_access(event_id)
    );

-- AUDIT_LOG POLICIES
CREATE POLICY "Admin can view audit log" ON audit_log
    FOR SELECT USING (is_admin());

CREATE POLICY "Service role can insert audit log" ON audit_log
    FOR INSERT WITH CHECK (true);
